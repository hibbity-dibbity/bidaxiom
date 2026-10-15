import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseBays, splitSheets, computeMetalBuilding, DEFAULT_METAL, computeConcrete, DEFAULT_CONCRETE, takeoffTotal } from "./takeoff";

test("metal building 40x80x16 reproduces the spreadsheet counts", () => {
  const r = computeMetalBuilding(DEFAULT_METAL);
  const q = Object.fromEntries(r.lines.map((l) => [l.key, l.quantity]));
  assert.equal(q.columns, 8);
  assert.equal(q.beams, 8);
  assert.equal(q.purlins, 40);
  assert.equal(q.girts, 48);
  assert.equal(q.roofSheets, 54);
  assert.equal(q.peakSheets, 27);
  assert.equal(q.endwallSheets, 27);
  assert.equal(q.sidewallSheets, 54);
  assert.equal(q.eaveStruts, 8);
  assert.equal(q.rakeTrim, 5);
  assert.equal(q.purlinClips, 50);
  assert.equal(q.girtClips, 50);
  assert.equal(q.closure, 6);
  assert.equal(q.bolts, 500);
  assert.equal(q.laptek, 5000);
  assert.equal(q.drilltek, 6000);
  assert.equal(q.rollDope, 5);
});

test("concrete: slab only matches the spreadsheet formula", () => {
  // 15 x 170 slab, 4.5 in, no beams or piers: sheet gives 37.99 yd
  const r = computeConcrete({ ...DEFAULT_CONCRETE, widthFt: 15, lengthFt: 170, slabIn: 4.5, perimBeamWidthIn: 0, perimBeamDepthIn: 0, intBeamWidthIn: 0, intBeamDepthIn: 0, intBeamQty: 0 });
  assert.ok(Math.abs(r.yards - 37.99) < 0.01);
  assert.equal(r.pricePerYard, 163);
  assert.ok(takeoffTotal(r.lines) > 0);
});

test("bay count: even bays between 20 and 30 ft, nearest 25", () => {
  assert.equal(chooseBays(24), 1);
  assert.equal(chooseBays(40), 2);
  assert.equal(chooseBays(80), 3); // 26.7 ft
  assert.equal(chooseBays(100), 4); // 25 ft
  assert.equal(chooseBays(150), 6); // 25 ft
  assert.equal(chooseBays(200), 8);
});

test("long runs are split into two lapped rows", () => {
  assert.deepEqual(splitSheets(20.07, 28, 12), { rows: 1, pieceFt: 21 });
  const r = splitSheets(36, 28, 12);
  assert.equal(r.rows, 2);
  assert.ok(r.pieceFt * 2 - 1 >= 36);
  const wide = computeMetalBuilding({ ...DEFAULT_METAL, widthFt: 100 });
  assert.ok(wide.lines.find((l) => l.key === "roofSheets")!.name.includes("2 rows"));
});

test("long rebar runs add lap splices", () => {
  const short = computeConcrete({ ...DEFAULT_CONCRETE, widthFt: 15, lengthFt: 18, perimBeamWidthIn: 0, intBeamWidthIn: 0, intBeamQty: 0 });
  const long = computeConcrete({ ...DEFAULT_CONCRETE, widthFt: 15, lengthFt: 60, perimBeamWidthIn: 0, intBeamWidthIn: 0, intBeamQty: 0 });
  assert.ok(long.rebarLbs / (15 * 60) > short.rebarLbs / (15 * 18));
});
