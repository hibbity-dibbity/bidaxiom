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
  template: z
    .string()
    .min(1)
    .max(50)
    .refine(
      (template) => {
        const result = validateJobNumberTemplate(template);
        return result.valid;
      },
      (template) => {
        const result = validateJobNumberTemplate(template);
        return {
          message: result.valid ? "" : result.error,
        };
      }
    ),
  nextSequenceNumber: z.number().int().min(1).default(1),
  lastGeneratedFormat: z.string().nullable().optional(),
});

export type JobNumberSettings = z.infer<typeof jobNumberSettingsSchema>;

/**
 * Get available template tokens with descriptions.
 * Used for help text in UI.
 */
export function getAvailableTokens(): Array<{ token: string; description: string }> {
  return [
    { token: "{YYYY}", description: "4-digit year (2026)" },
    { token: "{YY}", description: "2-digit year (26)" },
    { token: "{MM}", description: "2-digit month (01-12)" },
    { token: "{DD}", description: "2-digit day (01-31)" },
    { token: "{NNN}", description: "Sequential number (length = number of N's)" },
  ];
}

/**
 * Validates that a job number template contains at least one sequence pattern.
 * Template must include {N}, {NN}, {NNN}, etc.
 *
 * @param template - Job number template to validate
 * @returns Validation result with detailed error message if invalid
 */
export function validateJobNumberTemplate(template: string):
  | { valid: true }
  | { valid: false; error: string } {

  // Check for unmatched braces first (syntax error)
  const openBraces = (template.match(/\{/g) || []).length;
  const closeBraces = (template.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    return {
      valid: false,
      error: "Template contains unmatched braces. Check that all { have matching }",
    };
  }

  // Check for sequence pattern
  const sequenceMatch = template.match(/\{(N+)\}/);
  if (!sequenceMatch) {
    return {
      valid: false,
      error: "Template must contain at least one sequence pattern like {NN} or {NNN}",
    };
  }

  // Check for minimum sequence length (at least 2 N's)
  if (sequenceMatch[1].length < 2) {
    return {
      valid: false,
      error: "Sequence pattern must have at least 2 digits (use {NN} or longer)",
    };
  }

  // Check for invalid tokens
  const validTokens = ["{YYYY}", "{YY}", "{MM}", "{DD}"];
  const tokenPattern = /\{[A-Z]+\}/g;
  const tokens = template.match(tokenPattern) || [];

  for (const token of tokens) {
    // Skip sequence patterns {NNN...}
    if (/\{N+\}/.test(token)) {
      continue;
    }

    if (!validTokens.includes(token)) {
      return {
        valid: false,
        error: `Unknown token: ${token}. Valid tokens: {YYYY}, {YY}, {MM}, {DD}, {NNN}`,
      };
    }
  }

  // Check for minimum length (after token validation)
  if (template.length < 5) {
    return {
      valid: false,
      error: "Template is too short (minimum 5 characters). Example: {YY}-{NN}",
    };
  }

  // Check for maximum length (database column limit)
  if (template.length > 50) {
    return {
      valid: false,
      error: "Template exceeds maximum length of 50 characters",
    };
  }

  return { valid: true };
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
 * Parse a template to extract expected pattern for validation.
 * Used to validate manually-entered job numbers against the configured template.
 */
export function parseTemplatePattern(template: string): RegExp {
  // Escape special regex characters
  let pattern = template
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\{YYYY\\}/g, "\\d{4}")
    .replace(/\\{YY\\}/g, "\\d{2}")
    .replace(/\\{MM\\}/g, "\\d{2}")
    .replace(/\\{DD\\}/g, "\\d{2}");

  // Match sequence pattern {NNN...}
  const sequenceMatch = template.match(/\{(N+)\}/);
  if (sequenceMatch) {
    const length = sequenceMatch[1].length;
    pattern = pattern.replace(/\\{N+\\}/, `\\d{${length}}`);
  }

  return new RegExp(`^${pattern}$`);
}

/**
 * Validate a job number matches the template format.
 * Used when manually entering/editing job numbers on the client.
 */
export function validateJobNumberFormat(
  jobNumber: string,
  template: string
): boolean {
  const pattern = parseTemplatePattern(template);
  return pattern.test(jobNumber);
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
  allowPersonalTemplates: z.boolean().optional(), // Allow users to create personal estimate templates (default: true)
  sovGroupingMethod: z.enum(["csi", "phase", "payment_schedule"]).optional(), // Default SOV grouping method (default: csi)
});

export type CompanyConfig = z.infer<typeof companyConfigSchema>;
