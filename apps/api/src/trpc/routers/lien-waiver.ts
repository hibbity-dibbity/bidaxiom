import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createLienWaiverSchema,
  updateLienWaiverStatusSchema,
  AuditAction,
  STATE_LIEN_WAIVER_REQUIREMENTS,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, inArray } from "drizzle-orm";
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
 * Lien waiver management router.
 * Handles lien waiver CRUD, status tracking, collection status, and state validation.
 */
export const lienWaiverRouter = router({
  /**
   * Create a new lien waiver with auto state requirement detection.
   */
  create: protectedProcedure
    .input(createLienWaiverSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("manage", "LienWaiver");

      // Validate project exists
      const project = await db
        .select({ id: schema.projects.id, state: schema.projects.state })
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (project.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Validate payment app exists and belongs to project
      const paymentApp = await db
        .select({ id: schema.paymentApps.id, projectId: schema.paymentApps.projectId })
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.id, input.paymentAppId))
        .limit(1);

      if (paymentApp.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment application not found",
        });
      }

      if (paymentApp[0].projectId !== input.projectId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment application does not belong to this project",
        });
      }

      // Auto-detect state requirements if not explicitly provided
      let requiresNotarization = input.requiresNotarization;
      let usesStatutoryForm = input.usesStatutoryForm;

      // Get state from structured field
      const state = project[0].state;

      if (state) {
        const stateReqs = STATE_LIEN_WAIVER_REQUIREMENTS[state];

        if (stateReqs) {
          // Only auto-set if user didn't explicitly provide values
          if (input.requiresNotarization === undefined) {
            requiresNotarization = stateReqs.requiresNotarization;
          }
          if (input.usesStatutoryForm === undefined) {
            usesStatutoryForm = stateReqs.requiresStatutoryForm;
          }
        }
      }

      // Validation warnings for waiver type
      const warnings: string[] = [];

      if (input.waiverType.includes("unconditional")) {
        warnings.push(
          "WARNING: Unconditional waiver waives lien rights immediately, even if payment doesn't clear. Ensure payment has cleared before using unconditional waivers."
        );
      }

      if (input.waiverType.includes("final")) {
        // Check if this is the last payment app (advisory only)
        const paymentAppCount = await db
          .select({ count: schema.paymentApps.id })
          .from(schema.paymentApps)
          .where(
            and(
              eq(schema.paymentApps.projectId, input.projectId),
              inArray(schema.paymentApps.status, ["approved", "paid"])
            )
          );

        // This is a soft warning, not a blocking error
        if (paymentAppCount.length > 0) {
          warnings.push(
            "ADVISORY: Final waivers are typically used for the last payment application. Ensure this is the final payment before using final waiver types."
          );
        }
      }

      // Create lien waiver
      const [lienWaiver] = await db
        .insert(schema.lienWaivers)
        .values({
          projectId: input.projectId,
          paymentAppId: input.paymentAppId,
          waiverType: input.waiverType,
          partyName: input.partyName,
          partyType: input.partyType,
          throughDate: new Date(input.throughDate),
          amountWaived: input.amountWaived.toFixed(2),
          requiresNotarization,
          usesStatutoryForm,
          status: "pending",
        })
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "lien_waiver",
        entityId: lienWaiver.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: {
            waiverType: lienWaiver.waiverType,
            partyName: lienWaiver.partyName,
            amountWaived: lienWaiver.amountWaived,
            status: lienWaiver.status,
          },
        },
      });

      return {
        lienWaiver,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }),

  /**
   * List lien waivers by payment app or project.
   */
  list: protectedProcedure
    .input(
      z.object({
        paymentAppId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        status: z.enum(["pending", "received", "verified", "stored"]).optional(),
      }).refine(
        (data) => data.paymentAppId || data.projectId,
        { message: "Either paymentAppId or projectId must be provided" }
      )
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "LienWaiver");

      const conditions = [];

      if (input.paymentAppId) {
        conditions.push(eq(schema.lienWaivers.paymentAppId, input.paymentAppId));
      }

      if (input.projectId) {
        conditions.push(eq(schema.lienWaivers.projectId, input.projectId));
      }

      if (input.status) {
        conditions.push(eq(schema.lienWaivers.status, input.status));
      }

      const lienWaivers = await db
        .select({
          id: schema.lienWaivers.id,
          projectId: schema.lienWaivers.projectId,
          paymentAppId: schema.lienWaivers.paymentAppId,
          waiverType: schema.lienWaivers.waiverType,
          partyName: schema.lienWaivers.partyName,
          partyType: schema.lienWaivers.partyType,
          throughDate: schema.lienWaivers.throughDate,
          amountWaived: schema.lienWaivers.amountWaived,
          status: schema.lienWaivers.status,
          requiresNotarization: schema.lienWaivers.requiresNotarization,
          isNotarized: schema.lienWaivers.isNotarized,
          usesStatutoryForm: schema.lienWaivers.usesStatutoryForm,
          receivedAt: schema.lienWaivers.receivedAt,
          receivedBy: schema.lienWaivers.receivedBy,
          createdAt: schema.lienWaivers.createdAt,
        })
        .from(schema.lienWaivers)
        .where(and(...conditions))
        .orderBy(desc(schema.lienWaivers.createdAt));

      return lienWaivers;
    }),

  /**
   * Get lien waiver by ID with full details.
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "LienWaiver");

      const [lienWaiver] = await db
        .select()
        .from(schema.lienWaivers)
        .where(eq(schema.lienWaivers.id, input.id))
        .limit(1);

      if (!lienWaiver) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lien waiver not found",
        });
      }

      return lienWaiver;
    }),

  /**
   * Update lien waiver status with validation.
   */
  updateStatus: protectedProcedure
    .input(updateLienWaiverStatusSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("manage", "LienWaiver");

      // Get existing lien waiver
      const [existing] = await db
        .select()
        .from(schema.lienWaivers)
        .where(eq(schema.lienWaivers.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lien waiver not found",
        });
      }

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        pending: ["received"],
        received: ["verified", "pending"],
        verified: ["stored", "received"],
        stored: [], // Terminal state
      };

      const allowedNext = validTransitions[existing.status];
      if (!allowedNext.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid status transition from ${existing.status} to ${input.status}`,
        });
      }

      // Validate notarization update
      if (input.isNotarized !== undefined && !existing.requiresNotarization) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot update notarization status for waiver that doesn't require notarization",
        });
      }

      // Validate document reference
      if (input.documentId) {
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

        if (document.projectId !== existing.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Document does not belong to this project",
          });
        }
      }

      // Build update object
      const updates: Record<string, any> = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.status === "received") {
        updates.receivedAt = new Date();
        updates.receivedBy = ctx.userId;
      }

      if (input.documentId !== undefined) {
        updates.documentId = input.documentId;
      }

      if (input.isNotarized !== undefined) {
        updates.isNotarized = input.isNotarized;
      }

      // Update lien waiver
      const [updated] = await db
        .update(schema.lienWaivers)
        .set(updates)
        .where(eq(schema.lienWaivers.id, input.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "lien_waiver",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: { status: existing.status },
          after: { status: updated.status },
        },
      });

      return updated;
    }),

  /**
   * Delete a lien waiver (only when status is pending).
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
      ForbiddenError.from(abilities).throwUnlessCan("manage", "LienWaiver");

      // Get existing lien waiver
      const [existing] = await db
        .select()
        .from(schema.lienWaivers)
        .where(eq(schema.lienWaivers.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lien waiver not found",
        });
      }

      // Only allow deletion when status is pending
      if (existing.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot delete lien waiver with status ${existing.status}. Only pending waivers can be deleted.`,
        });
      }

      // Delete lien waiver
      await db
        .delete(schema.lienWaivers)
        .where(eq(schema.lienWaivers.id, input.id));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "lien_waiver",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          before: {
            partyName: existing.partyName,
            amountWaived: existing.amountWaived,
            status: existing.status,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get collection status for a payment application.
   * Returns summary for lien waiver tracker checklist.
   */
  getCollectionStatus: protectedProcedure
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

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "LienWaiver");

      // Get all lien waivers for this payment app
      const waivers = await db
        .select({
          id: schema.lienWaivers.id,
          partyName: schema.lienWaivers.partyName,
          waiverType: schema.lienWaivers.waiverType,
          amountWaived: schema.lienWaivers.amountWaived,
          status: schema.lienWaivers.status,
          requiresNotarization: schema.lienWaivers.requiresNotarization,
          isNotarized: schema.lienWaivers.isNotarized,
          usesStatutoryForm: schema.lienWaivers.usesStatutoryForm,
        })
        .from(schema.lienWaivers)
        .where(eq(schema.lienWaivers.paymentAppId, input.paymentAppId));

      const totalRequired = waivers.length;
      const totalReceived = waivers.filter((w) => w.status === "received" || w.status === "verified" || w.status === "stored").length;
      const totalVerified = waivers.filter((w) => w.status === "verified" || w.status === "stored").length;
      const allComplete = totalRequired > 0 && totalReceived === totalRequired;

      return {
        totalRequired,
        totalReceived,
        totalVerified,
        allComplete,
        waivers: waivers.map((w) => ({
          id: w.id,
          partyName: w.partyName,
          waiverType: w.waiverType,
          amountWaived: Number(w.amountWaived),
          status: w.status,
          requiresNotarization: w.requiresNotarization,
          isNotarized: w.isNotarized,
          usesStatutoryForm: w.usesStatutoryForm,
        })),
      };
    }),

  /**
   * Validate state requirements for a project.
   * Returns applicable state requirements or null if no special requirements.
   */
  validateStateRequirements: protectedProcedure
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "LienWaiver");

      // Get project state
      const [project] = await db
        .select({ state: schema.projects.state })
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Get state from structured field
      const state = project.state;

      if (!state) {
        return null; // No state found in project
      }

      const stateReqs = STATE_LIEN_WAIVER_REQUIREMENTS[state];

      if (!stateReqs) {
        return null; // No special requirements for this state
      }

      return {
        state,
        requiresStatutoryForm: stateReqs.requiresStatutoryForm,
        requiresNotarization: stateReqs.requiresNotarization,
      };
    }),
});
