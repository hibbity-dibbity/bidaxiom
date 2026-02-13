/**
 * User roles within an organization.
 * Maps to Clerk organization membership roles.
 * Custom roles (beyond admin/member) are configured in Clerk Dashboard.
 */
export enum UserRole {
  OWNER = "org:admin",
  ADMIN = "org:admin",
  PROJECT_MANAGER = "org:project_manager",
  SUPERINTENDENT = "org:superintendent",
  FOREMAN = "org:foreman",
  ESTIMATOR = "org:estimator",
  ACCOUNTANT = "org:accountant",
  MEMBER = "org:member",
}

/**
 * Organization membership for a user.
 */
export interface OrgMembership {
  userId: string;
  orgId: string;
  role: UserRole;
  companyId: string;
}

/**
 * Session context extracted from Clerk JWT.
 * Available on every authenticated request.
 */
export interface SessionContext {
  userId: string;
  orgId: string;
  activeCompanyId: string;
  role: UserRole;
  hasMfa: boolean;
}

/**
 * CASL action types for the application.
 */
export type AppActions =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "manage"
  | "approve"
  | "submit";

/**
 * CASL subject types for the application.
 * Maps to domain entities.
 */
export type AppSubjects =
  | "Project"
  | "Budget"
  | "Commitment"
  | "ChangeOrder"
  | "PayApplication"
  | "Bid"
  | "RFQ"
  | "AuditLog"
  | "User"
  | "CompanySettings"
  | "Document"
  | "Folder"
  | "ProjectTeam"
  | "all";
