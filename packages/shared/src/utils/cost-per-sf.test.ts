import test from "node:test";
import assert from "node:assert/strict";
import { buildCostPerSf, categorizeLine, DEFAULT_SF_CATEGORIES, OTHER_CATEGORY } from "./cost-per-sf";

const proj = (id: string, sqft: number) => ({ id, name: id, jobNumber: id, slug: id, sqft, phase: "active" });

test("first matching category wins, so erection is not counted as material", () => {
  assert.equal(categorizeLine("PEMB Erection - labor", DEFAULT_SF_CATEGORIES), "PEMB Erection");
  assert.equal(categorizeLine("PEMB building package", DEFAULT_SF_CATEGORIES), "PEMB Material");
  assert.equal(categorizeLine("Misc hardware", DEFAULT_SF_CATEGORIES), null);
});

test("weighted and job averages, and a job without the category is left out of it", () => {
  const projects = [proj("A", 10000), proj("B", 5000), proj("C", 5000), proj("D", 0)];
  const lines = [
    { projectId: "A", description: "PEMB package", amount: 100000 }, // 10/sf
    { projectId: "B", description: "PEMB package", amount: 100000 }, // 20/sf
    { projectId: "A", description: "Concrete slab", amount: 50000 },
    { projectId: "C", description: "Odd item", amount: 1000 },
    { projectId: "D", description: "PEMB package", amount: 999999 }, // no sf: ignored
  ];
  const r = buildCostPerSf(projects, lines, DEFAULT_SF_CATEGORIES);
  const pemb = r.stats.find((s) => s.name === "PEMB Material")!;
  assert.equal(pemb.jobs, 2);
  assert.equal(pemb.weighted, 13.33); // 200000 / 15000
  assert.equal(pemb.jobAverage, 15); // (10 + 20) / 2
  assert.equal(pemb.low, 10);
  assert.equal(pemb.high, 20);
  const conc = r.stats.find((s) => s.name === "Concrete")!;
  assert.equal(conc.jobs, 1);
  assert.equal(conc.weighted, 5);
  assert.equal(r.stats.find((s) => s.name === OTHER_CATEGORY)!.totalCost, 1000);
  assert.equal(r.uncategorized[0].description, "Odd item");
  assert.equal(r.rows.length, 3);
});
