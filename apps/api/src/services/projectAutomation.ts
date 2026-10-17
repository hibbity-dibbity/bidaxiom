import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { LIFECYCLE_ORDER, AuditAction, type LifecyclePhase } from "@construction/shared";
import { createAuditLog } from "../audit/logger.js";
import { queueProjectSyncOnChange, queueInvoiceSyncOnSend } from "../integrations/quickbooks/autoSync.js";
import type { buildTenantContext } from "../tenant/context.js";

type Tenant = NonNullable<Awaited<ReturnType<typeof buildTenantContext>>>;

/**
 * Project status automation and the "needs your attention" prompts.
 *
 * Rules (the person can always move a project by hand, and nothing here ever moves one backward):
 * - Takeoff or proposal created        -> Estimating   (only from Opportunity)
 * - Proposal emailed / marked sent     -> Submitted    (only from Opportunity or Estimating)
 * - Proposal accepted                  -> Awarded      (only before Awarded), plus a "send the deposit invoice" prompt
 * - Work seems to have started (a non-deposit invoice sent, a purchase/work order issued, or the start date
 *   has passed) while Awarded         -> prompt "Mark Active?"
 * - Every invoice on the project is paid -> prompt "Mark Closed?"
 *
 * A prompt is raised at most once per event (its dedupe key stays in the table after it is answered),
 * so reopening a closed project does not bring the question back; only a new event does.
 */

export type PromptAction =
  | { kind: "phase"; label: string; phase: LifecyclePhase }
  | { kind: "set_start_date"; label: string }
  | { kind: "email_invoice"; label: string; invoiceId: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "dismiss"; label: string };

const idx = (p: string) => LIFECYCLE_ORDER.indexOf(p as LifecyclePhase);
const ACTIVE_IDX = idx("active");
const CLOSED_IDX = idx("closed");

const AUTO_FROM: Record<string, LifecyclePhase[]> = {
  estimating: ["opportunity"],
  submitted: ["opportunity", "estimating"],
  awarded: ["opportunity", "estimating", "submitted"],
};

export const isDepositName = (name: string) => /deposit/i.test(name);

/** Raise a prompt once. Returns false when this event already had one (open or answered). */
export async function raisePrompt(
  tenant: Tenant,
  p: { projectId: string | null; kind: string; dedupeKey: string; title: string; body?: string | null; actions: PromptAction[] }
): Promise<boolean> {
  const { db, schema } = tenant;
  const rows = await db
    .insert(schema.actionPrompts)
    .values({ projectId: p.projectId, kind: p.kind, dedupeKey: p.dedupeKey, title: p.title, body: p.body ?? null, actions: p.actions as unknown as Array<Record<string, unknown>> })
    .onConflictDoNothing({ target: schema.actionPrompts.dedupeKey })
    .returning({ id: schema.actionPrompts.id });
  return rows.length > 0;
}

/** Close open prompts (answered somewhere else, or no longer true). */
export async function resolvePrompts(
  tenant: Tenant,
  where: { dedupeKey?: string; projectId?: string; kinds?: string[] },
  resolution: string,
  by: string | null = null
) {
  const { db, schema } = tenant;
  const conds = [eq(schema.actionPrompts.status, "open")];
  if (where.dedupeKey) conds.push(eq(schema.actionPrompts.dedupeKey, where.dedupeKey));
  if (where.projectId) conds.push(eq(schema.actionPrompts.projectId, where.projectId));
  if (where.kinds) conds.push(inArray(schema.actionPrompts.kind, where.kinds));
  await db.update(schema.actionPrompts).set({ status: "done", resolution, resolvedAt: new Date(), resolvedBy: by }).where(and(...conds));
}

/** Keep prompts honest after any phase change (automatic, manual, or from a prompt). */
export async function afterPhaseChange(tenant: Tenant, projectId: string, newPhase: string) {
  await queueProjectSyncOnChange(tenant, projectId); // QuickBooks job active/inactive follows the phase (only when the company turned auto-sync on)
  const i = idx(newPhase);
  // A paused or lost job is no longer waiting on a "start it?" or "close it?" answer.
  if (newPhase === "on_hold" || newPhase === "lost") {
    await resolvePrompts(tenant, { projectId, kinds: ["mark_active", "close_project"] }, `Project is now ${newPhase === "lost" ? "Lost" : "On Hold"}`);
    return;
  }
  if (i >= ACTIVE_IDX) await resolvePrompts(tenant, { projectId, kinds: ["mark_active"] }, `Project is now ${newPhase}`);
  if (i >= CLOSED_IDX) await resolvePrompts(tenant, { projectId, kinds: ["close_project"] }, `Project is now ${newPhase}`);
  if (i < ACTIVE_IDX) await resolvePrompts(tenant, { projectId, kinds: ["close_project"] }, `Project is now ${newPhase}`);
}

/** Move a project forward because of something that happened. Never backward, never from a later phase. */
export async function autoPhase(tenant: Tenant, projectId: string, to: "estimating" | "submitted" | "awarded", eventSource: string, actorId: string) {
  const { db, schema } = tenant;
  const [project] = await db.select({ phase: schema.projects.lifecyclePhase }).from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (!project || !AUTO_FROM[to].includes(project.phase as LifecyclePhase)) return false;
  await db.transaction(async (tx) => {
    await tx.update(schema.projects).set({ lifecyclePhase: to, updatedAt: new Date() }).where(eq(schema.projects.id, projectId));
    await tx.insert(schema.projectLifecycleTransitions).values({ projectId, fromPhase: project.phase, toPhase: to, triggeredBy: "system", actorId, eventSource });
  });
  await createAuditLog(db, schema, {
    entityType: "Project",
    entityId: projectId,
    action: AuditAction.UPDATE,
    actorId,
    changes: { before: { lifecyclePhase: project.phase }, after: { lifecyclePhase: to } },
    metadata: { triggeredBy: "system", eventSource },
  });
  await afterPhaseChange(tenant, projectId, to);
  return true;
}

async function projectInfo(tenant: Tenant, projectId: string) {
  const { db, schema } = tenant;
  const [p] = await db
    .select({ id: schema.projects.id, name: schema.projects.name, jobNumber: schema.projects.jobNumber, slug: schema.projects.slug, phase: schema.projects.lifecyclePhase, startDate: schema.projects.startDate })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);
  return p ?? null;
}
const label = (p: { name: string; jobNumber: string | null }) => [p.jobNumber, p.name].filter(Boolean).join(" - ");
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** A proposal (not a change order) went out to the customer. */
export async function onProposalSent(tenant: Tenant, estimateId: string, actorId: string) {
  const { db, schema } = tenant;
  const [e] = await db.select({ projectId: schema.estimates.projectId, kind: schema.estimates.kind }).from(schema.estimates).where(eq(schema.estimates.id, estimateId)).limit(1);
  if (e && e.kind !== "change_order") await autoPhase(tenant, e.projectId, "submitted", "proposal_sent", actorId);
}

/** A proposal or change order was accepted and its invoices drafted. */
export async function onProposalAccepted(tenant: Tenant, estimateId: string, actorId: string) {
  const { db, schema } = tenant;
  const [e] = await db.select({ projectId: schema.estimates.projectId, kind: schema.estimates.kind, number: schema.estimates.number }).from(schema.estimates).where(eq(schema.estimates.id, estimateId)).limit(1);
  if (!e) return;
  if (e.kind !== "change_order") await autoPhase(tenant, e.projectId, "awarded", "proposal_accepted", actorId);
  const project = await projectInfo(tenant, e.projectId);
  if (!project) return;
  const invoices = await db
    .select({ id: schema.invoices.id, number: schema.invoices.number, name: schema.invoices.milestoneName, amount: schema.invoices.amount })
    .from(schema.invoices)
    .where(and(eq(schema.invoices.estimateId, estimateId), eq(schema.invoices.status, "draft")));
  for (const inv of invoices.filter((i) => isDepositName(i.name))) {
    await raisePrompt(tenant, {
      projectId: e.projectId,
      kind: "deposit_invoice",
      dedupeKey: `deposit:${inv.id}`,
      title: `Send the ${inv.name} invoice`,
      body: `${e.kind === "change_order" ? "Change order" : "Proposal"} accepted for ${label(project)}. Invoice ${inv.number} (${money(Number(inv.amount))}) is ready to send.`,
      actions: [
        { kind: "email_invoice", label: "Email invoice", invoiceId: inv.id },
        { kind: "link", label: "Open invoice", href: `/projects/${project.slug}/invoices/${inv.id}` },
        { kind: "dismiss", label: "Not now" },
      ],
    });
  }
}

/** A draft invoice was sent (emailed, or marked sent). */
export async function onInvoiceSent(tenant: Tenant, invoiceId: string) {
  const { db, schema } = tenant;
  await resolvePrompts(tenant, { dedupeKey: `deposit:${invoiceId}` }, "Invoice sent");
  await queueInvoiceSyncOnSend(tenant, invoiceId); // creates it in QuickBooks when the company turned that on
  const [inv] = await db.select({ projectId: schema.invoices.projectId, name: schema.invoices.milestoneName, amount: schema.invoices.amount }).from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
  if (!inv || isDepositName(inv.name) || Number(inv.amount) <= 0) return;
  await suggestActive(tenant, inv.projectId, "an invoice was sent");
}

/** A purchase or work order was issued to a vendor. */
export async function onOrderIssued(tenant: Tenant, projectId: string) {
  await suggestActive(tenant, projectId, "an order was issued to a vendor");
}

/** The customer declined a proposal: ask whether the whole project is lost. Change orders only record the decline. */
export async function onProposalDeclined(tenant: Tenant, estimateId: string, signerName: string, reason: string | null) {
  const { db, schema } = tenant;
  const [e] = await db.select({ projectId: schema.estimates.projectId, kind: schema.estimates.kind, revision: schema.estimates.revision }).from(schema.estimates).where(eq(schema.estimates.id, estimateId)).limit(1);
  if (!e || e.kind === "change_order") return;
  const project = await projectInfo(tenant, e.projectId);
  if (!project || idx(project.phase) >= ACTIVE_IDX || project.phase === "lost") return;
  await raisePrompt(tenant, {
    projectId: e.projectId,
    kind: "proposal_declined",
    dedupeKey: `declined:${estimateId}`,
    title: `${label(project)}: proposal declined`,
    body: `${signerName} declined the proposal${reason ? ` ("${reason}")` : ""}. Revise and resend it, or mark the project Lost.`,
    actions: [
      { kind: "phase", label: "Mark Lost", phase: "lost" },
      { kind: "dismiss", label: "I will revise it" },
    ],
  });
}

/** Ask once whether to mark an Awarded project Active. */
async function suggestActive(tenant: Tenant, projectId: string, why: string) {
  const project = await projectInfo(tenant, projectId);
  if (!project || project.phase !== "awarded") return;
  await raisePrompt(tenant, {
    projectId,
    kind: "mark_active",
    dedupeKey: `active:${projectId}:work`,
    title: `Is ${label(project)} under construction?`,
    body: `It is still Awarded, but ${why}. Mark it Active?`,
    actions: [
      { kind: "phase", label: "Mark Active", phase: "active" },
      { kind: "dismiss", label: "Not yet" },
    ],
  });
}

/** Payments or invoice status changed: if every invoice is now paid, ask about closing the project. */
export async function onInvoicesChanged(tenant: Tenant, projectId: string, lastInvoiceId: string) {
  const { db, schema } = tenant;
  const rows = await db.select({ status: schema.invoices.status, amount: schema.invoices.amount }).from(schema.invoices).where(eq(schema.invoices.projectId, projectId));
  const billable = rows.filter((r) => Number(r.amount) !== 0);
  if (billable.length === 0 || billable.some((r) => r.status !== "paid")) return;
  const project = await projectInfo(tenant, projectId);
  if (!project || idx(project.phase) < idx("awarded") || idx(project.phase) >= CLOSED_IDX) return;
  await raisePrompt(tenant, {
    projectId,
    kind: "close_project",
    dedupeKey: `close:${projectId}:${lastInvoiceId}`,
    title: `Close ${label(project)}?`,
    body: "The final invoice is paid and nothing is left to bill. Mark the project Closed?",
    actions: [
      { kind: "phase", label: "Mark Closed", phase: "closed" },
      { kind: "dismiss", label: "Not yet" },
    ],
  });
}

/** Checks that depend on the calendar, run whenever someone's list of prompts is loaded. */
export async function syncDuePrompts(tenant: Tenant) {
  const { db, schema } = tenant;
  const due = await db
    .select({ id: schema.projects.id, name: schema.projects.name, jobNumber: schema.projects.jobNumber, startDate: schema.projects.startDate })
    .from(schema.projects)
    .where(and(eq(schema.projects.lifecyclePhase, "awarded"), lte(schema.projects.startDate, new Date()), isNull(schema.projects.deletedAt)));
  for (const p of due) {
    if (!p.startDate) continue;
    const day = p.startDate.toISOString().slice(0, 10);
    await raisePrompt(tenant, {
      projectId: p.id,
      kind: "mark_active",
      dedupeKey: `start:${p.id}:${day}`,
      title: `${label(p)} was due to start`,
      body: `The start date (${day}) has passed and the project is still Awarded. Mark it Active, or move the start date.`,
      actions: [
        { kind: "phase", label: "Mark Active", phase: "active" },
        { kind: "set_start_date", label: "Change start date" },
        { kind: "dismiss", label: "Not yet" },
      ],
    });
  }
}
