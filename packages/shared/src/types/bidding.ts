import { z } from "zod";
import { phoneSchema, addressSchema } from "../schemas/common";
import { tradeValueEnum } from "../constants/trades";

/**
 * Bid status enum
 */
export const bidStatusEnum = z.enum(["submitted", "under_review", "shortlisted", "awarded", "rejected", "withdrawn"]);
export type BidStatus = z.infer<typeof bidStatusEnum>;

/**
 * Invitation status enum
 */
export const invitationStatusEnum = z.enum(["pending", "viewed", "responded", "declined"]);
export type InvitationStatus = z.infer<typeof invitationStatusEnum>;

/**
 * Subcontractor status enum
 */
export const subcontractorStatusEnum = z.enum(["active", "inactive", "blacklisted"]);
export type SubcontractorStatus = z.infer<typeof subcontractorStatusEnum>;

/**
 * Directory entry kind: a subcontractor (work orders) or a supplier (purchase orders)
 */
export const vendorKindEnum = z.enum(["subcontractor", "supplier"]);
export type VendorKind = z.infer<typeof vendorKindEnum>;

/** Payment terms offered in the directory */
export const PAYMENT_TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 45", "Net 60"] as const;

/** Terms a new proposal gets when its customer has none of their own. */
export const DEFAULT_PAYMENT_TERMS = "Due on receipt" as const;

/** Terms, credit and compliance fields shared by create and update */
const vendorExtraFields = {
  kind: vendorKindEnum,
  category: z.string().max(200),
  paymentTerms: z.string().max(100),
  creditLimit: z.number().min(0).max(1_000_000_000),
  taxIdLast4: z.string().regex(/^\d{4}$/, "Enter the last 4 digits"),
  w9OnFile: z.boolean(),
  w9ReceivedAt: z.string().datetime(),
  insuranceExpiresAt: z.string().datetime(),
  is1099: z.boolean(),
};

/**
 * Leveling category enum
 */
export const levelingCategoryEnum = z.enum(["scope_gap", "scope_extra", "clarification", "risk"]);
export type LevelingCategory = z.infer<typeof levelingCategoryEnum>;

/**
 * Bid line item schema
 */
export const bidLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  amount: z.number().positive(),
  costCodeId: z.number().int().optional(),
});

export type BidLineItem = z.infer<typeof bidLineItemSchema>;

/**
 * Submit bid schema
 */
export const submitBidSchema = z.object({
  totalAmount: z.number().positive(),
  lineItems: z.array(bidLineItemSchema).min(1),
  scopeNotes: z.string().optional(),
  exclusions: z.string().optional(),
  inclusions: z.string().optional(),
  validUntil: z.string().datetime().optional(),
});

export type SubmitBid = z.infer<typeof submitBidSchema>;

/**
 * Update bid version schema
 */
export const updateBidVersionSchema = z.object({
  bidId: z.string().uuid(),
  totalAmount: z.number().positive(),
  lineItems: z.array(bidLineItemSchema).min(1),
  scopeNotes: z.string().optional(),
  exclusions: z.string().optional(),
  inclusions: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  triggerAmendmentId: z.string().uuid().optional(),
});

export type UpdateBidVersion = z.infer<typeof updateBidVersionSchema>;

/**
 * Create subcontractor schema
 */
export const createSubcontractorSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().optional(),
  contactEmail: z.string().email(),
  contactPhone: phoneSchema,
  street1: z.string().max(200).optional(),
  street2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).or(z.literal("")).optional(),
  zip: z.string().max(10).optional(),
  trades: z.array(z.number().int()),
  trade: z.array(tradeValueEnum).default([]),
  tradeOther: z.string().max(200).optional(),
  notes: z.string().optional(),
  kind: vendorExtraFields.kind.default("subcontractor"),
  category: vendorExtraFields.category.optional(),
  paymentTerms: vendorExtraFields.paymentTerms.optional(),
  creditLimit: vendorExtraFields.creditLimit.optional(),
  taxIdLast4: vendorExtraFields.taxIdLast4.optional(),
  w9OnFile: vendorExtraFields.w9OnFile.optional(),
  w9ReceivedAt: vendorExtraFields.w9ReceivedAt.optional(),
  insuranceExpiresAt: vendorExtraFields.insuranceExpiresAt.optional(),
  is1099: vendorExtraFields.is1099.optional(),
});

export type CreateSubcontractor = z.infer<typeof createSubcontractorSchema>;

/**
 * Update subcontractor schema
 */
export const updateSubcontractorSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string().min(1).max(200).optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: phoneSchema,
  street1: z.string().max(200).nullable().optional(),
  street2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().length(2).or(z.literal("")).nullable().optional(),
  zip: z.string().max(10).nullable().optional(),
  trades: z.array(z.number().int()).optional(),
  trade: z.array(tradeValueEnum).optional(),
  tradeOther: z.string().max(200).nullable().optional(),
  notes: z.string().nullable().optional(),
  status: subcontractorStatusEnum.optional(),
  kind: vendorExtraFields.kind.optional(),
  category: vendorExtraFields.category.nullable().optional(),
  paymentTerms: vendorExtraFields.paymentTerms.nullable().optional(),
  creditLimit: vendorExtraFields.creditLimit.nullable().optional(),
  taxIdLast4: vendorExtraFields.taxIdLast4.nullable().optional(),
  w9OnFile: vendorExtraFields.w9OnFile.optional(),
  w9ReceivedAt: vendorExtraFields.w9ReceivedAt.nullable().optional(),
  insuranceExpiresAt: vendorExtraFields.insuranceExpiresAt.nullable().optional(),
  is1099: vendorExtraFields.is1099.optional(),
});

export type UpdateSubcontractor = z.infer<typeof updateSubcontractorSchema>;

/**
 * Award bid schema
 */
export const awardBidSchema = z.object({
  bidId: z.string().uuid(),
  convertToCommitment: z.boolean().default(false),
  commitmentDescription: z.string().optional(),
});

export type AwardBid = z.infer<typeof awardBidSchema>;

/**
 * Bid comparison row interface
 */
export interface BidComparisonRow {
  bidId: string;
  bidderCompanyName: string;
  totalAmount: number;
  leveledAmount: number;
  lineItems: BidLineItem[];
  exclusions?: string;
  inclusions?: string;
  scopeNotes?: string;
  levelingNotes: Array<{
    category: LevelingCategory;
    note: string;
    adjustmentAmount?: number;
  }>;
  status: BidStatus;
}
