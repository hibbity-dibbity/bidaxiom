import { AuditAction } from "@construction/shared";
import { middleware } from "../trpc.js";
import { createAuditLog } from "../../audit/logger.js";
import type { AuditLogInput } from "../../audit/types.js";

/**
 * tRPC middleware for automatic audit logging.
 *
 * Logs AFTER procedure succeeds (fire-and-forget).
 * Never blocks the response or fails the parent operation.
 *
 * Usage:
 *   .use(withAuditLog({ entityType: 'Project', action: AuditAction.CREATE }))
 */
export function withAuditLog(config: {
  entityType: string;
  action: AuditAction;
}) {
  return middleware(async ({ ctx, next, input }) => {
    // Run the actual procedure
    const result = await next({ ctx });

    // After success, log the audit entry (fire-and-forget)
    if (result.ok && ctx.tenant && ctx.userId) {
      // Try to extract entity ID from result data
      let entityId = "unknown";
      try {
        const data = (result as unknown as { data: unknown }).data;
        if (data && typeof data === "object" && "id" in data) {
          entityId = String((data as { id: unknown }).id);
        }
      } catch {
        // Ignore extraction errors
      }

      const logInput: AuditLogInput = {
        entityType: config.entityType,
        entityId,
        action: config.action,
        actorId: ctx.userId,
        changes: {
          after: sanitizeForLog(input),
        },
      };

      // Fire and forget — don't await
      createAuditLog(ctx.tenant.db, ctx.tenant.schema, logInput).catch(
        (err) => {
          console.error("Audit middleware log failed:", err);
        }
      );
    }

    return result;
  });
}

/**
 * Sanitize procedure input/output for audit log storage.
 * Removes potentially sensitive fields.
 */
function sanitizeForLog(
  data: unknown
): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const obj = data as Record<string, unknown>;

  // Remove known sensitive fields
  const sanitized = { ...obj };
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;

  return sanitized;
}
