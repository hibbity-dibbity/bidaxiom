/**
 * CSI MasterFormat 50-division reference data (client-side copy).
 *
 * SOURCE OF TRUTH: apps/api/src/db/seed/csi-divisions.ts
 * This is a client-side duplicate for use in UI components.
 * Keep in sync with the API seed data.
 */

export const CSI_DIVISIONS = [
  // General Requirements
  { number: 0, name: "Procurement and Contracting Requirements" },
  { number: 1, name: "General Requirements" },

  // Facility Construction
  { number: 2, name: "Existing Conditions" },
  { number: 3, name: "Concrete" },
  { number: 4, name: "Masonry" },
  { number: 5, name: "Metals" },
  { number: 6, name: "Wood, Plastics, and Composites" },
  { number: 7, name: "Thermal and Moisture Protection" },
  { number: 8, name: "Openings" },
  { number: 9, name: "Finishes" },
  { number: 10, name: "Specialties" },
  { number: 11, name: "Equipment" },
  { number: 12, name: "Furnishings" },
  { number: 13, name: "Special Construction" },
  { number: 14, name: "Conveying Equipment" },

  // Facility Services
  { number: 21, name: "Fire Suppression" },
  { number: 22, name: "Plumbing" },
  { number: 23, name: "Heating, Ventilating, and Air Conditioning (HVAC)" },
  { number: 26, name: "Electrical" },
  { number: 27, name: "Communications" },
  { number: 28, name: "Electronic Safety and Security" },

  // Site and Infrastructure
  { number: 31, name: "Earthwork" },
  { number: 32, name: "Exterior Improvements" },
  { number: 33, name: "Utilities" },
  { number: 34, name: "Transportation" },
  { number: 35, name: "Waterway and Marine Construction" },
] as const;

export type CSIDivisionNumber = (typeof CSI_DIVISIONS)[number]["number"];
