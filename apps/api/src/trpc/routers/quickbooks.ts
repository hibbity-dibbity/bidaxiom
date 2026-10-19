import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure, authorizedProcedure } from "../procedures.js";
import { getQboAuthUrl, handleQboCallback } from "../../integrations/quickbooks/oauth.js";
import { encryptToken } from "../../integrations/quickbooks/crypto.js";
import { diagnoseQboConnection } from "../../integrations/quickbooks/diagnose.js";
import { getQboSyncQueue } from "../../integrations/quickbooks/queue.js";
import { getQboAccess, runReceiptPass } from "../../integrations/quickbooks/receipts.js";
import { qboQueryRows } from "../../integrations/quickbooks/client.js";
import { QBO_AUTO_SYNC_MODES } from "../../integrations/quickbooks/autoSync.js";
import { eq, sql, and, inArray, isNull } from "drizzle-orm";

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

      // Links and sync counters belong to one QuickBooks company. Reconnecting the same company keeps them;
      // connecting a different one (a new sandbox, say) would leave links pointing at someone else's records.
      const earlier = await tenant.db.select({ realmId: tenant.schema.qboConnections.realmId }).from(tenant.schema.qboConnections);
      const sameCompany = earlier.some((c) => c.realmId === realmId);
      await tenant.db.delete(tenant.schema.qboConnections);
      if (!sameCompany) {
        await tenant.db.delete(tenant.schema.qboEntityMappings);
        await tenant.db.delete(tenant.schema.qboSyncState);
      }

      // A fresh connection settles the earlier "reconnect" complaints.
      await tenant.db.update(tenant.schema.qboSyncNotifications).set({ dismissed: true }).where(eq(tenant.schema.qboSyncNotifications.entityType, "connection")).catch(() => undefined);

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

      // Initialize sync state rows for each entity type (unless a reconnect to the same company kept them)
      const entityTypes = ["project", "invoice", "bill", "payment", "vendor", "customer"] as const;
      const keptState = await tenant.db.select({ id: tenant.schema.qboSyncState.id }).from(tenant.schema.qboSyncState).limit(1);
      if (keptState.length === 0) {
        await tenant.db.insert(tenant.schema.qboSyncState).values(
          entityTypes.map((entityType) => ({
            entityType,
            syncStatus: "pending" as const,
          }))
        );
      }

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
   * Stop sync jobs that have not started and clear any "syncing" labels left behind.
   * A job already in progress finishes on its own (they take seconds). Admin-only.
   */
  cancelSync: authorizedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.abilities) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }
    if (!ctx.abilities.can("manage", "QuickBooks")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can cancel a sync" });
    }
    const queue = getQboSyncQueue();
    const waiting = await queue.getJobs(["waiting", "delayed", "failed", "paused", "prioritized"], 0, 5000);
    let removed = 0;
    for (const job of waiting) {
      if (job.data?.tenantId !== ctx.tenant.tenantId) continue;
      try {
        await job.remove();
        removed++;
      } catch {
        // already picked up by a worker; let it finish
      }
    }
    await ctx.tenant.db
      .update(ctx.tenant.schema.qboSyncState)
      .set({ syncStatus: "pending", updatedAt: new Date() })
      .where(inArray(ctx.tenant.schema.qboSyncState.syncStatus, ["syncing", "error"]));
    return { removed };
  }),

  /**
   * Forget the saved links between BidAxiom projects and QuickBooks customers (the next sync creates them fresh).
   * Used when links point at another QuickBooks company. Does not change anything in QuickBooks. Admin-only.
   */
  resetProjectLinks: authorizedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }
    if (!ctx.abilities.can("manage", "QuickBooks")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can reset QuickBooks links" });
    }
    const { db, schema } = ctx.tenant;
    const gone = await db.delete(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.entityType, "project")).returning({ id: schema.qboEntityMappings.id });
    await db.insert(schema.auditLogs).values({ entityType: "QuickBooks", entityId: "project-links", action: "quickbooks_links_reset", actorId: ctx.userId, changes: { removed: gone.length } });
    return { removed: gone.length };
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
      .orderBy(sql`(${tenant.schema.qboConnections.status} = 'active') DESC`, sql`${tenant.schema.qboConnections.updatedAt} DESC`)
      .limit(1);

    // A disconnected company counts as not connected, so the page offers Connect instead of Disconnect.
    if (connection.length === 0 || connection[0].status === "disconnected") {
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

      const [activeConn] = await tenant.db.select({ id: tenant.schema.qboConnections.id }).from(tenant.schema.qboConnections).where(eq(tenant.schema.qboConnections.status, "active")).limit(1);
      return {
        notifications: notifications
          // A "reconnect" complaint is out of date while the connection is working.
          .filter((n) => !(activeConn && n.entityType === "connection" && !includeDismissed))
          .map((n) => (/status code 429/i.test(n.message) ? { ...n, message: "QuickBooks was busy and asked us to slow down, so this was not sent. Press Sync again in a minute." } : n)),
      };
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

  /** Automatic project sync setting for this company. */
  getAutoSync: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    const [p] = await db
      .select({ mode: schema.companyProfiles.qboAutoSync, intervalMinutes: schema.companyProfiles.qboSyncIntervalMinutes, lastRunAt: schema.companyProfiles.qboAutoSyncLastRunAt, readPayments: schema.companyProfiles.qboReadPayments, readVendors: schema.companyProfiles.qboReadVendors })
      .from(schema.companyProfiles)
      .where(isNull(schema.companyProfiles.validTo))
      .limit(1);
    return { mode: (p?.mode ?? "off") as (typeof QBO_AUTO_SYNC_MODES)[number], intervalMinutes: p?.intervalMinutes ?? 60, lastRunAt: p?.lastRunAt ?? null, readPayments: p?.readPayments ?? false, readVendors: p?.readVendors ?? false, hasProfile: Boolean(p) };
  }),

  setAutoSync: authorizedProcedure
    .input(z.object({ mode: z.enum(QBO_AUTO_SYNC_MODES), intervalMinutes: z.number().int().min(15).max(10080), readPayments: z.boolean().optional(), readVendors: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (!ctx.abilities.can("manage", "QuickBooks")) throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can change QuickBooks sync settings" });
      const { db, schema } = ctx.tenant;
      const done = await db
        .update(schema.companyProfiles)
        .set({ qboAutoSync: input.mode, qboSyncIntervalMinutes: input.intervalMinutes, ...(input.readPayments === undefined ? {} : { qboReadPayments: input.readPayments }), ...(input.readVendors === undefined ? {} : { qboReadVendors: input.readVendors }) })
        .where(isNull(schema.companyProfiles.validTo))
        .returning({ id: schema.companyProfiles.id });
      if (done.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Save the company type in company settings first, then this option." });
      return { mode: input.mode, intervalMinutes: input.intervalMinutes };
    }),

  /** Whether sent invoices are created in QuickBooks, from which date, and onto which income item. */
  getInvoiceSync: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    const [p] = await db
      .select({ on: schema.companyProfiles.qboInvoicePush, from: schema.companyProfiles.qboInvoicePushFrom, itemId: schema.companyProfiles.qboIncomeItemId, itemName: schema.companyProfiles.qboIncomeItemName, taxId: schema.companyProfiles.qboSalesTaxCodeId, taxName: schema.companyProfiles.qboSalesTaxCodeName })
      .from(schema.companyProfiles)
      .where(isNull(schema.companyProfiles.validTo))
      .limit(1);
    return { enabled: p?.on ?? false, startDate: p?.from ?? null, itemId: p?.itemId ?? null, itemName: p?.itemName ?? null, taxCodeId: p?.taxId ?? null, taxCodeName: p?.taxName ?? null };
  }),

  /** The company's own QuickBooks products/services, so an admin can pick where invoice lines post. Read-only. */
  listIncomeItems: authorizedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.abilities) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ctx.abilities.can("manage", "QuickBooks")) throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can change QuickBooks sync settings" });
    const access = await getQboAccess(ctx.tenant).catch((e) => {
      throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "Could not reach QuickBooks." });
    });
    if (!access) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active QuickBooks connection. Please connect first." });
    const rows = await qboQueryRows<any>(access.accessToken, access.realmId, "Item", "select * from Item where Type = 'Service' and Active = true MAXRESULTS 200");
    return rows.map((r) => ({ id: String(r.Id), name: String(r.FullyQualifiedName ?? r.Name), incomeAccount: (r.IncomeAccountRef?.name as string | undefined) ?? null })).sort((a, b) => a.name.localeCompare(b.name));
  }),

  /** The company's taxable sales tax codes in QuickBooks, so an admin can pick the one invoices with tax use. Read-only. */
  listSalesTaxCodes: authorizedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.abilities) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ctx.abilities.can("manage", "QuickBooks")) throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can change QuickBooks sync settings" });
    const access = await getQboAccess(ctx.tenant).catch((e) => {
      throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "Could not reach QuickBooks." });
    });
    if (!access) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active QuickBooks connection. Please connect first." });
    const rows = await qboQueryRows<any>(access.accessToken, access.realmId, "TaxCode", "select * from TaxCode where Active = true MAXRESULTS 200");
    const rates = await qboQueryRows<any>(access.accessToken, access.realmId, "TaxRate", "select * from TaxRate MAXRESULTS 500").catch(() => [] as any[]);
    const rateOf = new Map(rates.map((r) => [String(r.Id), Number(r.RateValue ?? 0)]));
    return rows
      .filter((r) => r.Taxable !== false && String(r.Name).toUpperCase() !== "NON" && String(r.Name).toUpperCase() !== "EXEMPT")
      .map((r) => {
        const list = (r.SalesTaxRateList?.TaxRateDetail ?? []) as any[];
        const total = list.reduce((a, d) => a + (rateOf.get(String(d.TaxRateRef?.value)) ?? 0), 0);
        return { id: String(r.Id), name: total > 0 ? `${r.Name} (${Math.round(total * 1000) / 1000}%)` : String(r.Name) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }),

  setInvoiceSync: authorizedProcedure
    .input(z.object({ enabled: z.boolean(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), itemId: z.string().max(50).nullable(), itemName: z.string().max(200).nullable(), taxCodeId: z.string().max(50).nullable().optional(), taxCodeName: z.string().max(200).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (!ctx.abilities.can("manage", "QuickBooks")) throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can change QuickBooks sync settings" });
      if (input.enabled && (!input.itemId || !input.startDate)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the income item and the first date to send from before turning this on." });
      const { db, schema } = ctx.tenant;
      const done = await db
        .update(schema.companyProfiles)
        .set({ qboInvoicePush: input.enabled, qboInvoicePushFrom: input.startDate, qboIncomeItemId: input.itemId, qboIncomeItemName: input.itemName, qboSalesTaxCodeId: input.taxCodeId ?? null, qboSalesTaxCodeName: input.taxCodeName ?? null })
        .where(isNull(schema.companyProfiles.validTo))
        .returning({ id: schema.companyProfiles.id });
      if (done.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Save the company type in company settings first, then this option." });
      return input;
    }),

  /** Whether issued purchase and work orders are created in QuickBooks, from which date, and onto which expense accounts. */
  getOrderSync: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    const [p] = await db
      .select({ on: schema.companyProfiles.qboOrderPush, from: schema.companyProfiles.qboOrderPushFrom, accounts: schema.companyProfiles.qboOrderAccounts })
      .from(schema.companyProfiles)
      .where(isNull(schema.companyProfiles.validTo))
      .limit(1);
    return { enabled: p?.on ?? false, startDate: p?.from ?? null, accounts: (p?.accounts ?? {}) as Record<string, { id: string; name: string }> };
  }),

  /** The company's own QuickBooks expense and cost of goods sold accounts, so an admin can pick where order lines post. Read-only. */
  listExpenseAccounts: authorizedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.abilities) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ctx.abilities.can("manage", "QuickBooks")) throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can change QuickBooks sync settings" });
    const access = await getQboAccess(ctx.tenant).catch((e) => {
      throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "Could not reach QuickBooks." });
    });
    if (!access) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active QuickBooks connection. Please connect first." });
    const rows = await qboQueryRows<any>(access.accessToken, access.realmId, "Account", "select * from Account where Classification = 'Expense' and Active = true MAXRESULTS 500");
    return rows.map((r) => ({ id: String(r.Id), name: String(r.FullyQualifiedName ?? r.Name), type: String(r.AccountType ?? "") })).sort((a, b) => a.name.localeCompare(b.name));
  }),

  setOrderSync: authorizedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        accounts: z.record(z.enum(["material", "equipment", "labor"]), z.object({ id: z.string().max(50), name: z.string().max(200) })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (!ctx.abilities.can("manage", "QuickBooks")) throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can change QuickBooks sync settings" });
      if (input.enabled && (!input.startDate || !input.accounts.material?.id || !input.accounts.equipment?.id || !input.accounts.labor?.id)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the three expense accounts and the first date to send from before turning this on." });
      }
      const { db, schema } = ctx.tenant;
      const done = await db
        .update(schema.companyProfiles)
        .set({ qboOrderPush: input.enabled, qboOrderPushFrom: input.startDate, qboOrderAccounts: input.accounts as Record<string, { id: string; name: string }> })
        .where(isNull(schema.companyProfiles.validTo))
        .returning({ id: schema.companyProfiles.id });
      if (done.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Save the company type in company settings first, then this option." });
      return input;
    }),

  /**
   * Trigger manual sync for specific entity types or all entities.
   * Admin-only.
   */
  manualSync: authorizedProcedure
    .input(
      z.object({
        entityType: z.enum(["customer", "project", "invoice", "order", "bill", "all"]),
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
        const entityTypes = ["customer", "project", "invoice", "order", "bill"] as const;

        for (const type of entityTypes) {
          const queuedBefore = jobsQueued;
          // For each entity type, find platform entities without QBO mappings
          let platformEntities: Array<{ id: string }> = [];

          if (type === "customer") {
            platformEntities = await tenant.db
              .select({ id: tenant.schema.customers.id })
              .from(tenant.schema.customers)
              .leftJoin(
                tenant.schema.qboEntityMappings,
                and(
                  eq(tenant.schema.qboEntityMappings.platformId, tenant.schema.customers.id),
                  eq(tenant.schema.qboEntityMappings.entityType, "customer")
                )
              )
              .where(sql`${tenant.schema.qboEntityMappings.id} IS NULL`);
          }
          if (type === "invoice") {
            platformEntities = await tenant.db
              .select({ id: tenant.schema.invoices.id })
              .from(tenant.schema.invoices)
              .leftJoin(
                tenant.schema.qboEntityMappings,
                and(eq(tenant.schema.qboEntityMappings.platformId, tenant.schema.invoices.id), eq(tenant.schema.qboEntityMappings.entityType, "invoice"))
              )
              .where(and(sql`${tenant.schema.qboEntityMappings.id} IS NULL`, inArray(tenant.schema.invoices.status, ["sent", "partially_paid", "paid"]), sql`${tenant.schema.invoices.sentOn} IS NOT NULL`));
          }
          if (type === "order") {
            platformEntities = await tenant.db
              .select({ id: tenant.schema.orders.id })
              .from(tenant.schema.orders)
              .leftJoin(
                tenant.schema.qboEntityMappings,
                and(eq(tenant.schema.qboEntityMappings.platformId, tenant.schema.orders.id), eq(tenant.schema.qboEntityMappings.entityType, "order"))
              )
              .where(and(sql`${tenant.schema.qboEntityMappings.id} IS NULL`, inArray(tenant.schema.orders.status, ["issued", "partially_paid", "paid", "closed"])));
          }
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
              .where(and(sql`${tenant.schema.qboEntityMappings.id} IS NULL`, isNull(tenant.schema.projects.deletedAt)));
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

          // Only show "syncing" when something was actually queued; otherwise nothing would ever clear it.
          if (jobsQueued > queuedBefore) {
            await tenant.db
              .update(tenant.schema.qboSyncState)
              .set({ syncStatus: "syncing", updatedAt: new Date() })
              .where(eq(tenant.schema.qboSyncState.entityType, type));
          }
        }
      } else {
        // Specific entity type sync
        let platformEntities: Array<{ id: string }> = [];

        if (entityType === "customer") {
          platformEntities = await tenant.db
            .select({ id: tenant.schema.customers.id })
            .from(tenant.schema.customers)
            .leftJoin(
              tenant.schema.qboEntityMappings,
              and(
                eq(tenant.schema.qboEntityMappings.platformId, tenant.schema.customers.id),
                eq(tenant.schema.qboEntityMappings.entityType, "customer")
              )
            )
            .where(sql`${tenant.schema.qboEntityMappings.id} IS NULL`);
        }
        if (entityType === "invoice") {
          platformEntities = await tenant.db
            .select({ id: tenant.schema.invoices.id })
            .from(tenant.schema.invoices)
            .leftJoin(
              tenant.schema.qboEntityMappings,
              and(eq(tenant.schema.qboEntityMappings.platformId, tenant.schema.invoices.id), eq(tenant.schema.qboEntityMappings.entityType, "invoice"))
            )
            .where(and(sql`${tenant.schema.qboEntityMappings.id} IS NULL`, inArray(tenant.schema.invoices.status, ["sent", "partially_paid", "paid"]), sql`${tenant.schema.invoices.sentOn} IS NOT NULL`));
        }
        if (entityType === "order") {
          platformEntities = await tenant.db
            .select({ id: tenant.schema.orders.id })
            .from(tenant.schema.orders)
            .leftJoin(
                tenant.schema.qboEntityMappings,
                and(eq(tenant.schema.qboEntityMappings.platformId, tenant.schema.orders.id), eq(tenant.schema.qboEntityMappings.entityType, "order"))
              )
              .where(and(sql`${tenant.schema.qboEntityMappings.id} IS NULL`, inArray(tenant.schema.orders.status, ["issued", "partially_paid", "paid", "closed"])));
        }
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
            .where(and(sql`${tenant.schema.qboEntityMappings.id} IS NULL`, isNull(tenant.schema.projects.deletedAt)));
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

        // Only show "syncing" when something was actually queued; otherwise nothing would ever clear it.
        if (jobsQueued > 0) {
          await tenant.db
            .update(tenant.schema.qboSyncState)
            .set({ syncStatus: "syncing", updatedAt: new Date() })
            .where(eq(tenant.schema.qboSyncState.entityType, entityType));
        }
      }

      // Sync All / Sync Bills also read payments, vendor bills and expenses from QuickBooks now (when the company reads payments).
      let read: { billsRead: number; billsLinked: number; read: number } | null = null;
      if (entityType === "all" || entityType === "bill") {
        const [prof] = await tenant.db.select({ on: tenant.schema.companyProfiles.qboReadPayments }).from(tenant.schema.companyProfiles).where(isNull(tenant.schema.companyProfiles.validTo)).limit(1);
        if (prof?.on) {
          try {
            const r = await runReceiptPass(tenant);
            read = { billsRead: r.billsRead, billsLinked: r.billsLinked, read: r.read };
          } catch (e) {
            console.error("[qbo] read pass from manual sync failed", e instanceof Error ? e.message : e);
          }
        }
      }

      return { jobsQueued, read };
    }),
});
