import { z } from "zod";

// ========================================
// Enums
// ========================================

export const paymentAppStatusEnum = z.enum([
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "paid",
]);
export type PaymentAppStatus = z.infer<typeof paymentAppStatusEnum>;

export const lienWaiverTypeEnum = z.enum([
  "partial_conditional",
  "partial_unconditional",
  "final_conditional",
  "final_unconditional",
]);
export type LienWaiverType = z.infer<typeof lienWaiverTypeEnum>;

export const lienWaiverStatusEnum = z.enum([
  "pending",
  "received",
  "verified",
  "stored",
]);
export type LienWaiverStatus = z.infer<typeof lienWaiverStatusEnum>;

export const lienWaiverPartyTypeEnum = z.enum([
  "subcontractor",
  "supplier",
  "vendor",
]);
export type LienWaiverPartyType = z.infer<typeof lienWaiverPartyTypeEnum>;

export const retainageStatusEnum = z.enum([
  "held",
  "eligible_for_release",
  "released",
]);
export type RetainageStatus = z.infer<typeof retainageStatusEnum>;

export const paymentApprovalStepStatusEnum = z.enum([
  "pending",
  "approved",
  "rejected",
  "skipped",
]);
export type PaymentApprovalStepStatus = z.infer<typeof paymentApprovalStepStatusEnum>;

// ========================================
// SOV Schemas
// ========================================

export const createSovItemSchema = z.object({
  projectId: z.string().uuid(),
  budgetLineItemId: z.string().uuid().optional(),
  itemNumber: z.string().min(1).max(20),
  description: z.string().min(1).max(500),
  scheduledValue: z.number().min(0),
});

export const updateSovItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  scheduledValue: z.number().min(0).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const bulkCreateSovItemsSchema = z.object({
  projectId: z.string().uuid(),
  items: z.array(createSovItemSchema.omit({ projectId: true })).min(1),
});

// ========================================
// Payment App Schemas
// ========================================

export const createPaymentAppSchema = z.object({
  projectId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  lineItems: z
    .array(
      z.object({
        sovItemId: z.string().uuid(),
        currentPercentComplete: z.number().min(0).max(100),
        materialsStoredThisPeriod: z.number().min(0).default(0),
      })
    )
    .min(1),
});

export const submitPaymentAppSchema = z.object({
  paymentAppId: z.string().uuid(),
  approvalSteps: z
    .array(
      z.object({
        stepOrder: z.number().int().positive(),
        approverRole: z.string().optional(),
        approverUserId: z.string().optional(),
        requirementType: z.enum(["all", "any", "specific"]).default("all"),
      })
    )
    .min(1),
});

export const approveRejectPaymentAppSchema = z.object({
  paymentAppId: z.string().uuid(),
  comments: z.string().max(2000).optional(),
});

export const markPaymentAppPaidSchema = z.object({
  paymentAppId: z.string().uuid(),
  paidAt: z.string().datetime().optional(),
});

// ========================================
// Lien Waiver Schemas
// ========================================

export const createLienWaiverSchema = z.object({
  projectId: z.string().uuid(),
  paymentAppId: z.string().uuid(),
  waiverType: lienWaiverTypeEnum,
  partyName: z.string().min(1).max(200),
  partyType: lienWaiverPartyTypeEnum,
  throughDate: z.string().datetime(),
  amountWaived: z.number().min(0),
  requiresNotarization: z.boolean().default(false),
  usesStatutoryForm: z.boolean().default(false),
});

export const updateLienWaiverStatusSchema = z.object({
  id: z.string().uuid(),
  status: lienWaiverStatusEnum,
  documentId: z.string().uuid().optional(),
  isNotarized: z.boolean().optional(),
});

// ========================================
// Retainage Config Schema
// ========================================

export const retainageConfigSchema = z.object({
  defaultRate: z.number().min(0).max(100).default(10),
  progressiveRates: z
    .array(
      z.object({
        upToPercent: z.number().min(0).max(100),
        rate: z.number().min(0).max(100),
      })
    )
    .optional(),
  releaseConditions: z.object({
    substantialCompletion: z.boolean().default(true),
    punchListComplete: z.boolean().default(false),
    finalAcceptance: z.boolean().default(false),
    lienWaiversRequired: z.boolean().default(true),
  }),
});
export type RetainageConfig = z.infer<typeof retainageConfigSchema>;

// ========================================
// Aging Report Types
// ========================================

export interface AgingBucket {
  current: number; // 0-30 days
  days31_60: number;
  days61_90: number;
  days91_120: number;
  days120Plus: number;
}

export interface ARAgingReport {
  asOfDate: string;
  totalOutstanding: number;
  buckets: AgingBucket;
  byProject: Array<{
    projectId: string;
    projectName: string;
    buckets: AgingBucket;
    total: number;
  }>;
}

export interface APAgingReport {
  asOfDate: string;
  totalOutstanding: number;
  buckets: AgingBucket;
  byVendor: Array<{
    vendorName: string;
    buckets: AgingBucket;
    total: number;
  }>;
}

// ========================================
// Valid Status Transitions
// ========================================

export const VALID_PAYMENT_APP_STATUS_TRANSITIONS: Record<
  PaymentAppStatus,
  PaymentAppStatus[]
> = {
  draft: ["submitted"],
  submitted: ["under_review", "rejected"],
  under_review: ["approved", "rejected"],
  approved: ["paid"],
  rejected: ["draft"],
  paid: [],
};

// ========================================
// State Lien Waiver Requirements
// ========================================

export const STATE_LIEN_WAIVER_REQUIREMENTS: Record<
  string,
  {
    requiresStatutoryForm: boolean;
    requiresNotarization: boolean;
  }
> = {
  CA: { requiresStatutoryForm: true, requiresNotarization: false },
  TX: { requiresStatutoryForm: true, requiresNotarization: false },
  FL: { requiresStatutoryForm: true, requiresNotarization: false },
  AZ: { requiresStatutoryForm: true, requiresNotarization: false },
  GA: { requiresStatutoryForm: true, requiresNotarization: false },
  MI: { requiresStatutoryForm: true, requiresNotarization: false },
  MS: { requiresStatutoryForm: true, requiresNotarization: false },
  MO: { requiresStatutoryForm: true, requiresNotarization: false },
  NV: { requiresStatutoryForm: true, requiresNotarization: false },
  WY: { requiresStatutoryForm: true, requiresNotarization: false },
};
