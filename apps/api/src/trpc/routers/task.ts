import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";

/**
 * Action items on projects, with reminders under the bell and/or by email, and one list across every project.
 *
 * Who sees what: an admin sees every task. Everyone else sees tasks on projects they are on the team of, plus any
 * task they own or created (which also covers general tasks that belong to no project).
 */

type Ctx = {
  tenant: NonNullable<Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>>;
  userId: string;
  orgRole: string | null;
};

function need(ctx: { tenant?: Ctx["tenant"] | null; userId?: string | null; orgRole?: string | null }): Ctx {
  if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
  return { tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole ?? null };
}

const isAdmin = (c: Ctx) => c.orgRole === "org:admin";

async function myProjectIds(c: Ctx): Promise<string[]> {
  const { db, schema } = c.tenant;
  const rows = await db.select({ projectId: schema.projectTeamMembers.projectId }).from(schema.projectTeamMembers).where(eq(schema.projectTeamMembers.userId, c.userId));
  return rows.map((r) => r.projectId);
}

/** SQL condition limiting tasks to the ones this person may see. */
async function visible(c: Ctx): Promise<SQL | undefined> {
  if (isAdmin(c)) return undefined;
  const { schema } = c.tenant;
  const ids = await myProjectIds(c);
  const t = schema.projectTasks;
  return or(eq(t.assigneeId, c.userId), eq(t.createdBy, c.userId), ids.length ? inArray(t.projectId, ids) : sql`false`);
}

async function mayUseProject(c: Ctx, projectId: string) {
  const { db, schema } = c.tenant;
  const [p] = await db.select({ id: schema.projects.id }).from(schema.projects).where(and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt))).limit(1);
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "That project no longer exists." });
  if (isAdmin(c)) return;
  if (!(await myProjectIds(c)).includes(projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "You are not on that project's team." });
}

async function loadVisible(c: Ctx, id: string) {
  const { db, schema } = c.tenant;
  const cond = await visible(c);
  const [row] = await db.select().from(schema.projectTasks).where(cond ? and(eq(schema.projectTasks.id, id), cond) : eq(schema.projectTasks.id, id)).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "That task is gone." });
  return row;
}

async function checkAssignee(c: Ctx, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const { db, schema } = c.tenant;
  const [u] = await db.select({ id: schema.userProfiles.id }).from(schema.userProfiles).where(eq(schema.userProfiles.clerkUserId, assigneeId)).limit(1);
  if (!u) throw new TRPCError({ code: "BAD_REQUEST", message: "That person is not on your team." });
}

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const fields = {
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  notes: z.string().trim().max(4000).nullable().optional(),
  assigneeId: z.string().max(100).nullable().optional(),
  dueDate: dateText.nullable().optional(),
  /** When the reminder fires (an exact moment, worked out in the person's own time zone). */
  remindAt: z.string().datetime().nullable().optional(),
  remindBell: z.boolean().optional(),
  remindEmail: z.boolean().optional(),
};

export const taskRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        /** "me", "all", or a user id. */
        assignee: z.string().max(100).default("all"),
        status: z.enum(["open", "done", "all"]).default("open"),
        search: z.string().max(200).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const c = need(ctx);
      const { db, schema } = c.tenant;
      const t = schema.projectTasks;
      const conds: (SQL | undefined)[] = [await visible(c)];
      if (input.projectId) conds.push(eq(t.projectId, input.projectId));
      if (input.status !== "all") conds.push(eq(t.status, input.status));
      if (input.assignee === "me") conds.push(eq(t.assigneeId, c.userId));
      else if (input.assignee === "unassigned") conds.push(isNull(t.assigneeId));
      else if (input.assignee !== "all") conds.push(eq(t.assigneeId, input.assignee));
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conds.push(or(ilike(t.title, q), ilike(t.notes, q), ilike(schema.projects.name, q), ilike(schema.projects.jobNumber, q)));
      }
      const rows = await db
        .select({
          id: t.id,
          projectId: t.projectId,
          title: t.title,
          notes: t.notes,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate,
          status: t.status,
          completedAt: t.completedAt,
          remindAt: t.remindAt,
          remindBell: t.remindBell,
          remindEmail: t.remindEmail,
          createdBy: t.createdBy,
          projectName: schema.projects.name,
          projectSlug: schema.projects.slug,
          jobNumber: schema.projects.jobNumber,
        })
        .from(t)
        .leftJoin(schema.projects, eq(t.projectId, schema.projects.id))
        .where(and(...conds.filter((x): x is SQL => !!x)))
        // Open tasks: soonest due first, undated last. Done tasks: most recently finished first.
        .orderBy(asc(t.status), sql`${t.dueDate} ASC NULLS LAST`, desc(t.createdAt))
        .limit(1000);
      const people = await db.select({ id: schema.userProfiles.clerkUserId, firstName: schema.userProfiles.firstName, lastName: schema.userProfiles.lastName, email: schema.userProfiles.email }).from(schema.userProfiles);
      const name = new Map(people.map((p) => [p.id, [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email]));
      return rows.map((r) => ({ ...r, assigneeName: r.assigneeId ? (name.get(r.assigneeId) ?? "Unknown") : null }));
    }),

  create: protectedProcedure.input(z.object({ projectId: z.string().uuid().nullable().optional(), ...fields })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    const { db, schema } = c.tenant;
    if (input.projectId) await mayUseProject(c, input.projectId);
    const assigneeId = input.assigneeId === undefined ? c.userId : input.assigneeId;
    await checkAssignee(c, assigneeId);
    const [row] = await db
      .insert(schema.projectTasks)
      .values({
        projectId: input.projectId ?? null,
        title: input.title,
        notes: input.notes?.trim() || null,
        assigneeId,
        dueDate: input.dueDate ?? null,
        remindAt: input.remindAt ? new Date(input.remindAt) : null,
        remindBell: input.remindBell ?? true,
        remindEmail: input.remindEmail ?? false,
        createdBy: c.userId,
      })
      .returning({ id: schema.projectTasks.id });
    return row;
  }),

  update: protectedProcedure.input(z.object({ id: z.string().uuid(), projectId: z.string().uuid().nullable().optional(), ...fields, title: fields.title.optional() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    const { db, schema } = c.tenant;
    const i = input;
    const before = await loadVisible(c, i.id);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (i.projectId !== undefined && i.projectId !== before.projectId) {
      if (i.projectId) await mayUseProject(c, i.projectId);
      set.projectId = i.projectId;
    }
    if (i.title !== undefined) set.title = i.title;
    if (i.notes !== undefined) set.notes = i.notes?.trim() || null;
    if (i.assigneeId !== undefined) {
      await checkAssignee(c, i.assigneeId);
      set.assigneeId = i.assigneeId;
    }
    if (i.dueDate !== undefined) set.dueDate = i.dueDate;
    if (i.remindBell !== undefined) set.remindBell = i.remindBell;
    if (i.remindEmail !== undefined) set.remindEmail = i.remindEmail;
    if (i.remindAt !== undefined) set.remindAt = i.remindAt ? new Date(i.remindAt) : null;
    // A changed reminder (or a new person to remind) fires again.
    const rearm =
      (i.remindAt !== undefined && (i.remindAt ? new Date(i.remindAt).getTime() : null) !== (before.remindAt ? before.remindAt.getTime() : null)) ||
      (i.assigneeId !== undefined && i.assigneeId !== before.assigneeId) ||
      (i.remindBell === true && !before.remindBell) ||
      (i.remindEmail === true && !before.remindEmail);
    if (rearm) {
      set.bellAckedAt = null;
      set.emailSentAt = null;
    }
    await db.update(schema.projectTasks).set(set).where(eq(schema.projectTasks.id, i.id));
    return { ok: true };
  }),

  setDone: protectedProcedure.input(z.object({ id: z.string().uuid(), done: z.boolean() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    const { db, schema } = c.tenant;
    await loadVisible(c, input.id);
    await db
      .update(schema.projectTasks)
      .set(input.done ? { status: "done", completedAt: new Date(), completedBy: c.userId, updatedAt: new Date() } : { status: "open", completedAt: null, completedBy: null, updatedAt: new Date() })
      .where(eq(schema.projectTasks.id, input.id));
    return { ok: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    const { db, schema } = c.tenant;
    const row = await loadVisible(c, input.id);
    if (!isAdmin(c) && row.createdBy !== c.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Only the person who made a task, or an admin, can delete it." });
    await db.delete(schema.projectTasks).where(eq(schema.projectTasks.id, input.id));
    return { ok: true };
  }),

  /** Reminders waiting under the bell: this person's open tasks whose reminder time has come and that they have not dismissed. */
  bellReminders: protectedProcedure.query(async ({ ctx }) => {
    const c = need(ctx);
    const { db, schema } = c.tenant;
    const t = schema.projectTasks;
    return db
      .select({
        id: t.id,
        title: t.title,
        notes: t.notes,
        dueDate: t.dueDate,
        remindAt: t.remindAt,
        projectName: schema.projects.name,
        projectSlug: schema.projects.slug,
        jobNumber: schema.projects.jobNumber,
      })
      .from(t)
      .leftJoin(schema.projects, eq(t.projectId, schema.projects.id))
      .where(and(eq(t.assigneeId, c.userId), eq(t.status, "open"), eq(t.remindBell, true), lte(t.remindAt, new Date()), isNull(t.bellAckedAt)))
      .orderBy(asc(t.remindAt))
      .limit(50);
  }),

  /** Take a reminder off the bell without finishing the task. */
  dismissReminder: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    const row = await loadVisible(c, input.id);
    await c.tenant.db.update(c.tenant.schema.projectTasks).set({ bellAckedAt: new Date() }).where(eq(c.tenant.schema.projectTasks.id, row.id));
    return { ok: true };
  }),

  /** Remind me again later: moves the reminder time and lets it fire (bell and email) again. */
  snooze: protectedProcedure.input(z.object({ id: z.string().uuid(), until: z.string().datetime() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    const row = await loadVisible(c, input.id);
    await c.tenant.db
      .update(c.tenant.schema.projectTasks)
      .set({ remindAt: new Date(input.until), bellAckedAt: null, emailSentAt: null, updatedAt: new Date() })
      .where(eq(c.tenant.schema.projectTasks.id, row.id));
    return { ok: true };
  }),
});
