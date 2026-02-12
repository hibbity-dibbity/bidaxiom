# Plan 07 Summary: Audit Logging

**Commit:** 460ec38
**Status:** Complete

## What was built
- Immutable audit logging system with REVOKE UPDATE/DELETE on audit_logs tables
- `AuditLogger` class in `apps/api/src/audit/logger.ts` with log(), query(), getEntityHistory()
- `createAuditLog()` helper that NEVER throws — fire-and-forget pattern
- `withAuditLog({ entityType, action })` tRPC middleware for automatic post-procedure logging
- Sanitization of sensitive fields (password, token, secret) before storage
- tRPC audit router with three endpoints:
  - `audit.list` — paginated, filtered by action/entityType/actor, role-checked (admin/PM only)
  - `audit.entityHistory` — full history for a specific entity
  - `audit.summary` — dashboard summary with today's count and recent actions
- Types: AuditLogInput, AuditLogQuery, SENSITIVE_ACTIONS in `apps/api/src/audit/types.ts`

## Key design decisions
- Fire-and-forget: audit writes never block or fail parent operations
- Entity ID extraction from tRPC result data with try/catch fallback
- Middleware pattern: `withAuditLog()` attaches to any procedure in the chain
