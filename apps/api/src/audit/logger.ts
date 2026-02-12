import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";
import type { AuditLogEntry } from "@construction/shared";
import type { TenantSchema } from "../db/schema/tenant.js";
import type { AuditLogInput, AuditLogQuery } from "./types.js";

type TenantDb = { db: ReturnType<typeof import("drizzle-orm/node-postgres")["drizzle"]> };

/**
 * Audit logger service for tenant-scoped audit log operations.
 *
 * Writes to the tenant's audit_logs table (immutable — UPDATE/DELETE revoked).
 * IMPORTANT: log() never throws — failures are logged but don't break the main operation.
 */
export class AuditLogger {
  constructor(
    private tenantDb: TenantDb["db"],
    private schema: TenantSchema
  ) {}

  /**
   * Write an audit log entry. Fire-and-forget safe.
   * NEVER throws — logs errors internally.
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.tenantDb.insert(this.schema.auditLogs).values({
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId,
        actorEmail: input.actorEmail ?? null,
        changes: {
          ...input.changes,
          ...(input.metadata ? { _metadata: input.metadata } : {}),
        },
        ipAddress: input.ipAddress ?? null,
      });
    } catch (err) {
      // NEVER fail the parent operation
      console.error("Audit log write failed:", err);
      console.error("Failed audit entry:", JSON.stringify(input));
    }
  }

  /**
   * Query audit logs with filters and pagination.
   */
  async query(params: AuditLogQuery): Promise<{
    items: AuditLogEntry[];
    total: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = params.offset ?? 0;
    const conditions = [];

    if (params.entityType) {
      conditions.push(eq(this.schema.auditLogs.entityType, params.entityType));
    }
    if (params.entityId) {
      conditions.push(eq(this.schema.auditLogs.entityId, params.entityId));
    }
    if (params.action) {
      conditions.push(eq(this.schema.auditLogs.action, params.action));
    }
    if (params.actorId) {
      conditions.push(eq(this.schema.auditLogs.actorId, params.actorId));
    }
    if (params.startDate) {
      conditions.push(gte(this.schema.auditLogs.timestamp, params.startDate));
    }
    if (params.endDate) {
      conditions.push(lte(this.schema.auditLogs.timestamp, params.endDate));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      this.tenantDb
        .select()
        .from(this.schema.auditLogs)
        .where(whereClause)
        .orderBy(desc(this.schema.auditLogs.timestamp))
        .limit(limit)
        .offset(offset),
      this.tenantDb
        .select({ count: sql<number>`count(*)` })
        .from(this.schema.auditLogs)
        .where(whereClause),
    ]);

    return {
      items: items.map(mapToEntry),
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  /**
   * Get chronological history of all actions on a specific entity.
   */
  async getEntityHistory(
    entityType: string,
    entityId: string
  ): Promise<AuditLogEntry[]> {
    const items = await this.tenantDb
      .select()
      .from(this.schema.auditLogs)
      .where(
        and(
          eq(this.schema.auditLogs.entityType, entityType),
          eq(this.schema.auditLogs.entityId, entityId)
        )
      )
      .orderBy(asc(this.schema.auditLogs.timestamp));

    return items.map(mapToEntry);
  }
}

/**
 * Map DB row to AuditLogEntry type.
 */
function mapToEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    entityType: row.entityType as string,
    entityId: row.entityId as string,
    action: row.action as AuditLogEntry["action"],
    actorId: row.actorId as string,
    changes: (row.changes ?? {}) as Record<string, unknown>,
    timestamp: row.timestamp as Date,
    ipAddress: (row.ipAddress as string) ?? undefined,
  };
}

/**
 * Shorthand: create a single audit log entry.
 */
export async function createAuditLog(
  tenantDb: TenantDb["db"],
  schema: TenantSchema,
  input: AuditLogInput
): Promise<void> {
  const logger = new AuditLogger(tenantDb, schema);
  await logger.log(input);
}
