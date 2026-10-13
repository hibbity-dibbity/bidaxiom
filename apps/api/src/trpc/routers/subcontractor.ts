import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createSubcontractorSchema,
  updateSubcontractorSchema,
  subcontractorStatusEnum,
  vendorKindEnum,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, sql, or, ilike, inArray } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { generateSlug, generateNameSlug, isValidSlug } from "../../utils/slug.js";

/**
 * Subcontractor directory router.
 * Handles company-wide subcontractor directory CRUD with trade filtering.
 */
export const subcontractorRouter = router({
  /**
   * Create a new subcontractor in the directory.
   */
  create: protectedProcedure
    .input(createSubcontractorSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId
      );

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("create", "SubcontractorDirectory");

      // Create subcontractor without slug first
      const [subcontractor] = await db
        .insert(schema.subcontractorDirectory)
        .values({
          companyName: input.companyName,
          contactName: input.contactName ?? null,
          contactEmail: input.contactEmail ?? null,
          contactPhone: input.contactPhone ?? null,
          address: null, // Legacy column - no longer used
          street1: input.street1 || null,
          street2: input.street2 || null,
          city: input.city || null,
          state: input.state || null,
          zip: input.zip || null,
          trades: input.trades,
          trade: input.trade ?? [],
          tradeOther: input.tradeOther ?? null,
          notes: input.notes ?? null,
          kind: input.kind,
          category: input.category || null,
          paymentTerms: input.paymentTerms || null,
          creditLimit: input.creditLimit != null ? String(input.creditLimit) : null,
          taxIdLast4: input.taxIdLast4 || null,
          w9OnFile: input.w9OnFile ?? false,
          w9ReceivedAt: input.w9ReceivedAt ? new Date(input.w9ReceivedAt) : null,
          insuranceExpiresAt: input.insuranceExpiresAt ? new Date(input.insuranceExpiresAt) : null,
          is1099: input.is1099 ?? false,
          status: "active",
          createdBy: ctx.userId,
        })
        .returning();

      // Generate and update slug
      const finalSlug = generateNameSlug(input.companyName);
      const [updatedSubcontractor] = await db
        .update(schema.subcontractorDirectory)
        .set({ slug: finalSlug })
        .where(eq(schema.subcontractorDirectory.id, subcontractor.id))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "SubcontractorDirectory",
        entityId: subcontractor.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: updatedSubcontractor,
        },
      });

      return updatedSubcontractor;
    }),

  /**
   * List subcontractors with optional filtering.
   * Supports status, trade (CSI division), and text search filters.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: subcontractorStatusEnum.optional(),
        kind: vendorKindEnum.optional(),
        trade: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId
      );

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "SubcontractorDirectory");

      // Build where conditions
      const conditions = [];

      if (input.status) {
        conditions.push(eq(schema.subcontractorDirectory.status, input.status));
      }

      if (input.kind) {
        conditions.push(eq(schema.subcontractorDirectory.kind, input.kind));
      }

      // Trade / category filter: subcontractors match on the trade array, suppliers on category
      if (input.trade !== undefined) {
        conditions.push(
          or(
            sql`${schema.subcontractorDirectory.trade}::jsonb @> ${JSON.stringify([input.trade])}::jsonb`,
            eq(schema.subcontractorDirectory.category, input.trade)
          )
        );
      }

      // Search filter: ILIKE on companyName, contactName, or contactEmail
      if (input.search) {
        const searchPattern = `%${input.search}%`;
        conditions.push(
          or(
            ilike(schema.subcontractorDirectory.companyName, searchPattern),
            ilike(schema.subcontractorDirectory.contactName, searchPattern),
            ilike(schema.subcontractorDirectory.contactEmail, searchPattern)
          )
        );
      }

      // Query subcontractors
      const subcontractors = await db
        .select()
        .from(schema.subcontractorDirectory)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(schema.subcontractorDirectory.companyName);

      return subcontractors;
    }),

  /**
   * Get subcontractor by ID with bid history.
   * Includes historical bids with RFQ details and latest amounts.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId
      );

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "SubcontractorDirectory");

      // Fetch subcontractor
      const [subcontractor] = await db
        .select()
        .from(schema.subcontractorDirectory)
        .where(eq(schema.subcontractorDirectory.id, input.id))
        .limit(1);

      if (!subcontractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subcontractor not found",
        });
      }

      // Fetch bid history with RFQ details and latest version amounts
      const bidHistory = await db
        .select({
          rfqId: schema.rfqs.id,
          rfqNumber: schema.rfqs.rfqNumber,
          rfqTitle: schema.rfqs.title,
          bidId: schema.bids.id,
          status: schema.bids.status,
          submittedAt: schema.bids.submittedAt,
          latestAmount: sql<string>`(
            SELECT ${schema.bidVersions.totalAmount}
            FROM ${schema.bidVersions}
            WHERE ${schema.bidVersions.bidId} = ${schema.bids.id}
            ORDER BY ${schema.bidVersions.versionNumber} DESC
            LIMIT 1
          )`,
        })
        .from(schema.bids)
        .innerJoin(schema.rfqs, eq(schema.bids.rfqId, schema.rfqs.id))
        .where(eq(schema.bids.subcontractorId, input.id))
        .orderBy(desc(schema.bids.submittedAt));

      return {
        ...subcontractor,
        bidHistory: bidHistory.map(bid => ({
          rfqId: bid.rfqId,
          rfqNumber: bid.rfqNumber,
          rfqTitle: bid.rfqTitle,
          bidId: bid.bidId,
          latestAmount: bid.latestAmount ? Number(bid.latestAmount) : null,
          status: bid.status,
          submittedAt: bid.submittedAt,
        })),
      };
    }),

  /**
   * Get subcontractor by slug with bid history.
   */
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      if (!isValidSlug(input.slug)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid slug format"
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId
      );

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "SubcontractorDirectory");

      // Fetch subcontractor
      const [subcontractor] = await db
        .select()
        .from(schema.subcontractorDirectory)
        .where(eq(schema.subcontractorDirectory.slug, input.slug))
        .limit(1);

      if (!subcontractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subcontractor not found",
        });
      }

      // Fetch bid history with RFQ details and latest version amounts
      const bidHistory = await db
        .select({
          rfqId: schema.rfqs.id,
          rfqNumber: schema.rfqs.rfqNumber,
          rfqTitle: schema.rfqs.title,
          bidId: schema.bids.id,
          status: schema.bids.status,
          submittedAt: schema.bids.submittedAt,
          latestAmount: sql<string>`(
            SELECT ${schema.bidVersions.totalAmount}
            FROM ${schema.bidVersions}
            WHERE ${schema.bidVersions.bidId} = ${schema.bids.id}
            ORDER BY ${schema.bidVersions.versionNumber} DESC
            LIMIT 1
          )`,
        })
        .from(schema.bids)
        .innerJoin(schema.rfqs, eq(schema.bids.rfqId, schema.rfqs.id))
        .where(eq(schema.bids.subcontractorId, subcontractor.id))
        .orderBy(desc(schema.bids.submittedAt));

      return {
        ...subcontractor,
        bidHistory: bidHistory.map(bid => ({
          rfqId: bid.rfqId,
          rfqNumber: bid.rfqNumber,
          rfqTitle: bid.rfqTitle,
          bidId: bid.bidId,
          latestAmount: bid.latestAmount ? Number(bid.latestAmount) : null,
          status: bid.status,
          submittedAt: bid.submittedAt,
        })),
      };
    }),

  /**
   * Update subcontractor information.
   */
  update: protectedProcedure
    .input(updateSubcontractorSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId
      );

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "SubcontractorDirectory");

      // Fetch existing subcontractor
      const [existingSubcontractor] = await db
        .select()
        .from(schema.subcontractorDirectory)
        .where(eq(schema.subcontractorDirectory.id, input.id))
        .limit(1);

      if (!existingSubcontractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subcontractor not found",
        });
      }

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.companyName !== undefined) {
        updateValues.companyName = input.companyName;
      }

      if (input.contactName !== undefined) {
        updateValues.contactName = input.contactName;
      }

      if (input.contactEmail !== undefined) {
        updateValues.contactEmail = input.contactEmail;
      }

      if (input.contactPhone !== undefined) {
        updateValues.contactPhone = input.contactPhone;
      }

      if (input.street1 !== undefined) {
        updateValues.street1 = input.street1;
      }

      if (input.street2 !== undefined) {
        updateValues.street2 = input.street2;
      }

      if (input.city !== undefined) {
        updateValues.city = input.city;
      }

      if (input.state !== undefined) {
        updateValues.state = input.state;
      }

      if (input.zip !== undefined) {
        updateValues.zip = input.zip;
      }

      if (input.trades !== undefined) {
        updateValues.trades = input.trades;
      }

      if (input.trade !== undefined) {
        updateValues.trade = input.trade;
      }

      if (input.tradeOther !== undefined) {
        updateValues.tradeOther = input.tradeOther ?? null;
      }

      if (input.notes !== undefined) {
        updateValues.notes = input.notes;
      }

      if (input.status !== undefined) {
        updateValues.status = input.status;
      }

      if (input.kind !== undefined) updateValues.kind = input.kind;
      if (input.category !== undefined) updateValues.category = input.category || null;
      if (input.paymentTerms !== undefined) updateValues.paymentTerms = input.paymentTerms || null;
      if (input.creditLimit !== undefined) {
        updateValues.creditLimit = input.creditLimit === null ? null : String(input.creditLimit);
      }
      if (input.taxIdLast4 !== undefined) updateValues.taxIdLast4 = input.taxIdLast4 || null;
      if (input.w9OnFile !== undefined) updateValues.w9OnFile = input.w9OnFile;
      if (input.w9ReceivedAt !== undefined) {
        updateValues.w9ReceivedAt = input.w9ReceivedAt ? new Date(input.w9ReceivedAt) : null;
      }
      if (input.insuranceExpiresAt !== undefined) {
        updateValues.insuranceExpiresAt = input.insuranceExpiresAt ? new Date(input.insuranceExpiresAt) : null;
      }
      if (input.is1099 !== undefined) updateValues.is1099 = input.is1099;

      // Regenerate slug if company name changed
      if (input.companyName !== undefined) {
        updateValues.slug = generateNameSlug(input.companyName);
      }

      // Update subcontractor
      const [updated] = await db
        .update(schema.subcontractorDirectory)
        .set(updateValues)
        .where(eq(schema.subcontractorDirectory.id, input.id))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "SubcontractorDirectory",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: existingSubcontractor,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Delete a subcontractor from the directory.
   * Prevents deletion if active bids exist.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId
      );

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("delete", "SubcontractorDirectory");

      // Fetch existing subcontractor
      const [existingSubcontractor] = await db
        .select()
        .from(schema.subcontractorDirectory)
        .where(eq(schema.subcontractorDirectory.id, input.id))
        .limit(1);

      if (!existingSubcontractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subcontractor not found",
        });
      }

      // Check if subcontractor has any active bids
      const [activeBids] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(schema.bids)
        .where(
          and(
            eq(schema.bids.subcontractorId, input.id),
            inArray(schema.bids.status, ["submitted", "under_review"])
          )
        );

      if ((activeBids?.count ?? 0) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete subcontractor with active bids. Set status to inactive instead.",
        });
      }

      // Delete subcontractor
      await db
        .delete(schema.subcontractorDirectory)
        .where(eq(schema.subcontractorDirectory.id, input.id));

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "SubcontractorDirectory",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          before: existingSubcontractor,
        },
      });

      return { success: true };
    }),

  /**
   * Get subcontractors matching specific trades.
   * Helper for RFQ invitation - returns only active subcontractors.
   */
  getByTrades: protectedProcedure
    .input(
      z.object({
        trades: z.array(z.number().int()),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId
      );

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "SubcontractorDirectory");

      // Query subcontractors where trades JSONB array contains ANY of the provided divisions
      // Using JSONB overlap operator (?|) for ANY match
      const subcontractors = await db
        .select()
        .from(schema.subcontractorDirectory)
        .where(
          and(
            eq(schema.subcontractorDirectory.status, "active"),
            sql`${schema.subcontractorDirectory.trades}::jsonb ?| array[${sql.raw(input.trades.map(t => `'${t}'`).join(','))}]`
          )
        )
        .orderBy(schema.subcontractorDirectory.companyName);

      return subcontractors;
    }),
});
