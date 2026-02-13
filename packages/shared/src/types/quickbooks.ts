import { z } from "zod";

/**
 * QuickBooks Online Integration Types
 *
 * Defines schemas and types for QBO connection state, sync tracking,
 * entity mappings, and sync notifications.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * QBO connection status.
 */
export const qboConnectionStatusEnum = z.enum([
  "active",
  "disconnected",
  "expired",
  "error",
]);

/**
 * QBO environment type.
 */
export const qboEnvironmentEnum = z.enum(["sandbox", "production"]);

/**
 * Entity types that can be synced with QBO.
 */
export const qboEntityTypeEnum = z.enum([
  "project",
  "invoice",
  "bill",
  "payment",
  "vendor",
  "customer",
]);

/**
 * Sync direction for entity mappings.
 */
export const qboSyncDirectionEnum = z.enum([
  "platform_to_qbo",
  "qbo_to_platform",
  "bidirectional",
]);

/**
 * Current sync status for an entity or sync state.
 */
export const qboSyncStatusEnum = z.enum([
  "pending",
  "syncing",
  "synced",
  "error",
  "conflict",
]);

// ============================================================================
// Schemas
// ============================================================================

/**
 * QBO connection record.
 * Stores OAuth tokens and connection metadata for a tenant's QBO integration.
 */
export const qboConnectionSchema = z.object({
  id: z.string().uuid(),
  realmId: z.string(),
  environment: qboEnvironmentEnum,
  status: qboConnectionStatusEnum,
  companyName: z.string().optional(),
  lastSyncAt: z.string().datetime().optional(),
  tokenExpiresAt: z.string().datetime(),
  refreshTokenExpiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Sync state tracking per entity type.
 * Tracks when each entity type was last successfully synced.
 */
export const qboSyncStateSchema = z.object({
  id: z.string().uuid(),
  entityType: qboEntityTypeEnum,
  lastSuccessfulSync: z.string().datetime().optional(),
  lastCdcSync: z.string().datetime().optional(),
  syncStatus: qboSyncStatusEnum,
  errorMessage: z.string().optional(),
  updatedAt: z.string().datetime(),
});

/**
 * Bidirectional entity mapping.
 * Links platform entity IDs to QBO entity IDs for sync operations.
 */
export const qboEntityMappingSchema = z.object({
  id: z.string().uuid(),
  entityType: qboEntityTypeEnum,
  platformId: z.string().uuid(),
  qboId: z.string(),
  qboSyncToken: z.string().optional(),
  direction: qboSyncDirectionEnum,
  lastSyncedAt: z.string().datetime().optional(),
  syncStatus: qboSyncStatusEnum,
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Sync failure notification.
 * Created when BullMQ worker exhausts all retry attempts.
 */
export const qboSyncNotificationSchema = z.object({
  id: z.string().uuid(),
  entityType: qboEntityTypeEnum,
  entityId: z.string().optional(),
  message: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  dismissed: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

// ============================================================================
// Types
// ============================================================================

export type QboConnection = z.infer<typeof qboConnectionSchema>;
export type QboSyncState = z.infer<typeof qboSyncStateSchema>;
export type QboEntityMapping = z.infer<typeof qboEntityMappingSchema>;
export type QboSyncNotification = z.infer<typeof qboSyncNotificationSchema>;
