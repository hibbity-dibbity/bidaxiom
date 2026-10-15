/**
 * Material takeoff calculators: concrete slab and pre-engineered metal building.
 * Both turn a handful of dimensions into a priced material list. Rules come from the
 * estimator spreadsheets; every quantity and price can be overridden by the user afterwards.
 */

export type TakeoffKind = "concrete" | "metal_building";
export type TakeoffLineType = "material" | "equipment" | "labor" | "subcontractor" | "other";

export interface TakeoffLine {
  key: string;
  group: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  type: TakeoffLineType;
  /** informational only: shown in the list but not priced or sent to a proposal */
  info?: boolean;
}

const YD3_PER_IN3 = 1 / 46656;
const ceil = (n: number) => Math.ceil(n - 1e-9);
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ----------------------------------------------------------------- concrete */

export const PSI_UPCHARGE: Record<number, number> = {
  3000: 0, 3500: 4, 4000: 8, 4500: 13, 5000: 18, 5500: 22, 6000: 27,
};
export const REBAR_LB_PER_FT: Record<string, number> = { "#3": 0.376, "#4": 0.668, "#5": 1.043, "#6": 1.502 };

export interface ConcreteInputs {
  widthFt: number;
  lengthFt: number;
  slabIn: number;
  perimBeamWidthIn: number;
  perimBeamDepthIn: number;
  intBeamWidthIn: number;
  intBeamDepthIn: number;
  intBeamQty: number;
  psi: number;
  piers: number;
  pierDiameterIn: number;
  pierDepthIn: number;
  bellPiers: boolean;
  dirtPadIn: number;
  /** price per yard of 3000 psi concrete */
  baseYardCost: number;
  /** price of fill dirt, per 7 yd load */
  dirtLoadCost: number;
  /** reinforcement allowance, $ per sq ft of slab (used unless a rebar stick price is given) */
  reinforcementPerSf: number;
  rebarSize: string;
  rebarSpacingIn: number;
  /** bars running in each beam */
  beamBars: number;
  /** price of one 20 ft stick of rebar; 0 = covered by the allowance */
  rebarStickCost: number;
  /** overage on concrete, percent */
  wastePercent: number;
}

export const DEFAULT_CONCRETE: ConcreteInputs = {
  widthFt: 40, lengthFt: 80, slabIn: 5,
  perimBeamWidthIn: 14, perimBeamDepthIn: 24, intBeamWidthIn: 14, intBeamDepthIn: 24, intBeamQty: 2,
  psi: 4000, piers: 0, pierDiameterIn: 12, pierDepthIn: 108, bellPiers: false, dirtPadIn: 0,
  baseYardCost: 155, dirtLoadCost: 110, reinforcementPerSf: 1,
  rebarSize: "#4", rebarSpacingIn: 18, beamBars: 4, rebarStickCost: 0, wastePercent: 5,
};

export interface ConcreteResult {
  yards: number;
  yardsWithWaste: number;
  pricePerYard: number;
  dirtYards: number;
  rebarSticks: number;
  rebarLbs: number;
  sqft: number;
  lines: TakeoffLine[];
  total: number;
  costPerSf: number;
  warnings: string[];
}

export function computeConcrete(i: ConcreteInputs): ConcreteResult {
  const warnings: string[] = [];
  const perimFt = 2 * i.widthFt + 2 * i.lengthFt;
  const slab = (i.widthFt + 1) * 12 * ((i.lengthFt + 1) * 12) * i.slabIn;
  const perimBeam = Math.max(0, i.perimBeamDepthIn - i.slabIn) * i.perimBeamWidthIn * perimFt * 12;
  const intBeam = Math.max(0, i.intBeamDepthIn - i.slabIn) * i.intBeamWidthIn * i.widthFt * 12 * i.intBeamQty;
  const pierEach = Math.PI * (i.pierDiameterIn / 2) ** 2 * i.pierDepthIn;
  const piers = pierEach * i.piers * (i.bellPiers ? 1.25 : 1);
  const yards = (slab + perimBeam + intBeam + piers) * YD3_PER_IN3;
  const yardsWithWaste = yards * (1 + i.wastePercent / 100);
  const upcharge = PSI_UPCHARGE[i.psi];
  if (upcharge === undefined) warnings.push(`No upcharge is set for ${i.psi} psi; priced as 3000 psi.`);
  const pricePerYard = i.baseYardCost + (upcharge ?? 0);
  const sqft = i.widthFt * i.lengthFt;
  const dirtYards = ((sqft * 144 * i.dirtPadIn) * 1.5) * YD3_PER_IN3;
  const dirtLoads = dirtYards / 7;

  // Rebar: a mat each way in the slab, bars in each beam, bars in each pier.
  const matBarsAcross = ceil((i.widthFt * 12) / i.rebarSpacingIn) + 1; // run the length
  const matBarsAlong = ceil((i.lengthFt * 12) / i.rebarSpacingIn) + 1; // run the width
  const matFt = matBarsAcross * i.lengthFt + matBarsAlong * i.widthFt;
  const beamFt = (i.perimBeamWidthIn > 0 ? perimFt : 0) * i.beamBars +
    (i.intBeamWidthIn > 0 ? i.widthFt * i.intBeamQty * i.beamBars : 0);
  const pierFt = i.piers * 4 * (i.pierDepthIn / 12);
  const totalFt = (matFt + beamFt + pierFt) * 1.1; // 10% for laps
  const sticks = ceil(totalFt / 20);
  const lbs = totalFt * (REBAR_LB_PER_FT[i.rebarSize] ?? REBAR_LB_PER_FT["#4"]);

  const lines: TakeoffLine[] = [
    { key: "concrete", group: "Concrete", name: `Concrete ${i.psi} psi (incl. ${i.wastePercent}% overage)`, quantity: round2(yardsWithWaste), unit: "yd", unitCost: pricePerYard, type: "material" },
  ];
  if (dirtLoads > 0) {
    lines.push({ key: "dirt", group: "Site", name: "Fill dirt (7 yd loads)", quantity: round2(dirtLoads), unit: "load", unitCost: i.dirtLoadCost, type: "material" });
  }
  if (i.rebarStickCost > 0) {
    lines.push({ key: "rebar", group: "Reinforcement", name: `Rebar ${i.rebarSize} x 20'`, quantity: sticks, unit: "ea", unitCost: i.rebarStickCost, type: "material" });
  } else {
    lines.push({ key: "reinf", group: "Reinforcement", name: "Reinforcement allowance", quantity: round2(sqft), unit: "sf", unitCost: i.reinforcementPerSf, type: "material" });
    lines.push({ key: "rebar", group: "Reinforcement", name: `Rebar ${i.rebarSize} x 20' (included in allowance)`, quantity: sticks, unit: "ea", unitCost: 0, type: "material", info: true });
  }
  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  return {
    yards: round2(yards), yardsWithWaste: round2(yardsWithWaste), pricePerYard, dirtYards: round2(dirtYards),
    rebarSticks: sticks, rebarLbs: Math.round(lbs), sqft, lines, total: round2(total),
    costPerSf: sqft > 0 ? round2(total / sqft) : 0, warnings,
  };
}

/* ------------------------------------------------------------ metal building */

export interface MetalBuildingInputs {
  widthFt: number;
  lengthFt: number;
  eaveFt: number;
  /** distance between frames */
  bayFt: number;
  purlinSpacingFt: number;
  girtSpacingFt: number;
  walkDoors: number;
  rollUp12: number;
  rollUp10: number;
  rollUp8: number;
  awningLengthFt: number;
  awningProjectionFt: number;
  gutters: number;
}

export const DEFAULT_METAL: MetalBuildingInputs = {
  widthFt: 40, lengthFt: 80, eaveFt: 16, bayFt: 27, purlinSpacingFt: 4, girtSpacingFt: 4,
  walkDoors: 2, rollUp12: 0, rollUp10: 0, rollUp8: 0, awningLengthFt: 0, awningProjectionFt: 6, gutters: 1,
};

/** Default unit prices (before sales tax), from the estimator spreadsheet. Editable per takeoff. */
export const METAL_PRICES: Record<string, number> = {
  columns: 216, beams: 252, purlins: 56.1, girts: 38.2, roofSheets: 65.35, peakSheets: 14.5,
  endwallSheets: 58.82, sidewallSheets: 52.28, awningColumns: 51, awningPurlins: 56.1,
  awningClips: 2.95, awningSheets: 49.02, walkDoors: 799.2, purlinClips: 2.95, girtClips: 2.95,
  closure: 78, bolts: 1.35, eaveStruts: 105, rakeTrim: 16.9, gutters: 2500, laptek: 0.0915,
  drilltek: 0.1056, rollDope: 68, rollUp12: 1703, rollUp10: 1295.12, rollUp8: 795,
  miscTrim: 1500, miscMaterial: 1500,
};

export interface MetalBuildingResult {
  lines: TakeoffLine[];
  total: number;
  frames: number;
  surfaceSf: number;
  warnings: string[];
}

export function computeMetalBuilding(i: MetalBuildingInputs, prices: Record<string, number> = {}): MetalBuildingResult {
  const p = (k: string) => prices[k] ?? METAL_PRICES[k] ?? 0;
  const run = i.widthFt / 2;
  const slope = Math.sqrt(run * run + (run / 12) ** 2); // 1:12 roof
  const bays = Math.max(1, ceil(i.lengthFt / i.bayFt));
  const frames = bays + 1;
  const perim = 2 * i.widthFt + 2 * i.lengthFt;
  const purlinRows = 2 * ceil(run / i.purlinSpacingFt);
  const girtRows = Math.max(1, ceil(i.eaveFt / i.girtSpacingFt));
  const purlins = purlinRows * ceil(i.lengthFt / 20);
  const girts = girtRows * ceil(perim / 20);
  const sheetCols = ceil(i.lengthFt / 3);
  const surface = 2 * i.lengthFt * i.eaveFt + 2 * i.widthFt * (i.eaveFt + 3) + (i.widthFt + 2) * i.lengthFt;
  const awn = i.awningLengthFt > 0;
  const awnPurlins = awn ? ceil(i.awningProjectionFt / 3) * ceil(i.awningLengthFt / 20) : 0;
  const roundTo = (n: number, step: number) => ceil(n / step) * step;

  const L = (key: string, group: string, name: string, quantity: number, unit = "ea", type: TakeoffLineType = "material"): TakeoffLine =>
    ({ key, group, name, quantity, unit, unitCost: p(key), type });
  const all: TakeoffLine[] = [
    L("columns", "Frame", "Main columns", 2 * frames),
    L("beams", "Frame", "Main beams", 2 * frames),
    L("purlins", "Framing", "Purlins", purlins),
    L("girts", "Framing", "Girts", girts),
    L("eaveStruts", "Framing", "Eave struts", 2 * ceil(i.lengthFt / 20)),
    L("roofSheets", "Panels", "Roof sheets", 2 * sheetCols),
    L("peakSheets", "Panels", "Peak sheets", sheetCols),
    L("endwallSheets", "Panels", "Endwall sheets", ceil((2 * i.widthFt) / 3)),
    L("sidewallSheets", "Panels", "Sidewall sheets", ceil((2 * i.lengthFt) / 3)),
    L("awningColumns", "Awning", "Awning columns", awn ? ceil(i.awningLengthFt / 10) + 1 : 0),
    L("awningPurlins", "Awning", "Awning purlins", awnPurlins),
    L("awningClips", "Awning", "Awning purlin clips", awnPurlins),
    L("awningSheets", "Awning", "Awning sheets", awn ? ceil(i.awningLengthFt / 3) : 0),
    L("walkDoors", "Doors", "3070 walk door", i.walkDoors),
    L("rollUp12", "Doors", "12x12 roll up door", i.rollUp12),
    L("rollUp10", "Doors", "10x10 roll up door", i.rollUp10),
    L("rollUp8", "Doors", "8x8 roll up door", i.rollUp8),
    L("purlinClips", "Hardware", "Purlin clips", purlins + 10),
    L("girtClips", "Hardware", "Girt clips", girts + 2),
    L("closure", "Hardware", "Closure strips", 2 * bays),
    L("bolts", "Hardware", "Bolts", 125 * frames),
    L("laptek", "Hardware", "Laptek screws", roundTo(surface * 0.67, 500)),
    L("drilltek", "Hardware", "Drilltek screws", roundTo(surface * 0.8, 500)),
    L("rollDope", "Hardware", "Roll dope (sealant)", ceil(surface / 1500)),
    L("rakeTrim", "Trim", "Rake trim", ceil((4 * run) / 16)),
    L("gutters", "Trim", "Gutter", i.gutters, "lot"),
    L("miscTrim", "Trim", "Misc trim", 1, "lot"),
    L("miscMaterial", "Other", "Misc material", 1, "lot"),
  ];
  const lines = all.filter((l) => l.quantity > 0);
  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  return { lines, total: round2(total), frames, surfaceSf: Math.round(surface), warnings: [] };
}

/** Apply the user's overrides (quantity and unit cost by line key) to computed lines. */
export function applyOverrides(
  lines: TakeoffLine[],
  qty: Record<string, number>,
  cost: Record<string, number>
): TakeoffLine[] {
  return lines.map((l) => ({
    ...l,
    quantity: qty[l.key] ?? l.quantity,
    unitCost: cost[l.key] ?? l.unitCost,
  }));
}

export function takeoffTotal(lines: TakeoffLine[]): number {
  return round2(lines.filter((l) => !l.info).reduce((s, l) => s + l.quantity * l.unitCost, 0));
}
