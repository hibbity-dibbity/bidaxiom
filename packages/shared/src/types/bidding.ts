import { z } from "zod";
import { phoneSchema, addressSchema } from "../schemas/common";

/**
 * RFQ status enum
 */
export const rfqStatusEnum = z.enum(["draft", "issued", "closed", "awarded", "cancelled"]);
export type RfqStatus = z.infer<typeof rfqStatusEnum>;

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
 * Leveling category enum
 */
export const levelingCategoryEnum = z.enum(["scope_gap", "scope_extra", "clarification", "risk"]);
export type LevelingCategory = z.infer<typeof levelingCategoryEnum>;

/**
 * Create RFQ schema
 */
export const createRfqSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  scopeOfWork: z.string().min(1).max(10000),
  trades: z.array(z.number().int()),
  dueDate: z.string().datetime(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});

export type CreateRfq = z.infer<typeof createRfqSchema>;

/**
 * Update RFQ schema
 */
export const updateRfqSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  scopeOfWork: z.string().min(1).max(10000).optional(),
  trades: z.array(z.number().int()).optional(),
  dueDate: z.string().datetime().optional(),
  status: rfqStatusEnum.optional(),
});

export type UpdateRfq = z.infer<typeof updateRfqSchema>;

/**
 * Create amendment schema
 */
export const createAmendmentSchema = z.object({
  rfqId: z.string().uuid(),
  description: z.string().min(1).max(2000),
  scopeChanges: z.string().optional(),
  dueDateChange: z.string().datetime().optional(),
});

export type CreateAmendment = z.infer<typeof createAmendmentSchema>;

/**
 * Create invitation schema
 */
export const createInvitationSchema = z.object({
  rfqId: z.string().uuid(),
  subcontractorId: z.string().uuid().optional(),
  externalEmail: z.string().email().optional(),
  externalCompanyName: z.string().optional(),
}).refine(
  (data) => data.subcontractorId || (data.externalEmail && data.externalCompanyName),
  {
    message: "Must provide either subcontractorId OR (externalEmail AND externalCompanyName)",
  }
);

export type CreateInvitation = z.infer<typeof createInvitationSchema>;

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
  rfqId: z.string().uuid(),
  invitationId: z.string().uuid().optional(),
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
  address: addressSchema.optional(),
  street1: z.string().max(200).optional(),
  street2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().max(10).optional(),
  trades: z.array(z.number().int()),
  notes: z.string().optional(),
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
  address: addressSchema.optional(),
  street1: z.string().max(200).nullable().optional(),
  street2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  zip: z.string().max(10).nullable().optional(),
  trades: z.array(z.number().int()).optional(),
  notes: z.string().nullable().optional(),
  status: subcontractorStatusEnum.optional(),
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
 * Create leveling note schema
 */
export const createLevelingNoteSchema = z.object({
  rfqId: z.string().uuid(),
  bidId: z.string().uuid(),
  category: levelingCategoryEnum,
  note: z.string().min(1).max(2000),
  adjustmentAmount: z.number().optional(),
});

export type CreateLevelingNote = z.infer<typeof createLevelingNoteSchema>;

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

/**
 * RFQ summary interface
 */
export interface RfqSummary {
  id: string;
  rfqNumber: string;
  title: string;
  status: RfqStatus;
  dueDate: string;
  bidCount: number;
  invitationCount: number;
  projectId: string;
}
