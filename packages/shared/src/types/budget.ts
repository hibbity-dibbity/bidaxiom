import { z } from "zod";

/**
 * Commitment type enum
 */
export const commitmentTypeEnum = z.enum(["subcontract", "purchase_order"]);
export type CommitmentType = z.infer<typeof commitmentTypeEnum>;

/**
 * Commitment status enum
 */
export const commitmentStatusEnum = z.enum(["draft", "pending", "approved", "executed", "closed"]);
export type CommitmentStatus = z.infer<typeof commitmentStatusEnum>;

/**
 * CSI MasterFormat divisions (commonly used)
 * Full list of construction cost code divisions
 */
export const CSI_DIVISIONS = [
  { division: 0, name: "Procurement and Contracting Requirements", description: "General requirements" },
  { division: 1, name: "General Requirements", description: "Administrative and temporary facilities" },
  { division: 2, name: "Existing Conditions", description: "Demolition and site remediation" },
  { division: 3, name: "Concrete", description: "Concrete forming and placement" },
  { division: 4, name: "Masonry", description: "Brick, block, and stone masonry" },
  { division: 5, name: "Metals", description: "Structural steel and metal fabrications" },
  { division: 6, name: "Wood, Plastics, and Composites", description: "Rough and finish carpentry" },
  { division: 7, name: "Thermal and Moisture Protection", description: "Insulation, roofing, siding" },
  { division: 8, name: "Openings", description: "Doors, windows, and glazing" },
  { division: 9, name: "Finishes", description: "Drywall, painting, flooring, ceilings" },
  { division: 10, name: "Specialties", description: "Toilet accessories, signage, lockers" },
  { division: 11, name: "Equipment", description: "Commercial and institutional equipment" },
  { division: 12, name: "Furnishings", description: "Casework, window treatments, furniture" },
  { division: 13, name: "Special Construction", description: "Pools, fountains, special structures" },
  { division: 14, name: "Conveying Equipment", description: "Elevators, escalators, lifts" },
  { division: 21, name: "Fire Suppression", description: "Fire sprinklers and suppression systems" },
  { division: 22, name: "Plumbing", description: "Plumbing fixtures and piping" },
  { division: 23, name: "HVAC", description: "Heating, ventilation, and air conditioning" },
  { division: 26, name: "Electrical", description: "Electrical power and lighting" },
  { division: 27, name: "Communications", description: "Data, voice, and security systems" },
  { division: 28, name: "Electronic Safety and Security", description: "Fire alarms, access control" },
  { division: 31, name: "Earthwork", description: "Excavation, grading, and soil treatment" },
  { division: 32, name: "Exterior Improvements", description: "Paving, landscaping, site utilities" },
  { division: 33, name: "Utilities", description: "Water, sewer, and power distribution" },
] as const;

/**
 * Custom cost code schema (for company profiles)
 */
export const customCostCodeSchema = z.object({
  id: z.number().int().min(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  isActive: z.boolean().default(true),
});

/**
 * Cost code configuration schema (for company profiles)
 */
export const costCodeConfigSchema = z.object({
  enabledCsiDivisions: z.array(z.number().int().min(0).max(49)).default([]),
  customCodes: z.array(customCostCodeSchema).default([]),
});

export type CostCodeConfig = z.infer<typeof costCodeConfigSchema>;

/**
 * Budget line item creation schema
 */
export const createBudgetLineItemSchema = z.object({
  projectId: z.string().uuid(),
  costCodeId: z.number().int().min(0),
  description: z.string().min(1).max(500),
  budgetedAmount: z.number().positive(),
});

/**
 * Budget line item update schema
 */
export const updateBudgetLineItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  budgetedAmount: z.number().positive().optional(),
});

/**
 * Commitment creation schema
 */
export const createCommitmentSchema = z.object({
  projectId: z.string().uuid(),
  type: commitmentTypeEnum,
  vendorName: z.string().min(1).max(200),
  contractNumber: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  lineItems: z.array(z.object({
    budgetLineItemId: z.string().uuid().optional(),
    costCodeId: z.number().int().min(0),
    description: z.string().min(1).max(500),
    amount: z.number().positive(),
  })).min(1),
});

/**
 * Commitment update schema
 */
export const updateCommitmentSchema = z.object({
  id: z.string().uuid(),
  vendorName: z.string().min(1).max(200).optional(),
  contractNumber: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  status: commitmentStatusEnum.optional(),
});

/**
 * Forecast metrics (TypeScript interfaces for return types)
 */
export interface ForecastMetrics {
  budgetAtCompletion: number;
  earnedValue: number;
  actualCost: number;
  committedCost: number;
  costPerformanceIndex: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
  varianceAtCompletion: number;
}

/**
 * Variance alert
 */
export interface VarianceAlert {
  budgetLineItemId: string;
  costCodeId: number;
  description: string;
  budgeted: number;
  committed: number;
  variance: number;
  variancePercent: number;
  severity: "ok" | "warning" | "critical";
}

/**
 * Budget summary
 */
export interface BudgetSummary {
  projectId: string;
  totalBudgeted: number;
  totalCommitted: number;
  totalActual: number;
  totalVariance: number;
  lineItemCount: number;
  commitmentCount: number;
}

/**
 * Variance threshold configuration schema (for company profiles)
 */
export const varianceThresholdsSchema = z.object({
  warning: z.number().min(0).max(1).default(0.10),
  critical: z.number().min(0).max(1).default(0.20),
});

export type VarianceThresholds = z.infer<typeof varianceThresholdsSchema>;
