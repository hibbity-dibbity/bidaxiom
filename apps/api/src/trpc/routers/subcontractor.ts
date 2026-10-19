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
  buildVendorRows,
  type VendorImportMapping,
} from "@construction/shared";
import { previewVendorPush, pushVendors } from "../../integrations/quickbooks/vendors.js";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, sql, or, ilike, inArray } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { generateSlug, generateNameSlug, isValidSlug } from "../../utils/slug.js";

/** Importing vendors in bulk (and undoing it) is limited to the roles that can manage the directory. */
function requireImportRole(role: string | null) {
  if (role !== "org:admin" && role !== "org:project_manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only an admin or project manager can import subs and vendors." });
  }
}

/** Source-row layout the browser sends, so the server can re-check every row with the same rules. */
const IMPORT_COLUMNS: VendorImportMapping = {
  companyName: 0, contactName: 1, email: 2, phone: 3, street1: 4, street2: 5, city: 6, state: 7, zip: 8,
  kind: 9, vendorType: 10, paymentTerms: 11, creditLimit: 12, taxId: 13, is1099: 14, status: 15, notes: 16,
};
const IMPORT_WIDTH = 17;

/**
 * Subcontractor directory router.
 * Handles company-wide subcontractor directory CRUD with trade filtering.
 */
export const subcontractorRouter = router({
  /** Whether QuickBooks is connected, and what sending the list would do. Drives the Send to QuickBooks button. */
  qboStatus: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    const [conn] = await db.select({ id: schema.qboConnections.id }).from(schema.qboConnections).where(eq(schema.qboConnections.status, "active")).limit(1);
    if (!conn) return { connected: false, preview: null };
    return { connected: true, preview: await previewVendorPush(ctx.tenant) };
  }),

  /** Send new and changed vendors to QuickBooks. One way: nothing is read back into the list. */
  pushToQuickbooks: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    requireImportRole(ctx.orgRole);
    try {
      const result = await pushVendors(ctx.tenant, { actorId: ctx.userId });
      if (!result) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "QuickBooks isn't connected. Connect it under Settings → Integrations first." });
      return result;
    } catch (e) {
      if (e instanceof TRPCError) throw e;
      throw new TRPCError({ code: "BAD_GATEWAY", message: e instanceof Error ? e.message : "QuickBooks could not be reached" });
    }
  }),

  /** Existing entries' identifying details, so the import preview can flag duplicates. */
  importIndex: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    requireImportRole(ctx.orgRole);
    const { db, schema } = ctx.tenant;
    return db
      .select({ email: schema.subcontractorDirectory.contactEmail, companyName: schema.subcontractorDirectory.companyName })
      .from(schema.subcontractorDirectory);
  }),

  /** Add one batch (up to 500 rows) of an import. Every row is re-checked here; nothing from the browser is trusted. */
  importCommit: protectedProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
        fileName: z.string().max(255),
        importDuplicates: z.boolean(),
        rows: z.array(z.array(z.string().max(2100)).length(IMPORT_WIDTH)).min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      requireImportRole(ctx.orgRole);
      const { db, schema } = ctx.tenant;

      const existing = await db
        .select({ email: schema.subcontractorDirectory.contactEmail, companyName: schema.subcontractorDirectory.companyName, slug: schema.subcontractorDirectory.slug })
        .from(schema.subcontractorDirectory);
      const results = buildVendorRows(input.rows, IMPORT_COLUMNS, { defaultKind: "subcontractor" }, existing);
      const taken = new Set(existing.map((e) => e.slug).filter((s): s is string => Boolean(s)));

      const toInsert = results.filter((r) => r.vendor && (r.status === "ready" || r.status === "warning" || (input.importDuplicates && r.status === "duplicate")));
      const values = toInsert.map((r) => {
        const v = r.vendor!;
        const base = generateNameSlug(v.companyName) || "vendor";
        let slug = base;
        for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
        taken.add(slug);
        return {
          companyName: v.companyName,
          contactName: v.contactName,
          contactEmail: v.email,
          contactPhone: v.phone,
          street1: v.street1,
          street2: v.street2,
          city: v.city,
          state: v.state,
          zip: v.zip,
          trades: [] as number[],
          trade: v.trade ? [v.trade] : [],
          tradeOther: v.tradeOther,
          notes: v.notes,
          kind: v.kind,
          category: v.category,
          paymentTerms: v.paymentTerms,
          creditLimit: v.creditLimit != null ? String(v.creditLimit) : null,
          taxIdLast4: v.taxIdLast4,
          is1099: v.is1099,
          status: v.status,
          slug,
          createdBy: ctx.userId!,
          importBatchId: input.batchId,
          importSource: input.fileName,
        };
      });
      if (values.length) await db.insert(schema.subcontractorDirectory).values(values);

      if (values.length) {
        await createAuditLog(db, schema, {
          entityType: "SubcontractorDirectory",
          entityId: input.batchId,
          action: AuditAction.CREATE,
          actorId: ctx.userId,
          changes: { after: { imported: values.length, source: input.fileName } },
        });
      }
      return {
        imported: values.length,
        skippedDuplicates: input.importDuplicates ? 0 : results.filter((r) => r.status === "duplicate").length,
        skippedErrors: results.filter((r) => r.status === "error").length,
      };
    }),

  /** Earlier imports, newest first, with how many of their entries still exist. */
  importBatches: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    requireImportRole(ctx.orgRole);
    const { db, schema } = ctx.tenant;
    const t = schema.subcontractorDirectory;
    const rows = await db
      .select({
        batchId: t.importBatchId,
        source: sql<string>`max(${t.importSource})`,
        count: sql<number>`count(*)::int`,
        at: sql<string>`min(${t.createdAt})`,
      })
      .from(t)
      .where(sql`${t.importBatchId} IS NOT NULL`)
      .groupBy(t.importBatchId)
      .orderBy(sql`min(${t.createdAt}) desc`)
      .limit(20);
    return rows.map((r) => ({ batchId: r.batchId!, source: r.source, count: r.count, at: new Date(r.at).toISOString() }));
  }),

  /** Remove the entries one import added. Any already used on a bid, proposal line or order are kept. */
  importUndo: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      requireImportRole(ctx.orgRole);
      const { db, schema } = ctx.tenant;
      const t = schema.subcontractorDirectory;
      const removed = await db
        .delete(t)
        .where(
          and(
            eq(t.importBatchId, input.batchId),
            sql`NOT EXISTS (SELECT 1 FROM ${schema.bids} WHERE ${schema.bids.subcontractorId} = ${t.id})`,
            sql`NOT EXISTS (SELECT 1 FROM ${schema.proposalCostLines} WHERE ${schema.proposalCostLines.vendorId} = ${t.id})`,
            sql`NOT EXISTS (SELECT 1 FROM ${schema.orders} WHERE ${schema.orders.vendorId} = ${t.id})`
          )
        )
        .returning({ id: t.id });
      const [left] = await db.select({ n: sql<number>`count(*)::int` }).from(t).where(eq(t.importBatchId, input.batchId));
      await createAuditLog(db, schema, {
        entityType: "SubcontractorDirectory",
        entityId: input.batchId,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: { before: { removedImport: removed.length, keptBecauseInUse: left.n } },
      });
      return { removed: removed.length, kept: left.n };
    }),

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
        /** Any of these (multi-select filters). */
        statuses: z.array(subcontractorStatusEnum).max(10).optional(),
        kinds: z.array(vendorKindEnum).max(10).optional(),
        trades: z.array(z.string().max(200)).max(50).optional(),
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

      if (input.statuses?.length) conditions.push(inArray(schema.subcontractorDirectory.status, input.statuses));
      if (input.kinds?.length) conditions.push(inArray(schema.subcontractorDirectory.kind, input.kinds));
      if (input.trades?.length) {
        conditions.push(
          or(
            ...input.trades.map((t) => sql`${schema.subcontractorDirectory.trade}::jsonb @> ${JSON.stringify([t])}::jsonb`),
            inArray(schema.subcontractorDirectory.category, input.trades)
          )
        );
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
   * Includes historical bids with project details and latest amounts.
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

      // Fetch bid history with project details and latest version amounts
      const bidHistory = await db
        .select({
          projectName: schema.projects.name,
          jobNumber: schema.projects.jobNumber,
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
        .leftJoin(schema.projects, eq(schema.bids.projectId, schema.projects.id))
        .where(eq(schema.bids.subcontractorId, input.id))
        .orderBy(desc(schema.bids.submittedAt));

      return {
        ...subcontractor,
        bidHistory: bidHistory.map(bid => ({
          projectName: bid.projectName,
          jobNumber: bid.jobNumber,
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

      // Fetch bid history with project details and latest version amounts
      const bidHistory = await db
        .select({
          projectName: schema.projects.name,
          jobNumber: schema.projects.jobNumber,
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
        .leftJoin(schema.projects, eq(schema.bids.projectId, schema.projects.id))
        .where(eq(schema.bids.subcontractorId, subcontractor.id))
        .orderBy(desc(schema.bids.submittedAt));

      return {
        ...subcontractor,
        bidHistory: bidHistory.map(bid => ({
          projectName: bid.projectName,
          jobNumber: bid.jobNumber,
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
   * Returns only active subcontractors.
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
