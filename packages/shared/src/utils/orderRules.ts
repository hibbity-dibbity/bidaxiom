/**
 * Rules for reviewing, issuing and revising purchase and work orders. Pure, so the API and the
 * screens agree.
 *
 * - Only a draft order can be edited (vendor, lines, projected cost, exclusions, details).
 * - An order can be issued only with a vendor and at least one line.
 * - Issuing records a snapshot. Revising an issued order reopens it as a draft with revision + 1;
 *   earlier snapshots are kept.
 * - Lines move only between drafts of the same kind.
 * - Insurance problems on a work order warn but never block issuing.
 */

export type OrderStatus = "draft" | "issued" | "partially_paid" | "paid" | "closed";

export function isEditable(status: string): boolean {
  return status === "draft";
}

export function canRevise(status: string): boolean {
  return status === "issued";
}

/** Reasons an order cannot be issued yet. Empty means it can. */
export function issueBlockers(input: { status: string; vendorId: string | null; lineCount: number }): string[] {
  const out: string[] = [];
  if (input.status !== "draft") out.push("Only a draft order can be issued.");
  if (!input.vendorId) out.push("Assign a vendor first.");
  if (input.lineCount === 0) out.push("The order has no lines.");
  return out;
}

/** Reasons lines cannot be moved from one order to another. Empty means they can. */
export function moveBlockers(
  from: { status: string; kind: string },
  to: { status: string; kind: string } | null
): string[] {
  const out: string[] = [];
  if (!isEditable(from.status)) out.push("The source order is issued. Revise it first.");
  if (to) {
    if (!isEditable(to.status)) out.push("The other order is issued. Revise it first.");
    if (to.kind !== from.kind) out.push("Lines can only move between orders of the same kind.");
  }
  return out;
}

/** Next number such as PO26-014-03, from the numbers already used (gaps from merges are not reused). */
export function nextOrderNumber(existing: string[], prefix: "PO" | "WO", projectNumber: string | null): string {
  const head = `${prefix}${projectNumber ?? ""}-`;
  let max = 0;
  for (const n of existing) {
    if (!n.startsWith(head)) continue;
    const seq = Number(n.slice(head.length));
    if (Number.isInteger(seq) && seq > max) max = seq;
  }
  return `${head}${String(max + 1).padStart(2, "0")}`;
}

export type InsuranceStatus = "ok" | "expiring" | "expired" | "missing";

/** Insurance certificate status. "expiring" means within 30 days. */
export function insuranceStatus(expiresAt: Date | string | null | undefined, now: Date = new Date()): InsuranceStatus {
  if (!expiresAt) return "missing";
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return "missing";
  if (t < now.getTime()) return "expired";
  if (t - now.getTime() <= 30 * 24 * 3600 * 1000) return "expiring";
  return "ok";
}

export function insuranceMessage(status: InsuranceStatus): string | null {
  if (status === "missing") return "No insurance certificate on file";
  if (status === "expired") return "Insurance certificate expired";
  if (status === "expiring") return "Insurance certificate expires within 30 days";
  return null;
}

export function revisionLabel(revision: number): string {
  return `Rev ${revision}`;
}
