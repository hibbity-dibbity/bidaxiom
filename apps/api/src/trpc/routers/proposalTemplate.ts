import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { AuditAction } from "@construction/shared";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { createAuditLog } from "../../audit/logger.js";
import type { RequestTenantContext } from "../../tenant/context.js";
import { STARTER_TEMPLATES } from "../../services/proposalTemplateStarters.js";

/**
 * Proposal templates: a reusable parent line with its child lines. Several can be added to one proposal
 * (each arrives as its own group), alongside manually typed lines.
 */

const MANAGE_ROLES = new Set(["org:admin", "org:project_manager", "org:estimator"]);

const lineSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  type: z.enum(["labor", "material", "subcontractor", "equipment", "other"]),
  name: z.string().min(1).max(300),
  quantity: z.number().min(0).max(1e9),
  unit: z.string().min(1).max(20),
  unitCost: z.number().min(0).max(1e9),
  marginPercent: z.number().min(0).lt(100),
  contingencyPercent: z.number().min(0).max(1000).default(0),
  notes: z.string().max(5000).nullable().optional(),
  visibility: z.enum(["price", "name_only", "hidden"]),
});

/** One parent, any number of children pointing at it. */
function groupError(lines: Array<z.infer<typeof lineSchema>>): string | null {
  const parents = lines.filter((l) => !l.parentId);
  if (parents.length !== 1) return "A template is one group: one parent line and its child lines.";
  if (lines.some((l) => l.parentId && l.parentId !== parents[0]!.id)) return "Every child line must belong to the parent line.";
  return null;
}

async function requireUse(ctx: { tenant: RequestTenantContext; userId: string; orgRole: string | null }) {
  const memberships = await ctx.tenant.db
    .select({ projectId: ctx.tenant.schema.projectTeamMembers.projectId, role: ctx.tenant.schema.projectTeamMembers.role })
    .from(ctx.tenant.schema.projectTeamMembers)
    .where(eq(ctx.tenant.schema.projectTeamMembers.userId, ctx.userId));
  ForbiddenError.from(defineAbilitiesFor(ctx.orgRole ?? "org:member", ctx.userId, memberships)).throwUnlessCan("update", "Estimate");
}

function requireManage(orgRole: string | null) {
  if (!MANAGE_ROLES.has(orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators, project managers and estimators can change templates." });
}

const need = (ctx: { tenant?: RequestTenantContext | null; userId?: string | null; orgRole?: string | null }) => {
  if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
  return { tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole ?? null };
};

export const proposalTemplateRouter = router({
  /** Every template, with its parent name and how many lines it has. */
  list: protectedProcedure.query(async ({ ctx: raw }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    const { db, schema } = ctx.tenant;
    const templates = await db.select().from(schema.proposalTemplates).orderBy(asc(schema.proposalTemplates.name));
    const lines = await db.select().from(schema.proposalTemplateLines).orderBy(asc(schema.proposalTemplateLines.sortOrder));
    return templates.map((t) => {
      const mine = lines.filter((l) => l.templateId === t.id);
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        updatedAt: t.updatedAt,
        childCount: mine.filter((l) => l.parentId).length,
        // What the customer would read under the parent: the name-only lines.
        preview: mine.filter((l) => l.parentId && l.visibility === "name_only").map((l) => l.name),
      };
    });
  }),

  /** The lines of one or more templates, ready to drop into the proposal builder. */
  getMany: protectedProcedure.input(z.object({ ids: z.array(z.string().uuid()).min(1).max(20) })).query(async ({ ctx: raw, input }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    const { db, schema } = ctx.tenant;
    const out = [];
    for (const id of input.ids) {
      const [t] = await db.select().from(schema.proposalTemplates).where(eq(schema.proposalTemplates.id, id)).limit(1);
      if (!t) continue;
      const lines = await db.select().from(schema.proposalTemplateLines).where(eq(schema.proposalTemplateLines.templateId, id)).orderBy(asc(schema.proposalTemplateLines.sortOrder));
      out.push({
        id: t.id,
        name: t.name,
        lines: lines.map((l) => ({
          id: l.id,
          parentId: l.parentId,
          type: l.type as z.infer<typeof lineSchema>["type"],
          name: l.name,
          quantity: Number(l.quantity),
          unit: l.unit,
          unitCost: Number(l.unitCost),
          marginPercent: Number(l.marginPercent),
          contingencyPercent: Number(l.contingencyPercent),
          notes: l.notes ?? "",
          visibility: l.visibility as z.infer<typeof lineSchema>["visibility"],
        })),
      });
    }
    return out;
  }),

  /** Save a proposal group as a template. A template with the same name is replaced. */
  save: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(1000).nullable().optional(), lines: z.array(lineSchema).min(1).max(200) }))
    .mutation(async ({ ctx: raw, input }) => {
      const ctx = need(raw);
      await requireUse(ctx);
      requireManage(ctx.orgRole);
      const err = groupError(input.lines);
      if (err) throw new TRPCError({ code: "BAD_REQUEST", message: err });
      const { db, schema } = ctx.tenant;
      const [same] = await db.select().from(schema.proposalTemplates).where(sql`lower(${schema.proposalTemplates.name}) = lower(${input.name})`).limit(1);
      const id = await db.transaction(async (tx) => {
        let templateId = same?.id;
        if (same) {
          await tx.update(schema.proposalTemplates).set({ name: input.name, description: input.description ?? same.description, updatedAt: new Date() }).where(eq(schema.proposalTemplates.id, same.id));
          await tx.delete(schema.proposalTemplateLines).where(eq(schema.proposalTemplateLines.templateId, same.id));
        } else {
          const [t] = await tx.insert(schema.proposalTemplates).values({ name: input.name, description: input.description ?? null, createdBy: ctx.userId }).returning({ id: schema.proposalTemplates.id });
          templateId = t!.id;
        }
        // New ids so a template never shares line ids with the proposal it came from.
        const remap = new Map(input.lines.map((l) => [l.id, crypto.randomUUID()]));
        await tx.insert(schema.proposalTemplateLines).values(
          input.lines.map((l, i) => ({
            id: remap.get(l.id)!,
            templateId: templateId!,
            parentId: l.parentId ? remap.get(l.parentId)! : null,
            type: l.type,
            name: l.name,
            quantity: String(l.quantity),
            unit: l.unit,
            unitCost: String(l.unitCost),
            marginPercent: String(l.marginPercent),
            contingencyPercent: String(l.contingencyPercent),
            notes: l.notes ?? null,
            visibility: l.visibility,
            sortOrder: i,
          }))
        );
        return templateId!;
      });
      await createAuditLog(db, schema, { entityType: "ProposalTemplate", entityId: id, action: same ? AuditAction.UPDATE : AuditAction.CREATE, actorId: ctx.userId, changes: { after: { name: input.name, lines: input.lines.length } } });
      return { id, replaced: Boolean(same) };
    }),

  updateDetails: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200), description: z.string().max(1000).nullable() }))
    .mutation(async ({ ctx: raw, input }) => {
      const ctx = need(raw);
      await requireUse(ctx);
      requireManage(ctx.orgRole);
      const { db, schema } = ctx.tenant;
      const [clash] = await db.select({ id: schema.proposalTemplates.id }).from(schema.proposalTemplates).where(sql`lower(${schema.proposalTemplates.name}) = lower(${input.name}) and ${schema.proposalTemplates.id} <> ${input.id}`).limit(1);
      if (clash) throw new TRPCError({ code: "CONFLICT", message: "Another template already has that name." });
      await db.update(schema.proposalTemplates).set({ name: input.name, description: input.description, updatedAt: new Date() }).where(eq(schema.proposalTemplates.id, input.id));
      return { ok: true };
    }),

  remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: raw, input }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    requireManage(ctx.orgRole);
    const { db, schema } = ctx.tenant;
    await db.delete(schema.proposalTemplates).where(eq(schema.proposalTemplates.id, input.id));
    await createAuditLog(db, schema, { entityType: "ProposalTemplate", entityId: input.id, action: AuditAction.DELETE, actorId: ctx.userId, changes: {} });
    return { ok: true };
  }),

  /** Add the starter templates (slab, metal building, insulation). Any that already exist by name are left alone. */
  addStarters: protectedProcedure.mutation(async ({ ctx: raw }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    requireManage(ctx.orgRole);
    const { db, schema } = ctx.tenant;
    const existing = new Set((await db.select({ n: schema.proposalTemplates.name }).from(schema.proposalTemplates)).map((r) => r.n.toLowerCase()));
    const added: string[] = [];
    for (const t of STARTER_TEMPLATES) {
      if (existing.has(t.name.toLowerCase())) continue;
      await db.transaction(async (tx) => {
        const [row] = await tx.insert(schema.proposalTemplates).values({ name: t.name, description: t.description, createdBy: ctx.userId }).returning({ id: schema.proposalTemplates.id });
        const parentId = crypto.randomUUID();
        await tx.insert(schema.proposalTemplateLines).values([
          { id: parentId, templateId: row!.id, parentId: null, type: "other", name: t.parent.name, quantity: "0", unit: "ls", unitCost: "0", marginPercent: "0", contingencyPercent: "0", visibility: "price", sortOrder: 0 },
          ...t.children.map((c, i) => ({
            id: crypto.randomUUID(),
            templateId: row!.id,
            parentId,
            type: c.type,
            name: c.name,
            quantity: String(c.quantity),
            unit: c.unit,
            unitCost: "0",
            marginPercent: "0",
            contingencyPercent: "0",
            visibility: c.visibility,
            sortOrder: i + 1,
          })),
        ]);
      });
      added.push(t.name);
    }
    return { added };
  }),
});
