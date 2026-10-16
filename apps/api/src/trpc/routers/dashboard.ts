import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { eq, and, sql, count, inArray } from "drizzle-orm";

/**
 * Dashboard router
 * Provides aggregation endpoints for dashboard KPI metrics
 * All queries aggregate at database level for performance
 */
export const dashboardRouter = router({
  /**
   * User-scoped: My active projects count and overdue count
   * Filter by userId via projectTeamMembers join
   */
  myActiveProjects: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { db, schema } = ctx.tenant;

    // Query active projects where user is a team member
    const result = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${schema.projects.id})`,
        overdueCount: sql<number>`COUNT(DISTINCT CASE
          WHEN ${schema.projects.endDate} < NOW()
            AND ${schema.projects.status} = 'active'
          THEN ${schema.projects.id}
        END)`,
      })
      .from(schema.projects)
      .innerJoin(
        schema.projectTeamMembers,
        eq(schema.projects.id, schema.projectTeamMembers.projectId)
      )
      .where(
        and(
          eq(schema.projectTeamMembers.userId, ctx.userId),
          eq(schema.projects.status, "active")
        )
      );

    return {
      count: Number(result[0]?.count ?? 0),
      overdueCount: Number(result[0]?.overdueCount ?? 0),
    };
  }),

  /**
   * User-scoped: My open bids count
   * Filter by userId via projectTeamMembers join
   */
  myOpenBids: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { db, schema } = ctx.tenant;

    // Query bids on projects where user is a team member
    const result = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${schema.bids.id})`,
      })
      .from(schema.bids)
      .innerJoin(
        schema.projectTeamMembers,
        eq(schema.bids.projectId, schema.projectTeamMembers.projectId)
      )
      .where(
        and(
          eq(schema.projectTeamMembers.userId, ctx.userId),
          inArray(schema.bids.status, ["submitted", "under_review", "shortlisted"])
        )
      );

    return {
      count: Number(result[0]?.count ?? 0),
    };
  }),

  /**
   * User-scoped: My pending action items count
   * Count pending approvals assigned to the current user across multiple sources
   */
  myTodo: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { db, schema } = ctx.tenant;

    // Count pending change order approvals
    const changeOrderResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.approvalWorkflowSteps)
      .where(
        and(
          eq(schema.approvalWorkflowSteps.approverUserId, ctx.userId),
          eq(schema.approvalWorkflowSteps.status, "pending")
        )
      );

    // Count pending workflow approvals (RFI, Submittal, Transmittal)
    const workflowResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.workflowApprovals)
      .where(
        and(
          eq(schema.workflowApprovals.approverUserId, ctx.userId),
          eq(schema.workflowApprovals.status, "pending")
        )
      );

    const changeOrders = Number(changeOrderResult[0]?.count ?? 0);
    const workflows = Number(workflowResult[0]?.count ?? 0);

    return {
      count: changeOrders + workflows,
      breakdown: {
        changeOrders,
        workflows,
      },
    };
  }),

  /**
   * Company-scoped: Total active projects count
   * No user filter, just tenant schema scope
   */
  totalActiveProjects: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { db, schema } = ctx.tenant;

    const result = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.projects)
      .where(eq(schema.projects.status, "active"));

    return {
      count: Number(result[0]?.count ?? 0),
    };
  }),

  /**
   * Company-scoped: Open bids count
   * Count bids with open status
   */
  openBids: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { db, schema } = ctx.tenant;

    const result = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.bids)
      .where(
        inArray(schema.bids.status, ["submitted", "under_review", "shortlisted"])
      );

    return {
      count: Number(result[0]?.count ?? 0),
    };
  }),

  /**
   * Company-scoped: Bid opportunities count
   * Count bids still open (draft or submitted)
   */
  bidOpportunities: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { db, schema } = ctx.tenant;

    const result = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.bids)
      .where(inArray(schema.bids.status, ["draft", "submitted"]));

    return {
      count: Number(result[0]?.count ?? 0),
    };
  }),

  /**
   * Company-scoped: Revenue in progress
   * Sum budgeted amounts for all active projects
   */
  revenueInProgress: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { db, schema } = ctx.tenant;

    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.budgetLineItems.budgetedAmount}), 0)`,
      })
      .from(schema.budgetLineItems)
      .innerJoin(
        schema.projects,
        eq(schema.budgetLineItems.projectId, schema.projects.id)
      )
      .where(eq(schema.projects.status, "active"));

    return {
      total: parseFloat(result[0]?.total ?? "0"),
    };
  }),

  /**
   * Company-scoped: Backlog
   * Total committed but unearned revenue: sum of commitments minus sum of completed work
   */
  backlog: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    const { db, schema } = ctx.tenant;

    // Sum of approved/executed commitments for active projects
    const commitmentsResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.commitments.totalAmount}), 0)`,
      })
      .from(schema.commitments)
      .innerJoin(
        schema.projects,
        eq(schema.commitments.projectId, schema.projects.id)
      )
      .where(
        and(
          eq(schema.projects.status, "active"),
          inArray(schema.commitments.status, ["approved", "executed"])
        )
      );

    const committed = parseFloat(commitmentsResult[0]?.total ?? "0");
    const completed = 0;

    return {
      total: Math.max(0, committed - completed),
    };
  }),

  /**
   * Company-scoped: Estimating pipeline value
   * Placeholder for Phase 17-18 - always returns 0
   */
  estimatingPipeline: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Tenant context missing",
      });
    }

    // Placeholder - no database query needed
    return {
      total: 0,
      hasEstimatingModule: false,
    };
  }),
});
