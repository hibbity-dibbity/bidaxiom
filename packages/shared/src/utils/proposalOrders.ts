import type { CostLineType, ProposalResult } from "./proposalCalc";

/**
 * Draft purchase orders and work orders generated when a proposal is accepted.
 *
 * - Material and equipment lines become purchase order lines.
 * - Labor and subcontractor lines become work order lines.
 * - Type "other" (inclusion and exclusion wording) creates nothing.
 * - Only lines in the base proposal and in accepted options are used.
 * - One draft order per kind and vendor; lines with no vendor go to an Unassigned order.
 * - budgetCost is the line's proposal cost (contingency included) and is frozen at acceptance.
 */

export type OrderKind = "purchase" | "work";

export interface OrderSourceLine {
  id: string;
  parentId: string | null;
  name: string;
  type: CostLineType;
  vendorId: string | null;
  isOptional: boolean;
}

export interface DraftOrderLine {
  sourceLineId: string;
  description: string;
  /** cost category, e.g. "COGS: Materials & Supplies" */
  category: string;
  /** cents */
  budgetCost: number;
}

export interface DraftOrder {
  kind: OrderKind;
  /** null = Unassigned */
  vendorId: string | null;
  lines: DraftOrderLine[];
  /** cents */
  total: number;
}

export function orderKindForType(type: CostLineType): OrderKind | null {
  if (type === "material" || type === "equipment") return "purchase";
  if (type === "labor" || type === "subcontractor") return "work";
  return null;
}

/** Cost category an ordered line posts to. Fixed by line type; there are no cost codes. */
export function costCategoryForType(type: CostLineType): string | null {
  if (type === "material") return "COGS: Materials & Supplies";
  if (type === "equipment") return "COGS: Equipment Rental";
  if (type === "labor" || type === "subcontractor") return "COGS: Subcontract Labor";
  return null;
}

/** PO/WO/INV number: prefix + project number + two-digit sequence, e.g. PO2024-001-01. */
export function formatDocNumber(prefix: "PO" | "WO" | "INV", projectNumber: string | null, seq: number): string {
  return `${prefix}${projectNumber ?? ""}-${String(seq).padStart(2, "0")}`;
}

/** Lines that get priced and ordered: leaves of base parents and of accepted options. */
function includedLeaves(lines: OrderSourceLine[], acceptedOptionIds: string[]): OrderSourceLine[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const hasKids = new Set(lines.filter((l) => l.parentId).map((l) => l.parentId as string));
  return lines.filter((l) => {
    const top = l.parentId ? byId.get(l.parentId) : l;
    if (!top) return false;
    if (hasKids.has(l.id)) return false; // a parent with children is just a header
    return top.isOptional ? acceptedOptionIds.includes(top.id) : true;
  });
}

export function generateDraftOrders(
  lines: OrderSourceLine[],
  result: ProposalResult,
  acceptedOptionIds: string[]
): DraftOrder[] {
  const nameOf = new Map(lines.map((l) => [l.id, l.name]));
  const groups = new Map<string, DraftOrder>();
  for (const l of includedLeaves(lines, acceptedOptionIds)) {
    const kind = orderKindForType(l.type);
    const cost = result.lines[l.id]?.cost ?? 0;
    if (!kind || cost <= 0) continue;
    const key = `${kind}:${l.vendorId ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { kind, vendorId: l.vendorId, lines: [], total: 0 };
      groups.set(key, g);
    }
    const parentName = l.parentId ? nameOf.get(l.parentId) : null;
    g.lines.push({
      sourceLineId: l.id,
      description: parentName ? `${parentName}: ${l.name}` : l.name,
      category: costCategoryForType(l.type) ?? "",
      budgetCost: cost,
    });
    g.total += cost;
  }
  const rank = (g: DraftOrder) => (g.kind === "purchase" ? 0 : 2) + (g.vendorId === null ? 1 : 0);
  return [...groups.values()].sort((a, b) => rank(a) - rank(b));
}
