import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createWorkflowSchema,
  submitWorkflowSchema,
  reviewApprovalSchema,
  respondToWorkflowSchema,
  updateWorkflowSchema,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";

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
 * Generate the next sequential workflow number with SELECT FOR UPDATE locking.
 * Prevents race conditions under concurrent requests.
 *
 * @param db - Drizzle database instance
 * @param workflowCounters - Workflow counters table from tenant schema
 * @param projectId - Project UUID
 * @param workflowType - Type: rfi, submittal, transmittal
 * @returns Formatted number like "RFI-001", "SUB-024", "TX-012"
 */
async function getNextWorkflowNumber(
  db: any,
  workflowCounters: any,
  projectId: string,
  workflowType: string
): Promise<string> {
  return await db.transaction(async (tx: any) => {
    // Use raw SQL for SELECT FOR UPDATE
    const counterResult = await tx.execute(
      sql`SELECT id, current_number FROM ${workflowCounters}
          WHERE project_id = ${projectId}
          AND workflow_type = ${workflowType}
          FOR UPDATE`
    );

    let nextNumber: number;
    const rows = counterResult.rows as any[];

    if (!rows || rows.length === 0) {
      // First workflow of this type for this project — insert counter
      await tx.insert(workflowCounters).values({
        projectId,
        workflowType,
        currentNumber: 1,
      });
      nextNumber = 1;
    } else {
      nextNumber = rows[0].current_number + 1;
      await tx
        .update(workflowCounters)
        .set({ currentNumber: nextNumber })
        .where(eq(workflowCounters.id, rows[0].id));
    }

    // Format workflow number
    const prefixMap: Record<string, string> = {
      rfi: "RFI",
      submittal: "SUB",
      transmittal: "TX",
    };
    const prefix = prefixMap[workflowType] || workflowType.toUpperCase();
    return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
  });
}

/**
 * Document workflow management router.
 * Handles RFI, Submittal, and Transmittal workflows with multi-step approval process.
 */
export const workflowRouter = router({
  /**
   * Create a new document workflow with approval steps.
   * Generates sequential workflow number (RFI-001, SUB-024, TX-012).
   */
  create: protectedProcedure
    .input(createWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Fetch document to get projectId
      const [document] = await db
        .select({ id: schema.documents.id, projectId: schema.documents.projectId })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.documentId))
        .limit(1);

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Document");

      // Generate workflow number and create workflow + approval steps in transaction
      const result = await db.transaction(async (tx: any) => {
        // Generate sequential workflow number with SELECT FOR UPDATE
        const workflowNumber = await getNextWorkflowNumber(
          tx,
          schema.workflowCounters,
          document.projectId,
          input.workflowType
        );

        // Insert workflow
        const [workflow] = await tx
          .insert(schema.documentWorkflows)
          .values({
            documentId: input.documentId,
            workflowType: input.workflowType,
            workflowNumber,
            projectId: document.projectId,
            title: input.title,
            description: input.description ?? null,
            priority: input.priority ?? "medium",
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            status: "draft",
            createdBy: userId,
          })
          .returning();

        // Insert approval steps
        const approvalSteps = await tx
          .insert(schema.workflowApprovals)
          .values(
            input.approvalSteps.map((step) => ({
              workflowId: workflow.id,
              stepNumber: step.stepNumber,
              approverUserId: step.approverUserId ?? null,
              approverRole: step.approverRole ?? null,
              requirementType: step.requirementType,
              status: "pending",
            }))
          )
          .returning();

        // Insert workflow history: created
        await tx.insert(schema.workflowHistory).values({
          workflowId: workflow.id,
          changedBy: userId,
          fromStatus: null,
          toStatus: "draft",
          comment: "Workflow created",
        });

        return { workflow, approvalSteps };
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "DocumentWorkflow",
        entityId: result.workflow.id,
        action: AuditAction.CREATE,
        actorId: userId,
        changes: {
          after: {
            workflowNumber: result.workflow.workflowNumber,
            workflowType: result.workflow.workflowType,
            title: result.workflow.title,
          },
        },
      });

      return {
        id: result.workflow.id,
        workflowNumber: result.workflow.workflowNumber,
        ...result.workflow,
      };
    }),

  /**
   * Submit a draft workflow to start approval process.
   * Transitions: draft → submitted
   */
  submit: protectedProcedure
    .input(submitWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Fetch workflow
      const [workflow] = await db
        .select()
        .from(schema.documentWorkflows)
        .where(eq(schema.documentWorkflows.id, input.workflowId))
        .limit(1);

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Check if user is creator OR has update permission on Workflow
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Creator can submit their own workflows
      if (workflow.createdBy !== userId) {
        ForbiddenError.from(abilities).throwUnlessCan("update", "Workflow");
      }

      // Validate status is "draft"
      if (workflow.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot submit workflow with status "${workflow.status}". Only drafts can be submitted.`,
        });
      }

      // Update workflow and record history in transaction
      const updated = await db.transaction(async (tx: any) => {
        // Update workflow status
        const [updatedWorkflow] = await tx
          .update(schema.documentWorkflows)
          .set({
            status: "submitted",
            submittedBy: userId,
            submittedAt: new Date(),
          })
          .where(eq(schema.documentWorkflows.id, input.workflowId))
          .returning();

        // Insert workflow history
        await tx.insert(schema.workflowHistory).values({
          workflowId: input.workflowId,
          changedBy: userId,
          fromStatus: "draft",
          toStatus: "submitted",
          comment: "Workflow submitted for approval",
        });

        return updatedWorkflow;
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "DocumentWorkflow",
        entityId: input.workflowId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          before: { status: "draft" },
          after: { status: "submitted" },
        },
      });

      return updated;
    }),

  /**
   * Approve or reject an approval step.
   * Auto-advances workflow status based on approval outcomes.
   */
  reviewApproval: protectedProcedure
    .input(reviewApprovalSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Fetch approval step with workflow
      const [approval] = await db
        .select({
          id: schema.workflowApprovals.id,
          workflowId: schema.workflowApprovals.workflowId,
          stepNumber: schema.workflowApprovals.stepNumber,
          approverUserId: schema.workflowApprovals.approverUserId,
          approverRole: schema.workflowApprovals.approverRole,
          requirementType: schema.workflowApprovals.requirementType,
          status: schema.workflowApprovals.status,
          workflowStatus: schema.documentWorkflows.status,
          workflowProjectId: schema.documentWorkflows.projectId,
        })
        .from(schema.workflowApprovals)
        .innerJoin(
          schema.documentWorkflows,
          eq(schema.workflowApprovals.workflowId, schema.documentWorkflows.id)
        )
        .where(eq(schema.workflowApprovals.id, input.approvalId))
        .limit(1);

      if (!approval) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approval step not found",
        });
      }

      // Verify workflow is in valid state for approval
      if (approval.workflowStatus !== "submitted" && approval.workflowStatus !== "under_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot review approval for workflow with status "${approval.workflowStatus}"`,
        });
      }

      // Check if user can approve this step
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Get user's project role
      const [userMembership] = await db
        .select({ role: schema.projectTeamMembers.role })
        .from(schema.projectTeamMembers)
        .where(
          and(
            eq(schema.projectTeamMembers.userId, userId),
            eq(schema.projectTeamMembers.projectId, approval.workflowProjectId)
          )
        )
        .limit(1);

      const userProjectRole = userMembership?.role;

      // Validate user can approve this step based on requirementType
      if (approval.requirementType === "specific_user") {
        if (approval.approverUserId !== userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the specified user can approve this step",
          });
        }
      } else if (
        approval.requirementType === "any_with_role" ||
        approval.requirementType === "all_with_role"
      ) {
        if (userProjectRole !== approval.approverRole) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Only users with role "${approval.approverRole}" can approve this step`,
          });
        }
      }

      // Update approval and potentially workflow status in transaction
      const result = await db.transaction(async (tx: any) => {
        // Update approval step
        const [updatedApproval] = await tx
          .update(schema.workflowApprovals)
          .set({
            status: input.action === "approve" ? "approved" : "rejected",
            reviewedBy: userId,
            reviewedAt: new Date(),
            comments: input.comments ?? null,
          })
          .where(eq(schema.workflowApprovals.id, input.approvalId))
          .returning();

        // Determine new workflow status
        let newWorkflowStatus = approval.workflowStatus;

        if (input.action === "reject") {
          // Any rejection transitions workflow to "rejected"
          newWorkflowStatus = "rejected";
        } else if (input.action === "approve") {
          // Check if all steps are now approved
          const allSteps: Array<{ status: string | null }> = await tx
            .select({ status: schema.workflowApprovals.status })
            .from(schema.workflowApprovals)
            .where(eq(schema.workflowApprovals.workflowId, approval.workflowId));

          const allApproved = allSteps.every((s) => s.status === "approved");
          const anyRejected = allSteps.some((s) => s.status === "rejected");

          if (anyRejected) {
            newWorkflowStatus = "rejected";
          } else if (allApproved) {
            newWorkflowStatus = "approved";
          } else {
            // At least one approval in, but not all — mark as under_review
            newWorkflowStatus = "under_review";
          }
        }

        // Update workflow status if changed
        let updatedWorkflow = null;
        if (newWorkflowStatus !== approval.workflowStatus) {
          [updatedWorkflow] = await tx
            .update(schema.documentWorkflows)
            .set({ status: newWorkflowStatus })
            .where(eq(schema.documentWorkflows.id, approval.workflowId))
            .returning();

          // Record workflow history for status change
          await tx.insert(schema.workflowHistory).values({
            workflowId: approval.workflowId,
            changedBy: userId,
            fromStatus: approval.workflowStatus,
            toStatus: newWorkflowStatus,
            comment: `Workflow ${input.action === "approve" ? "approved" : "rejected"} by ${userId}`,
          });
        }

        // Record approval action in history
        await tx.insert(schema.workflowHistory).values({
          workflowId: approval.workflowId,
          changedBy: userId,
          fromStatus: null,
          toStatus: approval.workflowStatus,
          fieldName: `approval_step_${approval.stepNumber}`,
          comment: input.comments ?? `Step ${approval.stepNumber} ${input.action}ed`,
        });

        return { updatedApproval, updatedWorkflow };
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "DocumentWorkflow",
        entityId: approval.workflowId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: {
            approvalStep: approval.stepNumber,
            action: input.action,
            comments: input.comments,
          },
        },
      });

      return result.updatedWorkflow || result.updatedApproval;
    }),

  /**
   * Attach a response document to a workflow.
   * Used for formal responses to RFIs, Submittals, etc.
   */
  respond: protectedProcedure
    .input(respondToWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Fetch workflow
      const [workflow] = await db
        .select()
        .from(schema.documentWorkflows)
        .where(eq(schema.documentWorkflows.id, input.workflowId))
        .limit(1);

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Workflow");

      // Verify response document exists and belongs to same project
      const [responseDoc] = await db
        .select({ id: schema.documents.id, projectId: schema.documents.projectId })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.responseDocumentId))
        .limit(1);

      if (!responseDoc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Response document not found",
        });
      }

      if (responseDoc.projectId !== workflow.projectId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Response document must belong to the same project as the workflow",
        });
      }

      // Update workflow in transaction
      const updated = await db.transaction(async (tx: any) => {
        // Determine new status: if approved, close it
        const newStatus = workflow.status === "approved" ? "closed" : workflow.status;

        // Update workflow
        const [updatedWorkflow] = await tx
          .update(schema.documentWorkflows)
          .set({
            responseDocumentId: input.responseDocumentId,
            respondedBy: userId,
            respondedAt: new Date(),
            status: newStatus,
          })
          .where(eq(schema.documentWorkflows.id, input.workflowId))
          .returning();

        // Record history
        await tx.insert(schema.workflowHistory).values({
          workflowId: input.workflowId,
          changedBy: userId,
          fromStatus: workflow.status,
          toStatus: newStatus,
          fieldName: "responseDocumentId",
          comment: input.comments ?? "Response document attached",
        });

        return updatedWorkflow;
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "DocumentWorkflow",
        entityId: input.workflowId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: {
            responseDocumentId: input.responseDocumentId,
          },
        },
      });

      return updated;
    }),

  /**
   * List workflows for a project with optional filters.
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        workflowType: z.enum(["rfi", "submittal", "transmittal"]).optional(),
        status: z.string().optional(),
        limit: z.number().int().positive().default(50),
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

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Workflow");

      // Build where conditions
      const conditions = [eq(schema.documentWorkflows.projectId, input.projectId)];
      if (input.workflowType) {
        conditions.push(eq(schema.documentWorkflows.workflowType, input.workflowType));
      }
      if (input.status) {
        conditions.push(eq(schema.documentWorkflows.status, input.status));
      }

      // Query workflows with metadata
      const workflows = await db
        .select({
          id: schema.documentWorkflows.id,
          documentId: schema.documentWorkflows.documentId,
          workflowType: schema.documentWorkflows.workflowType,
          workflowNumber: schema.documentWorkflows.workflowNumber,
          title: schema.documentWorkflows.title,
          description: schema.documentWorkflows.description,
          priority: schema.documentWorkflows.priority,
          status: schema.documentWorkflows.status,
          dueDate: schema.documentWorkflows.dueDate,
          submittedBy: schema.documentWorkflows.submittedBy,
          submittedAt: schema.documentWorkflows.submittedAt,
          respondedBy: schema.documentWorkflows.respondedBy,
          respondedAt: schema.documentWorkflows.respondedAt,
          createdBy: schema.documentWorkflows.createdBy,
          createdAt: schema.documentWorkflows.createdAt,
        })
        .from(schema.documentWorkflows)
        .where(and(...conditions))
        .orderBy(desc(schema.documentWorkflows.createdAt))
        .limit(input.limit);

      // Get approval step status summary for each workflow
      const workflowIds = workflows.map((w) => w.id);
      const approvalSummaries = workflowIds.length > 0
        ? await db
            .select({
              workflowId: schema.workflowApprovals.workflowId,
              status: schema.workflowApprovals.status,
            })
            .from(schema.workflowApprovals)
            .where(inArray(schema.workflowApprovals.workflowId, workflowIds))
        : [];

      // Build summary map
      const summaryMap = new Map<
        string,
        { pending: number; approved: number; rejected: number }
      >();
      for (const approval of approvalSummaries) {
        if (!summaryMap.has(approval.workflowId)) {
          summaryMap.set(approval.workflowId, { pending: 0, approved: 0, rejected: 0 });
        }
        const summary = summaryMap.get(approval.workflowId)!;
        if (approval.status === "pending") summary.pending++;
        else if (approval.status === "approved") summary.approved++;
        else if (approval.status === "rejected") summary.rejected++;
      }

      // Return workflows with approval summary
      return workflows.map((workflow) => ({
        ...workflow,
        approvalSummary: summaryMap.get(workflow.id) || {
          pending: 0,
          approved: 0,
          rejected: 0,
        },
      }));
    }),

  /**
   * Get detailed workflow by ID with approval steps and computed fields.
   */
  getById: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch workflow
      const [workflow] = await db
        .select()
        .from(schema.documentWorkflows)
        .where(eq(schema.documentWorkflows.id, input.workflowId))
        .limit(1);

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Workflow");

      // Fetch approval steps
      const approvalSteps = await db
        .select()
        .from(schema.workflowApprovals)
        .where(eq(schema.workflowApprovals.workflowId, input.workflowId))
        .orderBy(schema.workflowApprovals.stepNumber);

      // Fetch document
      const [document] = await db
        .select({ id: schema.documents.id, name: schema.documents.name })
        .from(schema.documents)
        .where(eq(schema.documents.id, workflow.documentId))
        .limit(1);

      // Fetch response document if exists
      let responseDocument = null;
      if (workflow.responseDocumentId) {
        const [doc] = await db
          .select({ id: schema.documents.id, name: schema.documents.name })
          .from(schema.documents)
          .where(eq(schema.documents.id, workflow.responseDocumentId))
          .limit(1);
        responseDocument = doc || null;
      }

      // Compute canCurrentUserApprove
      const [userMembership] = await db
        .select({ role: schema.projectTeamMembers.role })
        .from(schema.projectTeamMembers)
        .where(
          and(
            eq(schema.projectTeamMembers.userId, ctx.userId),
            eq(schema.projectTeamMembers.projectId, workflow.projectId)
          )
        )
        .limit(1);

      const userProjectRole = userMembership?.role;

      const canCurrentUserApprove = approvalSteps.some((step) => {
        if (step.status !== "pending") return false;

        if (step.requirementType === "specific_user") {
          return step.approverUserId === ctx.userId;
        } else if (
          step.requirementType === "any_with_role" ||
          step.requirementType === "all_with_role"
        ) {
          return step.approverRole === userProjectRole;
        }

        return false;
      });

      return {
        ...workflow,
        document,
        responseDocument,
        approvalSteps,
        canCurrentUserApprove,
      };
    }),

  /**
   * Get workflow history for audit trail.
   */
  getHistory: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch workflow to verify it exists
      const [workflow] = await db
        .select({ projectId: schema.documentWorkflows.projectId })
        .from(schema.documentWorkflows)
        .where(eq(schema.documentWorkflows.id, input.workflowId))
        .limit(1);

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Workflow");

      // Query workflow history with user names
      const history = await db
        .select({
          id: schema.workflowHistory.id,
          workflowId: schema.workflowHistory.workflowId,
          changedBy: schema.workflowHistory.changedBy,
          changedAt: schema.workflowHistory.changedAt,
          fromStatus: schema.workflowHistory.fromStatus,
          toStatus: schema.workflowHistory.toStatus,
          fieldName: schema.workflowHistory.fieldName,
          comment: schema.workflowHistory.comment,
          userFirstName: schema.userProfiles.firstName,
          userLastName: schema.userProfiles.lastName,
          userEmail: schema.userProfiles.email,
        })
        .from(schema.workflowHistory)
        .leftJoin(
          schema.userProfiles,
          eq(schema.workflowHistory.changedBy, schema.userProfiles.clerkUserId)
        )
        .where(eq(schema.workflowHistory.workflowId, input.workflowId))
        .orderBy(desc(schema.workflowHistory.changedAt));

      // Transform to include user name
      return history.map((entry) => ({
        id: entry.id,
        workflowId: entry.workflowId,
        changedBy: entry.changedBy,
        changedByName:
          entry.userFirstName && entry.userLastName
            ? `${entry.userFirstName} ${entry.userLastName}`
            : entry.userEmail || entry.changedBy,
        changedAt: entry.changedAt,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        fieldName: entry.fieldName,
        comment: entry.comment,
      }));
    }),

  /**
   * Update a draft workflow.
   * Only drafts can be edited.
   */
  update: protectedProcedure
    .input(updateWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Fetch workflow
      const [workflow] = await db
        .select()
        .from(schema.documentWorkflows)
        .where(eq(schema.documentWorkflows.id, input.workflowId))
        .limit(1);

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Workflow");

      // Validate status is "draft"
      if (workflow.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot edit workflow with status "${workflow.status}". Only drafts can be edited.`,
        });
      }

      // Track changed fields for history
      const changes: Record<string, { from: any; to: any }> = {};
      const updates: any = {};

      if (input.title !== undefined && input.title !== workflow.title) {
        changes.title = { from: workflow.title, to: input.title };
        updates.title = input.title;
      }
      if (input.description !== undefined && input.description !== workflow.description) {
        changes.description = { from: workflow.description, to: input.description };
        updates.description = input.description;
      }
      if (input.priority !== undefined && input.priority !== workflow.priority) {
        changes.priority = { from: workflow.priority, to: input.priority };
        updates.priority = input.priority;
      }
      if (input.dueDate !== undefined) {
        const newDueDate = input.dueDate ? new Date(input.dueDate) : null;
        const oldDueDate = workflow.dueDate;
        if (
          (newDueDate === null && oldDueDate !== null) ||
          (newDueDate !== null && oldDueDate === null) ||
          (newDueDate !== null &&
            oldDueDate !== null &&
            newDueDate.getTime() !== oldDueDate.getTime())
        ) {
          changes.dueDate = { from: oldDueDate, to: newDueDate };
          updates.dueDate = newDueDate;
        }
      }
      if (input.status !== undefined && input.status !== workflow.status) {
        changes.status = { from: workflow.status, to: input.status };
        updates.status = input.status;
      }

      // If no changes, return existing workflow
      if (Object.keys(updates).length === 0) {
        return workflow;
      }

      // Update workflow and record history in transaction
      const updated = await db.transaction(async (tx: any) => {
        // Update workflow
        const [updatedWorkflow] = await tx
          .update(schema.documentWorkflows)
          .set(updates)
          .where(eq(schema.documentWorkflows.id, input.workflowId))
          .returning();

        // Insert history entries for each changed field
        for (const [fieldName, change] of Object.entries(changes)) {
          await tx.insert(schema.workflowHistory).values({
            workflowId: input.workflowId,
            changedBy: userId,
            fromStatus: workflow.status,
            toStatus: updates.status || workflow.status,
            fieldName,
            comment: `${fieldName} changed from ${JSON.stringify(change.from)} to ${JSON.stringify(change.to)}`,
          });
        }

        return updatedWorkflow;
      });

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "DocumentWorkflow",
        entityId: input.workflowId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          before: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v.from])
          ),
          after: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v.to])
          ),
        },
      });

      return updated;
    }),
});
