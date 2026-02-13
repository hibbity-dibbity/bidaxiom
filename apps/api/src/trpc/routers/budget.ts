import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createBudgetLineItemSchema,
  updateBudgetLineItemSchema,
  AuditAction,
  CSI_DIVISIONS,
  type BudgetSummary,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, inArray, and, sql, count } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { checkBudgetVariances } from "../../calculations/variance.js";
import { calculateForecast } from "../../calculations/forecast.js";

/**
 * Load project-level abilities for the current user.
 * Queries project team memberships and builds CASL abilities with project context.
 */
async function loadProjectAbilities(ctx: {
  tenant: NonNullable<Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>>;
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

  return defineAbilitiesFor(
    ctx.orgRole ?? "org:member",
    ctx.userId,
    memberships
  );
}

/**
 * Budget management router.
 * Handles budget line item CRUD, lock enforcement, variance alerts, and forecast calculations.
 */
export const budgetRouter = router({
  /**
   * Create a new budget line item.
   * Validates cost code and enforces CASL permissions.
   */
  createLineItem: protectedProcedure
    .input(createBudgetLineItemSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("update", "Budget");

      // Validate cost code
      if (input.costCodeId < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cost code ID must be non-negative",
        });
      }

      // If cost code is CSI division (0-49), check it exists
      if (input.costCodeId < 50) {
        const csiDivision = CSI_DIVISIONS.find(d => d.division === input.costCodeId);
        if (!csiDivision) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid CSI division: ${input.costCodeId}`,
          });
        }
      }
      // For custom codes (50+), accept any value (company config validation deferred to future enhancement)

      // Insert budget line item
      const [lineItem] = await db
        .insert(schema.budgetLineItems)
        .values({
          projectId: input.projectId,
          costCodeId: input.costCodeId,
          description: input.description,
          budgetedAmount: input.budgetedAmount.toFixed(2),
          createdBy: ctx.userId,
        })
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "BudgetLineItem",
        entityId: lineItem.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: lineItem,
        },
      });

      return lineItem;
    }),

  /**
   * List all budget line items for a project.
   * Returns items ordered by cost code, then creation date.
   */
  listLineItems: protectedProcedure
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "Budget");

      // Query budget line items
      const items = await db
        .select()
        .from(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.projectId, input.projectId))
        .orderBy(schema.budgetLineItems.costCodeId, schema.budgetLineItems.createdAt);

      return items;
    }),

  /**
   * Update a budget line item.
   * Enforces lock status - locked items cannot be modified.
   */
  updateLineItem: protectedProcedure
    .input(updateBudgetLineItemSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing line item
      const [existingItem] = await db
        .select()
        .from(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.id, input.id))
        .limit(1);

      if (!existingItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Budget line item not found",
        });
      }

      // Check if locked
      if (existingItem.isLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Budget line item is locked. Use change order to modify.",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Budget");

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.description !== undefined) {
        updateValues.description = input.description;
      }
      if (input.budgetedAmount !== undefined) {
        updateValues.budgetedAmount = input.budgetedAmount.toFixed(2);
      }

      // Update line item
      const [updated] = await db
        .update(schema.budgetLineItems)
        .set(updateValues)
        .where(eq(schema.budgetLineItems.id, input.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "BudgetLineItem",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: existingItem,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Delete a budget line item.
   * Enforces lock status and checks for dependent commitments.
   */
  deleteLineItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing line item
      const [existingItem] = await db
        .select()
        .from(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.id, input.id))
        .limit(1);

      if (!existingItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Budget line item not found",
        });
      }

      // Check if locked
      if (existingItem.isLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Budget line item is locked. Cannot delete.",
        });
      }

      // Check for dependent commitment line items
      const [commitmentCount] = await db
        .select({ count: count() })
        .from(schema.commitmentLineItems)
        .where(eq(schema.commitmentLineItems.budgetLineItemId, input.id));

      if (commitmentCount && commitmentCount.count > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete budget line item with associated commitments. Remove commitments first.",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("delete", "Budget");

      // Delete line item
      await db
        .delete(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.id, input.id));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "BudgetLineItem",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          before: existingItem,
        },
      });

      return { success: true };
    }),

  /**
   * Get project budget summary.
   * Aggregates budgeted, committed, and actual costs.
   */
  getProjectSummary: protectedProcedure
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "Budget");

      // Query: Total budgeted amount
      const [budgetResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${schema.budgetLineItems.budgetedAmount}), 0)`,
          count: count(),
        })
        .from(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.projectId, input.projectId));

      const totalBudgeted = Number(budgetResult?.total ?? 0);
      const lineItemCount = budgetResult?.count ?? 0;

      // Query: Total committed amount (approved and executed commitments)
      const [committedResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${schema.commitments.totalAmount}), 0)`,
          count: count(),
        })
        .from(schema.commitments)
        .where(
          and(
            eq(schema.commitments.projectId, input.projectId),
            inArray(schema.commitments.status, ["approved", "executed"])
          )
        );

      const totalCommitted = Number(committedResult?.total ?? 0);
      const commitmentCount = committedResult?.count ?? 0;

      // Phase 4: Actual costs come from payment applications (Phase 6)
      const totalActual = 0;

      // Calculate variance
      const totalVariance = totalBudgeted - totalCommitted;

      const summary: BudgetSummary = {
        projectId: input.projectId,
        totalBudgeted,
        totalCommitted,
        totalActual,
        totalVariance,
        lineItemCount,
        commitmentCount,
      };

      return summary;
    }),

  /**
   * Get variance alerts for a project.
   * Returns only warning and critical severity alerts.
   */
  getVarianceAlerts: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Budget");

      // Calculate all variances
      const allAlerts = await checkBudgetVariances(
        input.projectId,
        ctx.tenant.db,
        ctx.tenant.schema
      );

      // Filter to only warning and critical
      const filteredAlerts = allAlerts.filter(
        alert => alert.severity === "warning" || alert.severity === "critical"
      );

      return filteredAlerts;
    }),

  /**
   * Get forecast metrics for a project.
   * Returns EVM calculations (CPI, EAC, ETC, VAC).
   */
  getForecast: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Budget");

      // Calculate forecast metrics
      const metrics = await calculateForecast(
        input.projectId,
        ctx.tenant.db,
        ctx.tenant.schema
      );

      return metrics;
    }),

  /**
   * Lock a budget line item.
   * Called when payment applications are created (Phase 6).
   * Idempotent - returns existing lock if already locked.
   */
  lockLineItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing line item
      const [existingItem] = await db
        .select()
        .from(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.id, input.id))
        .limit(1);

      if (!existingItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Budget line item not found",
        });
      }

      // If already locked, return as-is (idempotent)
      if (existingItem.isLocked) {
        return existingItem;
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Budget");

      // Lock the line item
      const [locked] = await db
        .update(schema.budgetLineItems)
        .set({
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(schema.budgetLineItems.id, input.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "BudgetLineItem",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: { isLocked: false },
          after: { isLocked: true, lockedAt: locked.lockedAt, lockedBy: locked.lockedBy },
        },
      });

      return locked;
    }),
});
