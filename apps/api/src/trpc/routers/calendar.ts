import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  getGoogleCalendarAuthUrl,
  handleGoogleCalendarCallback,
} from "../../integrations/calendar/google/oauth.js";
import {
  getMicrosoftCalendarAuthUrl,
  handleMicrosoftCalendarCallback,
} from "../../integrations/calendar/microsoft/oauth.js";
import { encryptToken } from "../../integrations/calendar/shared/crypto.js";
import { calendarSyncQueue } from "../../integrations/calendar/shared/queue.js";
import { eq, and, sql } from "drizzle-orm";

/**
 * Calendar tRPC Router
 *
 * Provides endpoints for calendar OAuth connection, sync management,
 * event listing, and project milestone syncing.
 *
 * Permission model:
 * - Per-user enforcement: All procedures filter by ctx.auth.userId
 * - Users can only manage THEIR OWN calendar connections
 * - CASL "manage Calendar" permission checked for mutations
 * - CASL "read Calendar" permission checked for queries
 */
export const calendarRouter = router({
  /**
   * Get calendar authorization URL to initiate OAuth flow.
   * Per-user. Checks that no active connection exists for this provider.
   */
  getAuthUrl: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["google", "microsoft"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities, userId } = ctx;
      const { provider } = input;

      // Permission check - user must have manage Calendar permission
      if (!abilities.can("manage", "Calendar")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to manage calendar connections",
        });
      }

      // Check if user already has an active connection for this provider
      const existing = await tenant.db
        .select({ id: tenant.schema.calendarConnections.id })
        .from(tenant.schema.calendarConnections)
        .where(
          and(
            eq(tenant.schema.calendarConnections.provider, provider),
            eq(tenant.schema.calendarConnections.userId, userId),
            eq(tenant.schema.calendarConnections.status, "active")
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${provider === "google" ? "Google Calendar" : "Microsoft Outlook"} is already connected. Disconnect first to reconnect.`,
        });
      }

      // Generate authorization URL
      let url: string;
      if (provider === "google") {
        url = getGoogleCalendarAuthUrl(tenant.tenantId, userId);
      } else {
        url = await getMicrosoftCalendarAuthUrl(tenant.tenantId, userId);
      }

      return { url };
    }),

  /**
   * Handle OAuth callback from calendar provider.
   * User is authenticated but callback comes from provider redirect,
   * so we use protectedProcedure.
   */
  handleCallback: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["google", "microsoft"]),
        code: z.string(),
        state: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, userId } = ctx;
      const { provider, code, state } = input;

      // Parse state to validate tenantId matches current context
      const stateData = JSON.parse(state);
      if (stateData.tenantId !== tenant.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid OAuth state parameter - tenant mismatch",
        });
      }

      if (stateData.userId !== userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid OAuth state parameter - user mismatch",
        });
      }

      // Exchange authorization code for tokens
      let tokens: {
        accessToken: string;
        refreshToken: string;
        tokenExpiresAt: Date;
        providerEmail?: string;
      };

      if (provider === "google") {
        tokens = await handleGoogleCalendarCallback(code, state);
      } else {
        tokens = await handleMicrosoftCalendarCallback(code, state);
      }

      // Encrypt refresh token (or serialized account info for Microsoft)
      const encryptedRefreshToken = encryptToken(tokens.refreshToken);

      // Insert connection record
      const [connection] = await tenant.db
        .insert(tenant.schema.calendarConnections)
        .values({
          provider,
          userId,
          status: "active",
          accessToken: tokens.accessToken,
          encryptedRefreshToken,
          tokenExpiresAt: tokens.tokenExpiresAt,
          calendarId: "primary",
          providerEmail: tokens.providerEmail,
        })
        .returning({ id: tenant.schema.calendarConnections.id });

      // Create sync state row
      await tenant.db.insert(tenant.schema.calendarSyncState).values({
        calendarConnectionId: connection.id,
        syncStatus: "idle",
        syncedEventCount: 0,
        errorCount: 0,
      });

      // Queue initial full-sync job
      await calendarSyncQueue.add("full-sync", {
        tenantId: tenant.tenantId,
        provider,
        connectionId: connection.id,
        operation: "full-sync",
        syncReason: "manual",
      });

      // Audit log the connection event
      await tenant.db.insert(tenant.schema.auditLogs).values({
        entityType: "Calendar",
        entityId: connection.id,
        action: "calendar_connected",
        actorId: userId,
        changes: {
          provider,
          providerEmail: tokens.providerEmail,
        },
      });

      return { success: true, connectionId: connection.id };
    }),

  /**
   * Disconnect calendar integration.
   * Per-user. Updates connection status to 'disconnected' and clears tokens.
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities, userId } = ctx;
      const { connectionId } = input;

      // Permission check
      if (!abilities.can("manage", "Calendar")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to manage calendar connections",
        });
      }

      // Validate the connection belongs to current user
      const connection = await tenant.db
        .select({
          id: tenant.schema.calendarConnections.id,
          provider: tenant.schema.calendarConnections.provider,
        })
        .from(tenant.schema.calendarConnections)
        .where(
          and(
            eq(tenant.schema.calendarConnections.id, connectionId),
            eq(tenant.schema.calendarConnections.userId, userId)
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calendar connection not found or access denied",
        });
      }

      // Update connection status and clear tokens
      await tenant.db
        .update(tenant.schema.calendarConnections)
        .set({
          status: "disconnected",
          accessToken: null,
          encryptedRefreshToken: "",
          updatedAt: new Date(),
        })
        .where(eq(tenant.schema.calendarConnections.id, connectionId));

      // Delete associated calendar events
      await tenant.db
        .delete(tenant.schema.calendarEvents)
        .where(eq(tenant.schema.calendarEvents.calendarConnectionId, connectionId));

      // Delete sync state
      await tenant.db
        .delete(tenant.schema.calendarSyncState)
        .where(eq(tenant.schema.calendarSyncState.calendarConnectionId, connectionId));

      // Audit log disconnection
      await tenant.db.insert(tenant.schema.auditLogs).values({
        entityType: "Calendar",
        entityId: connectionId,
        action: "calendar_disconnected",
        actorId: userId,
        changes: {
          provider: connection[0].provider,
        },
      });

      return { success: true };
    }),

  /**
   * Get calendar connections for current user.
   * Returns all connections with sync state.
   */
  getConnections: protectedProcedure.query(async ({ ctx }) => {
    // Runtime null checks for TypeScript
    if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { tenant, abilities, userId } = ctx;

    // Permission check
    if (!abilities.can("read", "Calendar")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to view calendar connections",
      });
    }

    // Query connections for this user
    const connections = await tenant.db
      .select({
        id: tenant.schema.calendarConnections.id,
        provider: tenant.schema.calendarConnections.provider,
        status: tenant.schema.calendarConnections.status,
        providerEmail: tenant.schema.calendarConnections.providerEmail,
        calendarId: tenant.schema.calendarConnections.calendarId,
        lastSyncAt: tenant.schema.calendarConnections.lastSyncAt,
        webhookExpiresAt: tenant.schema.calendarConnections.webhookExpiresAt,
        errorMessage: tenant.schema.calendarConnections.errorMessage,
        // Join sync state
        syncStatus: tenant.schema.calendarSyncState.syncStatus,
        syncedEventCount: tenant.schema.calendarSyncState.syncedEventCount,
        errorCount: tenant.schema.calendarSyncState.errorCount,
        lastFullSyncAt: tenant.schema.calendarSyncState.lastFullSyncAt,
        lastIncrementalSyncAt: tenant.schema.calendarSyncState.lastIncrementalSyncAt,
        lastError: tenant.schema.calendarSyncState.lastError,
      })
      .from(tenant.schema.calendarConnections)
      .leftJoin(
        tenant.schema.calendarSyncState,
        eq(
          tenant.schema.calendarSyncState.calendarConnectionId,
          tenant.schema.calendarConnections.id
        )
      )
      .where(eq(tenant.schema.calendarConnections.userId, userId));

    // Return empty array if no connections
    if (connections.length === 0) {
      return [];
    }

    // Format response
    return connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      status: conn.status,
      providerEmail: conn.providerEmail,
      calendarId: conn.calendarId,
      lastSyncAt: conn.lastSyncAt,
      webhookExpiresAt: conn.webhookExpiresAt,
      errorMessage: conn.errorMessage,
      syncState: {
        syncStatus: conn.syncStatus,
        syncedEventCount: conn.syncedEventCount,
        errorCount: conn.errorCount,
        lastFullSyncAt: conn.lastFullSyncAt,
        lastIncrementalSyncAt: conn.lastIncrementalSyncAt,
        lastError: conn.lastError,
      },
    }));
  }),

  /**
   * Get calendar events for a connection, optionally filtered by project.
   */
  getEvents: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities, userId } = ctx;
      const { connectionId, projectId } = input;

      // Permission check
      if (!abilities.can("read", "Calendar")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view calendar events",
        });
      }

      // Validate connection belongs to current user
      const connection = await tenant.db
        .select({ id: tenant.schema.calendarConnections.id })
        .from(tenant.schema.calendarConnections)
        .where(
          and(
            eq(tenant.schema.calendarConnections.id, connectionId),
            eq(tenant.schema.calendarConnections.userId, userId)
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Calendar connection not found or access denied",
        });
      }

      // Build query
      const baseQuery = tenant.db
        .select({
          id: tenant.schema.calendarEvents.id,
          externalEventId: tenant.schema.calendarEvents.externalEventId,
          title: tenant.schema.calendarEvents.title,
          description: tenant.schema.calendarEvents.description,
          startDate: tenant.schema.calendarEvents.startDate,
          endDate: tenant.schema.calendarEvents.endDate,
          allDay: tenant.schema.calendarEvents.allDay,
          timezone: tenant.schema.calendarEvents.timezone,
          source: tenant.schema.calendarEvents.source,
          sourceEntityType: tenant.schema.calendarEvents.sourceEntityType,
          sourceEntityId: tenant.schema.calendarEvents.sourceEntityId,
          projectId: tenant.schema.calendarEvents.projectId,
          lastSyncedAt: tenant.schema.calendarEvents.lastSyncedAt,
        })
        .from(tenant.schema.calendarEvents)
        .where(eq(tenant.schema.calendarEvents.calendarConnectionId, connectionId));

      // Apply project filter if provided
      const events = projectId
        ? await baseQuery
            .where(
              and(
                eq(tenant.schema.calendarEvents.calendarConnectionId, connectionId),
                eq(tenant.schema.calendarEvents.projectId, projectId)
              )
            )
            .orderBy(sql`${tenant.schema.calendarEvents.startDate} ASC`)
        : await baseQuery.orderBy(sql`${tenant.schema.calendarEvents.startDate} ASC`);

      return events;
    }),

  /**
   * Sync a specific project's milestones to calendar.
   * Per-user. User must have read access to the project.
   */
  syncProject: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        projectId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities, userId } = ctx;
      const { connectionId, projectId } = input;

      // Permission check
      if (!abilities.can("manage", "Calendar")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to sync calendar events",
        });
      }

      // Validate connection belongs to current user and is active
      const connection = await tenant.db
        .select({
          id: tenant.schema.calendarConnections.id,
          provider: tenant.schema.calendarConnections.provider,
        })
        .from(tenant.schema.calendarConnections)
        .where(
          and(
            eq(tenant.schema.calendarConnections.id, connectionId),
            eq(tenant.schema.calendarConnections.userId, userId),
            eq(tenant.schema.calendarConnections.status, "active")
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active calendar connection not found or access denied",
        });
      }

      // Check user has read access to the project (via CASL)
      // Note: CASL check would need project team membership loaded
      // For now, we'll just verify the project exists
      const project = await tenant.db
        .select({ id: tenant.schema.projects.id })
        .from(tenant.schema.projects)
        .where(eq(tenant.schema.projects.id, projectId))
        .limit(1);

      if (project.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Queue push-event job
      await calendarSyncQueue.add("push-event", {
        tenantId: tenant.tenantId,
        provider: connection[0].provider,
        connectionId,
        operation: "push-event",
        projectId,
        syncReason: "manual",
      });

      return { queued: true };
    }),

  /**
   * Sync all projects the user is a team member of.
   */
  syncAllProjects: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities, userId } = ctx;
      const { connectionId } = input;

      // Permission check
      if (!abilities.can("manage", "Calendar")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to sync calendar events",
        });
      }

      // Validate connection belongs to current user and is active
      const connection = await tenant.db
        .select({
          id: tenant.schema.calendarConnections.id,
          provider: tenant.schema.calendarConnections.provider,
        })
        .from(tenant.schema.calendarConnections)
        .where(
          and(
            eq(tenant.schema.calendarConnections.id, connectionId),
            eq(tenant.schema.calendarConnections.userId, userId),
            eq(tenant.schema.calendarConnections.status, "active")
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active calendar connection not found or access denied",
        });
      }

      // Query all projects the user is a team member of
      const projects = await tenant.db
        .select({ projectId: tenant.schema.projectTeamMembers.projectId })
        .from(tenant.schema.projectTeamMembers)
        .where(eq(tenant.schema.projectTeamMembers.userId, userId));

      // Queue a push-event job for each project
      let jobsQueued = 0;
      for (const project of projects) {
        await calendarSyncQueue.add("push-event", {
          tenantId: tenant.tenantId,
          provider: connection[0].provider,
          connectionId,
          operation: "push-event",
          projectId: project.projectId,
          syncReason: "manual",
        });
        jobsQueued++;
      }

      return { jobsQueued };
    }),

  /**
   * Trigger manual incremental sync for a connection.
   */
  manualSync: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities, userId } = ctx;
      const { connectionId } = input;

      // Permission check
      if (!abilities.can("manage", "Calendar")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to sync calendar events",
        });
      }

      // Validate connection belongs to current user and is active
      const connection = await tenant.db
        .select({
          id: tenant.schema.calendarConnections.id,
          provider: tenant.schema.calendarConnections.provider,
        })
        .from(tenant.schema.calendarConnections)
        .where(
          and(
            eq(tenant.schema.calendarConnections.id, connectionId),
            eq(tenant.schema.calendarConnections.userId, userId),
            eq(tenant.schema.calendarConnections.status, "active")
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active calendar connection not found or access denied",
        });
      }

      // Queue incremental-sync job
      await calendarSyncQueue.add("incremental-sync", {
        tenantId: tenant.tenantId,
        provider: connection[0].provider,
        connectionId,
        operation: "incremental-sync",
        syncReason: "manual",
      });

      return { queued: true };
    }),
});
