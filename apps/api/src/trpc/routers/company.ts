import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure, authorizedProcedure } from "../procedures.js";
import { companyConfigSchema, AuditAction } from "@construction/shared";
import { asOfDate } from "../../lib/effective-dating.js";
import { withAuditLog } from "../middleware/audit.js";
import { requirePermission } from "../middleware/authorize.js";
import { isNull, desc, eq } from "drizzle-orm";
import {
  generateLogoUploadUrl,
  generateLogoDownloadUrl,
  deleteLogoFromStorage,
} from "../../storage/presigned.js";

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
        // Close current version (set validTo = now)
        await tx
          .update(schema.companyProfiles)
          .set({ validTo: new Date() })
          .where(isNull(schema.companyProfiles.validTo));

        // Insert new version (validFrom = now, validTo defaults to null)
        const inserted = await tx
          .insert(schema.companyProfiles)
          .values({
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
   * Upload company logo.
   * Returns a pre-signed URL for client-side upload to S3.
   *
   * Business rules:
   * - Only org:admin can upload logos
   * - Supports common image formats (png, jpg, jpeg, svg, webp)
   * - Storage key updated immediately to reserve the slot
   */
  uploadLogo: authorizedProcedure
    .use(requirePermission("manage", "CompanySettings"))
    .input(
      z.object({
        fileExtension: z.enum(["png", "jpg", "jpeg", "svg", "webp"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { uploadUrl, storageKey } = await generateLogoUploadUrl(
        ctx.tenant.tenantId,
        input.fileExtension
      );

      // Update company profile with new storage key
      await ctx.tenant.db
        .update(ctx.tenant.schema.companyProfiles)
        .set({
          logoStorageKey: storageKey,
          updatedAt: new Date(),
        })
        .where(isNull(ctx.tenant.schema.companyProfiles.validTo));

      return { uploadUrl, storageKey };
    }),

  /**
   * Get company logo download URL.
   * Returns a pre-signed URL for viewing the logo.
   * Available to all organization members.
   */
  getLogo: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const profile = await ctx.tenant.db
      .select({
        logoStorageKey: ctx.tenant.schema.companyProfiles.logoStorageKey,
      })
      .from(ctx.tenant.schema.companyProfiles)
      .where(isNull(ctx.tenant.schema.companyProfiles.validTo))
      .limit(1);

    if (!profile[0]?.logoStorageKey) {
      return { logoUrl: null };
    }

    const logoUrl = await generateLogoDownloadUrl(profile[0].logoStorageKey);
    return { logoUrl };
  }),

  /**
   * Delete company logo.
   * Removes the logo from S3 and clears the database reference.
   *
   * Business rules:
   * - Only org:admin can delete logos
   * - Safe to call even if no logo exists
   */
  deleteLogo: authorizedProcedure
    .use(requirePermission("manage", "CompanySettings"))
    .mutation(async ({ ctx }) => {
      if (!ctx.tenant) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const profile = await ctx.tenant.db
        .select({
          logoStorageKey: ctx.tenant.schema.companyProfiles.logoStorageKey,
        })
        .from(ctx.tenant.schema.companyProfiles)
        .where(isNull(ctx.tenant.schema.companyProfiles.validTo))
        .limit(1);

      if (profile[0]?.logoStorageKey) {
        // Delete from S3
        await deleteLogoFromStorage(profile[0].logoStorageKey);

        // Clear storage key in database
        await ctx.tenant.db
          .update(ctx.tenant.schema.companyProfiles)
          .set({
            logoStorageKey: null,
            updatedAt: new Date(),
          })
          .where(isNull(ctx.tenant.schema.companyProfiles.validTo));
      }

      return { success: true };
    }),
});
