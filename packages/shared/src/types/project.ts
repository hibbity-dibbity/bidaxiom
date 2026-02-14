import { z } from "zod";
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

// Project team role enum (project-level, distinct from org-level roles)
export const projectRoleEnum = z.enum(["project_manager", "superintendent", "foreman", "estimator", "accountant", "viewer"]);
export type ProjectRole = z.infer<typeof projectRoleEnum>;

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
  location: z.string().max(500).optional(),
  projectType: projectTypeEnum,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  costCodes: z.array(z.number().int().min(0).max(49)).default([]),
  teamMembers: z.array(teamMemberSchema).default([]),
  phases: z.array(projectPhaseSchema).default([]),
});

// Update project input
export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  jobNumber: z.string().max(50).nullable().optional(), // Can update or clear
  customerId: z.string().uuid().optional(), // Can change customer
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  projectType: projectTypeEnum.optional(),
  status: projectStatusEnum.optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  costCodes: z.array(z.number().int().min(0).max(49)).optional(),
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
