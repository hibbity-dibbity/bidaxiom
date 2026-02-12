import { AuditAction } from "@construction/shared";

/**
 * Input for creating a new audit log entry.
 */
export interface AuditLogInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string;
  actorEmail?: string;
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Query parameters for filtering audit logs.
 */
export interface AuditLogQuery {
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Actions that MUST be audit-logged for compliance.
 * Future phases will enforce these via tRPC middleware.
 */
export const SENSITIVE_ACTIONS: AuditAction[] = [
  AuditAction.FINANCIAL_CHANGE,
  AuditAction.BID_SUBMIT,
  AuditAction.SCHEDULE_UPDATE,
  AuditAction.ROLE_CHANGE,
  AuditAction.DELETE,
  AuditAction.CREATE,
];
