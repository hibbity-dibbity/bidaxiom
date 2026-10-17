/**
 * Starter proposal templates. Each is one parent group: a hidden Labor line and a hidden Material line (to build
 * costs in), then name-only lines that print on the proposal as inclusions and exclusions. Quantities and costs are
 * left at zero for the contractor to fill in per job; the wording is a draft to edit.
 */

export interface StarterLine {
  type: "labor" | "material" | "subcontractor" | "equipment" | "other";
  name: string;
  quantity: number;
  unit: string;
  visibility: "price" | "name_only" | "hidden";
}

export interface StarterTemplate {
  name: string;
  description: string;
  parent: { name: string };
  children: StarterLine[];
}

const hidden = (type: "labor" | "material", unit: string): StarterLine => ({ type, name: type === "labor" ? "Labor" : "Material", quantity: 1, unit, visibility: "hidden" });
const note = (name: string): StarterLine => ({ type: "other", name, quantity: 0, unit: "ea", visibility: "name_only" });

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Concrete Slab on Grade",
    description: "Slab for a building or pad. Fill in labor and material costs per job.",
    parent: { name: "Concrete Slab on Grade" },
    children: [
      hidden("labor", "ls"),
      hidden("material", "ls"),
      note('Includes: 4" thick concrete slab on grade, 3,500 psi'),
      note("Includes: Reinforcing as specified for the slab (rebar, wire mesh or fiber)"),
      note("Includes: Vapor barrier under the slab"),
      note("Includes: Forming, placing, screeding and finishing (broom or troweled finish)"),
      note("Includes: Control joints and curing"),
      note("Excludes: Site clearing, excavation, rock removal and subgrade or base preparation unless listed"),
      note("Excludes: Footings, stem walls and thickened edges unless listed"),
      note("Excludes: Underslab plumbing, electrical and utility sleeves"),
      note("Excludes: Sealers, hardeners, coatings and polished finishes"),
      note("Excludes: Soils testing, engineering and special inspections"),
      note("Excludes: Permits and fees; cold-weather protection and extra winter measures"),
    ],
  },
  {
    name: "Pre-Engineered Metal Building",
    description: "Metal building package with erection. Fill in labor and material costs per job.",
    parent: { name: "Pre-Engineered Metal Building" },
    children: [
      hidden("labor", "ls"),
      hidden("material", "ls"),
      note("Includes: Pre-engineered metal building package: primary and secondary framing, roof and wall panels, trim and fasteners"),
      note("Includes: Manufacturer's engineered drawings and anchor bolt plan"),
      note("Includes: Delivery of the building package to the site"),
      note("Includes: Erection of the frame, roof and wall panels and trim"),
      note("Excludes: Concrete foundation and slab (priced separately)"),
      note("Excludes: Insulation (priced separately)"),
      note("Excludes: Doors, overhead doors and windows unless listed"),
      note("Excludes: Gutters, downspouts and special trim unless listed"),
      note("Excludes: Electrical, plumbing, mechanical and fire protection"),
      note("Excludes: Site work, permits, impact fees and inspections"),
    ],
  },
  {
    name: 'Insulation: 3" Vinyl-Backed',
    description: 'Vinyl-backed blanket insulation, 3". Fill in labor and material costs per job.',
    parent: { name: 'Insulation: 3" Vinyl-Backed' },
    children: [
      hidden("labor", "sf"),
      hidden("material", "sf"),
      note('Includes: 3" vinyl-backed blanket insulation'),
      note("Includes: Installation with seams and edges taped and sealed"),
      note("Excludes: Interior liner panels or wall finishes"),
      note("Excludes: Spray foam, rigid board or higher R-value insulation unless listed"),
      note("Excludes: Fire-rated assemblies and special vapor barriers beyond the vinyl facing"),
      note("Excludes: Permits and inspections"),
    ],
  },
];
