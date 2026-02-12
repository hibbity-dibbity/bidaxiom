import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AuditAction } from "@construction/shared";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { AuditLogger } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";

export const auditRouter = router({
  /**
   * List audit logs with filtering and pagination.
   * Restricted to roles with 'read' permission on 'AuditLog'.
   */
  list: protectedProcedure
    .input(
      z.object({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        action: z.nativeEnum(AuditAction).optional(),
        actorId: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Permission check
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId ?? ""
      );
      if (!abilities.can("read", "AuditLog")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view audit logs",
        });
      }

      const logger = new AuditLogger(ctx.tenant.db, ctx.tenant.schema);
      return logger.query(input);
    }),

  /**
   * Get chronological history for a specific entity.
   */
  entityHistory: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId ?? ""
      );
      if (!abilities.can("read", "AuditLog")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view audit logs",
        });
      }

      const logger = new AuditLogger(ctx.tenant.db, ctx.tenant.schema);
      return logger.getEntityHistory(input.entityType, input.entityId);
    }),

  /**
   * Summary for dashboard widget.
   * Returns today's action count and recent entries.
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const abilities = defineAbilitiesFor(
      ctx.orgRole ?? "org:member",
      ctx.userId ?? ""
    );
    if (!abilities.can("read", "AuditLog")) {
      // Non-admin users see empty summary rather than error
      return { totalToday: 0, recentActions: [] };
    }

    const logger = new AuditLogger(ctx.tenant.db, ctx.tenant.schema);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayResult, recentResult] = await Promise.all([
      logger.query({ startDate: today, limit: 1, offset: 0 }),
      logger.query({ limit: 10 }),
    ]);

    return {
      totalToday: todayResult.total,
      recentActions: recentResult.items,
    };
  }),
});
