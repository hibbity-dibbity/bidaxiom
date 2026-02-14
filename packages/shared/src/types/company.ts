import { z } from "zod";
import { retainageConfigSchema } from "./payment-app";

export type RetainageConfig = z.infer<typeof retainageConfigSchema>;
export { retainageConfigSchema };

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
 * Job number settings for automatic project numbering.
 * Supports template-based generation with date tokens and sequences.
 *
 * Template tokens:
 * - {YYYY} - 4-digit year (2026)
 * - {YY} - 2-digit year (26)
 * - {MM} - 2-digit month (01-12)
 * - {DD} - 2-digit day (01-31)
 * - {NNN...} - Sequential number (length = number of N's, zero-padded)
 *
 * Examples:
 * - {YY}{NNNN} → 261001, 261002, 271001 (resets yearly)
 * - {YYYY}-{NNN} → 2026-001, 2026-002, 2027-001 (resets yearly)
 * - JOB-{NNNNN} → JOB-00001, JOB-00002 (never resets)
 */
export const jobNumberSettingsSchema = z.object({
  enabled: z.boolean(),
  template: z.string().min(1).max(50),
  nextSequenceNumber: z.number().int().min(1).default(1),
  lastGeneratedFormat: z.string().nullable().optional(),
});

export type JobNumberSettings = z.infer<typeof jobNumberSettingsSchema>;

/**
 * Validates that a job number template contains at least one sequence pattern.
 * Template must include {N}, {NN}, {NNN}, etc.
 */
export function validateJobNumberTemplate(template: string): boolean {
  return /\{N+\}/.test(template);
}

/**
 * Generate preview example for template.
 * Used in settings UI to show what job numbers will look like.
 */
export function previewJobNumber(
  template: string,
  sequenceNumber: number = 1
): string {
  const now = new Date();

  let preview = template
    .replace(/{YYYY}/g, now.getFullYear().toString())
    .replace(/{YY}/g, now.getFullYear().toString().slice(-2))
    .replace(/{MM}/g, (now.getMonth() + 1).toString().padStart(2, "0"))
    .replace(/{DD}/g, now.getDate().toString().padStart(2, "0"));

  const sequenceMatch = preview.match(/\{(N+)\}/);
  if (sequenceMatch) {
    const length = sequenceMatch[1].length;
    const paddedSequence = sequenceNumber.toString().padStart(length, "0");
    preview = preview.replace(/\{N+\}/, paddedSequence);
  }

  return preview;
}

/**
 * Complete company configuration schema.
 * Used for create/update validation on the API.
 */
export const companyConfigSchema = z.object({
  companyType: CompanyType,
  tradesConfig: tradesConfigSchema,
  jobNumberSettings: jobNumberSettingsSchema,
  logoStorageKey: z.string().nullable().optional(),
});

export type CompanyConfig = z.infer<typeof companyConfigSchema>;
