import { z } from "zod";

/**
 * Change order type enum
 */
export const changeOrderTypeEnum = z.enum(["owner", "internal", "subcontractor"]);
export type ChangeOrderType = z.infer<typeof changeOrderTypeEnum>;

/**
 * Change order status enum
 */
export const changeOrderStatusEnum = z.enum([
  "draft",
  "pco_submitted",
  "pending_approval",
  "approved",
  "rejected",
  "void",
]);
export type ChangeOrderStatus = z.infer<typeof changeOrderStatusEnum>;

/**
 * Internal change order reason enum
 */
export const internalReasonEnum = z.enum([
  "error",
  "efficiency",
  "value_engineering",
  "other",
]);
export type InternalReason = z.infer<typeof internalReasonEnum>;

/**
 * Approval step status enum
 */
export const approvalStepStatusEnum = z.enum([
  "pending",
  "approved",
  "rejected",
  "skipped",
]);
export type ApprovalStepStatus = z.infer<typeof approvalStepStatusEnum>;

/**
 * Change history type enum
 */
export const changeHistoryTypeEnum = z.enum([
  "field_update",
  "status_change",
  "approval",
  "line_item_change",
]);
export type ChangeHistoryType = z.infer<typeof changeHistoryTypeEnum>;

/**
 * Line item schema shared across all CO types
 */
export const changeOrderLineItemSchema = z.object({
  budgetLineItemId: z.string().uuid().optional(),
  costCodeId: z.number().int().min(0),
  description: z.string().min(1).max(500),
  amountChange: z.number(), // positive = increase, negative = decrease
});
export type ChangeOrderLineItem = z.infer<typeof changeOrderLineItemSchema>;

/**
 * Owner change order creation schema
 */
export const createOwnerChangeOrderSchema = z.object({
  type: z.literal("owner"),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  requestedBy: z.string().min(1).max(200),
  relatedDocuments: z.array(z.string().uuid()).default([]),
  lineItems: z.array(changeOrderLineItemSchema).min(1),
});
export type CreateOwnerChangeOrder = z.infer<typeof createOwnerChangeOrderSchema>;

/**
 * Internal change order creation schema
 */
export const createInternalChangeOrderSchema = z.object({
  type: z.literal("internal"),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  reason: internalReasonEnum,
  relatedDocuments: z.array(z.string().uuid()).default([]),
  lineItems: z.array(changeOrderLineItemSchema).min(1),
});
export type CreateInternalChangeOrder = z.infer<typeof createInternalChangeOrderSchema>;

/**
 * Subcontractor change order creation schema
 */
export const createSubcontractorChangeOrderSchema = z.object({
  type: z.literal("subcontractor"),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  commitmentId: z.string().uuid(),
  relatedDocuments: z.array(z.string().uuid()).default([]),
  lineItems: z.array(changeOrderLineItemSchema).min(1),
});
export type CreateSubcontractorChangeOrder = z.infer<
  typeof createSubcontractorChangeOrderSchema
>;

/**
 * Discriminated union for change order creation
 */
export const createChangeOrderSchema = z.discriminatedUnion("type", [
  createOwnerChangeOrderSchema,
  createInternalChangeOrderSchema,
  createSubcontractorChangeOrderSchema,
]);
export type CreateChangeOrder = z.infer<typeof createChangeOrderSchema>;

/**
 * Update change order schema
 */
export const updateChangeOrderSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  requestedBy: z.string().min(1).max(200).optional(),
  reason: internalReasonEnum.optional(),
  relatedDocuments: z.array(z.string().uuid()).optional(),
});
export type UpdateChangeOrder = z.infer<typeof updateChangeOrderSchema>;

/**
 * Submit for approval schema
 */
export const submitForApprovalSchema = z.object({
  changeOrderId: z.string().uuid(),
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
export type SubmitForApproval = z.infer<typeof submitForApprovalSchema>;

/**
 * Approve/reject schema
 */
export const approveRejectSchema = z.object({
  changeOrderId: z.string().uuid(),
  comments: z.string().max(2000).optional(),
});
export type ApproveReject = z.infer<typeof approveRejectSchema>;

/**
 * Valid status transitions map
 */
export const VALID_CO_STATUS_TRANSITIONS: Record<
  ChangeOrderStatus,
  ChangeOrderStatus[]
> = {
  draft: ["pco_submitted", "void"],
  pco_submitted: ["pending_approval", "draft", "void"],
  pending_approval: ["approved", "rejected"],
  approved: ["void"],
  rejected: ["draft", "void"],
  void: [],
};
