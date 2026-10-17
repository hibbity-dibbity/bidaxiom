import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { AuditAction } from "@construction/shared";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { createAuditLog } from "../../audit/logger.js";
import { syncDuePrompts, type PromptAction } from "../../services/projectAutomation.js";
import { projectRouter } from "./project.js";

/**
 * "Needs your attention": questions the system raises about a project (send the deposit invoice,
 * mark it Active, mark it Closed) that the person answers with one click. The answer does the work.
 */
export const attentionRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    try { await syncDuePrompts(ctx.tenant); } catch (e) { console.error("[attention] due check failed", e); }
    const rows = await db
      .select({
        id: schema.actionPrompts.id,
        projectId: schema.actionPrompts.projectId,
        kind: schema.actionPrompts.kind,
        title: schema.actionPrompts.title,
        body: schema.actionPrompts.body,
        actions: schema.actionPrompts.actions,
        createdAt: schema.actionPrompts.createdAt,
        projectName: schema.projects.name,
        projectSlug: schema.projects.slug,
        jobNumber: schema.projects.jobNumber,
      })
      .from(schema.actionPrompts)
      .leftJoin(schema.projects, eq(schema.actionPrompts.projectId, schema.projects.id))
      .where(eq(schema.actionPrompts.status, "open"))
      .orderBy(desc(schema.actionPrompts.createdAt))
      .limit(100);
    if (ctx.orgRole === "org:admin") return rows;
    const mine = await db.select({ projectId: schema.projectTeamMembers.projectId }).from(schema.projectTeamMembers).where(eq(schema.projectTeamMembers.userId, ctx.userId));
    const ok = new Set(mine.map((m) => m.projectId));
    return rows.filter((r) => (r.projectId && ok.has(r.projectId)) || (r.kind === "qbo_deposit" && ctx.orgRole === "org:project_manager"));
  }),

  /** Take one of a prompt's actions (the index into its actions list). */
  act: protectedProcedure
    .input(z.object({ id: z.string().uuid(), index: z.number().int().min(0).max(10), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      const { db, schema } = ctx.tenant;
      const [prompt] = await db.select().from(schema.actionPrompts).where(eq(schema.actionPrompts.id, input.id)).limit(1);
      if (!prompt) throw new TRPCError({ code: "NOT_FOUND", message: "That item is gone." });
      if (prompt.status !== "open") return { done: true, already: true };
      const action = (prompt.actions as unknown as PromptAction[])[input.index];
      if (!action) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown action." });

      const finish = async (status: "done" | "dismissed", resolution: string) => {
        await db.update(schema.actionPrompts).set({ status, resolution, resolvedAt: new Date(), resolvedBy: ctx.userId! }).where(eq(schema.actionPrompts.id, prompt.id));
        return { done: true, already: false };
      };

      if (action.kind === "dismiss") return finish("dismissed", action.label);

      if (action.kind === "phase") {
        if (!prompt.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "No project." });
        // The same permission rules as changing the status by hand.
        await projectRouter.createCaller(ctx).transitionLifecyclePhase({ projectId: prompt.projectId, toPhase: action.phase, reason: "Confirmed from a notification" });
        return finish("done", action.label);
      }

      if (action.kind === "set_start_date") {
        if (!prompt.projectId || !input.startDate) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a start date." });
        const isAdmin = ctx.orgRole === "org:admin";
        const team = await db.select({ role: schema.projectTeamMembers.role }).from(schema.projectTeamMembers).where(and(eq(schema.projectTeamMembers.projectId, prompt.projectId), eq(schema.projectTeamMembers.userId, ctx.userId)));
        if (!isAdmin && !team.some((m) => ["project_manager", "project_administrator", "estimator"].includes(m.role))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only an admin, project manager, estimator or project administrator can change the start date." });
        }
        const [before] = await db.select({ startDate: schema.projects.startDate }).from(schema.projects).where(eq(schema.projects.id, prompt.projectId)).limit(1);
        await db.update(schema.projects).set({ startDate: new Date(`${input.startDate}T12:00:00`), updatedAt: new Date() }).where(eq(schema.projects.id, prompt.projectId));
        await createAuditLog(db, schema, {
          entityType: "Project", entityId: prompt.projectId, action: AuditAction.UPDATE, actorId: ctx.userId,
          changes: { before: { startDate: before?.startDate ?? null }, after: { startDate: input.startDate } },
          metadata: { source: "notification" },
        });
        return finish("done", `Start date changed to ${input.startDate}`);
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "That action is done from the page." });
    }),
});
