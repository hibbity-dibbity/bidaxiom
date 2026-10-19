import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure, authorizedProcedure } from "../procedures.js";
import { companyConfigSchema, AuditAction, parseSequenceFromJobNumber, PDF_DOC_TYPES, type DocumentNamingSettings } from "@construction/shared";
import { asOfDate } from "../../lib/effective-dating.js";
import { withAuditLog } from "../middleware/audit.js";
import { requirePermission } from "../middleware/authorize.js";
import { isNull, isNotNull, desc, eq, ilike, and, ne, like } from "drizzle-orm";

/**
 * Company configuration router.
 *
 * Manages company profile with effective dating for historical tracking.
 * All versions are preserved — updates create new versions and close the previous one.
 */
export const companyRouter = router({
  /**
   * Get the current active company profile.
   * Returns null if no profile has been configured yet.
   */
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.tenant.db
      .select()
      .from(ctx.tenant.schema.companyProfiles)
      .where(isNull(ctx.tenant.schema.companyProfiles.validTo))
      .limit(1);

    return profile[0] ?? null;
  }),

  /**
   * Get the company profile as of a specific historical date.
   * Used to understand company capabilities at bid submission time.
   */
  getAsOf: protectedProcedure
    .input(z.object({ asOf: z.coerce.date() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.tenant.db
        .select()
        .from(ctx.tenant.schema.companyProfiles)
        .where(
          asOfDate(
            ctx.tenant.schema.companyProfiles.validFrom,
            ctx.tenant.schema.companyProfiles.validTo,
            input.asOf
          )
        )
        .orderBy(desc(ctx.tenant.schema.companyProfiles.validFrom))
        .limit(1);

      return profile[0] ?? null;
    }),

  /**
   * Update company configuration.
   * Creates a new version and closes the previous one atomically.
   *
   * Business rules:
   * - Subcontractors (sub_only) must select at least one trade
   * - Requires "manage" permission on "CompanySettings"
   */
  update: authorizedProcedure
    .use(requirePermission("manage", "CompanySettings"))
    .use(withAuditLog({ entityType: "CompanyProfile", action: AuditAction.UPDATE }))
    .input(companyConfigSchema)
    .mutation(async ({ ctx, input }) => {
      console.log("[DEBUG company.update] jobNumberSettings received:", JSON.stringify(input.jobNumberSettings));
      // Validate business rule: subs must have at least one trade
      if (
        input.companyType === "sub_only" &&
        input.tradesConfig.csiDivisions.length === 0 &&
        input.tradesConfig.customTrades.length === 0
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Subcontractors must select at least one trade",
        });
      }

      // Tenant and userId guaranteed to be non-null by protectedProcedure middleware
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      // Atomic version management: close old, insert new
      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;
      const newProfile = await db.transaction(async (tx) => {
        // Carry over everything this form does not manage (contact info, naming settings, ...)
        const [previous] = await tx
          .select()
          .from(schema.companyProfiles)
          .where(isNull(schema.companyProfiles.validTo))
          .limit(1);

        // Close current version (set validTo = now)
        await tx
          .update(schema.companyProfiles)
          .set({ validTo: new Date() })
          .where(isNull(schema.companyProfiles.validTo));

        // Insert new version (validFrom = now, validTo defaults to null)
        const inserted = await tx
          .insert(schema.companyProfiles)
          .values({
            phone: previous?.phone ?? null,
            website: previous?.website ?? null,
            license: previous?.license ?? null,
            street1: previous?.street1 ?? null,
            street2: previous?.street2 ?? null,
            city: previous?.city ?? null,
            state: previous?.state ?? null,
            zip: previous?.zip ?? null,
            allowPersonalTemplates: previous?.allowPersonalTemplates ?? null,
            sovGroupingMethod: previous?.sovGroupingMethod ?? null,
            documentNamingSettings: previous?.documentNamingSettings ?? null,
            roundToDollar: previous?.roundToDollar ?? false,
            qboAutoSync: previous?.qboAutoSync ?? "off",
            qboSyncIntervalMinutes: previous?.qboSyncIntervalMinutes ?? 60,
            qboAutoSyncLastRunAt: previous?.qboAutoSyncLastRunAt ?? null,
            qboReadPayments: previous?.qboReadPayments ?? false,
            qboReceiptsLastCheckAt: previous?.qboReceiptsLastCheckAt ?? null,
            qboInvoicePush: previous?.qboInvoicePush ?? false,
            qboInvoicePushFrom: previous?.qboInvoicePushFrom ?? null,
            qboIncomeItemId: previous?.qboIncomeItemId ?? null,
            qboIncomeItemName: previous?.qboIncomeItemName ?? null,
            qboSalesTaxCodeId: previous?.qboSalesTaxCodeId ?? null,
            qboSalesTaxCodeName: previous?.qboSalesTaxCodeName ?? null,
            qboBillsLastCheckAt: previous?.qboBillsLastCheckAt ?? null,
            qboReadVendors: previous?.qboReadVendors ?? false,
            qboVendorsLastCheckAt: previous?.qboVendorsLastCheckAt ?? null,
            qboOrderPush: previous?.qboOrderPush ?? false,
            qboOrderPushFrom: previous?.qboOrderPushFrom ?? null,
            qboOrderAccounts: previous?.qboOrderAccounts ?? {},
            companyType: input.companyType,
            tradesConfig: input.tradesConfig,
            jobNumberSettings: input.jobNumberSettings,
            validFrom: new Date(),
            createdBy: userId,
          })
          .returning();

        return inserted[0]!;
      });

      return newProfile;
    }),

  /**
   * Company contact info shown on proposals. Updated in place on the current profile
   * (it is not part of the versioned trade and job-number configuration).
   */
  updateContact: authorizedProcedure
    .use(requirePermission("manage", "CompanySettings"))
    .input(
      z.object({
        phone: z.string().trim().max(40).nullable(),
        website: z.string().trim().max(200).nullable(),
        street1: z.string().trim().max(200).nullable(),
        street2: z.string().trim().max(200).nullable(),
        city: z.string().trim().max(100).nullable(),
        state: z.string().trim().max(2).nullable(),
        zip: z.string().trim().max(10).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const clean = (v: string | null) => (v && v.length > 0 ? v : null);
      const values = {
        phone: clean(input.phone),
        website: clean(input.website),
        street1: clean(input.street1),
        street2: clean(input.street2),
        city: clean(input.city),
        state: clean(input.state)?.toUpperCase() ?? null,
        zip: clean(input.zip),
      };
      const updated = await db
        .update(schema.companyProfiles)
        .set(values)
        .where(isNull(schema.companyProfiles.validTo))
        .returning({ id: schema.companyProfiles.id });
      if (updated.length === 0) {
        // The company configuration has never been saved: start a profile so the contact info is kept.
        await db.insert(schema.companyProfiles).values({
          ...values,
          companyType: "gc_only",
          createdBy: ctx.userId ?? "system",
        });
      }
      return { ok: true as const };
    }),

  /**
   * Get full version history of company configuration.
   * Returns all versions ordered by most recent first.
   */
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const history = await ctx.tenant.db
      .select()
      .from(ctx.tenant.schema.companyProfiles)
      .orderBy(desc(ctx.tenant.schema.companyProfiles.validFrom));

    return history;
  }),

  /**
   * Check if a job number is already in use.
   * Used for duplicate validation before project creation.
   */
  checkJobNumberAvailability: protectedProcedure
    .input(z.object({
      jobNumber: z.string().min(1),
      excludeProjectId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const conditions = [ilike(ctx.tenant.schema.projects.jobNumber, input.jobNumber)];
      if (input.excludeProjectId) {
        conditions.push(ne(ctx.tenant.schema.projects.id, input.excludeProjectId));
      }

      const [existing] = await ctx.tenant.db
        .select({
          id: ctx.tenant.schema.projects.id,
          name: ctx.tenant.schema.projects.name,
          slug: ctx.tenant.schema.projects.slug,
        })
        .from(ctx.tenant.schema.projects)
        .where(and(...conditions))
        .limit(1);

      return {
        available: !existing,
        existingProjectName: existing?.name ?? null,
        existingProjectSlug: existing?.slug ?? null,
      };
    }),

  /**
   * Get the current document naming settings from the active company profile.
   * Returns an empty object if no settings have been configured (null → {}).
   */
  getDocumentNaming: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await ctx.tenant.db
      .select()
      .from(ctx.tenant.schema.companyProfiles)
      .where(isNull(ctx.tenant.schema.companyProfiles.validTo))
      .limit(1);

    const documentNamingSettings: DocumentNamingSettings =
      (profile?.documentNamingSettings as DocumentNamingSettings) ?? {};

    return { documentNamingSettings };
  }),

  /**
   * Update document naming convention templates.
   * Performs a simple UPDATE on the current active company profile row because
   * documentNamingSettings is a config-only JSONB column (no historical audit
   * requirement — the main company.update procedure handles the effective-dating
   * pattern for business-critical fields).
   *
   * Restricted to admin users (manage CompanySettings permission).
   */
  updateDocumentNaming: authorizedProcedure
    .use(requirePermission("manage", "CompanySettings"))
    .use(withAuditLog({ entityType: "CompanyProfile", action: AuditAction.UPDATE }))
    .input(
      z.object({
        settings: z.record(
          z.enum(PDF_DOC_TYPES),
          z.object({ template: z.string().max(200).optional(), revisionTemplate: z.string().max(200).optional() })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      await db
        .update(schema.companyProfiles)
        .set({ documentNamingSettings: input.settings as DocumentNamingSettings })
        .where(isNull(schema.companyProfiles.validTo));

      return { success: true };
    }),

  /** Pricing options that apply to every proposal, change order and invoice. */
  getPricing: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await ctx.tenant.db
      .select({ roundToDollar: ctx.tenant.schema.companyProfiles.roundToDollar })
      .from(ctx.tenant.schema.companyProfiles)
      .where(isNull(ctx.tenant.schema.companyProfiles.validTo))
      .limit(1);
    return { roundToDollar: profile?.roundToDollar ?? false };
  }),

  /** Round every dollar amount to the nearest dollar. Applies to proposals, change orders and invoices created from now on. */
  updatePricing: authorizedProcedure
    .use(requirePermission("manage", "CompanySettings"))
    .use(withAuditLog({ entityType: "CompanyProfile", action: AuditAction.UPDATE }))
    .input(z.object({ roundToDollar: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      const { db, schema } = ctx.tenant;
      const done = await db.update(schema.companyProfiles).set({ roundToDollar: input.roundToDollar }).where(isNull(schema.companyProfiles.validTo)).returning({ id: schema.companyProfiles.id });
      if (done.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Save the company type first, then this option." });
      return { roundToDollar: input.roundToDollar };
    }),

  /**
   * Get the highest sequence number already used by a project for the current
   * year/format. Used by company settings to floor nextSequenceNumber above
   * any already-issued job number when startingSequenceNumber is changed.
   *
   * Only considers job numbers that match the current-year format prefix so
   * sequences from previous years (which reset) don't falsely constrain the
   * current counter.
   */
  getMaxUsedJobSequence: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }

    const [profile] = await ctx.tenant.db
      .select()
      .from(ctx.tenant.schema.companyProfiles)
      .where(isNull(ctx.tenant.schema.companyProfiles.validTo))
      .limit(1);

    const settings = profile?.jobNumberSettings;
    if (!settings?.enabled || !settings.template) return { maxSequence: 0 };

    // Build the portion of the template before the {N+} token with date tokens
    // resolved to the current date. This is the year/format prefix used to
    // filter out job numbers from previous years.
    const now = new Date();
    const resolvedPrefix = settings.template
      .replace(/{YYYY}/g, now.getFullYear().toString())
      .replace(/{YY}/g, now.getFullYear().toString().slice(-2))
      .replace(/{MM}/g, (now.getMonth() + 1).toString().padStart(2, "0"))
      .replace(/{DD}/g, now.getDate().toString().padStart(2, "0"))
      .replace(/\{N+\}.*$/, ""); // strip from {NNNN} onwards

    // Fetch all job numbers that start with the current-year prefix
    const projects = await ctx.tenant.db
      .select({ jobNumber: ctx.tenant.schema.projects.jobNumber })
      .from(ctx.tenant.schema.projects)
      .where(
        and(
          isNotNull(ctx.tenant.schema.projects.jobNumber),
          resolvedPrefix
            ? like(ctx.tenant.schema.projects.jobNumber, resolvedPrefix + "%")
            : isNotNull(ctx.tenant.schema.projects.jobNumber)
        )
      );

    // Parse sequence digits from each matching job number and find the max
    let maxSequence = 0;
    for (const { jobNumber } of projects) {
      if (!jobNumber) continue;
      const seq = parseSequenceFromJobNumber(jobNumber, settings.template);
      if (seq !== null && seq > maxSequence) maxSequence = seq;
    }

    return { maxSequence };
  }),
});
