import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createPaymentAppSchema,
  submitPaymentAppSchema,
  approveRejectPaymentAppSchema,
  markPaymentAppPaidSchema,
  AuditAction,
  VALID_PAYMENT_APP_STATUS_TRANSITIONS,
  type PaymentAppStatus,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, sql, isNull, inArray } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { calculateLineItemAmounts, calculatePaymentAppTotals } from "../../calculations/payment-app.js";
import { getCurrentRetainageRate } from "../../calculations/retainage.js";

/**
 * Load project-level abilities for the current user.
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

  return defineAbilitiesFor(ctx.orgRole ?? "org:member", ctx.userId, memberships);
}

/**
 * Get next payment application number with SELECT FOR UPDATE.
 * Format: PAY-YYYY-NNN
 */
async function getNextPaymentAppNumber(
  db: any,
  schema: any,
  projectId: string
): Promise<string> {
  const year = new Date().getFullYear();

  return await db.transaction(async (tx: any) => {
    const [counter] = await tx
      .select()
      .from(schema.paymentAppCounters)
      .where(
        and(
          eq(schema.paymentAppCounters.projectId, projectId),
          eq(schema.paymentAppCounters.year, year)
        )
      )
      .for("update");

    let nextNumber: number;
    if (!counter) {
      await tx.insert(schema.paymentAppCounters).values({
        projectId,
        year,
        lastNumber: 1,
      });
      nextNumber = 1;
    } else {
      nextNumber = counter.lastNumber + 1;
      await tx
        .update(schema.paymentAppCounters)
        .set({ lastNumber: nextNumber })
        .where(eq(schema.paymentAppCounters.id, counter.id));
    }

    return `PAY-${year}-${String(nextNumber).padStart(3, "0")}`;
  });
}

/**
 * Payment application management router.
 * Handles creation, approval workflow, and budget updates.
 */
export const paymentAppRouter = router({
  /**
   * Create payment application from SOV line items.
   * Auto-calculates G702 totals, retainage, and populates previous percent complete.
   */
  create: protectedProcedure
    .input(createPaymentAppSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Verify project exists
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Check if SOV items exist
      const [sovCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId));

      if (Number(sovCount?.count ?? 0) === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No SOV items found. Create SOV items before creating payment applications.",
        });
      }

      // Validate all SOV items exist and belong to project
      const sovItemIds = input.lineItems.map((item) => item.sovItemId);
      const sovItems = await db
        .select()
        .from(schema.sovItems)
        .where(
          and(
            eq(schema.sovItems.projectId, input.projectId),
            inArray(schema.sovItems.id, sovItemIds)
          )
        );

      if (sovItems.length !== sovItemIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Some SOV items not found or do not belong to project",
        });
      }

      // Get most recent approved payment app for previous percent complete
      const [previousPaymentApp] = await db
        .select()
        .from(schema.paymentApps)
        .where(
          and(
            eq(schema.paymentApps.projectId, input.projectId),
            eq(schema.paymentApps.status, "approved")
          )
        )
        .orderBy(desc(schema.paymentApps.approvedAt))
        .limit(1);

      // Build previous percent complete map
      const previousPercentMap = new Map<string, number>();
      if (previousPaymentApp) {
        const previousLineItems = await db
          .select()
          .from(schema.paymentAppLineItems)
          .where(eq(schema.paymentAppLineItems.paymentAppId, previousPaymentApp.id));

        for (const item of previousLineItems) {
          previousPercentMap.set(item.sovItemId, Number(item.currentPercentComplete));
        }
      }

      // Get retainage config from company profile
      const [companyProfile] = await db
        .select({
          retainageConfig: schema.companyProfiles.retainageConfig,
        })
        .from(schema.companyProfiles)
        .where(isNull(schema.companyProfiles.validTo))
        .limit(1);

      const retainageConfig = companyProfile?.retainageConfig ?? {
        defaultRate: 10,
        progressiveRates: [],
        releaseConditions: {
          substantialCompletion: true,
          punchListComplete: false,
          finalAcceptance: false,
          lienWaiversRequired: true,
        },
      };

      // Calculate project completion percentage for retainage rate
      const [sovTotal] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${schema.sovItems.scheduledValue}::numeric), 0)`,
        })
        .from(schema.sovItems)
        .where(eq(schema.sovItems.projectId, input.projectId));

      const scheduledValueTotal = Number(sovTotal?.total ?? "0");

      // Calculate current completion based on input line items
      const currentCompletionValue = input.lineItems.reduce((sum, item) => {
        const sovItem = sovItems.find((sov) => sov.id === item.sovItemId);
        if (!sovItem) return sum;
        const scheduledValue = Number(sovItem.scheduledValue);
        const completionValue = (item.currentPercentComplete / 100) * scheduledValue;
        return sum + completionValue;
      }, 0);

      const projectCompletionPercent =
        scheduledValueTotal > 0 ? (currentCompletionValue / scheduledValueTotal) * 100 : 0;

      const retainageRate = getCurrentRetainageRate(retainageConfig, projectCompletionPercent);

      // Calculate line item amounts
      const calculatedLineItems = input.lineItems.map((item) => {
        const sovItem = sovItems.find((sov) => sov.id === item.sovItemId)!;
        const scheduledValue = Number(sovItem.scheduledValue);
        const previousPercent = previousPercentMap.get(item.sovItemId) ?? 0;

        // Validate current percent >= previous percent
        if (item.currentPercentComplete < previousPercent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `SOV item ${sovItem.itemNumber}: current percent complete (${item.currentPercentComplete}%) cannot be less than previous (${previousPercent}%)`,
          });
        }

        const amounts = calculateLineItemAmounts(
          scheduledValue,
          previousPercent,
          item.currentPercentComplete,
          item.materialsStoredThisPeriod ?? 0,
          retainageRate
        );

        return {
          sovItemId: item.sovItemId,
          previousPercentComplete: previousPercent.toFixed(2),
          currentPercentComplete: item.currentPercentComplete.toFixed(2),
          ...amounts,
        };
      });

      // Get original contract sum (sum of SOV scheduled values)
      const originalContractSum = scheduledValueTotal;

      // Get net change from approved change orders
      const [changeOrderTotal] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${schema.changeOrders.totalAmount}::numeric), 0)`,
        })
        .from(schema.changeOrders)
        .where(
          and(
            eq(schema.changeOrders.projectId, input.projectId),
            eq(schema.changeOrders.status, "approved")
          )
        );

      const netChangeByChangeOrders = Number(changeOrderTotal?.total ?? "0");

      // Get previous payments
      const [previousPayments] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${schema.paymentApps.currentPaymentDue}::numeric), 0)`,
        })
        .from(schema.paymentApps)
        .where(
          and(
            eq(schema.paymentApps.projectId, input.projectId),
            eq(schema.paymentApps.status, "approved")
          )
        );

      const previousPaymentsTotal = Number(previousPayments?.total ?? "0");

      // Calculate payment app totals
      const totals = calculatePaymentAppTotals(
        originalContractSum,
        netChangeByChangeOrders,
        previousPaymentsTotal,
        calculatedLineItems
      );

      // Generate application number
      const applicationNumber = await getNextPaymentAppNumber(db, schema, input.projectId);

      // Create payment app and line items in transaction
      const result = await db.transaction(async (tx: any) => {
        const [paymentApp] = await tx
          .insert(schema.paymentApps)
          .values({
            projectId: input.projectId,
            applicationNumber,
            periodStart: new Date(input.periodStart),
            periodEnd: new Date(input.periodEnd),
            originalContractSum: originalContractSum.toFixed(2),
            netChangeByChangeOrders: netChangeByChangeOrders.toFixed(2),
            contractSumToDate: totals.contractSumToDate.toFixed(2),
            totalCompletedAndStored: totals.totalCompletedAndStored.toFixed(2),
            retainageAmount: totals.retainageAmount.toFixed(2),
            totalEarnedLessRetainage: totals.totalEarnedLessRetainage.toFixed(2),
            previousPayments: previousPaymentsTotal.toFixed(2),
            currentPaymentDue: totals.currentPaymentDue.toFixed(2),
            balanceToFinish: totals.balanceToFinish.toFixed(2),
            status: "draft",
            createdBy: userId,
          })
          .returning();

        // Insert line items
        const lineItemsValues = calculatedLineItems.map((item) => ({
          paymentAppId: paymentApp.id,
          ...item,
        }));

        await tx.insert(schema.paymentAppLineItems).values(lineItemsValues);

        // Create retainage held record
        await tx.insert(schema.retainageHeld).values({
          projectId: input.projectId,
          paymentAppId: paymentApp.id,
          amountHeld: totals.retainageAmount.toFixed(2),
          retainageRate: retainageRate.toFixed(2),
          status: "held",
        });

        // Audit log
        await createAuditLog(db, schema, {
          action: AuditAction.CREATE,
          entityType: "payment_app",
          entityId: paymentApp.id,
          actorId: userId,
          changes: { after: paymentApp },
        });

        return paymentApp;
      });

      return result;
    }),

  /**
   * List payment applications for a project.
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.string().optional(),
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

      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      const conditions = [eq(schema.paymentApps.projectId, input.projectId)];

      if (input.status) {
        conditions.push(eq(schema.paymentApps.status, input.status));
      }

      const paymentApps = await db
        .select()
        .from(schema.paymentApps)
        .where(and(...conditions))
        .orderBy(desc(schema.paymentApps.createdAt));

      // Bulk query pending approval steps (single query, not per-row)
      const pendingSteps = paymentApps.length > 0
        ? await db
            .select()
            .from(schema.paymentAppApprovalSteps)
            .where(
              and(
                inArray(schema.paymentAppApprovalSteps.paymentAppId, paymentApps.map(pa => pa.id)),
                eq(schema.paymentAppApprovalSteps.status, "pending")
              )
            )
        : [];

      // Compute normalizedRole once before the map (not per-row)
      const normalizedRole = ctx.orgRole?.startsWith("org:") ? ctx.orgRole : `org:${ctx.orgRole}`;

      // Build map: first pending step per pay app (keyed by paymentAppId)
      const pendingStepMap = new Map<string, typeof pendingSteps[number]>();
      for (const step of pendingSteps) {
        if (!pendingStepMap.has(step.paymentAppId)) {
          pendingStepMap.set(step.paymentAppId, step);
        }
      }

      return paymentApps.map(pa => {
        const pendingStep = pendingStepMap.get(pa.id);
        const canCurrentUserApprove = pendingStep
          ? (pendingStep.approverUserId === ctx.userId) ||
            (!!pendingStep.approverRole && pendingStep.approverRole === normalizedRole) ||
            (!pendingStep.approverUserId && !pendingStep.approverRole)
          : false;
        return { ...pa, canCurrentUserApprove };
      });
    }),

  /**
   * Get payment application by ID with line items.
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

      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      const [paymentApp] = await db
        .select()
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.id, input.id))
        .limit(1);

      if (!paymentApp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment application not found",
        });
      }

      // Get line items with SOV details
      const lineItems = await db
        .select({
          id: schema.paymentAppLineItems.id,
          paymentAppId: schema.paymentAppLineItems.paymentAppId,
          sovItemId: schema.paymentAppLineItems.sovItemId,
          previousPercentComplete: schema.paymentAppLineItems.previousPercentComplete,
          currentPercentComplete: schema.paymentAppLineItems.currentPercentComplete,
          workCompletedThisPeriod: schema.paymentAppLineItems.workCompletedThisPeriod,
          materialsStoredThisPeriod: schema.paymentAppLineItems.materialsStoredThisPeriod,
          totalCompletedAndStored: schema.paymentAppLineItems.totalCompletedAndStored,
          retainagePercent: schema.paymentAppLineItems.retainagePercent,
          retainageAmount: schema.paymentAppLineItems.retainageAmount,
          sovItemNumber: schema.sovItems.itemNumber,
          sovDescription: schema.sovItems.description,
          sovScheduledValue: schema.sovItems.scheduledValue,
        })
        .from(schema.paymentAppLineItems)
        .innerJoin(
          schema.sovItems,
          eq(schema.sovItems.id, schema.paymentAppLineItems.sovItemId)
        )
        .where(eq(schema.paymentAppLineItems.paymentAppId, input.id))
        .orderBy(schema.sovItems.orderIndex);

      // Get approval steps
      const approvalSteps = await db
        .select()
        .from(schema.paymentAppApprovalSteps)
        .where(eq(schema.paymentAppApprovalSteps.paymentAppId, input.id))
        .orderBy(schema.paymentAppApprovalSteps.stepOrder);

      // Get retainage held
      const [retainage] = await db
        .select()
        .from(schema.retainageHeld)
        .where(eq(schema.retainageHeld.paymentAppId, input.id))
        .limit(1);

      return {
        ...paymentApp,
        lineItems,
        approvalSteps,
        retainage,
      };
    }),

  /**
   * Submit payment application for approval.
   * Creates approval workflow steps.
   */
  submit: protectedProcedure
    .input(submitPaymentAppSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Get payment app
      const [paymentApp] = await db
        .select()
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.id, input.paymentAppId))
        .limit(1);

      if (!paymentApp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment application not found",
        });
      }

      // Validate status is draft or rejected
      if (paymentApp.status !== "draft" && paymentApp.status !== "rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot submit payment app with status: ${paymentApp.status}`,
        });
      }

      // Create approval steps and update status in transaction
      await db.transaction(async (tx: any) => {
        // Insert approval steps
        const stepsValues = input.approvalSteps.map((step) => ({
          paymentAppId: input.paymentAppId,
          stepOrder: step.stepOrder,
          approverRole: step.approverRole ?? null,
          approverUserId: step.approverUserId ?? null,
          requirementType: step.requirementType,
          status: "pending",
        }));

        await tx.insert(schema.paymentAppApprovalSteps).values(stepsValues);

        // Update payment app status
        await tx
          .update(schema.paymentApps)
          .set({
            status: "submitted",
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.paymentApps.id, input.paymentAppId));

        // Audit log
        await createAuditLog(db, schema, {
          action: AuditAction.UPDATE,
          entityType: "payment_app",
          entityId: input.paymentAppId,
          actorId: userId,
          changes: {
            before: { status: paymentApp.status },
            after: { status: "submitted", approvalStepsCount: input.approvalSteps.length },
          },
        });
      });

      return { success: true };
    }),

  /**
   * Approve payment application.
   * Final approval atomically updates budget actuals.
   */
  approve: protectedProcedure
    .input(approveRejectPaymentAppSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("approve", "PaymentApp");

      // Get payment app
      const [paymentApp] = await db
        .select()
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.id, input.paymentAppId))
        .limit(1);

      if (!paymentApp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment application not found",
        });
      }

      // Validate status
      if (paymentApp.status !== "submitted" && paymentApp.status !== "under_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot approve payment app with status: ${paymentApp.status}`,
        });
      }

      // Get approval steps
      const approvalSteps = await db
        .select()
        .from(schema.paymentAppApprovalSteps)
        .where(eq(schema.paymentAppApprovalSteps.paymentAppId, input.paymentAppId))
        .orderBy(schema.paymentAppApprovalSteps.stepOrder);

      if (approvalSteps.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No approval steps found for this payment app",
        });
      }

      // Find first pending step
      const pendingStep = approvalSteps.find((step) => step.status === "pending");

      if (!pendingStep) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending approval steps",
        });
      }

      // Validate user can approve this step
      const userOrgRole = ctx.orgRole ?? "org:member";

      if (pendingStep.requirementType === "specific") {
        if (pendingStep.approverUserId !== userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the specific approver can approve this step",
          });
        }
      } else if (pendingStep.approverRole) {
        if (userOrgRole !== pendingStep.approverRole) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Only users with role ${pendingStep.approverRole} can approve this step`,
          });
        }
      }

      // Mark step as approved
      await db
        .update(schema.paymentAppApprovalSteps)
        .set({
          status: "approved",
          approvedBy: userId,
          approvedAt: new Date(),
          comments: input.comments ?? null,
        })
        .where(eq(schema.paymentAppApprovalSteps.id, pendingStep.id));

      // Check if all steps are now approved
      const updatedSteps = await db
        .select()
        .from(schema.paymentAppApprovalSteps)
        .where(eq(schema.paymentAppApprovalSteps.paymentAppId, input.paymentAppId));

      const allApproved = updatedSteps.every((step) => step.status === "approved");

      if (allApproved) {
        // Final approval - update budget actuals atomically
        await db.transaction(async (tx: any) => {
          // Get payment app line items with budget references
          const lineItems = await tx
            .select({
              id: schema.paymentAppLineItems.id,
              sovItemId: schema.paymentAppLineItems.sovItemId,
              workCompletedThisPeriod: schema.paymentAppLineItems.workCompletedThisPeriod,
              materialsStoredThisPeriod: schema.paymentAppLineItems.materialsStoredThisPeriod,
              budgetLineItemId: schema.sovItems.budgetLineItemId,
            })
            .from(schema.paymentAppLineItems)
            .innerJoin(
              schema.sovItems,
              eq(schema.sovItems.id, schema.paymentAppLineItems.sovItemId)
            )
            .where(eq(schema.paymentAppLineItems.paymentAppId, input.paymentAppId));

          // Update budget actuals and lock line items
          // This implements PYMT-06: approved payment apps update budget actualCost
          for (const lineItem of lineItems) {
            if (lineItem.budgetLineItemId) {
              // Calculate actual cost for this payment period (work this period + materials stored)
              const actualCostThisPeriod =
                Number(lineItem.workCompletedThisPeriod) +
                Number(lineItem.materialsStoredThisPeriod);

              // Increment actualCost atomically using SQL expression (prevents race conditions)
              await tx
                .update(schema.budgetLineItems)
                .set({
                  actualCost: sql`${schema.budgetLineItems.actualCost} + ${actualCostThisPeriod}`,
                  isLocked: true,
                  lockedAt: new Date(),
                  lockedBy: userId,
                  updatedAt: new Date(),
                })
                .where(eq(schema.budgetLineItems.id, lineItem.budgetLineItemId));
            }
          }

          // Update payment app status to approved
          await tx
            .update(schema.paymentApps)
            .set({
              status: "approved",
              approvedAt: new Date(),
              approvedBy: userId,
              updatedAt: new Date(),
            })
            .where(eq(schema.paymentApps.id, input.paymentAppId));

          // Audit log approval and budget updates
          await createAuditLog(db, schema, {
            action: AuditAction.FINANCIAL_CHANGE,
            entityType: "payment_app_approval",
            entityId: input.paymentAppId,
            actorId: userId,
            changes: {
              before: { status: paymentApp.status },
              after: {
                status: "approved",
                budgetLineItemsUpdated: lineItems.filter((item: any) => item.budgetLineItemId).length,
              },
            },
          });
        });
      } else {
        // More steps remain - update to under_review if currently submitted
        if (paymentApp.status === "submitted") {
          await db
            .update(schema.paymentApps)
            .set({
              status: "under_review",
              updatedAt: new Date(),
            })
            .where(eq(schema.paymentApps.id, input.paymentAppId));
        }

        // Audit log step approval
        await createAuditLog(db, schema, {
          action: AuditAction.UPDATE,
          entityType: "payment_app_step_approval",
          entityId: input.paymentAppId,
          actorId: userId,
          changes: {
            after: {
              stepOrder: pendingStep.stepOrder,
              approvedBy: userId,
              remainingSteps: updatedSteps.filter((s) => s.status === "pending").length,
            },
          },
        });
      }

      return { success: true, allApproved };
    }),

  /**
   * Reject payment application.
   */
  reject: protectedProcedure
    .input(approveRejectPaymentAppSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("approve", "PaymentApp");

      // Get payment app
      const [paymentApp] = await db
        .select()
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.id, input.paymentAppId))
        .limit(1);

      if (!paymentApp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment application not found",
        });
      }

      // Validate status
      if (paymentApp.status !== "submitted" && paymentApp.status !== "under_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot reject payment app with status: ${paymentApp.status}`,
        });
      }

      // Get first pending step and mark as rejected
      const approvalSteps = await db
        .select()
        .from(schema.paymentAppApprovalSteps)
        .where(eq(schema.paymentAppApprovalSteps.paymentAppId, input.paymentAppId))
        .orderBy(schema.paymentAppApprovalSteps.stepOrder);

      const pendingStep = approvalSteps.find((step) => step.status === "pending");

      if (pendingStep) {
        await db
          .update(schema.paymentAppApprovalSteps)
          .set({
            status: "rejected",
            approvedBy: userId,
            approvedAt: new Date(),
            comments: input.comments ?? null,
          })
          .where(eq(schema.paymentAppApprovalSteps.id, pendingStep.id));

        // Skip remaining pending steps
        const remainingPendingSteps = approvalSteps.filter(
          (step) => step.status === "pending" && step.id !== pendingStep.id
        );

        if (remainingPendingSteps.length > 0) {
          await db
            .update(schema.paymentAppApprovalSteps)
            .set({ status: "skipped" })
            .where(
              inArray(
                schema.paymentAppApprovalSteps.id,
                remainingPendingSteps.map((s) => s.id)
              )
            );
        }
      }

      // Update payment app status to rejected
      await db
        .update(schema.paymentApps)
        .set({
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(eq(schema.paymentApps.id, input.paymentAppId));

      // Audit log
      await createAuditLog(db, schema, {
        action: AuditAction.UPDATE,
        entityType: "payment_app_rejection",
        entityId: input.paymentAppId,
        actorId: userId,
        changes: {
          before: { status: paymentApp.status },
          after: { status: "rejected", comments: input.comments },
        },
      });

      return { success: true };
    }),

  /**
   * Mark payment application as paid.
   */
  markPaid: protectedProcedure
    .input(markPaymentAppPaidSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Get payment app
      const [paymentApp] = await db
        .select()
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.id, input.paymentAppId))
        .limit(1);

      if (!paymentApp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment application not found",
        });
      }

      // Validate status is approved
      if (paymentApp.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only approved payment applications can be marked as paid",
        });
      }

      const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

      // Update status
      await db
        .update(schema.paymentApps)
        .set({
          status: "paid",
          paidAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.paymentApps.id, input.paymentAppId));

      // Audit log
      await createAuditLog(db, schema, {
        action: AuditAction.UPDATE,
        entityType: "payment_app",
        entityId: input.paymentAppId,
        actorId: userId,
        changes: {
          before: { status: "approved" },
          after: { status: "paid", paidAt },
        },
      });

      return { success: true };
    }),

  /**
   * Get approval status for a payment application.
   */
  getApprovalStatus: protectedProcedure
    .input(z.object({ paymentAppId: z.string().uuid() }))
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

      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      const steps = await db
        .select()
        .from(schema.paymentAppApprovalSteps)
        .where(eq(schema.paymentAppApprovalSteps.paymentAppId, input.paymentAppId))
        .orderBy(schema.paymentAppApprovalSteps.stepOrder);

      // Determine if current user can approve current pending step
      const pendingStep = steps.find((step) => step.status === "pending");
      let canCurrentUserApprove = false;

      if (pendingStep) {
        const userOrgRole = ctx.orgRole ?? "org:member";

        if (pendingStep.requirementType === "specific") {
          canCurrentUserApprove = pendingStep.approverUserId === ctx.userId;
        } else if (pendingStep.approverRole) {
          canCurrentUserApprove = userOrgRole === pendingStep.approverRole;
        } else {
          canCurrentUserApprove = true;
        }
      }

      return {
        steps,
        canCurrentUserApprove,
        currentPendingStep: pendingStep ?? null,
      };
    }),

  /**
   * Get payment application summary for project dashboard.
   */
  getSummary: protectedProcedure
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

      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      // Count by status
      const [counts] = await db
        .select({
          draft: sql<number>`COUNT(*) FILTER (WHERE ${schema.paymentApps.status} = 'draft')`,
          submitted: sql<number>`COUNT(*) FILTER (WHERE ${schema.paymentApps.status} = 'submitted')`,
          underReview: sql<number>`COUNT(*) FILTER (WHERE ${schema.paymentApps.status} = 'under_review')`,
          approved: sql<number>`COUNT(*) FILTER (WHERE ${schema.paymentApps.status} = 'approved')`,
          rejected: sql<number>`COUNT(*) FILTER (WHERE ${schema.paymentApps.status} = 'rejected')`,
          paid: sql<number>`COUNT(*) FILTER (WHERE ${schema.paymentApps.status} = 'paid')`,
        })
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.projectId, input.projectId));

      // Sum amounts by status
      const [amounts] = await db
        .select({
          totalApproved: sql<string>`COALESCE(SUM(${schema.paymentApps.currentPaymentDue}::numeric) FILTER (WHERE ${schema.paymentApps.status} = 'approved'), 0)`,
          totalPending: sql<string>`COALESCE(SUM(${schema.paymentApps.currentPaymentDue}::numeric) FILTER (WHERE ${schema.paymentApps.status} IN ('submitted', 'under_review')), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(${schema.paymentApps.currentPaymentDue}::numeric) FILTER (WHERE ${schema.paymentApps.status} = 'paid'), 0)`,
        })
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.projectId, input.projectId));

      return {
        counts: {
          draft: Number(counts?.draft ?? 0),
          submitted: Number(counts?.submitted ?? 0),
          underReview: Number(counts?.underReview ?? 0),
          approved: Number(counts?.approved ?? 0),
          rejected: Number(counts?.rejected ?? 0),
          paid: Number(counts?.paid ?? 0),
        },
        amounts: {
          totalApproved: Number(amounts?.totalApproved ?? "0"),
          totalPending: Number(amounts?.totalPending ?? "0"),
          totalPaid: Number(amounts?.totalPaid ?? "0"),
        },
      };
    }),

  /**
   * Get retainage tracking for project.
   */
  getRetainage: protectedProcedure
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

      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      // Get all retainage held records with payment app details
      const retainageRecords = await db
        .select({
          id: schema.retainageHeld.id,
          projectId: schema.retainageHeld.projectId,
          paymentAppId: schema.retainageHeld.paymentAppId,
          amountHeld: schema.retainageHeld.amountHeld,
          retainageRate: schema.retainageHeld.retainageRate,
          status: schema.retainageHeld.status,
          releasedAmount: schema.retainageHeld.releasedAmount,
          releasedAt: schema.retainageHeld.releasedAt,
          releasedBy: schema.retainageHeld.releasedBy,
          releaseNotes: schema.retainageHeld.releaseNotes,
          createdAt: schema.retainageHeld.createdAt,
          applicationNumber: schema.paymentApps.applicationNumber,
          paymentAppStatus: schema.paymentApps.status,
        })
        .from(schema.retainageHeld)
        .innerJoin(
          schema.paymentApps,
          eq(schema.paymentApps.id, schema.retainageHeld.paymentAppId)
        )
        .where(eq(schema.retainageHeld.projectId, input.projectId))
        .orderBy(desc(schema.retainageHeld.createdAt));

      // Calculate totals
      const totalHeld = retainageRecords.reduce(
        (sum, record) => sum + Number(record.amountHeld) - Number(record.releasedAmount ?? "0"),
        0
      );

      const totalReleased = retainageRecords.reduce(
        (sum, record) => sum + Number(record.releasedAmount ?? "0"),
        0
      );

      const totalEligibleForRelease = retainageRecords
        .filter((record) => record.status === "eligible_for_release")
        .reduce((sum, record) => sum + Number(record.amountHeld) - Number(record.releasedAmount ?? "0"), 0);

      return {
        records: retainageRecords,
        totals: {
          totalHeld,
          totalReleased,
          totalEligibleForRelease,
        },
      };
    }),

  /**
   * Release retainage.
   */
  releaseRetainage: protectedProcedure
    .input(
      z.object({
        retainageId: z.string().uuid(),
        amount: z.number().positive(),
        notes: z.string().optional(),
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
      const userId = ctx.userId;

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("manage", "PaymentApp");

      // Get retainage record
      const [retainage] = await db
        .select()
        .from(schema.retainageHeld)
        .where(eq(schema.retainageHeld.id, input.retainageId))
        .limit(1);

      if (!retainage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Retainage record not found",
        });
      }

      // Validate status
      if (retainage.status !== "held" && retainage.status !== "eligible_for_release") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot release retainage with status: ${retainage.status}`,
        });
      }

      // Validate amount
      const amountHeld = Number(retainage.amountHeld);
      const alreadyReleased = Number(retainage.releasedAmount ?? "0");
      const availableToRelease = amountHeld - alreadyReleased;

      if (input.amount > availableToRelease) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot release ${input.amount}. Available: ${availableToRelease}`,
        });
      }

      const newReleasedAmount = alreadyReleased + input.amount;
      const isFullyReleased = newReleasedAmount >= amountHeld;

      // Update retainage record
      await db
        .update(schema.retainageHeld)
        .set({
          releasedAmount: newReleasedAmount.toFixed(2),
          releasedAt: new Date(),
          releasedBy: userId,
          releaseNotes: input.notes ?? null,
          status: isFullyReleased ? "released" : retainage.status,
        })
        .where(eq(schema.retainageHeld.id, input.retainageId));

      // Audit log
      await createAuditLog(db, schema, {
        action: AuditAction.FINANCIAL_CHANGE,
        entityType: "retainage_release",
        entityId: input.retainageId,
        actorId: userId,
        changes: {
          before: { releasedAmount: alreadyReleased, status: retainage.status },
          after: {
            releasedAmount: newReleasedAmount,
            status: isFullyReleased ? "released" : retainage.status,
            amountReleased: input.amount,
          },
        },
      });

      return { success: true };
    }),
});
