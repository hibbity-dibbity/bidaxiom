import test from "node:test";
import assert from "node:assert/strict";
import { computeProposal, applyAcceptance, type CostLineInput } from "./proposalCalc";
import { generateDraftOrders, costCategoryForType, formatDocNumber, type OrderSourceLine } from "./proposalOrders";

const calc: CostLineInput[] = [
  { id: "p", parentId: null, type: "other", quantity: 0, unitCost: 0, marginPercent: 0 },
  { id: "l1", parentId: "p", type: "labor", quantity: 10, unitCost: 50, marginPercent: 25 },
  { id: "m1", parentId: "p", type: "material", quantity: 1, unitCost: 1000, marginPercent: 25, contingencyPercent: 10 },
  { id: "m2", parentId: "p", type: "material", quantity: 1, unitCost: 300, marginPercent: 25 },
  { id: "s1", parentId: "p", type: "subcontractor", quantity: 1, unitCost: 5000, marginPercent: 25 },
  { id: "n1", parentId: "p", type: "other", quantity: 1, unitCost: 0, marginPercent: 0 },
  { id: "o", parentId: null, type: "other", quantity: 0, unitCost: 0, marginPercent: 0, isOptional: true },
  { id: "o1", parentId: "o", type: "material", quantity: 1, unitCost: 400, marginPercent: 25 },
  { id: "o2", parentId: "o", type: "labor", quantity: 1, unitCost: 200, marginPercent: 25 },
  { id: "x", parentId: null, type: "other", quantity: 0, unitCost: 0, marginPercent: 0, isOptional: true },
  { id: "x1", parentId: "x", type: "material", quantity: 1, unitCost: 999, marginPercent: 25 },
];
const src = (id: string, parentId: string | null, name: string, type: any, vendorId: string | null, _unused: number | null, isOptional = false): OrderSourceLine =>
  ({ id, parentId, name, type, vendorId, isOptional });
const lines: OrderSourceLine[] = [
  src("p", null, "Electrical", "other", null, null),
  src("l1", "p", "Rough-in labor", "labor", null, 26),
  src("m1", "p", "Wire", "material", "vA", 26),
  src("m2", "p", "Boxes", "material", "vA", 26),
  src("s1", "p", "Panel install", "subcontractor", "vB", 26),
  src("n1", "p", "Excludes permits", "other", null, null),
  src("o", null, "Extra circuit", "other", null, null, true),
  src("o1", "o", "Breaker", "material", null, 26),
  src("o2", "o", "Install", "labor", null, null),
  src("x", null, "Declined option", "other", null, null, true),
  src("x1", "x", "Declined mat", "material", "vA", 26),
];

test("draft orders group by kind and vendor, include accepted options only, unassigned last", () => {
  const result = computeProposal({ lines: calc, globals: [], taxRatePercent: 0 });
  const orders = generateDraftOrders(lines, result, ["o"]);
  const summary = orders.map((o) => `${o.kind}:${o.vendorId ?? "unassigned"}:${o.lines.length}`);
  assert.deepEqual(summary, ["purchase:vA:2", "purchase:unassigned:1", "work:vB:1", "work:unassigned:2"]);
  const vA = orders[0];
  assert.equal(vA.lines[0].budgetCost, 110000); // 1000 + 10% contingency
  assert.equal(vA.total, 110000 + 30000);
  assert.equal(vA.lines[0].description, "Electrical: Wire");
  // frozen budget equals the acceptance cost budget (excluding "other" lines which have no cost)
  const acc = applyAcceptance(result, ["o"]);
  assert.equal(orders.reduce((a, o) => a + o.total, 0), acc.costBudget);
  // declined option and "other" lines create nothing
  assert.ok(!orders.some((o) => o.lines.some((l) => l.sourceLineId === "x1" || l.sourceLineId === "n1")));
});

test("cost categories follow line type and numbers use the project number", () => {
  assert.equal(costCategoryForType("labor"), "COGS: Subcontract Labor");
  assert.equal(costCategoryForType("subcontractor"), "COGS: Subcontract Labor");
  assert.equal(costCategoryForType("equipment"), "COGS: Equipment Rental");
  assert.equal(costCategoryForType("material"), "COGS: Materials & Supplies");
  assert.equal(costCategoryForType("other"), null);
  assert.equal(formatDocNumber("PO", "24-101", 1), "PO24-101-01");
  assert.equal(formatDocNumber("INV", "24-101", 12), "INV24-101-12");
});
