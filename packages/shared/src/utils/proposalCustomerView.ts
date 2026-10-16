import {
  applyAcceptance,
  computeSchedule,
  type MilestoneInput,
  type ProposalResult,
} from "./proposalCalc";

/**
 * What the customer sees. Built field by field from an allow-list so cost, margin,
 * contingency, profit, vendors and internal notes can never leak into it.
 */

export type LineVisibility = "price" | "name_only" | "hidden";

export interface CustomerViewLineInput {
  id: string;
  parentId: string | null;
  name: string;
  visibility: LineVisibility;
  isOptional: boolean;
}

export interface CustomerViewMilestoneInput extends MilestoneInput {
  name: string;
}

export interface CustomerLine {
  id: string;
  name: string;
  /** "price" lines are listed with their price marked as included in the group price above. */
  mode: "price" | "name_only";
  /** cents, only for mode "price" */
  price: number | null;
}

export interface CustomerGroup {
  id: string;
  name: string;
  /** cents. Base groups include their share of global costs. */
  price: number;
  lines: CustomerLine[];
}

export interface CustomerScheduleRow {
  id: string;
  name: string;
  percent: number;
  amount: number;
}

export interface CustomerView {
  groups: CustomerGroup[];
  /** base price + global costs, before tax (cents) */
  subtotal: number;
  tax: number;
  total: number;
  options: CustomerGroup[];
  /** Invoicing schedule. Based on the contract value: the base total plus any accepted options. */
  schedule: CustomerScheduleRow[];
  /** The option groups included in `schedule` (empty until options are accepted or chosen). */
  scheduleOptionIds: string[];
  /** The amount the schedule percentages apply to (cents). */
  scheduleTotal: number;
}

export function buildCustomerView(input: {
  lines: CustomerViewLineInput[];
  result: ProposalResult;
  milestones: CustomerViewMilestoneInput[];
  /** Accepted optional items. Their price (and tax) is added to what the invoicing schedule bills. */
  acceptedOptionIds?: string[];
  roundToDollar?: boolean;
}): CustomerView {
  const { lines, result, milestones } = input;
  const optionIds = (input.acceptedOptionIds ?? []).filter((id) => result.options.some((o) => o.id === id));
  const scheduleTotal = applyAcceptance(result, optionIds).contractValue;

  const childrenOf = (id: string): CustomerLine[] =>
    lines
      .filter((l) => l.parentId === id && l.visibility !== "hidden")
      .map((l) => ({
        id: l.id,
        name: l.name,
        mode: l.visibility === "price" ? ("price" as const) : ("name_only" as const),
        price: l.visibility === "price" ? (result.lines[l.id]?.price ?? 0) : null,
      }));

  const nameOf = new Map(lines.map((l) => [l.id, l.name]));

  const groups: CustomerGroup[] = result.parents.map((p) => ({
    id: p.id,
    name: nameOf.get(p.id) ?? "",
    price: p.proposalPrice,
    lines: childrenOf(p.id),
  }));

  const options: CustomerGroup[] = result.options.map((o) => ({
    id: o.id,
    name: nameOf.get(o.id) ?? "",
    price: o.price,
    lines: childrenOf(o.id),
  }));

  const schedule = computeSchedule(scheduleTotal, milestones, input.roundToDollar === true).map((row, i) => ({
    id: row.id,
    name: milestones[i].name,
    percent: row.percent,
    amount: row.amount,
  }));

  return {
    groups,
    subtotal: result.totals.basePrice + result.totals.globalTotal,
    tax: result.totals.tax,
    total: result.totals.total,
    options,
    schedule,
    scheduleOptionIds: optionIds,
    scheduleTotal,
  };
}
