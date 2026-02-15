import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { eq, desc, or, like, sql } from "drizzle-orm";

/**
 * Customer management router.
 * Handles customer CRUD operations with audit logging.
 */
export const customerRouter = router({
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
          .select()
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

      const [customer] = await db
        .insert(schema.customers)
        .values({
          companyName: input.companyName || null,
          contactName: input.contactName,
          phone: input.phone || null,
          email: input.email || null,
          address: null, // Legacy column - no longer used
          street1: input.address?.street1 || null,
          street2: input.address?.street2 || null,
          city: input.address?.city || null,
          state: input.address?.state || null,
          zip: input.address?.zipCode || null,
          createdBy: userId,
        })
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Customer",
        entityId: customer.id,
        action: AuditAction.CREATE,
        actorId: userId,
        changes: {
          after: customer,
        },
      });

      return customer;
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
      if (input.address !== undefined) {
        // Map structured address to DB columns
        updateValues.address = null; // Legacy column - no longer used
        updateValues.street1 = input.address.street1 || null;
        updateValues.street2 = input.address.street2 || null;
        updateValues.city = input.address.city || null;
        updateValues.state = input.address.state || null;
        updateValues.zip = input.address.zipCode || null;
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
