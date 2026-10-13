import test from "node:test";
import assert from "node:assert/strict";
import { computeProposal, type CostLineInput } from "./proposalCalc";
import { buildCustomerView } from "./proposalCustomerView";

const calc: CostLineInput[] = [
  { id: "p", parentId: null, type: "other", quantity: 0, unitCost: 0, marginPercent: 0 },
  { id: "a", parentId: "p", type: "labor", quantity: 1, unitCost: 1000, marginPercent: 20, contingencyPercent: 10 },
  { id: "b", parentId: "p", type: "material", quantity: 1, unitCost: 500, marginPercent: 20 },
  { id: "c", parentId: "p", type: "equipment", quantity: 1, unitCost: 100, marginPercent: 20 },
  { id: "o", parentId: null, type: "other", quantity: 0, unitCost: 0, marginPercent: 0, isOptional: true },
  { id: "o1", parentId: "o", type: "labor", quantity: 1, unitCost: 200, marginPercent: 0 },
];

test("customer view honors child visibility and includes only allow-listed fields", () => {
  const result = computeProposal({ lines: calc, globals: [{ id: "g", amount: 100 }], taxRatePercent: 10 });
  const view = buildCustomerView({
    lines: [
      { id: "p", parentId: null, name: "Electrical", visibility: "price", isOptional: false },
      { id: "a", parentId: "p", name: "Rough-in", visibility: "price", isOptional: false },
      { id: "b", parentId: "p", name: "Fixtures", visibility: "name_only", isOptional: false },
      { id: "c", parentId: "p", name: "Lift rental", visibility: "hidden", isOptional: false },
      { id: "o", parentId: null, name: "Extra circuit", visibility: "price", isOptional: true },
      { id: "o1", parentId: "o", name: "Labor", visibility: "name_only", isOptional: false },
    ],
    result,
    milestones: [
      { id: "m1", name: "Deposit", percent: 50 },
      { id: "m2", name: "Final", percent: 50 },
    ],
  });
  const g = view.groups[0];
  assert.deepEqual(g.lines.map((l) => l.name), ["Rough-in", "Fixtures"]); // hidden line omitted
  assert.equal(g.lines[0].mode, "price");
  assert.equal(g.lines[0].price, 137500); // 1100 / 0.8
  assert.equal(g.lines[1].price, null);
  assert.equal(g.price, result.parents[0].proposalPrice);
  assert.equal(view.total, result.totals.total);
  assert.equal(view.schedule.reduce((a, r) => a + r.amount, 0), view.total);
  assert.equal(view.options[0].price, 20000);
  // nothing cost-related leaks into the payload
  const json = JSON.stringify(view);
  for (const key of ["cost", "margin", "profit", "contingency", "vendor", "notes"]) {
    assert.ok(!json.toLowerCase().includes(`"${key}`), `leaked ${key}`);
  }
  assert.ok(!json.includes("Lift rental"));
});
