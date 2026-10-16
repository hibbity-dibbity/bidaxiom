import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProposal, computeSchedule, applyAcceptance } from "./proposalCalc";

const lines = [
  { id: "p", parentId: null, type: "other" as const, quantity: 1, unitCost: 0, marginPercent: 0 },
  { id: "a", parentId: "p", type: "material" as const, quantity: 3, unitCost: 33.33, marginPercent: 20 },
  { id: "b", parentId: "p", type: "labor" as const, quantity: 7, unitCost: 41.17, marginPercent: 25, contingencyPercent: 5 },
  { id: "o", parentId: null, type: "material" as const, quantity: 2, unitCost: 119.99, marginPercent: 18, isOptional: true },
];
const globals = [{ id: "g", amount: 1234.56 }];

test("rounded prices are whole dollars and everything adds up", () => {
  const r = computeProposal({ lines, globals, taxRatePercent: 7.25, roundToDollar: true });
  for (const id of ["a", "b", "p"]) assert.equal(r.lines[id].price % 100, 0);
  assert.equal(r.totals.basePrice, r.lines.a.price + r.lines.b.price);
  assert.equal(r.totals.globalTotal % 100, 0);
  assert.equal(r.parents[0].globalShare % 100, 0);
  assert.equal(r.totals.tax % 100, 0);
  assert.equal(r.totals.total, r.totals.basePrice + r.totals.globalTotal + r.totals.tax);
  assert.equal(r.options[0].price % 100, 0);
  assert.equal(r.options[0].tax % 100, 0);
  const acc = applyAcceptance(r, ["o"]);
  assert.equal(acc.contractValue % 100, 0);
  const ms = [{ id: "1", percent: 33.33 }, { id: "2", percent: 33.33 }, { id: "3", percent: 33.34 }];
  const rows = computeSchedule(acc.contractValue, ms, true);
  rows.forEach((x) => assert.equal(x.amount % 100, 0));
  assert.equal(rows.reduce((a, x) => a + x.amount, 0), acc.contractValue);
});

test("without rounding nothing changes", () => {
  const a = computeProposal({ lines, globals, taxRatePercent: 7.25 });
  const b = computeProposal({ lines, globals, taxRatePercent: 7.25, roundToDollar: false });
  assert.deepEqual(a, b);
});
