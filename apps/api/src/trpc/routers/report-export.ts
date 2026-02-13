import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { AuditLogger } from "../../audit/logger.js";
import { AuditAction } from "@construction/shared";
import { exportReport } from "../../services/report-exporter.js";
import { executeReport } from "../../services/report-engine.js";
import type { ExportFormat, ReportExportOptions as ServiceExportOptions } from "../../services/report-exporter.js";
import { exportFormatEnum, type ReportDefinition, type ReportData } from "@construction/shared";

/**
 * Report export router - handles PDF, Excel, and CSV exports
 */
export const reportExportRouter = router({
  /**
   * Export a report by ID
   * Loads report definition, executes query, and generates export file
   */
  export: protectedProcedure
    .input(
      z.object({
        reportId: z.string().uuid(),
        format: exportFormatEnum,
        options: z.object({
          pageOrientation: z.enum(["portrait", "landscape"]).optional(),
          paperSize: z.enum(["letter", "legal", "a4"]).optional(),
          includeCharts: z.boolean().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Permission check - user must be able to read reports
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId ?? ""
      );
      if (!abilities.can("read", "Report")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to export reports",
        });
      }

      const { reportId, format, options } = input;

      // Load report definition from database
      const reportDefResult = await ctx.tenant.db
        .select()
        .from(ctx.tenant.schema.reportDefinitions)
        .where(eq(ctx.tenant.schema.reportDefinitions.id, reportId))
        .limit(1);

      if (reportDefResult.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report definition not found",
        });
      }

      const reportDef = reportDefResult[0];

      // Execute report to get data
      const executionResult = await executeReport(
        ctx.tenant.db,
        ctx.tenant.schema,
        reportDef as any,
        { forceRefresh: false }
      );

      // Transform execution result to ReportData format
      const reportData: ReportData = {
        rows: executionResult.data as Record<string, any>[],
        metadata: {
          generatedAt: executionResult.metadata.generatedAt,
          rowCount: executionResult.metadata.rowCount,
          executionTime: executionResult.metadata.executionTime,
          fromCache: executionResult.metadata.fromCache,
          filtersApplied: reportDef.filters as any,
        },
      };

      // Generate export file
      const exportResult = await exportReport(
        reportData,
        reportDef as any,
        format as ExportFormat,
        options as ServiceExportOptions
      );

      // Calculate expiry (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Audit log the export
      const logger = new AuditLogger(ctx.tenant.db, ctx.tenant.schema);
      await logger.log({
        entityType: "Report",
        entityId: reportId,
        action: AuditAction.CREATE,
        actorId: ctx.userId ?? "",
        changes: {},
        metadata: {
          action: "export",
          format,
          filename: exportResult.filename,
          size: exportResult.size,
        },
      });

      return {
        downloadUrl: `/api/reports/download/${exportResult.filename}`,
        filename: exportResult.filename,
        expiresAt: expiresAt.toISOString(),
      };
    }),

  /**
   * Export report with provided data (ad-hoc exports)
   * For custom/one-off exports without saving report definition
   */
  exportWithData: protectedProcedure
    .input(
      z.object({
        reportData: z.object({
          rows: z.array(z.record(z.unknown())),
          metadata: z.object({
            filtersApplied: z.record(z.unknown()).optional(),
          }).optional(),
        }),
        reportDefinition: z.object({
          name: z.string(),
          description: z.string().optional(),
          columns: z.array(z.object({
            field: z.string(),
            label: z.string(),
            format: z.string().optional(),
          })),
          chartConfig: z.object({
            chartType: z.string(),
            xAxis: z.string(),
            yAxis: z.string(),
          }).optional(),
        }),
        format: exportFormatEnum,
        options: z.object({
          pageOrientation: z.enum(["portrait", "landscape"]).optional(),
          paperSize: z.enum(["letter", "legal", "a4"]).optional(),
          includeCharts: z.boolean().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Permission check
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId ?? ""
      );
      if (!abilities.can("read", "Report")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to export reports",
        });
      }

      const { reportData, reportDefinition, format, options } = input;

      // Generate export file
      const exportResult = await exportReport(
        reportData as ReportData,
        reportDefinition as unknown as ReportDefinition,
        format as ExportFormat,
        options as ServiceExportOptions
      );

      // Calculate expiry (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Audit log the export
      const logger = new AuditLogger(ctx.tenant.db, ctx.tenant.schema);
      await logger.log({
        entityType: "Report",
        entityId: "ad-hoc",
        action: AuditAction.CREATE,
        actorId: ctx.userId ?? "",
        changes: {},
        metadata: {
          action: "export",
          format,
          reportName: reportDefinition.name,
          filename: exportResult.filename,
          size: exportResult.size,
        },
      });

      return {
        downloadUrl: `/api/reports/download/${exportResult.filename}`,
        filename: exportResult.filename,
        expiresAt: expiresAt.toISOString(),
      };
    }),

  /**
   * Check if export file still exists and get metadata
   */
  getExportStatus: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const fs = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");

      const REPORTS_TEMP_DIR = process.env.REPORTS_TEMP_DIR || path.join(os.tmpdir(), 'construction-reports');
      const filePath = path.join(REPORTS_TEMP_DIR, input.filename);

      try {
        const stats = await fs.stat(filePath);

        // Calculate expiry based on file modification time (24 hours)
        const expiresAt = new Date(stats.mtimeMs + 24 * 60 * 60 * 1000);

        return {
          exists: true,
          size: stats.size,
          expiresAt: expiresAt.toISOString(),
        };
      } catch (error) {
        return {
          exists: false,
          size: 0,
          expiresAt: new Date().toISOString(),
        };
      }
    }),
});
