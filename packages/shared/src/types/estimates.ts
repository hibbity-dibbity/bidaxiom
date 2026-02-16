import { z } from "zod";

// Estimate status enum
// Lifecycle: draft → submitted (bid generated) → accepted (bid won) → under_contract (converted to project)
export const estimateStatusEnum = z.enum(["draft", "submitted", "accepted", "under_contract"]);
export type EstimateStatus = z.infer<typeof estimateStatusEnum>;

// Cost type enum
export const costTypeEnum = z.enum(["labor", "material", "equipment", "subcontractor"]);
export type CostType = z.infer<typeof costTypeEnum>;

// Template scope enum
export const templateScopeEnum = z.enum(["company", "personal"]);
export type TemplateScope = z.infer<typeof templateScopeEnum>;

// Markup base enum
export const markupBaseEnum = z.enum(["direct", "direct_plus_overhead"]);
export type MarkupBase = z.infer<typeof markupBaseEnum>;

// Overhead type enum
export const overheadTypeEnum = z.enum(["percentage", "fixed"]);
export type OverheadType = z.infer<typeof overheadTypeEnum>;

// SOV grouping method enum
export const sovGroupingMethodEnum = z.enum(["csi", "phase", "payment_schedule"]);
export type SOVGroupingMethod = z.infer<typeof sovGroupingMethodEnum>;

// Unit enum for quantities
export const unitEnum = z.enum(["ea", "sf", "lf", "ton", "hr"]);
export type Unit = z.infer<typeof unitEnum>;

// Bid status enum (from Phase 7 bids table)
export const bidStatusEnum = z.enum(["draft", "submitted", "won", "lost", "withdrawn"]);
export type BidStatus = z.infer<typeof bidStatusEnum>;

/**
 * Estimate totals calculated from line items
 */
export interface EstimateTotals {
  directCosts: number;
  overhead: number;
  totalMarkup: number;
  totalCost: number;
  marginPercent: number;
  marginDollars: number;
}

/**
 * SOV line item structure
 */
export interface SOVLineItem {
  id: string;
  description: string;
  amount: number;
  costCodeReferences: string[];
  completionPercent: number;
  scheduledValues?: { phase?: string; month?: string; amount: number }[];
  sortOrder: number;
}

/**
 * Labor rates mapping classification to hourly rate
 */
export interface LaborRates {
  [classification: string]: number; // e.g., { "Foreman": 65, "Carpenter": 45 }
}
