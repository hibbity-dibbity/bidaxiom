import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure, authorizedProcedure } from "../procedures.js";
import { getQboAuthUrl, handleQboCallback } from "../../integrations/quickbooks/oauth.js";
import { encryptToken } from "../../integrations/quickbooks/crypto.js";
import { diagnoseQboConnection } from "../../integrations/quickbooks/diagnose.js";
import { getQboSyncQueue } from "../../integrations/quickbooks/queue.js";
import { eq, sql, and } from "drizzle-orm";

/**
 * QuickBooks tRPC Router
 *
 * Provides endpoints for QBO OAuth connection, sync status, manual sync triggers,
 * and sync failure notification management.
 *
 * Permission model:
 * - Admin (org:admin): Full access to connect, disconnect, manual sync, dismiss notifications
 * - Accountant (org:accountant): Read-only access to status and notifications
 * - Other roles: No access
 */
export const quickbooksRouter = router({
  /**
   * Get QuickBooks authorization URL to initiate OAuth flow.
   * Admin-only. Checks that no active connection exists before generating URL.
   */
  getAuthUrl: authorizedProcedure.mutation(async ({ ctx }) => {
    // Runtime null checks for TypeScript
    if (!ctx.tenant || !ctx.abilities) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { tenant, abilities } = ctx;

    // Admin-only permission check
    if (!abilities.can("manage", "QuickBooks")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only administrators can manage QuickBooks integration",
      });
    }

    // Check if tenant already has an active QBO connection
    const existing = await tenant.db
      .select({ id: tenant.schema.qboConnections.id })
      .from(tenant.schema.qboConnections)
      .where(eq(tenant.schema.qboConnections.status, "active"))
      .limit(1);

    if (existing.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "QuickBooks is already connected. Disconnect first to reconnect.",
      });
    }

    // Generate authorization URL (tenantId passed as state parameter for callback linking)
    const authUrl = getQboAuthUrl(tenant.tenantId);

    return { authUrl };
  }),

  /**
   * Handle OAuth callback from QuickBooks.
   * User is authenticated but callback comes from QBO redirect,
   * so we use protectedProcedure (not authorizedProcedure) since abilities may not be loaded.
   */
  handleCallback: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        realmId: z.string(),
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
      const { code, realmId, state } = input;

      // Verify state matches tenantId (CSRF protection)
      if (state !== tenant.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid OAuth state parameter",
        });
      }

      // Exchange authorization code for tokens
      const tokens = await handleQboCallback(code, realmId, tenant.tenantId);

      // Encrypt refresh token
      const encryptedRefreshToken = encryptToken(tokens.refreshToken);

      // Insert connection record
      await tenant.db.insert(tenant.schema.qboConnections).values({
        realmId: realmId, // Use realmId from input (tokens.realmId is optional)
        environment: process.env.QBO_ENVIRONMENT || "sandbox",
        accessToken: tokens.accessToken,
        encryptedRefreshToken,
        tokenExpiresAt: tokens.tokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        status: "active",
        connectedBy: userId,
      });

      // Initialize sync state rows for each entity type
      const entityTypes = ["project", "invoice", "bill", "payment", "vendor", "customer"] as const;
      await tenant.db.insert(tenant.schema.qboSyncState).values(
        entityTypes.map((entityType) => ({
          entityType,
          syncStatus: "pending" as const,
        }))
      );

      // Audit log
      await tenant.db.insert(tenant.schema.auditLogs).values({
        entityType: "QuickBooks",
        entityId: realmId,
        action: "quickbooks_connected",
        actorId: userId,
        changes: {
          realmId,
          environment: process.env.QBO_ENVIRONMENT || "sandbox",
        },
      });

      return { success: true, realmId };
    }),

  /**
   * Disconnect QuickBooks integration.
   * Admin-only. Updates connection status to 'disconnected' and clears tokens.
   */
  disconnect: authorizedProcedure.mutation(async ({ ctx }) => {
    // Runtime null checks for TypeScript
    if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { tenant, abilities, userId } = ctx;

    // Admin-only permission check
    if (!abilities.can("manage", "QuickBooks")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only administrators can manage QuickBooks integration",
      });
    }

    // Update connection status and clear tokens
    const result = await tenant.db
      .update(tenant.schema.qboConnections)
      .set({
        status: "disconnected",
        accessToken: null,
        encryptedRefreshToken: "",
        updatedAt: new Date(),
      })
      .where(eq(tenant.schema.qboConnections.status, "active"))
      .returning({ realmId: tenant.schema.qboConnections.realmId });

    if (result.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active QuickBooks connection found",
      });
    }

    // Audit log
    await tenant.db.insert(tenant.schema.auditLogs).values({
      entityType: "QuickBooks",
      entityId: result[0].realmId,
      action: "quickbooks_disconnected",
      actorId: userId,
      changes: {},
    });

    return { success: true };
  }),

  /**
   * What this server is set up to send to Intuit, so the person can match it against the app's Keys page.
   * Never returns the secret. Admin-only.
   */
  setupInfo: authorizedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.abilities) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }
    if (!ctx.abilities.can("manage", "QuickBooks")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can see the QuickBooks setup details" });
    }
    const id = process.env.QBO_CLIENT_ID ?? "";
    return {
      redirectUri: `${process.env.API_URL ?? ""}/api/integrations/quickbooks/callback`,
      environment: process.env.QBO_ENVIRONMENT || "sandbox",
      clientIdHint: id ? `${id.slice(0, 4)}…${id.slice(-4)}` : null,
      hasSecret: Boolean(process.env.QBO_CLIENT_SECRET),
      hasEncryptionKey: (process.env.QBO_ENCRYPTION_KEY ?? "").length === 64,
    };
  }),

  /**
   * Read-only health check: signs in to QuickBooks and reads company, plan, features and record counts.
   * Writes nothing to QuickBooks. Admin-only.
   */
  checkConnection: authorizedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.abilities) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }
    if (!ctx.abilities.can("manage", "QuickBooks")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can check the QuickBooks connection" });
    }
    return diagnoseQboConnection(ctx.tenant);
  }),

  /**
   * Get QuickBooks connection status and sync state.
   * Accessible to admin and accountant roles.
   */
  getStatus: authorizedProcedure.query(async ({ ctx }) => {
    // Runtime null checks for TypeScript
    if (!ctx.tenant || !ctx.abilities) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { tenant, abilities } = ctx;

    // Check read permission
    if (!abilities.can("read", "QuickBooks")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to view QuickBooks integration status",
      });
    }

    // Query connection
    const connection = await tenant.db
      .select({
        realmId: tenant.schema.qboConnections.realmId,
        companyName: tenant.schema.qboConnections.companyName,
        status: tenant.schema.qboConnections.status,
        lastSyncAt: tenant.schema.qboConnections.lastSyncAt,
        environment: tenant.schema.qboConnections.environment,
        connectedBy: tenant.schema.qboConnections.connectedBy,
        refreshTokenExpiresAt: tenant.schema.qboConnections.refreshTokenExpiresAt,
      })
      .from(tenant.schema.qboConnections)
      .limit(1);

    if (connection.length === 0) {
      return { connected: false };
    }

    // Query all sync states
    const syncStates = await tenant.db
      .select({
        entityType: tenant.schema.qboSyncState.entityType,
        lastSuccessfulSync: tenant.schema.qboSyncState.lastSuccessfulSync,
        syncStatus: tenant.schema.qboSyncState.syncStatus,
        syncedCount: tenant.schema.qboSyncState.syncedCount,
        errorCount: tenant.schema.qboSyncState.errorCount,
        errorMessage: tenant.schema.qboSyncState.errorMessage,
      })
      .from(tenant.schema.qboSyncState);

    return {
      connected: true,
      connection: connection[0],
      syncStates,
    };
  }),

  /**
   * Get sync failure notifications.
   * Accessible to admin and accountant roles.
   */
  getNotifications: authorizedProcedure
    .input(
      z.object({
        includeDismissed: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities } = ctx;

      // Check read permission
      if (!abilities.can("read", "QuickBooks")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view QuickBooks notifications",
        });
      }

      const { includeDismissed } = input;

      // Build query with optional dismissed filter
      const baseQuery = tenant.db
        .select({
          id: tenant.schema.qboSyncNotifications.id,
          entityType: tenant.schema.qboSyncNotifications.entityType,
          entityId: tenant.schema.qboSyncNotifications.entityId,
          message: tenant.schema.qboSyncNotifications.message,
          severity: tenant.schema.qboSyncNotifications.severity,
          dismissed: tenant.schema.qboSyncNotifications.dismissed,
          createdAt: tenant.schema.qboSyncNotifications.createdAt,
        })
        .from(tenant.schema.qboSyncNotifications);

      const notifications = includeDismissed
        ? await baseQuery.orderBy(sql`${tenant.schema.qboSyncNotifications.createdAt} DESC`).limit(50)
        : await baseQuery
            .where(eq(tenant.schema.qboSyncNotifications.dismissed, false))
            .orderBy(sql`${tenant.schema.qboSyncNotifications.createdAt} DESC`)
            .limit(50);

      return { notifications };
    }),

  /**
   * Dismiss a specific sync notification.
   * Admin-only.
   */
  dismissNotification: authorizedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities } = ctx;

      // Admin-only permission check
      if (!abilities.can("manage", "QuickBooks")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can dismiss notifications",
        });
      }

      await tenant.db
        .update(tenant.schema.qboSyncNotifications)
        .set({ dismissed: true })
        .where(eq(tenant.schema.qboSyncNotifications.id, input.notificationId));

      return { success: true };
    }),

  /**
   * Dismiss all undismissed sync notifications.
   * Admin-only. Returns count of notifications dismissed.
   */
  dismissAllNotifications: authorizedProcedure.mutation(async ({ ctx }) => {
    // Runtime null checks for TypeScript
    if (!ctx.tenant || !ctx.abilities) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { tenant, abilities } = ctx;

    // Admin-only permission check
    if (!abilities.can("manage", "QuickBooks")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only administrators can dismiss notifications",
      });
    }

    const result = await tenant.db
      .update(tenant.schema.qboSyncNotifications)
      .set({ dismissed: true })
      .where(eq(tenant.schema.qboSyncNotifications.dismissed, false))
      .returning({ id: tenant.schema.qboSyncNotifications.id });

    return { dismissed: result.length };
  }),

  /**
   * Trigger manual sync for specific entity types or all entities.
   * Admin-only.
   */
  manualSync: authorizedProcedure
    .input(
      z.object({
        entityType: z.enum(["project", "invoice", "bill", "all"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.abilities) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { tenant, abilities } = ctx;

      // Admin-only permission check
      if (!abilities.can("manage", "QuickBooks")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can trigger manual sync",
        });
      }

      // Verify active QBO connection exists
      const connection = await tenant.db
        .select({ id: tenant.schema.qboConnections.id })
        .from(tenant.schema.qboConnections)
        .where(eq(tenant.schema.qboConnections.status, "active"))
        .limit(1);

      if (connection.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active QuickBooks connection. Please connect first.",
        });
      }

      const { entityType } = input;
      let jobsQueued = 0;

      if (entityType === "all") {
        // Queue sync jobs for all supported entity types
        const entityTypes = ["project", "invoice", "bill"] as const;

        for (const type of entityTypes) {
          // For each entity type, find platform entities without QBO mappings
          let platformEntities: Array<{ id: string }> = [];

          if (type === "project") {
            platformEntities = await tenant.db
              .select({ id: tenant.schema.projects.id })
              .from(tenant.schema.projects)
              .leftJoin(
                tenant.schema.qboEntityMappings,
                and(
                  eq(tenant.schema.qboEntityMappings.platformId, tenant.schema.projects.id),
                  eq(tenant.schema.qboEntityMappings.entityType, "project")
                )
              )
              .where(sql`${tenant.schema.qboEntityMappings.id} IS NULL`);
          }
          // Add similar logic for invoice and bill when those tables exist

          // Queue sync jobs for unmapped entities
          for (const entity of platformEntities) {
            await getQboSyncQueue().add("sync-to-qbo", {
              tenantId: tenant.tenantId,
              entityType: type,
              platformId: entity.id,
              syncReason: "manual",
            });
            jobsQueued++;
          }

          // Also queue sync jobs for entities WITH mappings (to push updates)
          const mappedEntities = await tenant.db
            .select({ platformId: tenant.schema.qboEntityMappings.platformId })
            .from(tenant.schema.qboEntityMappings)
            .where(eq(tenant.schema.qboEntityMappings.entityType, type));

          for (const mapping of mappedEntities) {
            await getQboSyncQueue().add("sync-to-qbo", {
              tenantId: tenant.tenantId,
              entityType: type,
              platformId: mapping.platformId,
              syncReason: "manual",
            });
            jobsQueued++;
          }

          // Update sync state to 'syncing'
          await tenant.db
            .update(tenant.schema.qboSyncState)
            .set({ syncStatus: "syncing", updatedAt: new Date() })
            .where(eq(tenant.schema.qboSyncState.entityType, type));
        }
      } else {
        // Specific entity type sync
        let platformEntities: Array<{ id: string }> = [];

        if (entityType === "project") {
          platformEntities = await tenant.db
            .select({ id: tenant.schema.projects.id })
            .from(tenant.schema.projects)
            .leftJoin(
              tenant.schema.qboEntityMappings,
              and(
                eq(tenant.schema.qboEntityMappings.platformId, tenant.schema.projects.id),
                eq(tenant.schema.qboEntityMappings.entityType, "project")
              )
            )
            .where(sql`${tenant.schema.qboEntityMappings.id} IS NULL`);
        }
        // Add similar logic for invoice and bill when those tables exist

        // Queue sync jobs for unmapped entities
        for (const entity of platformEntities) {
          await getQboSyncQueue().add("sync-to-qbo", {
            tenantId: tenant.tenantId,
            entityType,
            platformId: entity.id,
            syncReason: "manual",
          });
          jobsQueued++;
        }

        // Also queue sync jobs for entities WITH mappings (to push updates)
        const mappedEntities = await tenant.db
          .select({ platformId: tenant.schema.qboEntityMappings.platformId })
          .from(tenant.schema.qboEntityMappings)
          .where(eq(tenant.schema.qboEntityMappings.entityType, entityType));

        for (const mapping of mappedEntities) {
          await getQboSyncQueue().add("sync-to-qbo", {
            tenantId: tenant.tenantId,
            entityType,
            platformId: mapping.platformId,
            syncReason: "manual",
          });
          jobsQueued++;
        }

        // Update sync state to 'syncing'
        await tenant.db
          .update(tenant.schema.qboSyncState)
          .set({ syncStatus: "syncing", updatedAt: new Date() })
          .where(eq(tenant.schema.qboSyncState.entityType, entityType));
      }

      return { jobsQueued };
    }),
});
