import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, sql, isNull } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import type { ARAgingReport, APAgingReport, AgingBucket } from "@construction/shared";

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
 * Invoice tracking router (read-only).
 * Generates AR/AP aging reports, payment history, and cash flow summaries.
 */
export const invoiceTrackingRouter = router({
  /**
   * Generate AR aging report.
   * Shows outstanding receivables (approved unpaid payment apps) grouped into 30-day buckets.
   */
  getARAgingReport: protectedProcedure
    .input(
      z.object({
        asOfDate: z.string().datetime().optional(),
        projectId: z.string().uuid().optional(),
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();

      // Build WHERE conditions
      let whereClause = sql`pa.status = 'approved' AND pa.paid_at IS NULL`;
      if (input.projectId) {
        whereClause = sql`${whereClause} AND pa.project_id = ${input.projectId}`;
      }

      // Query using PostgreSQL EXTRACT and CASE for efficient bucket calculation
      const agingData = await db.execute<{
        aging_bucket: number;
        invoice_count: string;
        total_amount: string;
        project_id?: string;
        project_name?: string;
      }>(sql`
        WITH payment_app_aging AS (
          SELECT
            pa.id,
            pa.application_number,
            p.id AS project_id,
            p.name AS project_name,
            pa.current_payment_due,
            pa.approved_at,
            EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) AS days_outstanding,
            CASE
              WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) <= 30 THEN 1
              WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) <= 60 THEN 2
              WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) <= 90 THEN 3
              WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) <= 120 THEN 4
              ELSE 5
            END AS aging_bucket
          FROM ${schema.paymentApps} pa
          INNER JOIN ${schema.projects} p ON p.id = pa.project_id
          WHERE ${whereClause}
        )
        SELECT
          aging_bucket,
          COUNT(*) AS invoice_count,
          SUM(current_payment_due) AS total_amount,
          project_id,
          project_name
        FROM payment_app_aging
        GROUP BY aging_bucket, project_id, project_name
        ORDER BY aging_bucket
      `);

      // Transform to report format
      const buckets: AgingBucket = {
        current: 0,
        days31_60: 0,
        days61_90: 0,
        days91_120: 0,
        days120Plus: 0,
      };

      const byProject = new Map<string, {
        projectId: string;
        projectName: string;
        buckets: AgingBucket;
        total: number;
      }>();

      for (const row of agingData.rows) {
        const amount = Number(row.total_amount);
        const bucket = Number(row.aging_bucket);

        // Update overall buckets
        switch (bucket) {
          case 1:
            buckets.current += amount;
            break;
          case 2:
            buckets.days31_60 += amount;
            break;
          case 3:
            buckets.days61_90 += amount;
            break;
          case 4:
            buckets.days91_120 += amount;
            break;
          case 5:
            buckets.days120Plus += amount;
            break;
        }

        // Update project-level buckets
        if (row.project_id && row.project_name) {
          if (!byProject.has(row.project_id)) {
            byProject.set(row.project_id, {
              projectId: row.project_id,
              projectName: row.project_name,
              buckets: {
                current: 0,
                days31_60: 0,
                days61_90: 0,
                days91_120: 0,
                days120Plus: 0,
              },
              total: 0,
            });
          }

          const projectData = byProject.get(row.project_id)!;
          switch (bucket) {
            case 1:
              projectData.buckets.current += amount;
              break;
            case 2:
              projectData.buckets.days31_60 += amount;
              break;
            case 3:
              projectData.buckets.days61_90 += amount;
              break;
            case 4:
              projectData.buckets.days91_120 += amount;
              break;
            case 5:
              projectData.buckets.days120Plus += amount;
              break;
          }
          projectData.total += amount;
        }
      }

      const totalOutstanding =
        buckets.current +
        buckets.days31_60 +
        buckets.days61_90 +
        buckets.days91_120 +
        buckets.days120Plus;

      const report: ARAgingReport = {
        asOfDate: asOfDate.toISOString(),
        totalOutstanding,
        buckets,
        byProject: Array.from(byProject.values()),
      };

      return report;
    }),

  /**
   * Generate AP aging report.
   * Shows outstanding payables (approved unpaid commitments) grouped by vendor and 30-day buckets.
   */
  getAPAgingReport: protectedProcedure
    .input(
      z.object({
        asOfDate: z.string().datetime().optional(),
        projectId: z.string().uuid().optional(),
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();

      // Build WHERE conditions
      // Note: Using approvedAt for commitments; if not available in schema, createdAt is fallback
      // The commitments table has approvedAt field per schema review
      let whereClause = sql`c.status IN ('approved', 'executed')`;
      if (input.projectId) {
        whereClause = sql`${whereClause} AND c.project_id = ${input.projectId}`;
      }

      // Query using PostgreSQL EXTRACT and CASE for efficient bucket calculation
      const agingData = await db.execute<{
        vendor_name: string;
        aging_bucket: number;
        total_amount: string;
      }>(sql`
        WITH commitment_aging AS (
          SELECT
            c.id,
            c.vendor_name,
            c.total_amount,
            c.approved_at,
            EXTRACT(DAY FROM (${asOfDate}::timestamp - COALESCE(c.approved_at, c.created_at))) AS days_outstanding,
            CASE
              WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - COALESCE(c.approved_at, c.created_at))) <= 30 THEN 1
              WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - COALESCE(c.approved_at, c.created_at))) <= 60 THEN 2
              WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - COALESCE(c.approved_at, c.created_at))) <= 90 THEN 3
              WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - COALESCE(c.approved_at, c.created_at))) <= 120 THEN 4
              ELSE 5
            END AS aging_bucket
          FROM ${schema.commitments} c
          WHERE ${whereClause}
        )
        SELECT
          vendor_name,
          aging_bucket,
          SUM(total_amount) AS total_amount
        FROM commitment_aging
        GROUP BY vendor_name, aging_bucket
        ORDER BY vendor_name, aging_bucket
      `);

      // Transform to report format
      const buckets: AgingBucket = {
        current: 0,
        days31_60: 0,
        days61_90: 0,
        days91_120: 0,
        days120Plus: 0,
      };

      const byVendor = new Map<string, {
        vendorName: string;
        buckets: AgingBucket;
        total: number;
      }>();

      for (const row of agingData.rows) {
        const amount = Number(row.total_amount);
        const bucket = Number(row.aging_bucket);
        const vendorName = row.vendor_name;

        // Update overall buckets
        switch (bucket) {
          case 1:
            buckets.current += amount;
            break;
          case 2:
            buckets.days31_60 += amount;
            break;
          case 3:
            buckets.days61_90 += amount;
            break;
          case 4:
            buckets.days91_120 += amount;
            break;
          case 5:
            buckets.days120Plus += amount;
            break;
        }

        // Update vendor-level buckets
        if (!byVendor.has(vendorName)) {
          byVendor.set(vendorName, {
            vendorName,
            buckets: {
              current: 0,
              days31_60: 0,
              days61_90: 0,
              days91_120: 0,
              days120Plus: 0,
            },
            total: 0,
          });
        }

        const vendorData = byVendor.get(vendorName)!;
        switch (bucket) {
          case 1:
            vendorData.buckets.current += amount;
            break;
          case 2:
            vendorData.buckets.days31_60 += amount;
            break;
          case 3:
            vendorData.buckets.days61_90 += amount;
            break;
          case 4:
            vendorData.buckets.days91_120 += amount;
            break;
          case 5:
            vendorData.buckets.days120Plus += amount;
            break;
        }
        vendorData.total += amount;
      }

      const totalOutstanding =
        buckets.current +
        buckets.days31_60 +
        buckets.days61_90 +
        buckets.days91_120 +
        buckets.days120Plus;

      const report: APAgingReport = {
        asOfDate: asOfDate.toISOString(),
        totalOutstanding,
        buckets,
        byVendor: Array.from(byVendor.values()),
      };

      return report;
    }),

  /**
   * Get payment history for a project.
   * Returns all payment apps with cumulative totals.
   */
  getPaymentHistory: protectedProcedure
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

      // Get all payment apps for project, ordered by application number
      const paymentApps = await db
        .select({
          id: schema.paymentApps.id,
          applicationNumber: schema.paymentApps.applicationNumber,
          periodStart: schema.paymentApps.periodStart,
          periodEnd: schema.paymentApps.periodEnd,
          status: schema.paymentApps.status,
          currentPaymentDue: schema.paymentApps.currentPaymentDue,
          retainageAmount: schema.paymentApps.retainageAmount,
          totalCompletedAndStored: schema.paymentApps.totalCompletedAndStored,
          submittedAt: schema.paymentApps.submittedAt,
          approvedAt: schema.paymentApps.approvedAt,
          paidAt: schema.paymentApps.paidAt,
        })
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.projectId, input.projectId))
        .orderBy(schema.paymentApps.applicationNumber);

      // Calculate cumulative totals
      let cumulativePayments = 0;
      let cumulativeRetainage = 0;

      const history = paymentApps.map((app) => {
        const currentPayment = Number(app.currentPaymentDue);
        const retainage = Number(app.retainageAmount);

        if (app.status === "approved" || app.status === "paid") {
          cumulativePayments += currentPayment;
          cumulativeRetainage += retainage;
        }

        return {
          id: app.id,
          applicationNumber: app.applicationNumber,
          periodStart: app.periodStart,
          periodEnd: app.periodEnd,
          status: app.status,
          currentPaymentDue: currentPayment,
          retainageAmount: retainage,
          totalCompletedAndStored: Number(app.totalCompletedAndStored),
          cumulativePayments,
          cumulativeRetainage,
          submittedAt: app.submittedAt,
          approvedAt: app.approvedAt,
          paidAt: app.paidAt,
        };
      });

      return history;
    }),

  /**
   * Get cash flow summary for a project or company-wide.
   * Shows receivables, payables, net position, and retainage held.
   */
  getCashFlowSummary: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "PaymentApp");

      // Build WHERE conditions
      const projectCondition = input.projectId
        ? sql`AND project_id = ${input.projectId}`
        : sql``;

      // Total receivable: sum of approved unpaid payment apps
      const receivableResult = await db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(current_payment_due), 0) AS total
        FROM ${schema.paymentApps}
        WHERE status = 'approved' AND paid_at IS NULL
        ${projectCondition}
      `);
      const totalReceivable = Number(receivableResult.rows[0]?.total || 0);

      // Total payable: sum of approved/executed unpaid commitments
      const payableResult = await db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM ${schema.commitments}
        WHERE status IN ('approved', 'executed')
        ${projectCondition}
      `);
      const totalPayable = Number(payableResult.rows[0]?.total || 0);

      // Total retainage held
      const retainageResult = await db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(amount_held), 0) AS total
        FROM ${schema.retainageHeld}
        WHERE status = 'held'
        ${projectCondition}
      `);
      const totalRetainageHeld = Number(retainageResult.rows[0]?.total || 0);

      // Overdue receivable (> 30 days)
      const overdueReceivableResult = await db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(current_payment_due), 0) AS total
        FROM ${schema.paymentApps}
        WHERE status = 'approved' AND paid_at IS NULL
          AND EXTRACT(DAY FROM (NOW() - approved_at)) > 30
        ${projectCondition}
      `);
      const overdueReceivable = Number(overdueReceivableResult.rows[0]?.total || 0);

      // Overdue payable (> 30 days)
      const overduePayableResult = await db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM ${schema.commitments}
        WHERE status IN ('approved', 'executed')
          AND EXTRACT(DAY FROM (NOW() - COALESCE(approved_at, created_at))) > 30
        ${projectCondition}
      `);
      const overduePayable = Number(overduePayableResult.rows[0]?.total || 0);

      const netCashPosition = totalReceivable - totalPayable;

      return {
        totalReceivable,
        totalPayable,
        netCashPosition,
        totalRetainageHeld,
        overdueReceivable,
        overduePayable,
      };
    }),
});
