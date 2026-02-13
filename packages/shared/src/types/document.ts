import { z } from "zod";

// Document category enum - predefined categories for document classification
export const documentCategoryEnum = z.enum([
  "contract",
  "drawing",
  "specification",
  "submittal",
  "rfi",
  "change_order",
  "payment_app",
  "invoice",
  "report",
  "photo",
  "closeout",
  "other"
]);
export type DocumentCategory = z.infer<typeof documentCategoryEnum>;

// Document creation (after file upload via presigned URL)
export const createDocumentSchema = z.object({
  projectId: z.string().uuid(),
  folderId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  category: documentCategoryEnum.optional(),
  description: z.string().max(1000).optional(),
  storageKey: z.string().min(1),
  fileSize: z.number().int().positive(),
  contentType: z.string().min(1).max(255),
  changeNotes: z.string().max(500).optional(),
});

// Upload version to existing document
export const uploadVersionSchema = z.object({
  documentId: z.string().uuid(),
  storageKey: z.string().min(1),
  fileSize: z.number().int().positive(),
  contentType: z.string().min(1).max(255),
  changeNotes: z.string().max(500).optional(),
});

// Folder creation
export const createFolderSchema = z.object({
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// Presigned URL request
export const presignedUrlSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(524288000), // 500MB max
});

// Tag management schemas
export const createTagSchema = z.object({
  documentId: z.string().uuid(),
  tag: z.string().min(1).max(50).trim().toLowerCase(),
});

export const removeTagSchema = z.object({
  documentId: z.string().uuid(),
  tag: z.string().min(1),
});

// Document search with filters
export const searchDocumentsSchema = z.object({
  projectId: z.string().uuid(),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: documentCategoryEnum.optional(),
  contentTypes: z.array(z.string()).optional(),
});

// ===== Document Workflow Schemas (RFI, Submittal, Transmittal) =====

// Document workflow type enum
export const documentWorkflowTypeEnum = z.enum(["rfi", "submittal", "transmittal"]);
export type DocumentWorkflowType = z.infer<typeof documentWorkflowTypeEnum>;

// Workflow status enum
export const workflowStatusEnum = z.enum([
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "closed",
  "cancelled"
]);
export type WorkflowStatus = z.infer<typeof workflowStatusEnum>;

// Workflow priority enum
export const workflowPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);
export type WorkflowPriority = z.infer<typeof workflowPriorityEnum>;

// Approval requirement type enum
export const approvalRequirementTypeEnum = z.enum([
  "specific_user",
  "any_with_role",
  "all_with_role"
]);
export type ApprovalRequirementType = z.infer<typeof approvalRequirementTypeEnum>;

// Approval status enum
export const approvalStatusEnum = z.enum(["pending", "approved", "rejected", "skipped"]);
export type ApprovalStatus = z.infer<typeof approvalStatusEnum>;

// Approval step definition
export const workflowApprovalStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  approverUserId: z.string().optional(), // for specific_user
  approverRole: z.string().optional(), // for any_with_role or all_with_role
  requirementType: approvalRequirementTypeEnum,
});

// Create workflow
export const createWorkflowSchema = z.object({
  documentId: z.string().uuid(),
  workflowType: documentWorkflowTypeEnum,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: workflowPriorityEnum.optional(),
  dueDate: z.string().datetime().optional(),
  approvalSteps: z.array(workflowApprovalStepSchema).min(1).max(10),
});

// Submit workflow (draft -> submitted)
export const submitWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
});

// Approve/Reject approval step
export const reviewApprovalSchema = z.object({
  approvalId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  comments: z.string().max(1000).optional(),
});

// Respond to workflow (attach response document)
export const respondToWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  responseDocumentId: z.string().uuid(),
  comments: z.string().max(1000).optional(),
});

// Update workflow
export const updateWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  priority: workflowPriorityEnum.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: workflowStatusEnum.optional(), // for manual status changes
});

// ===== Document and Folder Permissions Schemas =====

// Permission level enum
export const documentPermissionLevelEnum = z.enum(["view", "edit"]);
export type DocumentPermissionLevel = z.infer<typeof documentPermissionLevelEnum>;

// Share document permission
export const shareDocumentSchema = z.object({
  documentId: z.string().uuid(),
  userId: z.string().min(1), // Clerk user ID
  permissionLevel: documentPermissionLevelEnum,
  expiresAt: z.string().datetime().optional(),
});

// Revoke document permission
export const revokeDocumentPermissionSchema = z.object({
  documentId: z.string().uuid(),
  userId: z.string().min(1),
});

// Share folder permission
export const shareFolderSchema = z.object({
  folderId: z.string().uuid(),
  userId: z.string().min(1), // Clerk user ID
  permissionLevel: documentPermissionLevelEnum,
  includeSubfolders: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
});

// Revoke folder permission
export const revokeFolderPermissionSchema = z.object({
  folderId: z.string().uuid(),
  userId: z.string().min(1),
});

// Get document permissions (list all users with access)
export const getDocumentPermissionsSchema = z.object({
  documentId: z.string().uuid(),
});
