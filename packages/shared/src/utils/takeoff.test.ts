import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetalBuilding, DEFAULT_METAL, computeConcrete, DEFAULT_CONCRETE, takeoffTotal } from "./takeoff";

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
