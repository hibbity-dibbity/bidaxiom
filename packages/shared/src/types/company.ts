import { z } from "zod";

/**
 * Company type enum.
 * Determines which features are available to this company.
 *
 * - gc_only: General contractor features only (RFQ creation, bid evaluation)
 * - sub_only: Subcontractor features only (bid submission, trade selection)
 * - both: Full feature set (can act as GC or sub depending on project)
 */
export const CompanyType = z.enum(["gc_only", "sub_only", "both"]);
export type CompanyTypeValue = z.infer<typeof CompanyType>;

/**
 * Custom trade definition (non-CSI).
 * Allows companies to define their own specialty trades.
 */
export const customTradeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  parentDivision: z.number().int().min(0).max(49).optional(),
});

/**
 * Trades configuration for subcontractors.
 * Combines CSI standard divisions with custom trade definitions.
 */
export const tradesConfigSchema = z.object({
  csiDivisions: z.array(z.number().int().min(0).max(49)),
  customTrades: z.array(customTradeSchema),
});

export type TradesConfig = z.infer<typeof tradesConfigSchema>;

/**
 * Complete company configuration schema.
 * Used for create/update validation on the API.
 */
export const companyConfigSchema = z.object({
  companyType: CompanyType,
  tradesConfig: tradesConfigSchema,
});

export type CompanyConfig = z.infer<typeof companyConfigSchema>;
