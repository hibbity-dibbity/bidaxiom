/**
 * Tenant context resolved from session org.
 * Used to scope all database queries to the correct schema.
 */
export interface TenantContext {
  tenantId: string;
  schemaName: string;
  companyName: string;
}

/**
 * Tenant provisioning lifecycle states.
 */
export enum TenantStatus {
  PROVISIONING = "provisioning",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  ARCHIVED = "archived",
}

/**
 * Audit log action types.
 * Used for immutable audit trail of all sensitive actions.
 */
export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  INVITE = "invite",
  ROLE_CHANGE = "role_change",
  FINANCIAL_CHANGE = "financial_change",
  BID_SUBMIT = "bid_submit",
  SCHEDULE_UPDATE = "schedule_update",
}

/**
 * Audit log entry stored in tenant-scoped audit_logs table.
 * Immutable — UPDATE and DELETE are revoked on the table.
 */
export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
}
