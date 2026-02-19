import { z } from "zod";
import { addressSchema } from "../schemas/common";
import {
  createDocumentSchema as createDocumentSchemaBase,
  uploadVersionSchema as uploadVersionSchemaBase,
  createFolderSchema as createFolderSchemaBase,
  presignedUrlSchema as presignedUrlSchemaBase,
} from "./document";

// Project type enum
export const projectTypeEnum = z.enum(["commercial", "residential", "infrastructure", "industrial"]);
export type ProjectType = z.infer<typeof projectTypeEnum>;

// Project status enum
export const projectStatusEnum = z.enum(["active", "on_hold", "completed", "archived"]);
export type ProjectStatus = z.infer<typeof projectStatusEnum>;

// Lifecycle phase enum — 9-phase state machine
export const lifecyclePhaseEnum = z.enum([
  "opportunity",
  "estimating",
  "submitted",
  "awarded",
  "active",
  "substantial_completion",
  "closed",
  "warranty",
  "archived",
]);
export type LifecyclePhase = z.infer<typeof lifecyclePhaseEnum>;

// Project mode enum
export const projectModeEnum = z.enum(["simple", "gc_advanced"]);
export type ProjectMode = z.infer<typeof projectModeEnum>;

// Project team role enum (project-level, distinct from org-level roles)
export const projectRoleEnum = z.enum(["project_manager", "project_administrator", "project_assistant", "superintendent", "foreman", "estimator", "accountant", "viewer"]);
export type ProjectRole = z.infer<typeof projectRoleEnum>;

// Ordered list of lifecycle phases (index = ordinal position)
export const LIFECYCLE_ORDER: LifecyclePhase[] = [
  "opportunity",
  "estimating",
  "submitted",
  "awarded",
  "active",
  "substantial_completion",
  "closed",
  "warranty",
  "archived",
];

// Human-readable labels for the lifecycle phases
export const LIFECYCLE_PHASE_LABELS: Record<LifecyclePhase, string> = {
  opportunity: "Opportunity",
  estimating: "Estimating",
  submitted: "Submitted",
  awarded: "Awarded",
  active: "Active",
  substantial_completion: "Substantial Completion",
  closed: "Closed",
  warranty: "Warranty",
  archived: "Archived",
};

// Simple mode billing categories (replaces CSI trade classification)
export const BILLING_CATEGORIES = [
  "Labor",
  "Materials",
  "Subcontractors",
  "Equipment",
  "Other",
] as const;
export type BillingCategory = typeof BILLING_CATEGORIES[number];

// Project phase status
export const phaseStatusEnum = z.enum(["pending", "in_progress", "completed"]);
export type PhaseStatus = z.infer<typeof phaseStatusEnum>;

// Team member assignment
export const teamMemberSchema = z.object({
  userId: z.string().min(1),
  role: projectRoleEnum,
});

// Project phase definition
export const projectPhaseSchema = z.object({
  name: z.string().min(1).max(100),
  orderIndex: z.number().int().min(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Create project input
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  jobNumber: z.string().max(50).optional(), // Manual override during creation
  customerId: z.string().uuid(), // Required - every project must have a customer
  description: z.string().max(2000).optional(),
  location: addressSchema.optional(),
  street1: z.string().max(200).optional(),
  street2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().max(10).optional(),
  projectType: projectTypeEnum,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  costCodes: z.array(z.number().int().min(0).max(49)).default([]),
  teamMembers: z.array(teamMemberSchema).default([]),
  phases: z.array(projectPhaseSchema).default([]),
  projectMode: projectModeEnum.optional(), // defaults server-side from user preference
});

// Update project input
export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  jobNumber: z.string().max(50).nullable().optional(), // Can update or clear
  customerId: z.string().uuid().optional(), // Can change customer
  description: z.string().max(2000).optional(),
  location: addressSchema.optional(),
  street1: z.string().max(200).nullable().optional(),
  street2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  zip: z.string().max(10).nullable().optional(),
  projectType: projectTypeEnum.optional(),
  status: projectStatusEnum.optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  costCodes: z.array(z.number().int().min(0).max(49)).optional(),
});

// List projects input schema with advanced filters
export const listProjectsSchema = z.object({
  status: projectStatusEnum.optional(),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  assignedUserId: z.string().optional(),
  startDateFrom: z.string().datetime().optional(),
  startDateTo: z.string().datetime().optional(),
  sortBy: z.enum(['name', 'jobNumber', 'status', 'createdAt', 'startDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// Re-export document schemas from document.ts for backward compatibility
export const createDocumentSchema = createDocumentSchemaBase;
export const uploadVersionSchema = uploadVersionSchemaBase;
export const createFolderSchema = createFolderSchemaBase;
export const presignedUrlSchema = presignedUrlSchemaBase;

// Default construction folder templates
export const DEFAULT_PROJECT_FOLDERS = [
  { name: "Contracts", order: 1, description: "Owner contracts, subcontracts, purchase orders" },
  { name: "Drawings", order: 2, description: "Architectural, structural, MEP drawings" },
  { name: "Specifications", order: 3, description: "Project specifications organized by CSI division" },
  { name: "Submittals", order: 4, description: "Material and equipment submittals" },
  { name: "RFIs", order: 5, description: "Requests for Information" },
  { name: "Change Orders", order: 6, description: "Owner and subcontractor change orders" },
  { name: "Pay Apps", order: 7, description: "AIA G702/G703 forms, lien waivers" },
  { name: "Invoices", order: 8, description: "AP/AR documentation" },
  { name: "Reports", order: 9, description: "Daily reports, inspection reports, progress photos" },
  { name: "Closeout", order: 10, description: "As-builts, warranties, O&M manuals" },
  { name: "Miscellaneous", order: 11, description: "Uncategorized project documents" },
] as const;

// Default project phases
export const DEFAULT_PROJECT_PHASES = [
  { name: "Pre-Construction", orderIndex: 0 },
  { name: "Mobilization", orderIndex: 1 },
  { name: "Foundation", orderIndex: 2 },
  { name: "Structural", orderIndex: 3 },
  { name: "Rough-In", orderIndex: 4 },
  { name: "Finishes", orderIndex: 5 },
  { name: "Closeout", orderIndex: 6 },
] as const;

// Schema for manual lifecycle phase transitions
export const transitionLifecyclePhaseSchema = z.object({
  projectId: z.string().uuid(),
  toPhase: lifecyclePhaseEnum,
  reason: z.string().min(1).max(1000).optional(),
});

// Schema for setting project mode
export const setProjectModeSchema = z.object({
  projectId: z.string().uuid(),
  mode: projectModeEnum,
});
