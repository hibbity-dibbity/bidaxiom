import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createRfqSchema,
  updateRfqSchema,
  createAmendmentSchema,
  createInvitationSchema,
  rfqStatusEnum,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, sql, count, inArray } from "drizzle-orm";
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
 * RFQ lifecycle management router.
 * Handles RFQ creation, issuance, amendments, invitations, and status transitions.
 */
export const rfqRouter = router({
  /**
   * Create a new RFQ in draft status.
   * Generates sequential RFQ number.
   */
  create: protectedProcedure
    .input(createRfqSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("create", "RFQ");

      // Generate sequential RFQ number
      const [maxRfq] = await db
        .select({ rfqNumber: schema.rfqs.rfqNumber })
        .from(schema.rfqs)
        .where(eq(schema.rfqs.projectId, input.projectId))
        .orderBy(desc(schema.rfqs.rfqNumber))
        .limit(1);

      let nextNumber = 1;
      if (maxRfq?.rfqNumber) {
        // Extract number from "RFQ-001" format
        const match = maxRfq.rfqNumber.match(/RFQ-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const rfqNumber = `RFQ-${String(nextNumber).padStart(3, "0")}`;

      // Create RFQ
      const [rfq] = await db
        .insert(schema.rfqs)
        .values({
          projectId: input.projectId,
          rfqNumber,
          title: input.title,
          description: input.description ?? null,
          scopeOfWork: input.scopeOfWork,
          trades: input.trades,
          dueDate: new Date(input.dueDate),
          attachmentIds: input.attachmentIds ?? [],
          status: "draft",
          createdBy: ctx.userId,
        })
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: rfq.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: rfq,
        },
      });

      return rfq;
    }),

  /**
   * List RFQs for a project with optional status filter.
   * Includes bid count and invitation count.
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: rfqStatusEnum.optional(),
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "RFQ");

      // Build where conditions
      const conditions = [eq(schema.rfqs.projectId, input.projectId)];
      if (input.status) {
        conditions.push(eq(schema.rfqs.status, input.status));
      }

      // Query RFQs
      const rfqs = await db
        .select()
        .from(schema.rfqs)
        .where(and(...conditions))
        .orderBy(desc(schema.rfqs.createdAt));

      // Get counts for each RFQ
      const rfqsWithCounts = await Promise.all(
        rfqs.map(async (rfq) => {
          const [bidCount] = await db
            .select({ count: count() })
            .from(schema.bids)
            .where(eq(schema.bids.rfqId, rfq.id));

          const [invitationCount] = await db
            .select({ count: count() })
            .from(schema.rfqInvitations)
            .where(eq(schema.rfqInvitations.rfqId, rfq.id));

          return {
            ...rfq,
            bidCount: bidCount?.count ?? 0,
            invitationCount: invitationCount?.count ?? 0,
          };
        })
      );

      return rfqsWithCounts;
    }),

  /**
   * Get RFQ by ID with full details.
   * Includes amendments, invitations with subcontractor details, and bid count.
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

      // Fetch RFQ
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.id))
        .limit(1);

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "RFQ");

      // Fetch amendments
      const amendments = await db
        .select()
        .from(schema.rfqAmendments)
        .where(eq(schema.rfqAmendments.rfqId, input.id))
        .orderBy(schema.rfqAmendments.amendmentNumber);

      // Fetch invitations with subcontractor details
      const invitations = await db
        .select({
          id: schema.rfqInvitations.id,
          rfqId: schema.rfqInvitations.rfqId,
          subcontractorId: schema.rfqInvitations.subcontractorId,
          externalEmail: schema.rfqInvitations.externalEmail,
          externalCompanyName: schema.rfqInvitations.externalCompanyName,
          status: schema.rfqInvitations.status,
          sentAt: schema.rfqInvitations.sentAt,
          viewedAt: schema.rfqInvitations.viewedAt,
          respondedAt: schema.rfqInvitations.respondedAt,
          createdAt: schema.rfqInvitations.createdAt,
          subcontractorCompanyName: schema.subcontractorDirectory.companyName,
          subcontractorContactEmail: schema.subcontractorDirectory.contactEmail,
        })
        .from(schema.rfqInvitations)
        .leftJoin(
          schema.subcontractorDirectory,
          eq(schema.rfqInvitations.subcontractorId, schema.subcontractorDirectory.id)
        )
        .where(eq(schema.rfqInvitations.rfqId, input.id));

      // Get bid count
      const [bidCount] = await db
        .select({ count: count() })
        .from(schema.bids)
        .where(eq(schema.bids.rfqId, input.id));

      return {
        ...rfq,
        amendments,
        invitations,
        bidCount: bidCount?.count ?? 0,
      };
    }),

  /**
   * Update RFQ (only draft status allowed).
   * Issued RFQs must use amendments.
   */
  update: protectedProcedure
    .input(updateRfqSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing RFQ
      const [existingRfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.id))
        .limit(1);

      if (!existingRfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Only allow updates when status is draft
      if (existingRfq.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft RFQs can be edited. Use amendments for issued RFQs.",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "RFQ");

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) {
        updateValues.title = input.title;
      }

      if (input.description !== undefined) {
        updateValues.description = input.description;
      }

      if (input.scopeOfWork !== undefined) {
        updateValues.scopeOfWork = input.scopeOfWork;
      }

      if (input.trades !== undefined) {
        updateValues.trades = input.trades;
      }

      if (input.dueDate !== undefined) {
        updateValues.dueDate = new Date(input.dueDate);
      }

      // Update RFQ
      const [updated] = await db
        .update(schema.rfqs)
        .set(updateValues)
        .where(eq(schema.rfqs.id, input.id))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: existingRfq,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Issue an RFQ (change status to 'issued').
   * Validates that at least one invitation exists.
   */
  issue: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing RFQ
      const [existingRfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.id))
        .limit(1);

      if (!existingRfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Validate status is draft
      if (existingRfq.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft RFQs can be issued",
        });
      }

      // Validate at least one invitation exists
      const [invitationCount] = await db
        .select({ count: count() })
        .from(schema.rfqInvitations)
        .where(eq(schema.rfqInvitations.rfqId, input.id));

      if ((invitationCount?.count ?? 0) === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot issue RFQ without at least one invitation",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "RFQ");

      // Issue RFQ
      const [updated] = await db
        .update(schema.rfqs)
        .set({
          status: "issued",
          issuedAt: new Date(),
          issuedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(schema.rfqs.id, input.id))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: input.id,
        action: "rfq_issued" as AuditAction,
        actorId: ctx.userId,
        changes: {
          before: existingRfq,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Close an RFQ (stop accepting bids).
   * Only issued RFQs can be closed.
   */
  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing RFQ
      const [existingRfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.id))
        .limit(1);

      if (!existingRfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Validate status is issued
      if (existingRfq.status !== "issued") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only issued RFQs can be closed",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "RFQ");

      // Close RFQ
      const [updated] = await db
        .update(schema.rfqs)
        .set({
          status: "closed",
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.rfqs.id, input.id))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: input.id,
        action: "rfq_closed" as AuditAction,
        actorId: ctx.userId,
        changes: {
          before: existingRfq,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Cancel an RFQ.
   * Only draft or issued RFQs can be cancelled.
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing RFQ
      const [existingRfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.id))
        .limit(1);

      if (!existingRfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Validate status is draft or issued
      if (!["draft", "issued"].includes(existingRfq.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft or issued RFQs can be cancelled",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "RFQ");

      // Cancel RFQ
      const [updated] = await db
        .update(schema.rfqs)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(schema.rfqs.id, input.id))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: input.id,
        action: "rfq_cancelled" as AuditAction,
        actorId: ctx.userId,
        changes: {
          before: existingRfq,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Create an amendment for an issued RFQ.
   * Generates sequential amendment number and updates RFQ if needed.
   */
  createAmendment: protectedProcedure
    .input(createAmendmentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch RFQ
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.rfqId))
        .limit(1);

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Validate RFQ is in issued status
      if (rfq.status !== "issued") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only issued RFQs can be amended",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "RFQ");

      // Generate sequential amendment number
      const [maxAmendment] = await db
        .select({ amendmentNumber: schema.rfqAmendments.amendmentNumber })
        .from(schema.rfqAmendments)
        .where(eq(schema.rfqAmendments.rfqId, input.rfqId))
        .orderBy(desc(schema.rfqAmendments.amendmentNumber))
        .limit(1);

      const nextAmendmentNumber = (maxAmendment?.amendmentNumber ?? 0) + 1;

      // Insert amendment
      const [amendment] = await db
        .insert(schema.rfqAmendments)
        .values({
          rfqId: input.rfqId,
          amendmentNumber: nextAmendmentNumber,
          description: input.description,
          scopeChanges: input.scopeChanges ?? null,
          dueDateChange: input.dueDateChange ? new Date(input.dueDateChange) : null,
          createdBy: ctx.userId,
        })
        .returning();

      // Update RFQ if changes provided
      const rfqUpdates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.dueDateChange) {
        rfqUpdates.dueDate = new Date(input.dueDateChange);
      }

      if (input.scopeChanges) {
        rfqUpdates.scopeOfWork = input.scopeChanges;
      }

      if (Object.keys(rfqUpdates).length > 1) {
        // More than just updatedAt
        await db
          .update(schema.rfqs)
          .set(rfqUpdates)
          .where(eq(schema.rfqs.id, input.rfqId));
      }

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: input.rfqId,
        action: "rfq_amended" as AuditAction,
        actorId: ctx.userId,
        changes: {
          after: {
            amendment,
            rfqUpdates,
          },
        },
      });

      return amendment;
    }),

  /**
   * Add an invitation to an RFQ.
   * Can invite directory subcontractors or external emails.
   */
  addInvitation: protectedProcedure
    .input(createInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch RFQ
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.rfqId))
        .limit(1);

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Validate RFQ status is draft or issued
      if (!["draft", "issued"].includes(rfq.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only invite to draft or issued RFQs",
        });
      }

      // If subcontractorId provided, verify it exists
      if (input.subcontractorId) {
        const [subcontractor] = await db
          .select()
          .from(schema.subcontractorDirectory)
          .where(eq(schema.subcontractorDirectory.id, input.subcontractorId))
          .limit(1);

        if (!subcontractor) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subcontractor not found in directory",
          });
        }
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "RFQ");

      // Check for duplicate invitation
      const existingConditions = [eq(schema.rfqInvitations.rfqId, input.rfqId)];

      if (input.subcontractorId) {
        existingConditions.push(eq(schema.rfqInvitations.subcontractorId, input.subcontractorId));
      } else if (input.externalEmail) {
        existingConditions.push(eq(schema.rfqInvitations.externalEmail, input.externalEmail));
      }

      const [existingInvitation] = await db
        .select()
        .from(schema.rfqInvitations)
        .where(and(...existingConditions))
        .limit(1);

      if (existingInvitation) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation already exists for this RFQ and recipient",
        });
      }

      // Create invitation
      const [invitation] = await db
        .insert(schema.rfqInvitations)
        .values({
          rfqId: input.rfqId,
          subcontractorId: input.subcontractorId ?? null,
          externalEmail: input.externalEmail ?? null,
          externalCompanyName: input.externalCompanyName ?? null,
          status: "pending",
          sentAt: new Date(),
        })
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: input.rfqId,
        action: "rfq_invitation_sent" as AuditAction,
        actorId: ctx.userId,
        changes: {
          after: invitation,
        },
      });

      return invitation;
    }),

  /**
   * Remove an invitation from an RFQ.
   * Only pending invitations can be removed.
   */
  removeInvitation: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch invitation
      const [invitation] = await db
        .select()
        .from(schema.rfqInvitations)
        .where(eq(schema.rfqInvitations.id, input.id))
        .limit(1);

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      // Validate status is pending
      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending invitations can be removed",
        });
      }

      // Fetch RFQ to get projectId for abilities
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, invitation.rfqId))
        .limit(1);

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "RFQ");

      // Delete invitation
      await db
        .delete(schema.rfqInvitations)
        .where(eq(schema.rfqInvitations.id, input.id));

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: invitation.rfqId,
        action: "rfq_invitation_removed" as AuditAction,
        actorId: ctx.userId,
        changes: {
          before: invitation,
        },
      });

      return { success: true };
    }),

  /**
   * Delete a draft RFQ.
   * Only draft RFQs can be deleted (cascade deletes amendments and invitations).
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

      // Fetch existing RFQ
      const [existingRfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.id))
        .limit(1);

      if (!existingRfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Only allow deletion of draft RFQs
      if (existingRfq.status !== "draft") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only draft RFQs can be deleted",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("delete", "RFQ");

      // Delete RFQ (cascade deletes amendments and invitations)
      await db
        .delete(schema.rfqs)
        .where(eq(schema.rfqs.id, input.id));

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "RFQ",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          before: existingRfq,
        },
      });

      return { success: true };
    }),
});
