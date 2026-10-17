/**
 * Proposal calculation rules (single source of truth for API and builder UI).
 *
 * - Cost includes contingency: cost = qty x unit cost x (1 + contingency%).
 * - A credit (negative line on a change order) reduces the price only. Its cost counts as zero.
 * - Margin is a percent of PRICE: price = cost / (1 - margin). Profit = price - cost.
 * - Cost lines are two levels: a parent's cost and price are the sum of its children.
 *   A parent with no children prices its own quantity x unit cost.
 * - Optional items are top-level lines flagged `isOptional`. They never enter base totals
 *   and receive no share of global costs.
 * - Global costs are taken at face value (no margin) and spread across BASE parents by
 *   each parent's share of total base cost, added to that parent's proposal price.
 * - Sales tax applies to the price of material lines only (not global-cost shares).
 * - All money is computed in whole cents to avoid floating-point drift.
 * - With `roundToDollar`, every price the customer can see is a whole dollar: each line's price,
 *   global costs, sales tax and the schedule amounts. Parents are sums of whole-dollar children
 *   and the schedule's last milestone absorbs the remainder, so everything still adds up exactly.
 *   Costs (what we pay) stay exact; only prices are rounded, so profit is price minus exact cost.
 */

export type CostLineType = "labor" | "material" | "subcontractor" | "equipment" | "other";

export interface CostLineInput {
  id: string;
  /** null for parents and standalone optional items */
  parentId: string | null;
  type: CostLineType;
  quantity: number;
  unitCost: number;
  /** 0 up to (but not including) 100 */
  marginPercent: number;
  /** Padding added to the line's cost (waste, forgotten items), percent of cost. Defaults to 0. */
  contingencyPercent?: number;
  isOptional?: boolean;
}

export interface GlobalCostInput {
  id: string;
  amount: number;
}

export interface MilestoneInput {
  id: string;
  percent: number;
}

export interface ProposalInput {
  lines: CostLineInput[];
  globals: GlobalCostInput[];
  /** e.g. 7.5 for 7.5% */
  taxRatePercent: number;
  /** Round every price, tax and global cost to a whole dollar (company setting). */
  roundToDollar?: boolean;
}

export interface LineResult {
  id: string;
  /** cents, including contingency */
  cost: number;
  /** cents, before global-cost shares and tax */
  price: number;
  /** price - cost, cents (contingency counts as cost, so unspent contingency is not in this) */
  profit: number;
  /** portion of `cost` that is contingency padding, cents */
  contingency: number;
}

export interface ParentResult extends LineResult {
  /** cents of global costs spread onto this parent */
  globalShare: number;
  /** price + globalShare, cents */
  proposalPrice: number;
}

export interface OptionResult extends LineResult {
  /** cents of tax on this option if it is material */
  tax: number;
}

export interface ProposalTotals {
  baseCost: number;
  /** contingency included in baseCost; unspent at project end is bonus profit */
  baseContingency: number;
  basePrice: number;
  globalTotal: number;
  tax: number;
  /** basePrice + globalTotal + tax */
  total: number;
}

export interface ProposalResult {
  lines: Record<string, LineResult>;
  parents: ParentResult[];
  options: OptionResult[];
  totals: ProposalTotals;
}

export interface AcceptanceResult {
  contractValue: number;
  costBudget: number;
  /** contingency inside costBudget (base plus accepted options) */
  contingencyBudget: number;
  optionsPrice: number;
  optionsTax: number;
  optionsCost: number;
}

export interface ScheduleRow {
  id: string;
  percent: number;
  /** cents */
  amount: number;
}

const toCents = (dollars: number): number => Math.round((Number(dollars) || 0) * 100);

/** Round cents to the nearest whole dollar (still expressed in cents). */
export const roundCentsToDollar = (cents: number): number => Math.round(cents / 100) * 100;

/** Convert cents to dollars for display or storage. */
export const centsToDollars = (cents: number): number => cents / 100;

/** Cost in cents for one line (quantity x unit cost). */
export function lineCostCents(quantity: number, unitCost: number, contingencyPercent = 0): number {
  const base = (Number(quantity) || 0) * (Number(unitCost) || 0) * 100;
  return Math.round(base * (1 + (Number(contingencyPercent) || 0) / 100));
}

/** price = cost / (1 - margin). Margin must be below 100%. */
export function priceFromCostCents(costCents: number, marginPercent: number): number {
  const m = (Number(marginPercent) || 0) / 100;
  if (m < 0 || m >= 1) {
    throw new RangeError(`Margin must be at least 0% and below 100% (got ${marginPercent}%)`);
  }
  return Math.round(costCents / (1 - m));
}

/**
 * Split `totalCents` across weights, proportional to each weight. Rounding remainder goes
 * to the largest weight so the shares always sum exactly to the total.
 */
export function spreadByWeight(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map(() => 0);
  const shares = weights.map((w) => Math.round((totalCents * w) / sum));
  const diff = totalCents - shares.reduce((a, s) => a + s, 0);
  if (diff !== 0) {
    let largest = 0;
    weights.forEach((w, i) => {
      if (w > weights[largest]) largest = i;
    });
    shares[largest] += diff;
  }
  return shares;
}

export function computeProposal(input: ProposalInput): ProposalResult {
  const { lines, globals } = input;
  const taxRate = (Number(input.taxRatePercent) || 0) / 100;
  const whole = input.roundToDollar === true;
  const money = (cents: number): number => (whole ? roundCentsToDollar(cents) : cents);

  const childrenByParent = new Map<string, CostLineInput[]>();
  for (const l of lines) {
    if (l.parentId) {
      const arr = childrenByParent.get(l.parentId) ?? [];
      arr.push(l);
      childrenByParent.set(l.parentId, arr);
    }
  }

  const lineResults: Record<string, LineResult> = {};
  const priceOne = (l: CostLineInput): LineResult => {
    const entered = lineCostCents(l.quantity, l.unitCost, l.contingencyPercent);
    // A credit (negative line, change orders only) lowers what the customer is charged. It does not lower what we
    // pay: the orders already placed stand, so a credit carries no cost and the profit absorbs it.
    const cost = Math.max(entered, 0);
    const contingency = cost === 0 ? 0 : cost - lineCostCents(l.quantity, l.unitCost, 0);
    const price = money(priceFromCostCents(entered, l.marginPercent));
    return { id: l.id, cost, price, profit: price - cost, contingency };
  };

  for (const l of lines) {
    if (!childrenByParent.has(l.id)) lineResults[l.id] = priceOne(l);
  }
  // Parents with children: sum of children
  for (const l of lines) {
    const kids = childrenByParent.get(l.id);
    if (kids) {
      const cost = kids.reduce((a, k) => a + lineResults[k.id].cost, 0);
      const price = kids.reduce((a, k) => a + lineResults[k.id].price, 0);
      const contingency = kids.reduce((a, k) => a + lineResults[k.id].contingency, 0);
      lineResults[l.id] = { id: l.id, cost, price, profit: price - cost, contingency };
    }
  }

  const topLevel = lines.filter((l) => !l.parentId);
  const baseParents = topLevel.filter((l) => !l.isOptional);
  const optionLines = topLevel.filter((l) => l.isOptional);

  const globalTotal = money(globals.reduce((a, g) => a + toCents(g.amount), 0));
  const rawShares = spreadByWeight(
    whole ? globalTotal / 100 : globalTotal,
    baseParents.map((p) => Math.abs(lineResults[p.id].cost))
  );
  // Whole dollars: spread dollars, not cents, so each parent's share is a whole dollar and the shares still total exactly.
  const shares = whole ? rawShares.map((x) => x * 100) : rawShares;

  const parents: ParentResult[] = baseParents.map((p, i) => {
    const r = lineResults[p.id];
    return { ...r, globalShare: shares[i], proposalPrice: r.price + shares[i] };
  });

  const taxableOf = (l: CostLineInput): number => {
    const kids = childrenByParent.get(l.id);
    if (!kids) return l.type === "material" ? lineResults[l.id].price : 0;
    return kids.reduce((a, k) => a + (k.type === "material" ? lineResults[k.id].price : 0), 0);
  };

  const options: OptionResult[] = optionLines.map((o) => ({
    ...lineResults[o.id],
    tax: money(Math.round(taxableOf(o) * taxRate)),
  }));

  const baseCost = parents.reduce((a, p) => a + p.cost, 0);
  const baseContingency = parents.reduce((a, p) => a + p.contingency, 0);
  const basePrice = parents.reduce((a, p) => a + p.price, 0);
  const taxableBase = baseParents.reduce((a, p) => a + taxableOf(p), 0);
  const tax = money(Math.round(taxableBase * taxRate));

  return {
    lines: lineResults,
    parents,
    options,
    totals: { baseCost, baseContingency, basePrice, globalTotal, tax, total: basePrice + globalTotal + tax },
  };
}

/** Contract value and cost budget once the customer has chosen which options they accepted. */
export function applyAcceptance(result: ProposalResult, acceptedOptionIds: string[]): AcceptanceResult {
  const accepted = result.options.filter((o) => acceptedOptionIds.includes(o.id));
  const optionsPrice = accepted.reduce((a, o) => a + o.price, 0);
  const optionsTax = accepted.reduce((a, o) => a + o.tax, 0);
  const optionsCost = accepted.reduce((a, o) => a + o.cost, 0);
  const optionsContingency = accepted.reduce((a, o) => a + o.contingency, 0);
  return {
    contractValue: result.totals.total + optionsPrice + optionsTax,
    costBudget: result.totals.baseCost + optionsCost,
    contingencyBudget: result.totals.baseContingency + optionsContingency,
    optionsPrice,
    optionsTax,
    optionsCost,
  };
}

/** True when milestone percents total exactly 100 (to 2 decimals). */
export function milestonesTotal100(milestones: MilestoneInput[]): boolean {
  const total = milestones.reduce((a, m) => a + Math.round((Number(m.percent) || 0) * 100), 0);
  return total === 10000;
}

/** Dollar amount of each milestone; the last one absorbs the rounding remainder. */
export function computeSchedule(contractValueCents: number, milestones: MilestoneInput[], roundToDollar = false): ScheduleRow[] {
  const rows = milestones.map((m) => {
    const exact = Math.round((contractValueCents * (Number(m.percent) || 0)) / 100);
    return { id: m.id, percent: m.percent, amount: roundToDollar ? roundCentsToDollar(exact) : exact };
  });
  if (rows.length > 0 && milestonesTotal100(milestones)) {
    const diff = contractValueCents - rows.reduce((a, r) => a + r.amount, 0);
    rows[rows.length - 1].amount += diff;
  }
  return rows;
}
