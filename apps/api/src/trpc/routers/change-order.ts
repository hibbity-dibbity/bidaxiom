import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createChangeOrderSchema,
  updateChangeOrderSchema,
  submitForApprovalSchema,
  approveRejectSchema,
  AuditAction,
  VALID_CO_STATUS_TRANSITIONS,
  type ChangeOrderStatus,
  type LifecyclePhase,
  isFeatureAvailableInPhase,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, inArray, and, sql, count } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { getNextChangeOrderNumber } from "../../utils/sequential-number.js";

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
 * Change order management router.
 * Handles full lifecycle: draft -> PCO submitted -> approval workflow -> approved/rejected.
 */
export const changeOrderRouter = router({
  /**
   * Create a new change order with line items.
   * Validates discriminated union (owner/internal/subcontractor) and budget line item references.
   */
  create: protectedProcedure
    .input(createChangeOrderSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("manage", "ChangeOrder");

      // Verify project exists
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Project not found",
        });
      }

      // Phase gate: Change Orders are only available in Awarded phase and later
      if (!isFeatureAvailableInPhase("change_orders", project.lifecyclePhase as LifecyclePhase)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Change Orders are not available in the '${project.lifecyclePhase}' phase. Projects must reach the Awarded phase before change orders can be created.`,
        });
      }

      // Type-specific validations
      if (input.type === "subcontractor") {
        // Validate commitment exists and belongs to project
        const [commitment] = await db
          .select()
          .from(schema.commitments)
          .where(eq(schema.commitments.id, input.commitmentId))
          .limit(1);

        if (!commitment) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Commitment not found",
          });
        }

        if (commitment.projectId !== input.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Commitment does not belong to project",
          });
        }
      }

      // Validate budget line item references
      for (const lineItem of input.lineItems) {
        if (lineItem.budgetLineItemId) {
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
              message: `Budget line item ${lineItem.budgetLineItemId} does not belong to project`,
            });
          }
        }
      }

      // Calculate total amount
      const totalAmount = input.lineItems.reduce((sum, item) => sum + item.amountChange, 0);

      // Create change order and line items in transaction
      const result = await db.transaction(async (tx) => {
        // Build values object based on CO type to satisfy discriminated union
        const baseValues: any = {
          projectId: input.projectId,
          type: input.type,
          status: "draft",
          title: input.title,
          description: input.description,
          totalAmount: totalAmount.toFixed(2),
          relatedDocuments: input.relatedDocuments ?? [],
          createdBy: ctx.userId,
        };

        // Add type-specific fields
        if (input.type === "internal") {
          baseValues.reason = input.reason;
        } else if (input.type === "subcontractor") {
          baseValues.commitmentId = input.commitmentId;
        } else if (input.type === "owner") {
          baseValues.requestedBy = input.requestedBy;
        }

        // Insert change order
        const [changeOrder] = await tx
          .insert(schema.changeOrders)
          .values(baseValues)
          .returning();

        // Insert line items
        const lineItems = await tx
          .insert(schema.changeOrderLineItems)
          .values(
            input.lineItems.map(item => ({
              changeOrderId: changeOrder.id,
              budgetLineItemId: item.budgetLineItemId ?? undefined,
              costCodeId: item.costCodeId,
              description: item.description,
              amountChange: item.amountChange.toFixed(2),
            }))
          )
          .returning();

        // Record history: status change to draft
        await tx.insert(schema.changeOrderHistory).values({
          changeOrderId: changeOrder.id,
          revisionNumber: 1,
          changedBy: ctx.userId,
          changeType: "status_change",
          fieldName: "status",
          oldValue: undefined,
          newValue: { status: "draft" },
        } as any);

        return { changeOrder, lineItems };
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "ChangeOrder",
        entityId: result.changeOrder.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: {
            ...result.changeOrder,
            lineItems: result.lineItems,
          },
        },
      });

      return result;
    }),

  /**
   * List change orders for a project with optional filters.
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.string().optional(),
        type: z.string().optional(),
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "ChangeOrder");

      // Build where conditions
      const conditions = [eq(schema.changeOrders.projectId, input.projectId)];
      if (input.status) {
        conditions.push(eq(schema.changeOrders.status, input.status));
      }
      if (input.type) {
        conditions.push(eq(schema.changeOrders.type, input.type));
      }

      // Query change orders with line item count
      const changeOrders = await db
        .select({
          id: schema.changeOrders.id,
          projectId: schema.changeOrders.projectId,
          type: schema.changeOrders.type,
          status: schema.changeOrders.status,
          pcoNumber: schema.changeOrders.pcoNumber,
          coNumber: schema.changeOrders.coNumber,
          title: schema.changeOrders.title,
          description: schema.changeOrders.description,
          totalAmount: schema.changeOrders.totalAmount,
          submittedAt: schema.changeOrders.submittedAt,
          approvedAt: schema.changeOrders.approvedAt,
          rejectedAt: schema.changeOrders.rejectedAt,
          createdAt: schema.changeOrders.createdAt,
          createdBy: schema.changeOrders.createdBy,
        })
        .from(schema.changeOrders)
        .where(and(...conditions))
        .orderBy(desc(schema.changeOrders.createdAt));

      // Get line item counts
      const lineItemCounts = await db
        .select({
          changeOrderId: schema.changeOrderLineItems.changeOrderId,
          count: count(),
        })
        .from(schema.changeOrderLineItems)
        .where(
          inArray(
            schema.changeOrderLineItems.changeOrderId,
            changeOrders.map(co => co.id)
          )
        )
        .groupBy(schema.changeOrderLineItems.changeOrderId);

      const countMap = new Map(
        lineItemCounts.map(item => [item.changeOrderId, Number(item.count)])
      );

      return changeOrders.map(co => ({
        ...co,
        lineItemCount: countMap.get(co.id) ?? 0,
      }));
    }),

  /**
   * Get a single change order by ID with all details.
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
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "ChangeOrder");

      // Get change order
      const [changeOrder] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.id))
        .limit(1);

      if (!changeOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found",
        });
      }

      // Get line items with budget line item context
      const lineItems = await db
        .select({
          id: schema.changeOrderLineItems.id,
          changeOrderId: schema.changeOrderLineItems.changeOrderId,
          budgetLineItemId: schema.changeOrderLineItems.budgetLineItemId,
          costCodeId: schema.changeOrderLineItems.costCodeId,
          description: schema.changeOrderLineItems.description,
          amountChange: schema.changeOrderLineItems.amountChange,
          budgetLineItem: {
            id: schema.budgetLineItems.id,
            description: schema.budgetLineItems.description,
            budgetedAmount: schema.budgetLineItems.budgetedAmount,
          },
        })
        .from(schema.changeOrderLineItems)
        .leftJoin(
          schema.budgetLineItems,
          eq(schema.changeOrderLineItems.budgetLineItemId, schema.budgetLineItems.id)
        )
        .where(eq(schema.changeOrderLineItems.changeOrderId, input.id));

      // Get approval steps
      const approvalSteps = await db
        .select()
        .from(schema.approvalWorkflowSteps)
        .where(eq(schema.approvalWorkflowSteps.changeOrderId, input.id))
        .orderBy(schema.approvalWorkflowSteps.stepOrder);

      // Get history
      const history = await db
        .select()
        .from(schema.changeOrderHistory)
        .where(eq(schema.changeOrderHistory.changeOrderId, input.id))
        .orderBy(schema.changeOrderHistory.changedAt);

      return {
        ...changeOrder,
        lineItems,
        approvalSteps,
        history,
      };
    }),

  /**
   * Update a change order's basic fields.
   * Only allowed in draft or rejected status.
   */
  update: protectedProcedure
    .input(updateChangeOrderSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("manage", "ChangeOrder");

      // Get current change order
      const [current] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.id))
        .limit(1);

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found",
        });
      }

      // Only allow updates in draft or rejected status
      if (current.status !== "draft" && current.status !== "rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot update change order in ${current.status} status. Only draft or rejected COs can be updated.`,
        });
      }

      // Get next revision number
      const [maxRevision] = await db
        .select({ max: sql<number>`COALESCE(MAX(${schema.changeOrderHistory.revisionNumber}), 0)` })
        .from(schema.changeOrderHistory)
        .where(eq(schema.changeOrderHistory.changeOrderId, input.id));

      const nextRevision = (maxRevision?.max ?? 0) + 1;

      // Track field-level changes and update
      const result = await db.transaction(async (tx) => {
        const updates: Record<string, any> = { updatedAt: new Date() };
        const historyEntries: Array<any> = [];

        // Track each field change
        if (input.title !== undefined && input.title !== current.title) {
          updates.title = input.title;
          historyEntries.push({
            changeOrderId: input.id,
            revisionNumber: nextRevision,
            changedBy: ctx.userId,
            changeType: "field_update",
            fieldName: "title",
            oldValue: current.title,
            newValue: input.title,
          });
        }

        if (input.description !== undefined && input.description !== current.description) {
          updates.description = input.description;
          historyEntries.push({
            changeOrderId: input.id,
            revisionNumber: nextRevision,
            changedBy: ctx.userId,
            changeType: "field_update",
            fieldName: "description",
            oldValue: current.description,
            newValue: input.description,
          });
        }

        if (input.requestedBy !== undefined && input.requestedBy !== current.requestedBy) {
          updates.requestedBy = input.requestedBy;
          historyEntries.push({
            changeOrderId: input.id,
            revisionNumber: nextRevision,
            changedBy: ctx.userId,
            changeType: "field_update",
            fieldName: "requestedBy",
            oldValue: current.requestedBy,
            newValue: input.requestedBy,
          });
        }

        if (input.reason !== undefined && input.reason !== current.reason) {
          updates.reason = input.reason;
          historyEntries.push({
            changeOrderId: input.id,
            revisionNumber: nextRevision,
            changedBy: ctx.userId,
            changeType: "field_update",
            fieldName: "reason",
            oldValue: current.reason,
            newValue: input.reason,
          });
        }

        if (input.relatedDocuments !== undefined) {
          const currentDocs = JSON.stringify(current.relatedDocuments);
          const newDocs = JSON.stringify(input.relatedDocuments);
          if (currentDocs !== newDocs) {
            updates.relatedDocuments = input.relatedDocuments;
            historyEntries.push({
              changeOrderId: input.id,
              revisionNumber: nextRevision,
              changedBy: ctx.userId,
              changeType: "field_update",
              fieldName: "relatedDocuments",
              oldValue: current.relatedDocuments,
              newValue: input.relatedDocuments,
            });
          }
        }

        // Only update if there are changes
        let updated = current;
        if (Object.keys(updates).length > 1) {
          // More than just updatedAt
          [updated] = await tx
            .update(schema.changeOrders)
            .set(updates)
            .where(eq(schema.changeOrders.id, input.id))
            .returning();

          // Insert history entries
          if (historyEntries.length > 0) {
            await tx.insert(schema.changeOrderHistory).values(historyEntries);
          }
        }

        return updated;
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "ChangeOrder",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: current,
          after: result,
        },
      });

      return result;
    }),

  /**
   * Update line items for a change order.
   * Only allowed in draft or rejected status.
   */
  updateLineItems: protectedProcedure
    .input(
      z.object({
        changeOrderId: z.string().uuid(),
        lineItems: z.array(
          z.object({
            budgetLineItemId: z.string().uuid().optional(),
            costCodeId: z.number().int().min(0),
            description: z.string().min(1).max(500),
            amountChange: z.number(),
          })
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
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "ChangeOrder");

      // Get current change order
      const [current] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.changeOrderId))
        .limit(1);

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found",
        });
      }

      // Only allow updates in draft or rejected status
      if (current.status !== "draft" && current.status !== "rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot update line items in ${current.status} status`,
        });
      }

      // Validate budget line items
      for (const lineItem of input.lineItems) {
        if (lineItem.budgetLineItemId) {
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

          if (budgetLineItem.projectId !== current.projectId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Budget line item ${lineItem.budgetLineItemId} does not belong to project`,
            });
          }
        }
      }

      // Calculate new total amount
      const totalAmount = input.lineItems.reduce((sum, item) => sum + item.amountChange, 0);

      // Get next revision number
      const [maxRevision] = await db
        .select({ max: sql<number>`COALESCE(MAX(${schema.changeOrderHistory.revisionNumber}), 0)` })
        .from(schema.changeOrderHistory)
        .where(eq(schema.changeOrderHistory.changeOrderId, input.changeOrderId));

      const nextRevision = (maxRevision?.max ?? 0) + 1;

      // Replace line items and update total
      const result = await db.transaction(async (tx) => {
        // Delete existing line items
        await tx
          .delete(schema.changeOrderLineItems)
          .where(eq(schema.changeOrderLineItems.changeOrderId, input.changeOrderId));

        // Insert new line items
        const lineItems = await tx
          .insert(schema.changeOrderLineItems)
          .values(
            input.lineItems.map(item => ({
              changeOrderId: input.changeOrderId,
              budgetLineItemId: item.budgetLineItemId ?? undefined,
              costCodeId: item.costCodeId,
              description: item.description,
              amountChange: item.amountChange.toFixed(2),
            }))
          )
          .returning();

        // Update total amount
        const [updated] = await tx
          .update(schema.changeOrders)
          .set({
            totalAmount: totalAmount.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(schema.changeOrders.id, input.changeOrderId))
          .returning();

        // Record history
        await tx.insert(schema.changeOrderHistory).values({
          changeOrderId: input.changeOrderId,
          revisionNumber: nextRevision,
          changedBy: ctx.userId,
          changeType: "line_item_change",
          fieldName: undefined,
          oldValue: { totalAmount: current.totalAmount },
          newValue: { totalAmount: totalAmount, lineItemCount: lineItems.length },
        } as any);

        return { changeOrder: updated, lineItems };
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "ChangeOrder",
        entityId: input.changeOrderId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: { ...current },
          after: { ...result.changeOrder, lineItems: result.lineItems },
        },
      });

      return result;
    }),

  /**
   * Submit a change order for approval.
   * Generates PCO number and creates approval workflow steps.
   */
  submit: protectedProcedure
    .input(submitForApprovalSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("manage", "ChangeOrder");

      // Get current change order
      const [current] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.changeOrderId))
        .limit(1);

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found",
        });
      }

      // Only allow submission from draft or rejected status
      if (current.status !== "draft" && current.status !== "rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot submit change order in ${current.status} status`,
        });
      }

      // Generate PCO number
      const pcoNumber = await getNextChangeOrderNumber(
        db,
        schema.changeOrderCounters,
        current.projectId,
        "pco"
      );

      // Get next revision number
      const [maxRevision] = await db
        .select({ max: sql<number>`COALESCE(MAX(${schema.changeOrderHistory.revisionNumber}), 0)` })
        .from(schema.changeOrderHistory)
        .where(eq(schema.changeOrderHistory.changeOrderId, input.changeOrderId));

      const nextRevision = (maxRevision?.max ?? 0) + 1;

      // Update status and create approval steps
      const result = await db.transaction(async (tx) => {
        // Update change order
        const [updated] = await tx
          .update(schema.changeOrders)
          .set({
            status: "pco_submitted",
            pcoNumber,
            submittedAt: new Date(),
            submittedBy: ctx.userId,
            updatedAt: new Date(),
          })
          .where(eq(schema.changeOrders.id, input.changeOrderId))
          .returning();

        // Create approval workflow steps
        const steps = await tx
          .insert(schema.approvalWorkflowSteps)
          .values(
            input.approvalSteps.map(step => ({
              changeOrderId: input.changeOrderId,
              stepOrder: step.stepOrder,
              approverRole: step.approverRole ?? undefined,
              approverUserId: step.approverUserId ?? undefined,
              requirementType: step.requirementType,
              status: "pending",
            }))
          )
          .returning();

        // Record history
        await tx.insert(schema.changeOrderHistory).values({
          changeOrderId: input.changeOrderId,
          revisionNumber: nextRevision,
          changedBy: ctx.userId,
          changeType: "status_change",
          fieldName: "status",
          oldValue: { status: current.status },
          newValue: { status: "pco_submitted", pcoNumber },
        } as any);

        return { changeOrder: updated, approvalSteps: steps };
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "ChangeOrder",
        entityId: input.changeOrderId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: current,
          after: result.changeOrder,
        },
      });

      return result;
    }),

  /**
   * Delete a change order.
   * Only allowed in draft status.
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
      ForbiddenError.from(abilities).throwUnlessCan("manage", "ChangeOrder");

      // Get current change order
      const [current] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.id))
        .limit(1);

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found",
        });
      }

      // Only allow deletion in draft status
      if (current.status !== "draft") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only draft change orders can be deleted. Use void instead for submitted/approved COs.",
        });
      }

      // Delete (cascades to line items, steps, history)
      await db
        .delete(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.id));

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "ChangeOrder",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          before: current,
        },
      });

      return { success: true };
    }),

  /**
   * Approve a change order at the current approval step.
   * If this is the final approval, generates CO number and atomically updates budget.
   */
  approve: protectedProcedure
    .input(approveRejectSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("approve", "ChangeOrder");

      // Get change order
      const [changeOrder] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.changeOrderId))
        .limit(1);

      if (!changeOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found",
        });
      }

      // Verify status allows approval
      if (changeOrder.status !== "pco_submitted" && changeOrder.status !== "pending_approval") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot approve change order in ${changeOrder.status} status`,
        });
      }

      // Load approval steps ordered by stepOrder
      const approvalSteps = await db
        .select()
        .from(schema.approvalWorkflowSteps)
        .where(eq(schema.approvalWorkflowSteps.changeOrderId, input.changeOrderId))
        .orderBy(schema.approvalWorkflowSteps.stepOrder);

      if (approvalSteps.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No approval workflow steps found",
        });
      }

      // Find current pending step
      const currentStep = approvalSteps.find(s => s.status === "pending");
      if (!currentStep) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending approval step found",
        });
      }

      // Validate user can approve this step
      const normalizedRole = ctx.orgRole?.startsWith("org:") ? ctx.orgRole : `org:${ctx.orgRole}`;
      const canApprove =
        (currentStep.approverUserId && currentStep.approverUserId === ctx.userId) ||
        (currentStep.approverRole && currentStep.approverRole === normalizedRole) ||
        (!currentStep.approverUserId && !currentStep.approverRole);

      if (!canApprove) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to approve this step",
        });
      }

      // Get next revision number
      const [maxRevision] = await db
        .select({ max: sql<number>`COALESCE(MAX(${schema.changeOrderHistory.revisionNumber}), 0)` })
        .from(schema.changeOrderHistory)
        .where(eq(schema.changeOrderHistory.changeOrderId, input.changeOrderId));

      const nextRevision = (maxRevision?.max ?? 0) + 1;

      // Mark step as approved
      await db
        .update(schema.approvalWorkflowSteps)
        .set({
          status: "approved",
          approvedBy: ctx.userId,
          approvedAt: new Date(),
          comments: input.comments,
        })
        .where(eq(schema.approvalWorkflowSteps.id, currentStep.id));

      // Check if all steps are now approved
      const remainingPending = approvalSteps.filter(
        s => s.id !== currentStep.id && s.status === "pending"
      );
      const isFinalApproval = remainingPending.length === 0;

      if (isFinalApproval) {
        // CRITICAL TRANSACTION: Generate CO number, update status, apply budget impacts
        const result = await db.transaction(async (tx) => {
          // Generate CO number
          const coNumber = await getNextChangeOrderNumber(
            tx as any,
            schema.changeOrderCounters,
            changeOrder.projectId,
            "co"
          );

          // Update change order status
          const [updated] = await tx
            .update(schema.changeOrders)
            .set({
              status: "approved",
              coNumber,
              approvedAt: new Date(),
              approvedBy: ctx.userId,
              updatedAt: new Date(),
            })
            .where(eq(schema.changeOrders.id, input.changeOrderId))
            .returning();

          // Apply budget impacts
          const lineItems = await tx
            .select()
            .from(schema.changeOrderLineItems)
            .where(eq(schema.changeOrderLineItems.changeOrderId, input.changeOrderId));

          for (const lineItem of lineItems) {
            if (lineItem.budgetLineItemId) {
              // Update budget line item: budgeted_amount += amountChange
              await tx
                .update(schema.budgetLineItems)
                .set({
                  budgetedAmount: sql`${schema.budgetLineItems.budgetedAmount} + ${lineItem.amountChange}`,
                })
                .where(eq(schema.budgetLineItems.id, lineItem.budgetLineItemId));
            }
          }

          // Record history: status change to approved
          await tx.insert(schema.changeOrderHistory).values({
            changeOrderId: input.changeOrderId,
            revisionNumber: nextRevision,
            changedBy: ctx.userId,
            changeType: "status_change",
            fieldName: "status",
            oldValue: { status: changeOrder.status },
            newValue: { status: "approved", coNumber },
          } as any);

          // Record history: approval action
          await tx.insert(schema.changeOrderHistory).values({
            changeOrderId: input.changeOrderId,
            revisionNumber: nextRevision + 1,
            changedBy: ctx.userId,
            changeType: "approval",
            fieldName: undefined,
            oldValue: undefined,
            newValue: { step: currentStep.stepOrder, approvedBy: ctx.userId, finalApproval: true },
          } as any);

          return updated;
        });

        // Create audit log
        await createAuditLog(db, schema, {
          entityType: "ChangeOrder",
          entityId: input.changeOrderId,
          action: AuditAction.UPDATE,
          actorId: ctx.userId,
          changes: {
            before: changeOrder,
            after: result,
          },
        });

        return result;
      } else {
        // Not final approval - update status to pending_approval if needed
        let updated = changeOrder;
        if (changeOrder.status === "pco_submitted") {
          [updated] = await db
            .update(schema.changeOrders)
            .set({
              status: "pending_approval",
              updatedAt: new Date(),
            })
            .where(eq(schema.changeOrders.id, input.changeOrderId))
            .returning();
        }

        // Record history: approval action (more steps pending)
        await db.insert(schema.changeOrderHistory).values({
          changeOrderId: input.changeOrderId,
          revisionNumber: nextRevision,
          changedBy: ctx.userId,
          changeType: "approval",
          fieldName: undefined,
          oldValue: undefined,
          newValue: {
            step: currentStep.stepOrder,
            approvedBy: ctx.userId,
            moreStepsPending: true,
          },
        } as any);

        // Create audit log
        await createAuditLog(db, schema, {
          entityType: "ChangeOrder",
          entityId: input.changeOrderId,
          action: AuditAction.UPDATE,
          actorId: ctx.userId,
          changes: {
            before: changeOrder,
            after: updated,
          },
        });

        return updated;
      }
    }),

  /**
   * Reject a change order at the current approval step.
   * Marks remaining steps as skipped and allows resubmission after edit.
   */
  reject: protectedProcedure
    .input(approveRejectSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("approve", "ChangeOrder");

      // Get change order
      const [changeOrder] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.changeOrderId))
        .limit(1);

      if (!changeOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found",
        });
      }

      // Verify status allows rejection
      if (changeOrder.status !== "pco_submitted" && changeOrder.status !== "pending_approval") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot reject change order in ${changeOrder.status} status`,
        });
      }

      // Load approval steps
      const approvalSteps = await db
        .select()
        .from(schema.approvalWorkflowSteps)
        .where(eq(schema.approvalWorkflowSteps.changeOrderId, input.changeOrderId))
        .orderBy(schema.approvalWorkflowSteps.stepOrder);

      const currentStep = approvalSteps.find(s => s.status === "pending");
      if (!currentStep) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending approval step found",
        });
      }

      // Validate user can reject this step
      const normalizedRole = ctx.orgRole?.startsWith("org:") ? ctx.orgRole : `org:${ctx.orgRole}`;
      const canReject =
        (currentStep.approverUserId && currentStep.approverUserId === ctx.userId) ||
        (currentStep.approverRole && currentStep.approverRole === normalizedRole) ||
        (!currentStep.approverUserId && !currentStep.approverRole);

      if (!canReject) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to reject this step",
        });
      }

      // Get next revision number
      const [maxRevision] = await db
        .select({ max: sql<number>`COALESCE(MAX(${schema.changeOrderHistory.revisionNumber}), 0)` })
        .from(schema.changeOrderHistory)
        .where(eq(schema.changeOrderHistory.changeOrderId, input.changeOrderId));

      const nextRevision = (maxRevision?.max ?? 0) + 1;

      // Reject step and skip remaining
      const result = await db.transaction(async (tx) => {
        // Mark current step as rejected
        await tx
          .update(schema.approvalWorkflowSteps)
          .set({
            status: "rejected",
            comments: input.comments,
          })
          .where(eq(schema.approvalWorkflowSteps.id, currentStep.id));

        // Skip all remaining pending steps
        const remainingPendingIds = approvalSteps
          .filter(s => s.id !== currentStep.id && s.status === "pending")
          .map(s => s.id);

        if (remainingPendingIds.length > 0) {
          await tx
            .update(schema.approvalWorkflowSteps)
            .set({ status: "skipped" })
            .where(inArray(schema.approvalWorkflowSteps.id, remainingPendingIds));
        }

        // Update change order status
        const [updated] = await tx
          .update(schema.changeOrders)
          .set({
            status: "rejected",
            rejectedAt: new Date(),
            rejectedBy: ctx.userId,
            rejectionReason: input.comments,
            updatedAt: new Date(),
          })
          .where(eq(schema.changeOrders.id, input.changeOrderId))
          .returning();

        // Record history
        await tx.insert(schema.changeOrderHistory).values({
          changeOrderId: input.changeOrderId,
          revisionNumber: nextRevision,
          changedBy: ctx.userId,
          changeType: "status_change",
          fieldName: "status",
          oldValue: { status: changeOrder.status },
          newValue: { status: "rejected", reason: input.comments },
        } as any);

        return updated;
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "ChangeOrder",
        entityId: input.changeOrderId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: changeOrder,
          after: result,
        },
      });

      return result;
    }),

  /**
   * Void a change order.
   * If CO was approved, reverses budget impacts.
   */
  void: protectedProcedure
    .input(
      z.object({
        changeOrderId: z.string().uuid(),
        reason: z.string().max(2000),
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
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "ChangeOrder");

      // Get change order
      const [changeOrder] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.changeOrderId))
        .limit(1);

      if (!changeOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found",
        });
      }

      // Cannot void if already void
      if (changeOrder.status === "void") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Change order is already void",
        });
      }

      // Get next revision number
      const [maxRevision] = await db
        .select({ max: sql<number>`COALESCE(MAX(${schema.changeOrderHistory.revisionNumber}), 0)` })
        .from(schema.changeOrderHistory)
        .where(eq(schema.changeOrderHistory.changeOrderId, input.changeOrderId));

      const nextRevision = (maxRevision?.max ?? 0) + 1;

      // Void change order (and reverse budget if approved)
      const result = await db.transaction(async (tx) => {
        // If CO was approved, reverse budget impacts
        if (changeOrder.status === "approved") {
          const lineItems = await tx
            .select()
            .from(schema.changeOrderLineItems)
            .where(eq(schema.changeOrderLineItems.changeOrderId, input.changeOrderId));

          for (const lineItem of lineItems) {
            if (lineItem.budgetLineItemId) {
              // Reverse: budgeted_amount -= amountChange
              await tx
                .update(schema.budgetLineItems)
                .set({
                  budgetedAmount: sql`${schema.budgetLineItems.budgetedAmount} - ${lineItem.amountChange}`,
                })
                .where(eq(schema.budgetLineItems.id, lineItem.budgetLineItemId));
            }
          }
        }

        // Update change order status
        const [updated] = await tx
          .update(schema.changeOrders)
          .set({
            status: "void",
            updatedAt: new Date(),
          })
          .where(eq(schema.changeOrders.id, input.changeOrderId))
          .returning();

        // Record history
        await tx.insert(schema.changeOrderHistory).values({
          changeOrderId: input.changeOrderId,
          revisionNumber: nextRevision,
          changedBy: ctx.userId,
          changeType: "status_change",
          fieldName: "status",
          oldValue: { status: changeOrder.status },
          newValue: { status: "void", reason: input.reason },
        } as any);

        return updated;
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "ChangeOrder",
        entityId: input.changeOrderId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: changeOrder,
          after: result,
        },
      });

      return result;
    }),

  /**
   * Get change order history.
   * Returns all field-level changes ordered chronologically.
   */
  getHistory: protectedProcedure
    .input(z.object({ changeOrderId: z.string().uuid() }))
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "ChangeOrder");

      // Get history
      const history = await db
        .select()
        .from(schema.changeOrderHistory)
        .where(eq(schema.changeOrderHistory.changeOrderId, input.changeOrderId))
        .orderBy(schema.changeOrderHistory.changedAt);

      return history;
    }),

  /**
   * Get approval workflow status.
   * Returns all approval steps with computed canCurrentUserApprove field.
   */
  getApprovalStatus: protectedProcedure
    .input(z.object({ changeOrderId: z.string().uuid() }))
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "ChangeOrder");

      // Get approval steps
      const steps = await db
        .select()
        .from(schema.approvalWorkflowSteps)
        .where(eq(schema.approvalWorkflowSteps.changeOrderId, input.changeOrderId))
        .orderBy(schema.approvalWorkflowSteps.stepOrder);

      // Find current pending step
      const currentPendingStep = steps.find(s => s.status === "pending");

      // Compute canCurrentUserApprove
      const normalizedRole = ctx.orgRole?.startsWith("org:") ? ctx.orgRole : `org:${ctx.orgRole}`;
      const stepsWithPermission = steps.map(step => ({
        ...step,
        canCurrentUserApprove:
          step.id === currentPendingStep?.id &&
          ((step.approverUserId && step.approverUserId === ctx.userId) ||
           (step.approverRole && step.approverRole === normalizedRole) ||
           (!step.approverUserId && !step.approverRole)),
      }));

      return stepsWithPermission;
    }),
});
