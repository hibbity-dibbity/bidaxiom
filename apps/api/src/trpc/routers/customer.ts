import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  AuditAction,
  buildCustomerRows,
  type CustomerImportMapping,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { eq, desc, or, like, sql, and } from "drizzle-orm";
import { generateSlug, generateNameSlug, isValidSlug } from "../../utils/slug.js";

/**
 * Customer management router.
 * Handles customer CRUD operations with audit logging.
 */
/** Importing customers in bulk (and undoing it) is limited to the roles that can delete a customer. */
function requireImportRole(role: string | null) {
  if (role !== "org:admin" && role !== "org:project_manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only an admin or project manager can import customers." });
  }
}

/** Source-row layout the browser sends, so the server can re-check every row with the same rules. */
const IMPORT_COLUMNS: CustomerImportMapping = {
  companyName: 0, contactName: 1, email: 2, phone: 3, street1: 4, street2: 5, city: 6, state: 7, zip: 8, paymentTerms: 9,
};

export const customerRouter = router({
  /** Existing customers' identifying details, so the import preview can flag duplicates. */
  importIndex: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    requireImportRole(ctx.orgRole);
    const { db, schema } = ctx.tenant;
    return db
      .select({ email: schema.customers.email, companyName: schema.customers.companyName, contactName: schema.customers.contactName })
      .from(schema.customers);
  }),

  /** Add one batch (up to 500 rows) of an import. Every row is re-checked here; nothing from the browser is trusted. */
  importCommit: protectedProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
        fileName: z.string().max(255),
        importDuplicates: z.boolean(),
        rows: z.array(z.array(z.string().max(500)).length(10)).min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      requireImportRole(ctx.orgRole);
      const { db, schema } = ctx.tenant;

      const existing = await db
        .select({ email: schema.customers.email, companyName: schema.customers.companyName, contactName: schema.customers.contactName, slug: schema.customers.slug })
        .from(schema.customers);
      const results = buildCustomerRows(input.rows, IMPORT_COLUMNS, { useCompanyAsContact: true }, existing);
      const taken = new Set(existing.map((e) => e.slug).filter((s): s is string => Boolean(s)));

      const toInsert = results.filter((r) => r.customer && (r.status === "ready" || r.status === "warning" || (input.importDuplicates && r.status === "duplicate")));
      const values = toInsert.map((r) => {
        const c = r.customer!;
        const base = generateNameSlug(c.companyName || c.contactName) || "customer";
        let slug = base;
        for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
        taken.add(slug);
        return {
          companyName: c.companyName,
          contactName: c.contactName,
          email: c.email,
          phone: c.phone,
          street1: c.street1,
          street2: c.street2,
          city: c.city,
          state: c.state,
          zip: c.zip,
          paymentTerms: c.paymentTerms,
          slug,
          createdBy: ctx.userId!,
          importBatchId: input.batchId,
          importSource: input.fileName,
        };
      });
      if (values.length) await db.insert(schema.customers).values(values);

      if (values.length) {
        await createAuditLog(db, schema, {
          entityType: "Customer",
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

  /** Earlier imports, newest first, with how many of their customers still exist. */
  importBatches: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    requireImportRole(ctx.orgRole);
    const { db, schema } = ctx.tenant;
    const rows = await db
      .select({
        batchId: schema.customers.importBatchId,
        source: sql<string>`max(${schema.customers.importSource})`,
        count: sql<number>`count(*)::int`,
        at: sql<string>`min(${schema.customers.createdAt})`,
      })
      .from(schema.customers)
      .where(sql`${schema.customers.importBatchId} IS NOT NULL`)
      .groupBy(schema.customers.importBatchId)
      .orderBy(sql`min(${schema.customers.createdAt}) desc`)
      .limit(20);
    return rows.map((r) => ({ batchId: r.batchId!, source: r.source, count: r.count, at: new Date(r.at).toISOString() }));
  }),

  /** Remove the customers one import added. Any that already have projects are kept. */
  importUndo: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      requireImportRole(ctx.orgRole);
      const { db, schema } = ctx.tenant;
      const removed = await db
        .delete(schema.customers)
        .where(
          and(
            eq(schema.customers.importBatchId, input.batchId),
            sql`NOT EXISTS (SELECT 1 FROM ${schema.projects} WHERE ${schema.projects.customerId} = ${schema.customers.id})`
          )
        )
        .returning({ id: schema.customers.id });
      const [left] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.customers)
        .where(eq(schema.customers.importBatchId, input.batchId));
      await createAuditLog(db, schema, {
        entityType: "Customer",
        entityId: input.batchId,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: { before: { removedImport: removed.length, keptBecauseTheyHaveProjects: left.n } },
      });
      return { removed: removed.length, kept: left.n };
    }),

  /**
   * List all customers with optional search
   */
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
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

      // Build WHERE conditions
      const conditions = [];
      if (input.search) {
        conditions.push(
          or(
            like(schema.customers.companyName, `%${input.search}%`),
            like(schema.customers.contactName, `%${input.search}%`),
            like(schema.customers.email, `%${input.search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? conditions[0] : undefined;

      const [items, totalResult] = await Promise.all([
        db
          .select({
            id: schema.customers.id,
            companyName: schema.customers.companyName,
            contactName: schema.customers.contactName,
            phone: schema.customers.phone,
            email: schema.customers.email,
            address: schema.customers.address,
            street1: schema.customers.street1,
            street2: schema.customers.street2,
            city: schema.customers.city,
            state: schema.customers.state,
            zip: schema.customers.zip,
            paymentTerms: schema.customers.paymentTerms,
            slug: schema.customers.slug,
            createdBy: schema.customers.createdBy,
            createdAt: schema.customers.createdAt,
            updatedAt: schema.customers.updatedAt,
          })
          .from(schema.customers)
          .where(whereClause)
          .orderBy(desc(schema.customers.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.customers)
          .where(whereClause),
      ]);

      return {
        items,
        total: totalResult[0]?.count || 0,
      };
    }),

  /**
   * Get customer by ID with project count
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

      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, input.id))
        .limit(1);

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Get project count for this customer
      const projects = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.customerId, input.id));

      return {
        ...customer,
        projectCount: projects.length,
        projects,
      };
    }),

  /**
   * Get customer by slug with project count
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

      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.slug, input.slug))
        .limit(1);

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Get project count for this customer
      const projects = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.customerId, customer.id));

      return {
        ...customer,
        projectCount: projects.length,
        projects,
      };
    }),

  /**
   * Create a new customer
   */
  create: protectedProcedure
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Create customer without slug first
      const [customer] = await db
        .insert(schema.customers)
        .values({
          companyName: input.companyName || null,
          contactName: input.contactName,
          phone: input.phone || null,
          email: input.email || null,
          address: null, // Legacy column - no longer used
          street1: input.street1 || null,
          street2: input.street2 || null,
          city: input.city || null,
          state: input.state || null,
          zip: input.zip || null,
          paymentTerms: input.paymentTerms || null,
          createdBy: userId,
        })
        .returning();

      // Generate slug using ID and name
      const name = input.companyName || input.contactName;
      const finalSlug = generateNameSlug(name);

      // Update with final slug
      const [updatedCustomer] = await db
        .update(schema.customers)
        .set({ slug: finalSlug })
        .where(eq(schema.customers.id, customer.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Customer",
        entityId: customer.id,
        action: AuditAction.CREATE,
        actorId: userId,
        changes: {
          after: updatedCustomer,
        },
      });

      return updatedCustomer;
    }),

  /**
   * Update customer
   */
  update: protectedProcedure
    .input(updateCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Get existing customer
      const [existingCustomer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, input.id))
        .limit(1);

      if (!existingCustomer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.companyName !== undefined) updateValues.companyName = input.companyName;
      if (input.contactName !== undefined) updateValues.contactName = input.contactName;
      if (input.phone !== undefined) updateValues.phone = input.phone;
      if (input.email !== undefined) updateValues.email = input.email;
      if (input.street1 !== undefined) updateValues.street1 = input.street1 || null;
      if (input.street2 !== undefined) updateValues.street2 = input.street2 || null;
      if (input.city !== undefined) updateValues.city = input.city || null;
      if (input.state !== undefined) updateValues.state = input.state || null;
      if (input.zip !== undefined) updateValues.zip = input.zip || null;
      if (input.paymentTerms !== undefined) updateValues.paymentTerms = input.paymentTerms || null;

      // Regenerate slug if name changed
      if (input.companyName !== undefined || input.contactName !== undefined) {
        const newCompanyName = input.companyName ?? existingCustomer.companyName;
        const newContactName = input.contactName ?? existingCustomer.contactName;
        const name = newCompanyName || newContactName;
        updateValues.slug = generateNameSlug(name);
      }

      const [updated] = await db
        .update(schema.customers)
        .set(updateValues)
        .where(eq(schema.customers.id, input.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Customer",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          before: existingCustomer,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Delete customer (only if no projects associated)
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

      if (ctx.orgRole !== "org:admin" && ctx.orgRole !== "org:project_manager") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only an admin or project manager can delete a customer." });
      }
      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Check if customer has projects
      const projects = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(eq(schema.projects.customerId, input.id))
        .limit(1);

      if (projects.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete customer with associated projects",
        });
      }

      // Get customer for audit log
      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, input.id))
        .limit(1);

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      await db.delete(schema.customers).where(eq(schema.customers.id, input.id));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Customer",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: userId,
        changes: {
          before: customer,
        },
      });

      return { success: true };
    }),
});
