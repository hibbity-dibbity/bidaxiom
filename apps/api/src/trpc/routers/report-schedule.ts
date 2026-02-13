/**
 * Report Schedule tRPC Router
 *
 * CRUD operations for scheduled report delivery.
 * Manages automated report generation and email distribution.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ForbiddenError } from '@casl/ability';
import { eq, and, desc } from 'drizzle-orm';
import {
  scheduleFrequencyEnum,
  exportFormatEnum,
  createReportScheduleSchema,
  updateReportScheduleSchema,
  AuditAction,
} from '@construction/shared';
import { router } from '../trpc.js';
import { protectedProcedure, authorizedProcedure } from '../procedures.js';
import { calculateNextRun } from '../../services/report-scheduler.js';
import { scheduledReportsQueue } from '../../jobs/scheduled-reports.js';
import { createAuditLog } from '../../audit/logger.js';

/**
 * Report Schedule Router
 *
 * Procedures:
 * - list: Query schedules with optional filtering
 * - getById: Get single schedule with report definition
 * - create: Create new schedule with auto-calculated nextRunAt
 * - update: Update schedule and recalculate nextRunAt if needed
 * - delete: Delete schedule and remove pending jobs
 * - toggleActive: Activate or deactivate schedule
 * - runNow: Manually trigger immediate report delivery
 */
export const reportScheduleRouter = router({
  /**
   * List report schedules with optional filtering.
   */
  list: protectedProcedure
    .input(
      z.object({
        reportDefinitionId: z.string().uuid().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, schema } = ctx.tenant;

      // Build where conditions
      const conditions = [];
      if (input.reportDefinitionId) {
        conditions.push(eq(schema.reportSchedules.reportDefinitionId, input.reportDefinitionId));
      }
      if (input.isActive !== undefined) {
        conditions.push(eq(schema.reportSchedules.isActive, input.isActive));
      }

      // Query schedules with report definition names
      const schedules = await db
        .select({
          schedule: schema.reportSchedules,
          reportName: schema.reportDefinitions.name,
        })
        .from(schema.reportSchedules)
        .leftJoin(
          schema.reportDefinitions,
          eq(schema.reportSchedules.reportDefinitionId, schema.reportDefinitions.id)
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(schema.reportSchedules.nextRunAt);

      return schedules.map(({ schedule, reportName }) => ({
        ...schedule,
        reportName,
      }));
    }),

  /**
   * Get schedule by ID with full report definition.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, schema } = ctx.tenant;

      const [result] = await db
        .select({
          schedule: schema.reportSchedules,
          reportDefinition: schema.reportDefinitions,
        })
        .from(schema.reportSchedules)
        .leftJoin(
          schema.reportDefinitions,
          eq(schema.reportSchedules.reportDefinitionId, schema.reportDefinitions.id)
        )
        .where(eq(schema.reportSchedules.id, input.id))
        .limit(1);

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      return result;
    }),

  /**
   * Create new report schedule.
   */
  create: authorizedProcedure
    .input(createReportScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tenant context missing',
        });
      }

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan('manage', 'Report');

      const { db, schema, userId, tenantId } = ctx.tenant;

      // Verify report definition exists
      const [reportDefinition] = await db
        .select()
        .from(schema.reportDefinitions)
        .where(eq(schema.reportDefinitions.id, input.reportDefinitionId))
        .limit(1);

      if (!reportDefinition) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Report definition not found',
        });
      }

      // Validate inputs based on frequency
      if (input.frequency === 'weekly' && (input.dayOfWeek === null || input.dayOfWeek === undefined)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'dayOfWeek is required for weekly schedules',
        });
      }

      if (input.frequency === 'monthly' && (input.dayOfMonth === null || input.dayOfMonth === undefined)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'dayOfMonth is required for monthly schedules',
        });
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(input.time)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid time format. Expected HH:MM (24-hour format)',
        });
      }

      // Validate dayOfWeek range
      if (input.dayOfWeek !== null && input.dayOfWeek !== undefined) {
        if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)',
          });
        }
      }

      // Validate dayOfMonth range
      if (input.dayOfMonth !== null && input.dayOfMonth !== undefined) {
        if (input.dayOfMonth < 1 || input.dayOfMonth > 31) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'dayOfMonth must be between 1 and 31',
          });
        }
      }

      // Validate recipients
      if (!input.recipients || input.recipients.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one recipient email is required',
        });
      }

      // Calculate next run time
      const scheduleData = {
        ...input,
        createdBy: userId,
      };
      const nextRunAt = calculateNextRun(scheduleData as any);

      // Insert schedule
      const [created] = await db
        .insert(schema.reportSchedules)
        .values({
          ...input,
          nextRunAt,
          createdBy: userId,
        })
        .returning();

      // If next run is within 1 hour, add to queue immediately
      const oneHourFromNow = new Date();
      oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

      if (nextRunAt <= oneHourFromNow && input.isActive !== false) {
        await scheduledReportsQueue.add(
          'process-scheduled-report',
          {
            tenantId,
            scheduleId: created.id,
          },
          {
            jobId: `${tenantId}-${created.id}-${Date.now()}`,
          }
        );
      }

      // Audit log
      await createAuditLog(db, schema, {
        entityType: 'ReportSchedule',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: userId,
        changes: {
          after: {
            name: input.name,
            frequency: input.frequency,
            reportDefinitionId: input.reportDefinitionId,
          },
        },
      });

      return created;
    }),

  /**
   * Update existing schedule.
   */
  update: authorizedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateReportScheduleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tenant context missing',
        });
      }

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan('manage', 'Report');

      const { db, schema, userId } = ctx.tenant;

      // Check if schedule exists
      const [existing] = await db
        .select()
        .from(schema.reportSchedules)
        .where(eq(schema.reportSchedules.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Determine if we need to recalculate nextRunAt
      const recalcNeeded =
        input.data.frequency !== undefined ||
        input.data.dayOfWeek !== undefined ||
        input.data.dayOfMonth !== undefined ||
        input.data.time !== undefined;

      let nextRunAt = existing.nextRunAt;
      if (recalcNeeded) {
        const updatedSchedule = {
          ...existing,
          ...input.data,
        };
        nextRunAt = calculateNextRun(updatedSchedule as any);
      }

      // Update schedule
      const [updated] = await db
        .update(schema.reportSchedules)
        .set({
          ...input.data,
          ...(recalcNeeded ? { nextRunAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.reportSchedules.id, input.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: 'ReportSchedule',
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: input.data,
        },
        metadata: {
          recalculatedNextRun: recalcNeeded,
        },
      });

      return updated;
    }),

  /**
   * Delete schedule.
   */
  delete: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tenant context missing',
        });
      }

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan('manage', 'Report');

      const { db, schema, userId, tenantId } = ctx.tenant;

      // Check if schedule exists
      const [existing] = await db
        .select()
        .from(schema.reportSchedules)
        .where(eq(schema.reportSchedules.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Delete from database
      await db.delete(schema.reportSchedules).where(eq(schema.reportSchedules.id, input.id));

      // Remove pending jobs from queue
      // Note: BullMQ doesn't have a direct way to remove by job data
      // In production, consider using job IDs with predictable pattern
      // For now, we'll just let the worker skip deleted schedules

      // Audit log
      await createAuditLog(db, schema, {
        entityType: 'ReportSchedule',
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: userId,
        changes: {
          before: {
            name: existing.name,
            frequency: existing.frequency,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Toggle schedule active status.
   */
  toggleActive: authorizedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tenant context missing',
        });
      }

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan('manage', 'Report');

      const { db, schema, userId, tenantId } = ctx.tenant;

      // Check if schedule exists
      const [existing] = await db
        .select()
        .from(schema.reportSchedules)
        .where(eq(schema.reportSchedules.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Update status
      const [updated] = await db
        .update(schema.reportSchedules)
        .set({
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(eq(schema.reportSchedules.id, input.id))
        .returning();

      // If activating and next run is due, add to queue
      if (input.isActive && existing.nextRunAt && existing.nextRunAt <= new Date()) {
        await scheduledReportsQueue.add(
          'process-scheduled-report',
          {
            tenantId,
            scheduleId: input.id,
          },
          {
            jobId: `${tenantId}-${input.id}-${Date.now()}`,
          }
        );
      }

      // Audit log
      await createAuditLog(db, schema, {
        entityType: 'ReportSchedule',
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          before: { isActive: existing.isActive },
          after: { isActive: input.isActive },
        },
        metadata: {
          action: input.isActive ? 'activated' : 'deactivated',
        },
      });

      return updated;
    }),

  /**
   * Manually trigger immediate report delivery.
   */
  runNow: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.abilities) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Tenant context missing',
        });
      }

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan('manage', 'Report');

      const { db, schema, userId, tenantId } = ctx.tenant;

      // Check if schedule exists
      const [schedule] = await db
        .select()
        .from(schema.reportSchedules)
        .where(eq(schema.reportSchedules.id, input.id))
        .limit(1);

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Add immediate job to queue
      await scheduledReportsQueue.add(
        'process-scheduled-report',
        {
          tenantId,
          scheduleId: input.id,
        },
        {
          priority: 1, // High priority for manual runs
          jobId: `manual-${tenantId}-${input.id}-${Date.now()}`,
        }
      );

      // Audit log
      await createAuditLog(db, schema, {
        entityType: 'ReportSchedule',
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {},
        metadata: {
          action: 'manual_run',
          name: schedule.name,
          triggeredManually: true,
        },
      });

      return {
        success: true,
        message: 'Report scheduled for immediate delivery',
      };
    }),
});
