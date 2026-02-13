import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure, authorizedProcedure } from "../procedures.js";
import {
  reportDefinitionSchema,
  AuditAction,
  type ReportDefinition,
  reportFilterSchema,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, sql } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { executeReport, refreshMaterializedData } from "../../services/report-engine.js";
import {
  calculateCostPerformance,
  calculateBudgetVariance,
  projectCashFlow
} from "../../services/analytics-calculator.js";

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
 * Report management router.
 * Handles report CRUD, template usage, execution, analytics, and cache management.
 */
export const reportRouter = router({
  /**
   * List report definitions with optional filtering.
   */
  list: protectedProcedure
    .input(
      z.object({
        type: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const conditions = [];

      if (input.type) {
        conditions.push(eq(schema.reportDefinitions.type, input.type));
      }

      if (input.status) {
        conditions.push(eq(schema.reportDefinitions.status, input.status));
      }

      const reports = await db
        .select()
        .from(schema.reportDefinitions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.reportDefinitions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return reports;
    }),

  /**
   * Get report definition by ID.
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

      // Check read permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Report");

      const [report] = await db
        .select()
        .from(schema.reportDefinitions)
        .where(eq(schema.reportDefinitions.id, input.id))
        .limit(1);

      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found",
        });
      }

      return report;
    }),

  /**
   * Create a new report definition.
   */
  create: authorizedProcedure
    .input(reportDefinitionSchema.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("manage", "Report");

      // Insert report definition
      const [report] = await db
        .insert(schema.reportDefinitions)
        .values({
          name: input.name,
          description: input.description,
          type: input.type,
          dataSource: input.dataSource,
          filters: input.filters,
          columns: input.columns,
          sortBy: input.sortBy,
          groupBy: input.groupBy,
          chartConfig: input.chartConfig,
          status: "active",
          createdBy: ctx.userId,
        })
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "report_definition",
        entityId: report.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: { after: report },
      });

      return report;
    }),

  /**
   * Update an existing report definition.
   */
  update: authorizedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: reportDefinitionSchema.omit({ id: true }).partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("manage", "Report");

      // Get existing report
      const [existing] = await db
        .select()
        .from(schema.reportDefinitions)
        .where(eq(schema.reportDefinitions.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found",
        });
      }

      // Update report
      const updateData: any = { ...input.data };
      delete updateData.id;
      delete updateData.createdBy;
      delete updateData.createdAt;
      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(schema.reportDefinitions)
        .set(updateData)
        .where(eq(schema.reportDefinitions.id, input.id))
        .returning();

      // Delete cached data to force refresh
      await db
        .delete(schema.materializedReportData)
        .where(eq(schema.materializedReportData.reportDefinitionId, input.id));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "report_definition",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: { before: existing, after: updated },
      });

      return updated;
    }),

  /**
   * Delete a report definition.
   */
  delete: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("manage", "Report");

      // Get existing report for audit
      const [existing] = await db
        .select()
        .from(schema.reportDefinitions)
        .where(eq(schema.reportDefinitions.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found",
        });
      }

      // Delete report (cascades to schedules and materialized data)
      await db
        .delete(schema.reportDefinitions)
        .where(eq(schema.reportDefinitions.id, input.id));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "report_definition",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: { before: existing },
      });

      return { success: true };
    }),

  /**
   * Execute a report with optional cache refresh and filter overrides.
   */
  execute: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        forceRefresh: z.boolean().default(false),
        filters: z.array(reportFilterSchema).optional(),
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

      // Check read permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Report");

      // Get report definition
      const [reportDef] = await db
        .select()
        .from(schema.reportDefinitions)
        .where(eq(schema.reportDefinitions.id, input.id))
        .limit(1);

      if (!reportDef) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found",
        });
      }

      // Execute report
      const result = await executeReport(
        db,
        schema,
        reportDef as any,
        {
          forceRefresh: input.forceRefresh,
          filters: input.filters,
        }
      );

      return result;
    }),

  /**
   * List report templates.
   */
  listTemplates: protectedProcedure
    .input(
      z.object({
        type: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const conditions = [];

      if (input.type) {
        conditions.push(eq(schema.reportTemplates.type, input.type));
      }

      const templates = await db
        .select()
        .from(schema.reportTemplates)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          desc(schema.reportTemplates.isSystem),
          schema.reportTemplates.name
        );

      return templates;
    }),

  /**
   * Create a report from a template with optional customizations.
   */
  createFromTemplate: authorizedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        name: z.string().min(1).max(200),
        customizations: z
          .object({
            filters: z.array(reportFilterSchema).optional(),
            columns: z.any().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("manage", "Report");

      // Load template
      const [template] = await db
        .select()
        .from(schema.reportTemplates)
        .where(eq(schema.reportTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Merge customizations with template definition
      const definition = template.definition as any;
      const reportData = {
        name: input.name,
        description: template.description,
        type: template.type,
        dataSource: definition.dataSource ?? "projects",
        filters: input.customizations?.filters ?? definition.filters ?? [],
        columns: input.customizations?.columns ?? definition.columns ?? [],
        sortBy: definition.sortBy,
        groupBy: definition.groupBy,
        chartConfig: definition.chartConfig,
        status: "active" as const,
        createdBy: ctx.userId,
      };

      // Create report definition
      const [report] = await db
        .insert(schema.reportDefinitions)
        .values(reportData)
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "report_definition",
        entityId: report.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: { after: { ...report, fromTemplate: template.id } },
      });

      return report;
    }),

  /**
   * Get analytics for a project (cost performance and budget variance).
   */
  getAnalytics: protectedProcedure
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

      // Check read permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Budget");

      // Query budget totals
      const budgetTotals = await db
        .select({
          budgeted: sql<string>`COALESCE(SUM(${schema.budgetLineItems.budgetedAmount}), 0)`,
          actual: sql<string>`COALESCE(SUM(${schema.budgetLineItems.actualCost}), 0)`,
        })
        .from(schema.budgetLineItems)
        .where(eq(schema.budgetLineItems.projectId, input.projectId));

      // Query commitment totals
      const commitmentTotals = await db
        .select({
          committed: sql<string>`COALESCE(SUM(${schema.commitments.totalAmount}), 0)`,
        })
        .from(schema.commitments)
        .where(
          and(
            eq(schema.commitments.projectId, input.projectId),
            eq(schema.commitments.status, "executed")
          )
        );

      if (!budgetTotals || budgetTotals.length === 0) {
        return {
          costPerformance: null,
          budgetVariance: null,
        };
      }

      const budgetData = budgetTotals[0];
      const commitmentData = commitmentTotals[0] ?? { committed: "0" };

      const budgeted = parseFloat(budgetData.budgeted ?? "0");
      const committed = parseFloat(commitmentData.committed ?? "0");
      const actual = parseFloat(budgetData.actual ?? "0");

      // Calculate percent complete (using committed as proxy for earned value)
      const percentComplete = budgeted > 0 ? (committed / budgeted) * 100 : 0;

      // Calculate metrics
      const costPerformance = calculateCostPerformance(
        budgeted,
        committed,
        actual,
        percentComplete
      );

      const budgetVariance = calculateBudgetVariance(budgeted, committed, actual);

      return {
        costPerformance,
        budgetVariance,
      };
    }),

  /**
   * Get cash flow projection for a project.
   */
  getCashFlowProjection: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        periodType: z.enum(["monthly", "quarterly"]).default("monthly"),
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

      // Check read permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Budget");

      const projection = await projectCashFlow(
        db,
        schema,
        input.projectId,
        input.startDate,
        input.endDate,
        input.periodType
      );

      return projection;
    }),

  /**
   * Refresh materialized cache for reports.
   */
  refreshCache: authorizedProcedure
    .input(
      z.object({
        reportDefinitionId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("manage", "Report");

      const result = await refreshMaterializedData(
        db,
        schema,
        input.reportDefinitionId
      );

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "report_cache",
        entityId: input.reportDefinitionId ?? "all",
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          after: {
            refreshedCount: result.refreshedCount,
            deletedCount: result.deletedCount,
          },
        },
      });

      return {
        success: true,
        refreshedCount: result.refreshedCount,
        deletedCount: result.deletedCount,
      };
    }),
});
