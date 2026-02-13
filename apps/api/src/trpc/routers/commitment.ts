import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createCommitmentSchema,
  updateCommitmentSchema,
  commitmentStatusEnum,
  commitmentTypeEnum,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, inArray, and, sql, count } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";

/**
 * Valid status transitions for commitment lifecycle.
 * Enforces proper workflow progression.
 */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending", "closed"],
  pending: ["approved", "draft", "closed"],
  approved: ["executed", "pending", "closed"],
  executed: ["closed"],
  closed: [], // Terminal state
};

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
 * Commitment management router.
 * Handles commitment CRUD, status lifecycle, and budget variance warnings.
 */
export const commitmentRouter = router({
  /**
   * Create a new commitment with line items.
   * Validates budget line items and warns if commitments exceed budget.
   */
  create: protectedProcedure
    .input(createCommitmentSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("create", "Commitment");

      // Calculate total amount from line items
      const totalAmount = input.lineItems.reduce((sum, item) => sum + item.amount, 0);

      // Validate budget line items and check for over-budget warnings
      const warnings: Array<{
        budgetLineItemId: string;
        budgeted: number;
        currentCommitted: number;
        newCommitted: number;
        exceedsBy: number;
      }> = [];

      for (const lineItem of input.lineItems) {
        if (lineItem.budgetLineItemId) {
          // Verify budget line item exists and belongs to this project
          const [budgetLineItem] = await db
            .select()
            .from(schema.budgetLineItems)
            .where(eq(schema.budgetLineItems.id, lineItem.budgetLineItemId))
            .limit(1);

          if (!budgetLineItem) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Budget line item ${lineItem.budgetLineItemId} not found`,
            });
          }

          if (budgetLineItem.projectId !== input.projectId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Budget line item ${lineItem.budgetLineItemId} does not belong to project ${input.projectId}`,
            });
          }

          // Calculate current committed amount for this budget line item
          const [currentCommitted] = await db
            .select({
              total: sql<string>`COALESCE(SUM(${schema.commitmentLineItems.amount}), 0)`,
            })
            .from(schema.commitmentLineItems)
            .innerJoin(
              schema.commitments,
              eq(schema.commitmentLineItems.commitmentId, schema.commitments.id)
            )
            .where(
              and(
                eq(schema.commitmentLineItems.budgetLineItemId, lineItem.budgetLineItemId),
                inArray(schema.commitments.status, ["approved", "executed"])
              )
            );

          const currentCommittedAmount = Number(currentCommitted?.total ?? 0);
          const newCommittedAmount = currentCommittedAmount + lineItem.amount;
          const budgetedAmount = Number(budgetLineItem.budgetedAmount);

          // Check if new total would exceed budget
          if (newCommittedAmount > budgetedAmount) {
            warnings.push({
              budgetLineItemId: lineItem.budgetLineItemId,
              budgeted: budgetedAmount,
              currentCommitted: currentCommittedAmount,
              newCommitted: newCommittedAmount,
              exceedsBy: newCommittedAmount - budgetedAmount,
            });
          }
        }
      }

      // Insert commitment and line items in a transaction
      const [commitment] = await db
        .insert(schema.commitments)
        .values({
          projectId: input.projectId,
          type: input.type,
          vendorName: input.vendorName,
          contractNumber: input.contractNumber ?? null,
          description: input.description ?? null,
          totalAmount: totalAmount.toFixed(2),
          status: "draft",
          createdBy: ctx.userId,
        })
        .returning();

      // Insert line items
      const lineItems = await db
        .insert(schema.commitmentLineItems)
        .values(
          input.lineItems.map(item => ({
            commitmentId: commitment.id,
            budgetLineItemId: item.budgetLineItemId ?? null,
            costCodeId: item.costCodeId,
            description: item.description,
            amount: item.amount.toFixed(2),
          }))
        )
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Commitment",
        entityId: commitment.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: {
            ...commitment,
            lineItems: lineItems,
          },
        },
      });

      return {
        commitment,
        lineItems,
        warnings,
      };
    }),

  /**
   * List commitments for a project.
   * Supports optional filtering by status and type.
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: commitmentStatusEnum.optional(),
        type: commitmentTypeEnum.optional(),
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
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Commitment");

      // Build where conditions
      const conditions = [eq(schema.commitments.projectId, input.projectId)];

      if (input.status) {
        conditions.push(eq(schema.commitments.status, input.status));
      }

      if (input.type) {
        conditions.push(eq(schema.commitments.type, input.type));
      }

      // Query commitments
      const commitments = await db
        .select()
        .from(schema.commitments)
        .where(and(...conditions))
        .orderBy(desc(schema.commitments.createdAt));

      // Get line item counts and totals for each commitment
      const commitmentsWithMetadata = await Promise.all(
        commitments.map(async commitment => {
          const [metadata] = await db
            .select({
              lineItemCount: count(),
              totalAmount: sql<string>`COALESCE(SUM(${schema.commitmentLineItems.amount}), 0)`,
            })
            .from(schema.commitmentLineItems)
            .where(eq(schema.commitmentLineItems.commitmentId, commitment.id));

          return {
            ...commitment,
            lineItemCount: metadata?.lineItemCount ?? 0,
            calculatedTotal: Number(metadata?.totalAmount ?? 0),
          };
        })
      );

      return commitmentsWithMetadata;
    }),

  /**
   * Get a commitment by ID with full line item details.
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

      // Fetch commitment
      const [commitment] = await db
        .select()
        .from(schema.commitments)
        .where(eq(schema.commitments.id, input.id))
        .limit(1);

      if (!commitment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commitment not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Commitment");

      // Fetch line items with budget line item details
      const lineItems = await db
        .select({
          id: schema.commitmentLineItems.id,
          commitmentId: schema.commitmentLineItems.commitmentId,
          budgetLineItemId: schema.commitmentLineItems.budgetLineItemId,
          costCodeId: schema.commitmentLineItems.costCodeId,
          description: schema.commitmentLineItems.description,
          amount: schema.commitmentLineItems.amount,
          createdAt: schema.commitmentLineItems.createdAt,
          budgetDescription: schema.budgetLineItems.description,
          budgetedAmount: schema.budgetLineItems.budgetedAmount,
        })
        .from(schema.commitmentLineItems)
        .leftJoin(
          schema.budgetLineItems,
          eq(schema.commitmentLineItems.budgetLineItemId, schema.budgetLineItems.id)
        )
        .where(eq(schema.commitmentLineItems.commitmentId, input.id));

      return {
        ...commitment,
        lineItems,
      };
    }),

  /**
   * Update a commitment.
   * Enforces valid status transitions.
   */
  update: protectedProcedure
    .input(updateCommitmentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing commitment
      const [existingCommitment] = await db
        .select()
        .from(schema.commitments)
        .where(eq(schema.commitments.id, input.id))
        .limit(1);

      if (!existingCommitment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commitment not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "Commitment");

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.vendorName !== undefined) {
        updateValues.vendorName = input.vendorName;
      }

      if (input.contractNumber !== undefined) {
        updateValues.contractNumber = input.contractNumber;
      }

      if (input.description !== undefined) {
        updateValues.description = input.description;
      }

      // Handle status transitions
      if (input.status !== undefined) {
        const currentStatus = existingCommitment.status;
        const newStatus = input.status;

        // Check if transition is valid
        const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
        if (!validTransitions.includes(newStatus)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot transition from ${currentStatus} to ${newStatus}`,
          });
        }

        updateValues.status = newStatus;

        // Set timestamps for specific transitions
        if (newStatus === "executed") {
          updateValues.executedAt = new Date();
        }

        if (newStatus === "approved") {
          updateValues.approvedBy = ctx.userId;
          updateValues.approvedAt = new Date();
        }
      }

      // Update commitment
      const [updated] = await db
        .update(schema.commitments)
        .set(updateValues)
        .where(eq(schema.commitments.id, input.id))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Commitment",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: existingCommitment,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Delete a commitment.
   * Only draft commitments can be deleted.
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

      // Fetch existing commitment
      const [existingCommitment] = await db
        .select()
        .from(schema.commitments)
        .where(eq(schema.commitments.id, input.id))
        .limit(1);

      if (!existingCommitment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commitment not found",
        });
      }

      // Only allow deletion of draft commitments
      if (existingCommitment.status !== "draft") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only draft commitments can be deleted. Close the commitment instead.",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("delete", "Commitment");

      // Delete commitment (CASCADE deletes line items)
      await db
        .delete(schema.commitments)
        .where(eq(schema.commitments.id, input.id));

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Commitment",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          before: existingCommitment,
        },
      });

      return { success: true };
    }),

  /**
   * Get line items for a commitment with budget context.
   */
  getLineItems: protectedProcedure
    .input(z.object({ commitmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch commitment to get projectId
      const [commitment] = await db
        .select()
        .from(schema.commitments)
        .where(eq(schema.commitments.id, input.commitmentId))
        .limit(1);

      if (!commitment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commitment not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Commitment");

      // Query commitment line items with budget line item context
      const lineItems = await db
        .select({
          id: schema.commitmentLineItems.id,
          commitmentId: schema.commitmentLineItems.commitmentId,
          budgetLineItemId: schema.commitmentLineItems.budgetLineItemId,
          costCodeId: schema.commitmentLineItems.costCodeId,
          description: schema.commitmentLineItems.description,
          amount: schema.commitmentLineItems.amount,
          createdAt: schema.commitmentLineItems.createdAt,
          budgetDescription: schema.budgetLineItems.description,
          budgetedAmount: schema.budgetLineItems.budgetedAmount,
        })
        .from(schema.commitmentLineItems)
        .leftJoin(
          schema.budgetLineItems,
          eq(schema.commitmentLineItems.budgetLineItemId, schema.budgetLineItems.id)
        )
        .where(eq(schema.commitmentLineItems.commitmentId, input.commitmentId));

      return lineItems;
    }),
});
