import { z } from "zod";

/**
 * Calendar provider enum
 * Supported providers for calendar integration
 */
export const calendarProviderEnum = z.enum(["google", "microsoft"]);
export type CalendarProvider = z.infer<typeof calendarProviderEnum>;

/**
 * Calendar connection status enum
 * Tracks the lifecycle state of a calendar connection
 */
export const calendarConnectionStatusEnum = z.enum([
  "active",
  "disconnected",
  "expired",
  "error",
]);
export type CalendarConnectionStatus = z.infer<typeof calendarConnectionStatusEnum>;

/**
 * Calendar sync status enum
 * Tracks the real-time state of sync operations
 */
export const calendarSyncStatusEnum = z.enum([
  "idle",
  "syncing",
  "synced",
  "error",
]);
export type CalendarSyncStatus = z.infer<typeof calendarSyncStatusEnum>;

/**
 * Calendar event source enum
 * Indicates whether event originated from platform or external calendar
 */
export const calendarEventSourceEnum = z.enum(["platform", "external"]);
export type CalendarEventSource = z.infer<typeof calendarEventSourceEnum>;

/**
 * Calendar connection schema
 * Per-user OAuth connection to Google Calendar or Microsoft Outlook
 */
export const calendarConnectionSchema = z.object({
  id: z.string().uuid(),
  provider: calendarProviderEnum,
  userId: z.string(), // Clerk user ID (per-user, not per-company)
  status: calendarConnectionStatusEnum,
  accessToken: z.string().optional(), // Short-lived, OK unencrypted
  encryptedRefreshToken: z.string(),
  tokenExpiresAt: z.string().datetime(), // ISO 8601 timestamp
  refreshTokenExpiresAt: z.string().datetime().optional(), // NULL for Google (doesn't expire)
  calendarId: z.string().default("primary"), // "primary" for Google, calendar ID for Microsoft
  providerEmail: z.string().email().optional(), // Email used during OAuth
  lastSyncAt: z.string().datetime().optional(),
  syncToken: z.string().optional(), // Google syncToken or Microsoft deltaLink for incremental sync
  webhookChannelId: z.string().optional(), // Google channel ID
  webhookResourceId: z.string().optional(), // Google resource ID
  webhookSubscriptionId: z.string().optional(), // Microsoft subscription ID
  webhookExpiresAt: z.string().datetime().optional(), // Webhook expiry for renewal scheduling
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CalendarConnection = z.infer<typeof calendarConnectionSchema>;

/**
 * Calendar event schema
 * Bidirectional sync between platform milestones and external calendar events
 */
export const calendarEventSchema = z.object({
  id: z.string().uuid(),
  calendarConnectionId: z.string().uuid(),
  projectId: z.string().uuid().optional(), // NULL for external-origin events
  externalEventId: z.string(), // Google/Microsoft event ID
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  allDay: z.boolean().default(false),
  timezone: z.string().optional(), // IANA timezone e.g. "America/New_York"
  source: calendarEventSourceEnum,
  sourceEntityType: z.string().optional(), // "project", "project_phase"
  sourceEntityId: z.string().optional(), // Project ID or phase ID
  etag: z.string().optional(), // Provider ETag for conflict detection
  lastSyncedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

/**
 * Calendar sync state schema
 * Tracks sync status and metrics per connection
 */
export const calendarSyncStateSchema = z.object({
  id: z.string().uuid(),
  calendarConnectionId: z.string().uuid(),
  lastFullSyncAt: z.string().datetime().optional(),
  lastIncrementalSyncAt: z.string().datetime().optional(),
  syncStatus: calendarSyncStatusEnum,
  syncedEventCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  lastError: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CalendarSyncState = z.infer<typeof calendarSyncStateSchema>;

/**
 * Input schemas for calendar operations
 */
export const connectCalendarInputSchema = z.object({
  provider: calendarProviderEnum,
});
export type ConnectCalendarInput = z.infer<typeof connectCalendarInputSchema>;

export const disconnectCalendarInputSchema = z.object({
  connectionId: z.string().uuid(),
});
export type DisconnectCalendarInput = z.infer<typeof disconnectCalendarInputSchema>;
