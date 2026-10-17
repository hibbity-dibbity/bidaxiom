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

const scopeSchema = z.enum(["personal", "global"]);
const kindSchema = z.enum(["group", "addon"]);

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

/** A group is one parent and its children. An add-on is child lines only (no parent), attached inside a group on the proposal. */
function shapeError(kind: "group" | "addon", lines: Array<z.infer<typeof lineSchema>>): string | null {
  if (kind === "addon") {
    return lines.some((l) => l.parentId) ? "An add-on is a flat list of lines." : null;
  }
  const parents = lines.filter((l) => !l.parentId);
  if (parents.length !== 1) return "A template is one group: one parent line and its child lines.";
  if (lines.some((l) => l.parentId && l.parentId !== parents[0]!.id)) return "Every child line must belong to the parent line.";
  return null;
}

/** Anyone who can create proposals can use and save templates (change orders use the same builder). */
async function requireUse(ctx: { tenant: RequestTenantContext; userId: string; orgRole: string | null }) {
  const memberships = await ctx.tenant.db
    .select({ projectId: ctx.tenant.schema.projectTeamMembers.projectId, role: ctx.tenant.schema.projectTeamMembers.role })
    .from(ctx.tenant.schema.projectTeamMembers)
    .where(eq(ctx.tenant.schema.projectTeamMembers.userId, ctx.userId));
  ForbiddenError.from(defineAbilitiesFor(ctx.orgRole ?? "org:member", ctx.userId, memberships)).throwUnlessCan("create", "Estimate");
}

export const isAdminRole = (orgRole: string | null) => orgRole === "org:admin";

type TemplateRow = { createdBy: string; scope: string };
/** The owner can change a template; an administrator can also change anything in the shared catalog. */
export const canChange = (t: TemplateRow, ctx: { userId: string; orgRole: string | null }) => t.createdBy === ctx.userId || (t.scope === "global" && isAdminRole(ctx.orgRole));
/** Personal templates belong to their creator alone; shared ones are visible to everyone. */
export const isVisible = (t: TemplateRow, userId: string) => t.scope === "global" || t.createdBy === userId;

const need = (ctx: { tenant?: RequestTenantContext | null; userId?: string | null; orgRole?: string | null }) => {
  if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
  return { tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole ?? null };
};

export const proposalTemplateRouter = router({
  /** Who is asking: lets the pages show administrator-only actions. */
  viewer: protectedProcedure.query(async ({ ctx: raw }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    return { isAdmin: isAdminRole(ctx.orgRole) };
  }),

  /** Every template this person can use: the shared catalog plus their own personal ones. */
  list: protectedProcedure.query(async ({ ctx: raw }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    const { db, schema } = ctx.tenant;
    const all = await db.select().from(schema.proposalTemplates).orderBy(asc(schema.proposalTemplates.name));
    const templates = all.filter((t) => isVisible(t, ctx.userId));
    const lines = await db.select().from(schema.proposalTemplateLines).orderBy(asc(schema.proposalTemplateLines.sortOrder));
    const owners = await db.select({ id: schema.userProfiles.clerkUserId, first: schema.userProfiles.firstName, last: schema.userProfiles.lastName, email: schema.userProfiles.email }).from(schema.userProfiles);
    const ownerName = (id: string) => {
      const o = owners.find((x) => x.id === id);
      return o ? [o.first, o.last].filter(Boolean).join(" ") || o.email : "A former user";
    };
    return templates.map((t) => {
      const mine = lines.filter((l) => l.templateId === t.id);
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        scope: t.scope as "personal" | "global",
        kind: t.kind as "group" | "addon",
        appliesTo: t.appliesTo,
        updatedAt: t.updatedAt,
        isMine: t.createdBy === ctx.userId,
        ownerName: t.createdBy === ctx.userId ? "You" : ownerName(t.createdBy),
        canChange: canChange(t, ctx),
        childCount: t.kind === "addon" ? mine.length : mine.filter((l) => l.parentId).length,
        // What the customer would read: the name-only lines.
        preview: mine.filter((l) => (t.kind === "addon" || l.parentId) && l.visibility === "name_only").map((l) => l.name),
      };
    });
  }),

  /** The lines of one or more templates, ready to drop into the proposal builder. */
  getMany: protectedProcedure.input(z.object({ ids: z.array(z.string().uuid()).min(1).max(40) })).query(async ({ ctx: raw, input }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    const { db, schema } = ctx.tenant;
    const out = [];
    for (const id of input.ids) {
      const [t] = await db.select().from(schema.proposalTemplates).where(eq(schema.proposalTemplates.id, id)).limit(1);
      if (!t || !isVisible(t, ctx.userId)) continue;
      const lines = await db.select().from(schema.proposalTemplateLines).where(eq(schema.proposalTemplateLines.templateId, id)).orderBy(asc(schema.proposalTemplateLines.sortOrder));
      out.push({
        id: t.id,
        name: t.name,
        kind: t.kind as "group" | "addon",
        appliesTo: t.appliesTo,
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

  /**
   * Save a proposal group (or a few of its child lines, as an add-on) as a template, for just you or for everyone.
   * A template of yours with the same name is replaced.
   */
  save: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().max(1000).nullable().optional(),
        scope: scopeSchema.default("personal"),
        kind: kindSchema.default("group"),
        appliesTo: z.string().trim().max(200).nullable().optional(),
        lines: z.array(lineSchema).min(1).max(200),
      })
    )
    .mutation(async ({ ctx: raw, input }) => {
      const ctx = need(raw);
      await requireUse(ctx);
      const err = shapeError(input.kind, input.lines);
      if (err) throw new TRPCError({ code: "BAD_REQUEST", message: err });
      const { db, schema } = ctx.tenant;
      const sameName = await db.select().from(schema.proposalTemplates).where(sql`lower(${schema.proposalTemplates.name}) = lower(${input.name})`);
      let same = sameName.find((t) => t.createdBy === ctx.userId);
      if (input.scope === "global") {
        const other = sameName.find((t) => t.scope === "global" && t.createdBy !== ctx.userId);
        if (other) {
          // Only an administrator replaces somebody else's shared template.
          if (!isAdminRole(ctx.orgRole)) throw new TRPCError({ code: "CONFLICT", message: `A shared template named "${input.name}" already exists. Pick another name, or ask its owner or an administrator.` });
          same = other;
        }
      }
      const ownerChanges = !same || same.createdBy === ctx.userId;
      const id = await db.transaction(async (tx) => {
        let templateId = same?.id;
        const fields = {
          name: input.name,
          description: input.description ?? same?.description ?? null,
          kind: input.kind,
          appliesTo: input.kind === "addon" ? input.appliesTo || null : null,
          updatedAt: new Date(),
        };
        if (same) {
          await tx.update(schema.proposalTemplates).set({ ...fields, scope: ownerChanges ? input.scope : same.scope }).where(eq(schema.proposalTemplates.id, same.id));
          await tx.delete(schema.proposalTemplateLines).where(eq(schema.proposalTemplateLines.templateId, same.id));
        } else {
          const [t] = await tx.insert(schema.proposalTemplates).values({ ...fields, scope: input.scope, createdBy: ctx.userId }).returning({ id: schema.proposalTemplates.id });
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
      await createAuditLog(db, schema, { entityType: "ProposalTemplate", entityId: id, action: same ? AuditAction.UPDATE : AuditAction.CREATE, actorId: ctx.userId, changes: { after: { name: input.name, kind: input.kind, scope: ownerChanges ? input.scope : same?.scope, lines: input.lines.length } } });
      return { id, replaced: Boolean(same) };
    }),

  /** Rename, re-describe, or change who can use it (owner), and the same for anything in the shared catalog (administrator). */
  updateDetails: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200), description: z.string().max(1000).nullable(), scope: scopeSchema.optional(), appliesTo: z.string().trim().max(200).nullable().optional() }))
    .mutation(async ({ ctx: raw, input }) => {
      const ctx = need(raw);
      await requireUse(ctx);
      const { db, schema } = ctx.tenant;
      const [t] = await db.select().from(schema.proposalTemplates).where(eq(schema.proposalTemplates.id, input.id)).limit(1);
      if (!t || !isVisible(t, ctx.userId)) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found." });
      if (!canChange(t, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "Only the person who made a template, or an administrator for the shared catalog, can change it." });
      // Somebody else's template can be taken out of the shared catalog, not handed to a new owner or reopened to everyone.
      const scope = t.createdBy === ctx.userId ? input.scope ?? t.scope : input.scope === "personal" ? "personal" : t.scope;
      const clashes = await db.select().from(schema.proposalTemplates).where(sql`lower(${schema.proposalTemplates.name}) = lower(${input.name}) and ${schema.proposalTemplates.id} <> ${input.id}`);
      const clash = clashes.find((c) => (scope === "global" ? c.scope === "global" || c.createdBy === t.createdBy : c.createdBy === t.createdBy));
      if (clash) throw new TRPCError({ code: "CONFLICT", message: "Another template already has that name." });
      await db
        .update(schema.proposalTemplates)
        .set({ name: input.name, description: input.description, scope, appliesTo: t.kind === "addon" ? (input.appliesTo === undefined ? t.appliesTo : input.appliesTo || null) : null, updatedAt: new Date() })
        .where(eq(schema.proposalTemplates.id, input.id));
      await createAuditLog(db, schema, { entityType: "ProposalTemplate", entityId: input.id, action: AuditAction.UPDATE, actorId: ctx.userId, changes: { before: { name: t.name, scope: t.scope }, after: { name: input.name, scope } } });
      return { ok: true };
    }),

  /**
   * Remove from the shared catalog. An administrator can do this to anyone's shared template; it becomes a personal template
   * of its owner, who keeps it. Nothing is deleted.
   */
  unshare: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: raw, input }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    const { db, schema } = ctx.tenant;
    const [t] = await db.select().from(schema.proposalTemplates).where(eq(schema.proposalTemplates.id, input.id)).limit(1);
    if (!t || !isVisible(t, ctx.userId)) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found." });
    if (t.scope !== "global") throw new TRPCError({ code: "BAD_REQUEST", message: "That template is not in the shared catalog." });
    if (!canChange(t, ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "Only the person who made a template or an administrator can take it out of the shared catalog." });
    // The owner may already have a personal template with this name; keep both usable by renaming the unshared one.
    const [dup] = await db.select({ id: schema.proposalTemplates.id }).from(schema.proposalTemplates).where(sql`lower(${schema.proposalTemplates.name}) = lower(${t.name}) and ${schema.proposalTemplates.createdBy} = ${t.createdBy} and ${schema.proposalTemplates.id} <> ${t.id}`).limit(1);
    await db.update(schema.proposalTemplates).set({ scope: "personal", name: dup ? `${t.name} (removed from shared)` : t.name, updatedAt: new Date() }).where(eq(schema.proposalTemplates.id, t.id));
    await createAuditLog(db, schema, { entityType: "ProposalTemplate", entityId: t.id, action: AuditAction.UPDATE, actorId: ctx.userId, changes: { before: { scope: "global" }, after: { scope: "personal" } } });
    return { ok: true };
  }),

  /** Delete one of your own templates. (Administrators take other people's out of the shared catalog with unshare.) */
  remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx: raw, input }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    const { db, schema } = ctx.tenant;
    const [t] = await db.select().from(schema.proposalTemplates).where(eq(schema.proposalTemplates.id, input.id)).limit(1);
    if (!t || !isVisible(t, ctx.userId)) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found." });
    if (t.createdBy !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN", message: "You can delete your own templates. To take someone else's out of the shared catalog, use Remove from shared." });
    await db.delete(schema.proposalTemplates).where(eq(schema.proposalTemplates.id, input.id));
    await createAuditLog(db, schema, { entityType: "ProposalTemplate", entityId: input.id, action: AuditAction.DELETE, actorId: ctx.userId, changes: {} });
    return { ok: true };
  }),

  /** Add the starter templates (slab, metal building, insulation, and the metal building add-ons) to the shared catalog. Administrators only. */
  addStarters: protectedProcedure.mutation(async ({ ctx: raw }) => {
    const ctx = need(raw);
    await requireUse(ctx);
    if (!isAdminRole(ctx.orgRole)) throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator can add the starter templates." });
    const { db, schema } = ctx.tenant;
    const existing = new Set((await db.select({ n: schema.proposalTemplates.name, s: schema.proposalTemplates.scope }).from(schema.proposalTemplates)).filter((r) => r.s === "global").map((r) => r.n.toLowerCase()));
    const added: string[] = [];
    for (const t of STARTER_TEMPLATES) {
      if (existing.has(t.name.toLowerCase())) continue;
      const kind = t.kind ?? "group";
      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.proposalTemplates)
          .values({ name: t.name, description: t.description, createdBy: ctx.userId, scope: "global", kind, appliesTo: kind === "addon" ? t.appliesTo ?? null : null })
          .returning({ id: schema.proposalTemplates.id });
        const parentId = kind === "addon" ? null : crypto.randomUUID();
        await tx.insert(schema.proposalTemplateLines).values([
          ...(parentId ? [{ id: parentId, templateId: row!.id, parentId: null, type: "other", name: t.parent.name, quantity: "0", unit: "ls", unitCost: "0", marginPercent: "0", contingencyPercent: "0", visibility: "price", sortOrder: 0 }] : []),
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
