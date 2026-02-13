import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createSovItemSchema,
  updateSovItemSchema,
  bulkCreateSovItemsSchema,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, sql, isNull, isNotNull } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";

/**
 * Load project-level abilities for the current user.
 * Queries project team memberships and builds CASL abilities with project context.
 */
async function loadProjectAbilities(ctx: {
  tenant: NonNullable<
    Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>
  >;
  userId: string;
  orgRole: string | null;
}) {
  const memberships = await ctx.tenant.db
    .select({
      projectId: ctx.tenant.schema.projectTeamMembers.projectId,
      role: ctx.tenant.schema.projectTeamMembers.role,
    })
    .from(ctx.tenant.schema.projectTeamMembers)
    .where(eq(ctx.tenant.schema.projectTeamMembers.userId, ctx.userId));

  return defineAbilitiesFor(ctx.orgRole ?? "org:member", ctx.userId, memberships);
}

/**
 * Schedule of Values (SOV) management router.
 * Handles SOV CRUD operations, bulk creation, and budget import.
 */
export const sovRouter = router({
  /**
   * List all SOV items for a project, ordered by orderIndex ASC.
   */
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      // Get SOV items
      const items = await db
        .select()
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId))
        .orderBy(schema.sovItems.orderIndex);

      // Calculate total scheduled value
      const [totalResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${schema.sovItems.scheduledValue}::numeric), 0)`,
        })
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId));

      return {
        items,
        totalScheduledValue: Number(totalResult?.total ?? "0"),
      };
    }),

  /**
   * Create a single SOV item.
   * Auto-generates itemNumber and orderIndex if not provided.
   */
  create: protectedProcedure
    .input(createSovItemSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Verify project exists
      const [project] = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Auto-generate itemNumber if not provided (sequential from max existing)
      let itemNumber = input.itemNumber;
      if (!itemNumber) {
        const [maxItemResult] = await db
          .select({
            maxItem: sql<string>`MAX(${schema.sovItems.itemNumber})`,
          })
          .from(schema.sovItems)
          .where(eq(schema.sovItems.projectId, input.projectId));

        const maxItem = maxItemResult?.maxItem;
        const nextNumber = maxItem ? parseInt(maxItem, 10) + 1 : 1;
        itemNumber = String(nextNumber).padStart(3, "0"); // e.g., "001", "002"
      }

      // Get max orderIndex
      const [maxOrderResult] = await db
        .select({
          maxOrder: sql<number>`COALESCE(MAX(${schema.sovItems.orderIndex}), -1)`,
        })
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId));

      const orderIndex = (maxOrderResult?.maxOrder ?? -1) + 1;

      // Insert SOV item
      const [sovItem] = await db
        .insert(schema.sovItems)
        .values({
          projectId: input.projectId,
          budgetLineItemId: input.budgetLineItemId,
          itemNumber,
          description: input.description,
          scheduledValue: input.scheduledValue.toFixed(2),
          orderIndex,
          createdBy: ctx.userId,
        })
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        action: AuditAction.CREATE,
        entityType: "sov_item",
        entityId: sovItem.id,
        actorId: ctx.userId,
        changes: { after: sovItem },
      });

      return sovItem;
    }),

  /**
   * Bulk create SOV items.
   * Auto-generates sequential itemNumbers starting from max + 1.
   */
  bulkCreate: protectedProcedure
    .input(bulkCreateSovItemsSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId; // Guaranteed non-null by protectedProcedure

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Verify project exists
      const [project] = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Get max itemNumber
      const [maxItemResult] = await db
        .select({
          maxItem: sql<string>`MAX(${schema.sovItems.itemNumber})`,
        })
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId));

      const maxItem = maxItemResult?.maxItem;
      let nextNumber = maxItem ? parseInt(maxItem, 10) + 1 : 1;

      // Get max orderIndex
      const [maxOrderResult] = await db
        .select({
          maxOrder: sql<number>`COALESCE(MAX(${schema.sovItems.orderIndex}), -1)`,
        })
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId));

      let orderIndex = (maxOrderResult?.maxOrder ?? -1) + 1;

      // Build values array with sequential itemNumbers and orderIndexes
      const values = input.items.map((item) => ({
        projectId: input.projectId,
        budgetLineItemId: item.budgetLineItemId,
        itemNumber: item.itemNumber || String(nextNumber++).padStart(3, "0"),
        description: item.description,
        scheduledValue: item.scheduledValue.toFixed(2),
        orderIndex: orderIndex++,
        createdBy: userId,
      }));

      // Insert all items in transaction
      const sovItems = await db.transaction(async (tx) => {
        const items = await tx.insert(schema.sovItems).values(values).returning();

        // Audit log bulk creation
        await createAuditLog(db, schema, {
          action: AuditAction.CREATE,
          entityType: "sov_item_bulk",
          entityId: input.projectId,
          actorId: userId,
          changes: { after: { count: items.length, projectId: input.projectId } },
        });

        return items;
      });

      return sovItems;
    }),

  /**
   * Import SOV items from budget line items.
   * Creates an SOV item for each budget line item that doesn't already have one.
   */
  importFromBudget: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId; // Guaranteed non-null by protectedProcedure

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Get all budget line items for the project
      const budgetLineItems = await db
        .select()
        .from(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.projectId, input.projectId))
        .orderBy(
          schema.budgetLineItems.costCodeId,
          schema.budgetLineItems.createdAt
        );

      if (budgetLineItems.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No budget line items found for this project",
        });
      }

      // Get existing SOV items that reference budget line items
      const existingSovItems = await db
        .select({
          budgetLineItemId: schema.sovItems.budgetLineItemId,
        })
        .from(schema.sovItems)
        .where(
          and(
            eq(schema.sovItems.projectId, input.projectId),
            isNotNull(schema.sovItems.budgetLineItemId)
          )
        );

      const existingBudgetLineItemIds = new Set(
        existingSovItems
          .map((item) => item.budgetLineItemId)
          .filter((id): id is string => id !== null)
      );

      // Filter to budget line items that don't have SOV items yet
      const itemsToImport = budgetLineItems.filter(
        (item) => !existingBudgetLineItemIds.has(item.id)
      );

      if (itemsToImport.length === 0) {
        return { created: [], skipped: budgetLineItems.length };
      }

      // Get max itemNumber and orderIndex
      const [maxItemResult] = await db
        .select({
          maxItem: sql<string>`MAX(${schema.sovItems.itemNumber})`,
        })
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId));

      const maxItem = maxItemResult?.maxItem;
      let nextNumber = maxItem ? parseInt(maxItem, 10) + 1 : 1;

      const [maxOrderResult] = await db
        .select({
          maxOrder: sql<number>`COALESCE(MAX(${schema.sovItems.orderIndex}), -1)`,
        })
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId));

      let orderIndex = (maxOrderResult?.maxOrder ?? -1) + 1;

      // Build values array
      const values = itemsToImport.map((item) => ({
        projectId: input.projectId,
        budgetLineItemId: item.id,
        itemNumber: String(nextNumber++).padStart(3, "0"),
        description: item.description,
        scheduledValue: item.budgetedAmount, // Copy budgeted amount as scheduled value
        orderIndex: orderIndex++,
        createdBy: userId,
      }));

      // Insert in transaction
      const sovItems = await db.transaction(async (tx) => {
        const items = await tx.insert(schema.sovItems).values(values).returning();

        // Audit log import
        await createAuditLog(db, schema, {
          action: AuditAction.CREATE,
          entityType: "sov_import_from_budget",
          entityId: input.projectId,
          actorId: userId,
          changes: {
            after: {
              importedCount: items.length,
              skippedCount: existingBudgetLineItemIds.size,
              projectId: input.projectId,
            },
          },
        });

        return items;
      });

      return {
        created: sovItems,
        skipped: existingBudgetLineItemIds.size,
      };
    }),

  /**
   * Update an SOV item.
   * Only allowed when no payment apps exist for this project (or all are draft).
   */
  update: protectedProcedure
    .input(updateSovItemSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Get the SOV item
      const [sovItem] = await db
        .select()
        .from(schema.sovItems)
        .where(eq(schema.sovItems.id, input.id))
        .limit(1);

      if (!sovItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "SOV item not found",
        });
      }

      // Check if any non-draft payment apps exist for this project
      const [nonDraftPaymentApp] = await db
        .select({ id: schema.paymentApps.id })
        .from(schema.paymentApps)
        .where(
          and(
            eq(schema.paymentApps.projectId, sovItem.projectId),
            sql`${schema.paymentApps.status} != 'draft'`
          )
        )
        .limit(1);

      if (nonDraftPaymentApp) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Cannot update SOV item: non-draft payment apps exist for this project. SOV is locked once a payment app is submitted.",
        });
      }

      // Build update object (only include provided fields)
      const updates: Partial<typeof sovItem> = {
        updatedAt: new Date(),
      };

      if (input.description !== undefined) {
        updates.description = input.description;
      }
      if (input.scheduledValue !== undefined) {
        updates.scheduledValue = input.scheduledValue.toFixed(2);
      }
      if (input.orderIndex !== undefined) {
        updates.orderIndex = input.orderIndex;
      }

      // Update SOV item
      const [updatedItem] = await db
        .update(schema.sovItems)
        .set(updates)
        .where(eq(schema.sovItems.id, input.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        action: AuditAction.UPDATE,
        entityType: "sov_item",
        entityId: updatedItem.id,
        actorId: ctx.userId,
        changes: {
          before: sovItem,
          after: updatedItem,
        },
      });

      return updatedItem;
    }),

  /**
   * Delete an SOV item.
   * Only allowed when no payment app line items reference this item.
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
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Get the SOV item
      const [sovItem] = await db
        .select()
        .from(schema.sovItems)
        .where(eq(schema.sovItems.id, input.id))
        .limit(1);

      if (!sovItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "SOV item not found",
        });
      }

      // Check if any payment app line items reference this SOV item
      const [lineItem] = await db
        .select({ id: schema.paymentAppLineItems.id })
        .from(schema.paymentAppLineItems)
        .where(eq(schema.paymentAppLineItems.sovItemId, input.id))
        .limit(1);

      if (lineItem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot delete SOV item: payment app line items reference this item. Remove those line items first.",
        });
      }

      // Delete SOV item
      await db.delete(schema.sovItems).where(eq(schema.sovItems.id, input.id));

      // Audit log
      await createAuditLog(db, schema, {
        action: AuditAction.DELETE,
        entityType: "sov_item",
        entityId: input.id,
        actorId: ctx.userId,
        changes: { before: sovItem },
      });

      return { success: true };
    }),

  /**
   * Reorder SOV items.
   * Updates orderIndex for each item based on array position.
   */
  reorder: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        itemIds: z.array(z.string().uuid()).min(1),
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
      const userId = ctx.userId; // Guaranteed non-null by protectedProcedure

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Verify all items belong to this project
      const items = await db
        .select({ id: schema.sovItems.id })
        .from(schema.sovItems)
        .where(
          and(
            eq(schema.sovItems.projectId, input.projectId),
            sql`${schema.sovItems.id} = ANY(${input.itemIds})`
          )
        );

      if (items.length !== input.itemIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Some SOV items do not belong to this project or do not exist",
        });
      }

      // Update orderIndex for each item based on position in array
      await db.transaction(async (tx) => {
        for (let i = 0; i < input.itemIds.length; i++) {
          await tx
            .update(schema.sovItems)
            .set({ orderIndex: i, updatedAt: new Date() })
            .where(eq(schema.sovItems.id, input.itemIds[i]));
        }

        // Audit log reorder
        await createAuditLog(db, schema, {
          action: AuditAction.UPDATE,
          entityType: "sov_reorder",
          entityId: input.projectId,
          actorId: userId,
          changes: {
            after: {
              projectId: input.projectId,
              itemIds: input.itemIds,
            },
          },
        });
      });

      return { success: true };
    }),
});
