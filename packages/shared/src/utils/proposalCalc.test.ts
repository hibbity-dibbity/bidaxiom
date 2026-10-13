import test from "node:test";
import assert from "node:assert/strict";
import {
  computeProposal,
  applyAcceptance,
  computeSchedule,
  milestonesTotal100,
  priceFromCostCents,
  spreadByWeight,
  type CostLineInput,
} from "./proposalCalc";

const L = (
  id: string,
  parentId: string | null,
  type: CostLineInput["type"],
  quantity: number,
  unitCost: number,
  extra: Partial<CostLineInput> = {}
): CostLineInput => ({ id, parentId, type, quantity, unitCost, marginPercent: 25, ...extra });

// 26-014 Retail Tenant Improvement sample from the mockup
const sample = () => ({
  lines: [
    L("p1", null, "other", 0, 0),
    L("c1", "p1", "labor", 160, 48),
    L("c2", "p1", "material", 320, 14.5),
    L("c3", "p1", "subcontractor", 1, 6200),
    L("p2", null, "other", 0, 0),
    L("c4", "p2", "subcontractor", 1, 18500),
    L("c5", "p2", "material", 42, 96),
    L("c6", "p2", "labor", 60, 52),
    L("p3", null, "other", 0, 0),
    L("c7", "p3", "material", 1, 3850),
    L("c8", "p3", "labor", 80, 50),
    L("o1", null, "material", 1, 2400, { isOptional: true }),
    L("o2", null, "subcontractor", 1, 3000, { isOptional: true }),
  ],
  globals: [
    { id: "g1", amount: 4200 },
    { id: "g2", amount: 850 },
  ],
  taxRatePercent: 7.5,
});

test("price = cost / (1 - margin)", () => {
  assert.equal(priceFromCostCents(10000, 25), 13333);
  assert.equal(priceFromCostCents(10000, 0), 10000);
  assert.throws(() => priceFromCostCents(10000, 100), RangeError);
  assert.throws(() => priceFromCostCents(10000, -1), RangeError);
});

test("spreadByWeight sums exactly to the total", () => {
  const shares = spreadByWeight(10000, [1, 1, 1]);
  assert.equal(shares.reduce((a, s) => a + s, 0), 10000);
  assert.deepEqual(spreadByWeight(500, [0, 0]), [0, 0]);
});

test("26-014 sample totals match the mockup", () => {
  const r = computeProposal(sample());
  assert.equal(r.totals.baseCost, 5202200);
  assert.equal(r.totals.basePrice, 6936267);
  assert.equal(r.totals.globalTotal, 505000);
  assert.equal(r.totals.tax, 125220);
  assert.equal(r.totals.total, 7566487);
});

test("global costs spread by share of base cost and sum exactly", () => {
  const r = computeProposal(sample());
  assert.equal(r.parents.reduce((a, p) => a + p.globalShare, 0), 505000);
  const p1 = r.parents.find((p) => p.id === "p1")!;
  // p1 cost 18,520 of 52,022 total = ~35.6%
  assert.equal(p1.globalShare, Math.round((505000 * p1.cost) / 5202200));
  assert.equal(p1.proposalPrice, p1.price + p1.globalShare);
});

test("options stay out of base totals and get no global share", () => {
  const r = computeProposal(sample());
  assert.equal(r.parents.length, 3);
  assert.equal(r.options.length, 2);
  assert.equal(r.options[0].price, 320000);
  assert.equal(r.options[0].tax, 24000);
  assert.equal(r.options[1].price, 400000);
  assert.equal(r.options[1].tax, 0);
});

test("accepting option 1 gives contract value 79,104.87 and cost budget 54,422", () => {
  const r = computeProposal(sample());
  const a = applyAcceptance(r, ["o1"]);
  assert.equal(a.contractValue, 7910487);
  assert.equal(a.costBudget, 5442200);
  const none = applyAcceptance(r, []);
  assert.equal(none.contractValue, r.totals.total);
  assert.equal(none.costBudget, r.totals.baseCost);
});

test("parent price is the sum of its children", () => {
  const r = computeProposal(sample());
  const kids = ["c1", "c2", "c3"].map((id) => r.lines[id]);
  assert.equal(r.lines["p1"].price, kids.reduce((a, k) => a + k.price, 0));
  assert.equal(r.lines["p1"].cost, kids.reduce((a, k) => a + k.cost, 0));
});

test("a parent with no children prices its own quantity x unit cost", () => {
  const r = computeProposal({
    lines: [L("solo", null, "labor", 10, 100)],
    globals: [],
    taxRatePercent: 0,
  });
  assert.equal(r.totals.baseCost, 100000);
  assert.equal(r.totals.basePrice, 133333);
});

test("milestones must total 100 and the last absorbs rounding", () => {
  const m = [
    { id: "m1", percent: 30 },
    { id: "m2", percent: 40 },
    { id: "m3", percent: 25 },
    { id: "m4", percent: 5 },
  ];
  assert.equal(milestonesTotal100(m), true);
  assert.equal(milestonesTotal100([{ id: "x", percent: 99.9 }]), false);
  const rows = computeSchedule(7910487, m);
  assert.equal(rows.reduce((a, r) => a + r.amount, 0), 7910487);
  assert.equal(rows[0].amount, 2373146);
  const thirds = computeSchedule(10000, [
    { id: "a", percent: 33.33 },
    { id: "b", percent: 33.33 },
    { id: "c", percent: 33.34 },
  ]);
  assert.equal(thirds.reduce((a, r) => a + r.amount, 0), 10000);
});
