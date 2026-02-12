/**
 * User roles within an organization.
 * Derived from Clerk organization membership roles.
 */
export enum UserRole {
  OWNER = "owner",
  ADMIN = "admin",
  PROJECT_MANAGER = "project_manager",
  SUPERINTENDENT = "superintendent",
  FOREMAN = "foreman",
  ESTIMATOR = "estimator",
  ACCOUNTANT = "accountant",
  MEMBER = "member",
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
