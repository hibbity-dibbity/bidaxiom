import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  submitBidSchema,
  updateBidVersionSchema,
  awardBidSchema,
  createLevelingNoteSchema,
  bidStatusEnum,
  AuditAction,
  type BidComparisonRow,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, inArray, and, sql, asc, isNull } from "drizzle-orm";
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
 * Bid management router.
 * Handles bid submission, versioning, comparison, leveling, and award-to-commitment conversion.
 */
/**
 * Estimate-based bids have no RFQ (rfqId is null). RFQ-scoped procedures call
 * this to get a non-null id, failing with a clear error instead of querying null.
 */
function requireRfqId(bid: { rfqId: string | null }): string {
  if (!bid.rfqId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Bid is not linked to an RFQ",
    });
  }
  return bid.rfqId;
}

export const bidRouter = router({
  /**
   * Submit a new bid against an RFQ.
   * Creates first version, updates invitation if provided.
   */
  submit: protectedProcedure
    .input(submitBidSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Lookup RFQ to get projectId and validate status
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

      // Validate RFQ status - must be issued
      if (rfq.status !== "issued") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot submit bid to RFQ with status '${rfq.status}'. RFQ must be 'issued'.`,
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("create", "Bid");

      // If invitation provided, validate it
      let invitation = null;
      if (input.invitationId) {
        [invitation] = await db
          .select()
          .from(schema.rfqInvitations)
          .where(eq(schema.rfqInvitations.id, input.invitationId))
          .limit(1);

        if (!invitation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invitation not found",
          });
        }

        if (invitation.rfqId !== input.rfqId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invitation does not belong to this RFQ",
          });
        }
      }

      // Get bidder company name from user context or invitation
      const bidderCompanyName = invitation?.externalCompanyName ?? "Unknown Company";

      // Transaction: create bid, first version, update invitation
      const [bid] = await db
        .insert(schema.bids)
        .values({
          rfqId: input.rfqId,
          invitationId: input.invitationId ?? null,
          subcontractorId: invitation?.subcontractorId ?? null,
          bidderCompanyName,
          bidderContactEmail: invitation?.externalEmail ?? null,
          status: "submitted",
          submittedAt: new Date(),
          notes: null,
        })
        .returning();

      // Insert first bid version
      const [bidVersion] = await db
        .insert(schema.bidVersions)
        .values({
          bidId: bid.id,
          versionNumber: 1,
          totalAmount: input.totalAmount.toFixed(2),
          lineItems: input.lineItems,
          scopeNotes: input.scopeNotes ?? null,
          exclusions: input.exclusions ?? null,
          inclusions: input.inclusions ?? null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          submittedAt: new Date(),
          triggerAmendmentId: null,
        })
        .returning();

      // Update bid.currentVersionId
      await db
        .update(schema.bids)
        .set({ currentVersionId: bidVersion.id })
        .where(eq(schema.bids.id, bid.id));

      // Update invitation if provided
      if (input.invitationId) {
        await db
          .update(schema.rfqInvitations)
          .set({
            status: "responded",
            respondedAt: new Date(),
          })
          .where(eq(schema.rfqInvitations.id, input.invitationId));
      }

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Bid",
        entityId: bid.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: {
            bid,
            version: bidVersion,
          },
        },
      });

      return {
        ...bid,
        currentVersion: bidVersion,
      };
    }),

  /**
   * Create a new version of an existing bid.
   * Increments version number, creates immutable snapshot.
   */
  updateVersion: protectedProcedure
    .input(updateBidVersionSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch bid
      const [bid] = await db
        .select()
        .from(schema.bids)
        .where(eq(schema.bids.id, input.bidId))
        .limit(1);

      if (!bid) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bid not found",
        });
      }

      // Validate bid status - can't update awarded/rejected/withdrawn
      if (!["submitted", "under_review"].includes(bid.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot update bid with status '${bid.status}'. Only 'submitted' or 'under_review' bids can be updated.`,
        });
      }

      // Estimate-based bids have no RFQ, so there is no RFQ status to validate against
      if (!bid.rfqId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bid is not linked to an RFQ",
        });
      }

      // Fetch RFQ to validate status
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, bid.rfqId))
        .limit(1);

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Validate RFQ is still issued
      if (rfq.status !== "issued") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot update bid - RFQ status is '${rfq.status}'. RFQ must be 'issued'.`,
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "Bid");

      // Get max version number for this bid
      const [maxVersion] = await db
        .select({
          maxVersionNumber: sql<number>`MAX(${schema.bidVersions.versionNumber})`,
        })
        .from(schema.bidVersions)
        .where(eq(schema.bidVersions.bidId, input.bidId));

      const nextVersionNumber = (maxVersion?.maxVersionNumber ?? 0) + 1;

      // Insert new version
      const [newVersion] = await db
        .insert(schema.bidVersions)
        .values({
          bidId: input.bidId,
          versionNumber: nextVersionNumber,
          totalAmount: input.totalAmount.toFixed(2),
          lineItems: input.lineItems,
          scopeNotes: input.scopeNotes ?? null,
          exclusions: input.exclusions ?? null,
          inclusions: input.inclusions ?? null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          submittedAt: new Date(),
          triggerAmendmentId: input.triggerAmendmentId ?? null,
        })
        .returning();

      // Update bid.currentVersionId
      const [updatedBid] = await db
        .update(schema.bids)
        .set({
          currentVersionId: newVersion.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.bids.id, input.bidId))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Bid",
        entityId: input.bidId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          after: {
            bid: updatedBid,
            newVersion,
          },
        },
      });

      return {
        ...updatedBid,
        currentVersion: newVersion,
      };
    }),

  /**
   * List all bids for an RFQ.
   * Optionally include all versions.
   */
  listByRfq: protectedProcedure
    .input(
      z.object({
        rfqId: z.string().uuid(),
        includeVersions: z.boolean().default(false),
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

      // Fetch RFQ to get projectId
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

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Bid");

      // Query bids with current version totalAmount
      const bids = await db
        .select({
          id: schema.bids.id,
          rfqId: schema.bids.rfqId,
          invitationId: schema.bids.invitationId,
          subcontractorId: schema.bids.subcontractorId,
          bidderCompanyName: schema.bids.bidderCompanyName,
          bidderContactEmail: schema.bids.bidderContactEmail,
          status: schema.bids.status,
          submittedAt: schema.bids.submittedAt,
          awardedAt: schema.bids.awardedAt,
          awardedBy: schema.bids.awardedBy,
          currentVersionId: schema.bids.currentVersionId,
          commitmentId: schema.bids.commitmentId,
          notes: schema.bids.notes,
          createdAt: schema.bids.createdAt,
          updatedAt: schema.bids.updatedAt,
          currentVersionTotalAmount: schema.bidVersions.totalAmount,
          versionCount: sql<number>`(select count(*)::int from ${schema.bidVersions} bv where bv.bid_id = ${schema.bids.id})`,
        })
        .from(schema.bids)
        .leftJoin(
          schema.bidVersions,
          eq(schema.bids.currentVersionId, schema.bidVersions.id)
        )
        .where(eq(schema.bids.rfqId, input.rfqId))
        .orderBy(asc(schema.bids.submittedAt));

      // If includeVersions, fetch all versions for each bid
      if (input.includeVersions) {
        const bidsWithVersions = await Promise.all(
          bids.map(async (bid) => {
            const versions = await db
              .select()
              .from(schema.bidVersions)
              .where(eq(schema.bidVersions.bidId, bid.id))
              .orderBy(desc(schema.bidVersions.versionNumber));

            return {
              ...bid,
              versions,
            };
          })
        );

        return bidsWithVersions;
      }

      return bids;
    }),

  /**
   * Get a bid by ID with all versions.
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

      // Fetch bid
      const [bid] = await db
        .select()
        .from(schema.bids)
        .where(eq(schema.bids.id, input.id))
        .limit(1);

      if (!bid) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bid not found",
        });
      }

      // Fetch RFQ details (estimate-based bids have no RFQ, so rfq stays undefined)
      const [rfq] = bid.rfqId
        ? await db
            .select({
              id: schema.rfqs.id,
              rfqNumber: schema.rfqs.rfqNumber,
              title: schema.rfqs.title,
              status: schema.rfqs.status,
              projectId: schema.rfqs.projectId,
            })
            .from(schema.rfqs)
            .where(eq(schema.rfqs.id, bid.rfqId))
            .limit(1)
        : [];

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Bid");

      // Fetch all versions
      const versions = await db
        .select()
        .from(schema.bidVersions)
        .where(eq(schema.bidVersions.bidId, input.id))
        .orderBy(desc(schema.bidVersions.versionNumber));

      // Fetch leveling notes
      const levelingNotes = await db
        .select()
        .from(schema.bidLevelingNotes)
        .where(eq(schema.bidLevelingNotes.bidId, input.id))
        .orderBy(desc(schema.bidLevelingNotes.createdAt));

      return {
        ...bid,
        rfq,
        versions,
        levelingNotes,
      };
    }),

  /**
   * Compare bids side-by-side for an RFQ.
   * Calculates leveled amounts from scope adjustments.
   */
  compare: protectedProcedure
    .input(
      z.object({
        rfqId: z.string().uuid(),
        bidIds: z.array(z.string().uuid()).optional(),
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

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Bid");

      // Determine which bids to compare
      let bidsToCompare;
      if (input.bidIds && input.bidIds.length > 0) {
        // Compare specific bids
        bidsToCompare = await db
          .select()
          .from(schema.bids)
          .where(
            and(
              eq(schema.bids.rfqId, input.rfqId),
              inArray(schema.bids.id, input.bidIds)
            )
          );
      } else {
        // Compare all non-withdrawn/rejected bids
        bidsToCompare = await db
          .select()
          .from(schema.bids)
          .where(
            and(
              eq(schema.bids.rfqId, input.rfqId),
              sql`${schema.bids.status} NOT IN ('withdrawn', 'rejected')`
            )
          );
      }

      // Build comparison rows
      const comparisonRows: BidComparisonRow[] = await Promise.all(
        bidsToCompare.map(async (bid) => {
          // Get current version
          const [currentVersion] = await db
            .select()
            .from(schema.bidVersions)
            .where(eq(schema.bidVersions.id, bid.currentVersionId!))
            .limit(1);

          if (!currentVersion) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Bid ${bid.id} missing current version`,
            });
          }

          // Get leveling notes
          const levelingNotes = await db
            .select()
            .from(schema.bidLevelingNotes)
            .where(eq(schema.bidLevelingNotes.bidId, bid.id));

          // Calculate leveled amount
          const adjustmentSum = levelingNotes.reduce((sum, note) => {
            return sum + (note.adjustmentAmount ? Number(note.adjustmentAmount) : 0);
          }, 0);

          const totalAmount = Number(currentVersion.totalAmount);
          const leveledAmount = totalAmount + adjustmentSum;

          return {
            bidId: bid.id,
            bidderCompanyName: bid.bidderCompanyName,
            totalAmount,
            leveledAmount,
            lineItems: currentVersion.lineItems as any,
            exclusions: currentVersion.exclusions ?? undefined,
            inclusions: currentVersion.inclusions ?? undefined,
            scopeNotes: currentVersion.scopeNotes ?? undefined,
            levelingNotes: levelingNotes.map((note) => ({
              category: note.category as any,
              note: note.note,
              adjustmentAmount: note.adjustmentAmount ? Number(note.adjustmentAmount) : undefined,
            })),
            status: bid.status as any,
          };
        })
      );

      // Sort by leveled amount (lowest first)
      comparisonRows.sort((a, b) => a.leveledAmount - b.leveledAmount);

      return comparisonRows;
    }),

  /**
   * Add a scope leveling note to a bid.
   */
  addLevelingNote: protectedProcedure
    .input(createLevelingNoteSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch RFQ to get projectId
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

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission (update Bid or manage RFQ)
      ForbiddenError.from(abilities).throwUnlessCan("update", "Bid");

      // Insert leveling note
      const [levelingNote] = await db
        .insert(schema.bidLevelingNotes)
        .values({
          rfqId: input.rfqId,
          bidId: input.bidId,
          category: input.category,
          note: input.note,
          adjustmentAmount: input.adjustmentAmount ? input.adjustmentAmount.toFixed(2) : null,
          createdBy: ctx.userId,
        })
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Bid",
        entityId: input.bidId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          after: { levelingNote },
        },
      });

      return levelingNote;
    }),

  /**
   * Remove a leveling note.
   */
  removeLevelingNote: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch note to get rfqId for abilities check
      const [note] = await db
        .select()
        .from(schema.bidLevelingNotes)
        .where(eq(schema.bidLevelingNotes.id, input.id))
        .limit(1);

      if (!note) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Leveling note not found",
        });
      }

      // Fetch RFQ to get projectId
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, note.rfqId))
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
      ForbiddenError.from(abilities).throwUnlessCan("update", "Bid");

      // Delete note
      await db
        .delete(schema.bidLevelingNotes)
        .where(eq(schema.bidLevelingNotes.id, input.id));

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Bid",
        entityId: note.bidId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: { levelingNote: note },
        },
      });

      return { success: true };
    }),

  /**
   * Update bid status.
   * Enforces valid status transitions.
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: bidStatusEnum,
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

      // Fetch bid
      const [bid] = await db
        .select()
        .from(schema.bids)
        .where(eq(schema.bids.id, input.id))
        .limit(1);

      if (!bid) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bid not found",
        });
      }

      // Cannot set status to 'awarded' via this procedure
      if (input.status === "awarded") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use the 'award' procedure to award a bid",
        });
      }

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        submitted: ["under_review", "shortlisted", "rejected", "withdrawn"],
        under_review: ["shortlisted", "rejected", "withdrawn"],
        shortlisted: ["rejected", "withdrawn"],
        awarded: [], // Terminal
        rejected: [], // Terminal
        withdrawn: [], // Terminal
      };

      const currentStatus = bid.status;
      const allowedStatuses = validTransitions[currentStatus] ?? [];

      if (!allowedStatuses.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from '${currentStatus}' to '${input.status}'`,
        });
      }

      // Fetch RFQ to get projectId
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, requireRfqId(bid)))
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
      ForbiddenError.from(abilities).throwUnlessCan("update", "Bid");

      // Update status
      const [updatedBid] = await db
        .update(schema.bids)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(schema.bids.id, input.id))
        .returning();

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Bid",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: { status: bid.status },
          after: { status: input.status },
        },
      });

      return updatedBid;
    }),

  /**
   * Award a bid and optionally convert to commitment.
   */
  award: protectedProcedure
    .input(awardBidSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch bid
      const [bid] = await db
        .select()
        .from(schema.bids)
        .where(eq(schema.bids.id, input.bidId))
        .limit(1);

      if (!bid) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bid not found",
        });
      }

      // Validate bid status
      if (!["submitted", "under_review", "shortlisted"].includes(bid.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot award bid with status '${bid.status}'`,
        });
      }

      // Fetch RFQ
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, requireRfqId(bid)))
        .limit(1);

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found",
        });
      }

      // Validate RFQ status
      if (!["issued", "closed"].includes(rfq.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot award bid - RFQ status is '${rfq.status}'`,
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission (only PMs/admins can award)
      ForbiddenError.from(abilities).throwUnlessCan("manage", "RFQ");

      // Get current version
      const [currentVersion] = await db
        .select()
        .from(schema.bidVersions)
        .where(eq(schema.bidVersions.id, bid.currentVersionId!))
        .limit(1);

      if (!currentVersion) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Bid current version not found",
        });
      }

      let commitment = null;

      // Transaction: award bid, update RFQ, optionally create commitment, reject other bids
      // Update bid status
      const [awardedBid] = await db
        .update(schema.bids)
        .set({
          status: "awarded",
          awardedAt: new Date(),
          awardedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(schema.bids.id, input.bidId))
        .returning();

      // Update RFQ status to awarded
      await db
        .update(schema.rfqs)
        .set({
          status: "awarded",
          updatedAt: new Date(),
        })
        .where(eq(schema.rfqs.id, requireRfqId(bid)));

      // Convert to commitment if requested
      if (input.convertToCommitment) {
        const lineItems = currentVersion.lineItems as any[];
        const totalAmount = Number(currentVersion.totalAmount);

        // Insert commitment
        const [createdCommitment] = await db
          .insert(schema.commitments)
          .values({
            projectId: rfq.projectId,
            type: "subcontract",
            vendorName: bid.bidderCompanyName,
            description: input.commitmentDescription ?? rfq.title,
            totalAmount: totalAmount.toFixed(2),
            status: "draft",
            createdBy: ctx.userId,
          })
          .returning();

        // Insert commitment line items
        const commitmentLineItems = await db
          .insert(schema.commitmentLineItems)
          .values(
            lineItems.map((item) => ({
              commitmentId: createdCommitment.id,
              budgetLineItemId: null,
              costCodeId: item.costCodeId ?? null,
              description: item.description,
              amount: item.amount.toFixed(2),
            }))
          )
          .returning();

        // Update bid.commitmentId
        await db
          .update(schema.bids)
          .set({ commitmentId: createdCommitment.id })
          .where(eq(schema.bids.id, input.bidId));

        commitment = {
          ...createdCommitment,
          lineItems: commitmentLineItems,
        };
      }

      // Reject all other non-withdrawn bids for this RFQ
      await db
        .update(schema.bids)
        .set({
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.bids.rfqId, requireRfqId(bid)),
            sql`${schema.bids.id} != ${input.bidId}`,
            sql`${schema.bids.status} NOT IN ('withdrawn', 'rejected', 'awarded')`
          )
        );

      // Create audit log
      await createAuditLog(db, schema, {
        entityType: "Bid",
        entityId: input.bidId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          after: {
            bid: awardedBid,
            commitment,
          },
        },
      });

      return {
        bid: awardedBid,
        commitment,
      };
    }),

  /**
   * Check if bid needs updating after RFQ amendments.
   */
  getAmendmentNotifications: protectedProcedure
    .input(z.object({ bidId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch bid
      const [bid] = await db
        .select()
        .from(schema.bids)
        .where(eq(schema.bids.id, input.bidId))
        .limit(1);

      if (!bid) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bid not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Bid");

      // Get bid's latest version triggerAmendmentId
      const [latestVersion] = await db
        .select()
        .from(schema.bidVersions)
        .where(eq(schema.bidVersions.bidId, input.bidId))
        .orderBy(desc(schema.bidVersions.versionNumber))
        .limit(1);

      // Get all amendments for the RFQ
      // Estimate-based bids have no RFQ, so they have no amendments
      const amendments = bid.rfqId
        ? await db
            .select()
            .from(schema.rfqAmendments)
            .where(eq(schema.rfqAmendments.rfqId, bid.rfqId))
            .orderBy(desc(schema.rfqAmendments.amendmentNumber))
        : [];

      // Check if there are unacknowledged amendments
      let unacknowledgedAmendments = amendments;
      if (latestVersion?.triggerAmendmentId) {
        // Filter amendments newer than the acknowledged one
        const acknowledgedAmendment = amendments.find(
          (a) => a.id === latestVersion.triggerAmendmentId
        );
        if (acknowledgedAmendment) {
          unacknowledgedAmendments = amendments.filter(
            (a) => a.amendmentNumber > acknowledgedAmendment.amendmentNumber
          );
        }
      }

      const hasUnacknowledgedAmendments =
        unacknowledgedAmendments.length > 0 &&
        (!latestVersion?.triggerAmendmentId || unacknowledgedAmendments.length > 0);

      return {
        hasUnacknowledgedAmendments,
        amendments: hasUnacknowledgedAmendments ? unacknowledgedAmendments : [],
      };
    }),
});
