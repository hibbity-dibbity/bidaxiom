import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createEstimateSchema,
  updateEstimateSchema,
  createLineItemSchema,
  updateLineItemSchema,
  generateBidSchema,
  updateBidStatusSchema,
  AuditAction,
  type EstimateStatus,
  type LifecyclePhase,
  isFeatureAvailableInPhase,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { tryAutoAdvance } from "../../lib/lifecycle-state-machine.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, count, inArray, sql } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { calculateEstimateTotals } from "../../services/estimateCalculations.js";
import { convertEstimateToProject } from "../../services/projectConversion.js";
import { canTransitionEstimate } from "../../services/estimateLifecycle.js";
import { generateBidFromEstimate } from "../../services/bidGeneration.js";
import { generateSlug, isValidSlug } from "../../utils/slug.js";

/**
 * Load project-level abilities for the current user.
 * Queries project team memberships and builds CASL abilities with project context.
 */
async function loadProjectAbilities(ctx: {
  tenant: NonNullable<
    Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>
  >;
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
 * Estimates router.
 * Handles estimate CRUD, calculation engine, versioning, and submit workflow.
 */
export const estimatesRouter = router({
  /**
   * List all estimates for a project.
   * Returns estimates with line item counts and calculated totals.
   */
  list: protectedProcedure
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
      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");

      // Query estimates
      const estimates = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.projectId, input.projectId))
        .orderBy(desc(schema.estimates.createdAt));

      // Get line item counts
      if (estimates.length === 0) {
        return [];
      }

      const lineItemCounts = await db
        .select({
          estimateId: schema.estimateLineItems.estimateId,
          count: count(),
        })
        .from(schema.estimateLineItems)
        .where(
          inArray(
            schema.estimateLineItems.estimateId,
            estimates.map((e) => e.id)
          )
        )
        .groupBy(schema.estimateLineItems.estimateId);

      const countMap = new Map(
        lineItemCounts.map((item) => [item.estimateId, Number(item.count)])
      );

      return estimates.map((est) => ({
        ...est,
        lineItemCount: countMap.get(est.id) || 0,
      }));
    }),

  /**
   * Get estimate by ID with all line items.
   * Returns estimate with line items and calculated totals.
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

      // Fetch estimate
      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.id))
        .limit(1);

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");

      // Fetch line items
      const lineItems = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.estimateId, input.id))
        .orderBy(schema.estimateLineItems.orderIndex);

      return {
        ...estimate,
        lineItems,
      };
    }),

  /**
   * Get estimate by slug with all line items.
   * Returns estimate with line items and calculated totals.
   */
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      if (!isValidSlug(input.slug)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid slug format"
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch estimate
      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.slug, input.slug))
        .limit(1);

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");

      // Fetch line items
      const lineItems = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.estimateId, estimate.id))
        .orderBy(schema.estimateLineItems.orderIndex);

      return {
        ...estimate,
        lineItems,
      };
    }),

  /**
   * Create a new estimate.
   * Initializes estimate with draft status and version 1.
   */
  create: protectedProcedure
    .input(createEstimateSchema)
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
      ForbiddenError.from(abilities).throwUnlessCan("create", "Estimate");

      // Verify project exists
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Create estimate without slug first
      const [estimate] = await db
        .insert(schema.estimates)
        .values({
          name: input.name,
          projectId: input.projectId,
          projectType: input.projectType,
          description: input.description,
          status: "draft",
          currentVersion: 1,
          createdBy: ctx.userId,
        })
        .returning();

      // Generate slug using project job number if available
      const identifier = project.jobNumber
        ? `est-${project.jobNumber}`
        : `est-${estimate.id.slice(0, 8)}`;
      const finalSlug = generateSlug(identifier, input.name);

      // Update with final slug
      const [updatedEstimate] = await db
        .update(schema.estimates)
        .set({ slug: finalSlug })
        .where(eq(schema.estimates.id, estimate.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: estimate.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: updatedEstimate,
        },
      });

      // Auto-advance: if project is in 'opportunity', first estimate created advances to 'estimating'
      if (updatedEstimate?.projectId) {
        await tryAutoAdvance(
          ctx.tenant.db,
          ctx.tenant.schema,
          updatedEstimate.projectId,
          "estimating",
          "estimate_created",
          ctx.userId!
        );
      }

      return updatedEstimate;
    }),

  /**
   * Update estimate fields.
   * Recalculates totals from line items if needed.
   * Throws error if trying to change status (use submit procedure).
   */
  update: protectedProcedure
    .input(updateEstimateSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing estimate
      const [existing] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      // Phase gate: Estimate editing is only available in Opportunity and Estimating phases
      const [estimateProject] = await db
        .select({ lifecyclePhase: schema.projects.lifecyclePhase })
        .from(schema.projects)
        .where(eq(schema.projects.id, existing.projectId))
        .limit(1);

      if (estimateProject && !isFeatureAvailableInPhase("estimate_editing", estimateProject.lifecyclePhase as LifecyclePhase)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Estimates cannot be edited in the '${estimateProject.lifecyclePhase}' phase. Estimates are only editable in Opportunity and Estimating phases.`,
        });
      }

      // Check if trying to change status
      if (input.status && input.status !== existing.status && existing.status === "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use submit procedure to change status from draft",
        });
      }

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        updateValues.name = input.name;
      }
      if (input.description !== undefined) {
        updateValues.description = input.description;
      }
      if (input.overheadType !== undefined) {
        updateValues.overheadType = input.overheadType;
      }
      if (input.overheadValue !== undefined) {
        updateValues.overheadValue = input.overheadValue.toFixed(2);
      }
      if (input.markupBase !== undefined) {
        updateValues.markupBase = input.markupBase;
      }

      // Update estimate
      const [updated] = await db
        .update(schema.estimates)
        .set(updateValues)
        .where(eq(schema.estimates.id, input.id))
        .returning();

      // Recalculate totals if overhead or markup base changed
      if (input.overheadType !== undefined || input.overheadValue !== undefined || input.markupBase !== undefined) {
        const lineItems = await db
          .select()
          .from(schema.estimateLineItems)
          .where(eq(schema.estimateLineItems.estimateId, input.id));

        if (lineItems.length > 0) {
          const totals = calculateEstimateTotals(
            lineItems as any,
            {
              companyDefaults: {
                laborMarkup: 20,
                materialMarkup: 15,
                equipmentMarkup: 10,
                subcontractorMarkup: 5,
              },
              markupBaseType: updated.markupBase as "direct" | "direct_plus_overhead",
            },
            {
              type: updated.overheadType as "percentage" | "fixed",
              value: Number(updated.overheadValue),
            }
          );

          // Update denormalized totals
          const [withTotals] = await db
            .update(schema.estimates)
            .set({
              directCosts: totals.directCosts.toFixed(2),
              overheadAmount: totals.overhead.toFixed(2),
              markupAmount: totals.totalMarkup.toFixed(2),
              totalCost: totals.totalCost.toFixed(2),
            })
            .where(eq(schema.estimates.id, input.id))
            .returning();

          // Audit log
          await createAuditLog(db, schema, {
            entityType: "Estimate",
            entityId: input.id,
            action: AuditAction.UPDATE,
            actorId: ctx.userId,
            changes: {
              before: existing,
              after: withTotals,
            },
          });

          return withTotals;
        }
      }

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: existing,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Update a line item.
   * Triggers recalculation of estimate totals.
   */
  updateLineItem: protectedProcedure
    .input(updateLineItemSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing line item
      const [existingItem] = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.id, input.id))
        .limit(1);

      if (!existingItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Line item not found",
        });
      }

      // Fetch estimate to check abilities
      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, existingItem.estimateId))
        .limit(1);

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      // Phase gate: Estimate editing is only available in Opportunity and Estimating phases
      const [lineItemProject] = await db
        .select({ lifecyclePhase: schema.projects.lifecyclePhase })
        .from(schema.projects)
        .where(eq(schema.projects.id, estimate.projectId))
        .limit(1);

      if (lineItemProject && !isFeatureAvailableInPhase("estimate_editing", lineItemProject.lifecyclePhase as LifecyclePhase)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Estimates cannot be edited in the '${lineItemProject.lifecyclePhase}' phase. Estimates are only editable in Opportunity and Estimating phases.`,
        });
      }

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.description !== undefined) {
        updateValues.description = input.description;
      }
      if (input.quantity !== undefined) {
        updateValues.quantity = input.quantity.toFixed(4);
      }
      if (input.unit !== undefined) {
        updateValues.unit = input.unit;
      }
      if (input.unitCost !== undefined) {
        updateValues.unitCost = input.unitCost.toFixed(4);
      }
      if (input.costType !== undefined) {
        updateValues.costType = input.costType;
      }
      if (input.customMarkupPercent !== undefined) {
        updateValues.customMarkupPercent = input.customMarkupPercent?.toFixed(2);
      }
      if (input.costCodeId !== undefined) {
        updateValues.costCodeId = input.costCodeId;
      }

      // Update line item
      const [updated] = await db
        .update(schema.estimateLineItems)
        .set(updateValues)
        .where(eq(schema.estimateLineItems.id, input.id))
        .returning();

      // Recalculate estimate totals
      const allLineItems = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.estimateId, existingItem.estimateId));

      const totals = calculateEstimateTotals(
        allLineItems as any,
        {
          companyDefaults: {
            laborMarkup: 20,
            materialMarkup: 15,
            equipmentMarkup: 10,
            subcontractorMarkup: 5,
          },
          markupBaseType: estimate.markupBase as "direct" | "direct_plus_overhead",
        },
        {
          type: estimate.overheadType as "percentage" | "fixed",
          value: Number(estimate.overheadValue),
        }
      );

      // Update denormalized totals on estimate
      await db
        .update(schema.estimates)
        .set({
          directCosts: totals.directCosts.toFixed(2),
          overheadAmount: totals.overhead.toFixed(2),
          markupAmount: totals.totalMarkup.toFixed(2),
          totalCost: totals.totalCost.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.estimates.id, existingItem.estimateId));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "EstimateLineItem",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: existingItem,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Create a line item.
   * Appends to end of estimate (max orderIndex + 1).
   */
  createLineItem: protectedProcedure
    .input(createLineItemSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch estimate to check abilities
      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId))
        .limit(1);

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      // Get max orderIndex
      const [maxOrderResult] = await db
        .select({
          maxOrder: sql<number>`COALESCE(MAX(${schema.estimateLineItems.orderIndex}), -1)`,
        })
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.estimateId, input.estimateId));

      const orderIndex = (maxOrderResult?.maxOrder ?? -1) + 1;

      // Create line item
      const [lineItem] = await db
        .insert(schema.estimateLineItems)
        .values({
          estimateId: input.estimateId,
          costCodeId: input.costCodeId,
          description: input.description,
          quantity: input.quantity.toFixed(4),
          unit: input.unit,
          unitCost: input.unitCost.toFixed(4),
          costType: input.costType,
          customMarkupPercent: input.customMarkupPercent?.toFixed(2) ?? null,
          orderIndex,
        })
        .returning();

      // Recalculate estimate totals
      const allLineItems = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.estimateId, input.estimateId));

      const totals = calculateEstimateTotals(
        allLineItems as any,
        {
          companyDefaults: {
            laborMarkup: 20,
            materialMarkup: 15,
            equipmentMarkup: 10,
            subcontractorMarkup: 5,
          },
          markupBaseType: estimate.markupBase as "direct" | "direct_plus_overhead",
        },
        {
          type: estimate.overheadType as "percentage" | "fixed",
          value: Number(estimate.overheadValue),
        }
      );

      // Update denormalized totals on estimate
      await db
        .update(schema.estimates)
        .set({
          directCosts: totals.directCosts.toFixed(2),
          overheadAmount: totals.overhead.toFixed(2),
          markupAmount: totals.totalMarkup.toFixed(2),
          totalCost: totals.totalCost.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.estimates.id, input.estimateId));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "EstimateLineItem",
        entityId: lineItem.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: {
          after: lineItem,
        },
      });

      return lineItem;
    }),

  /**
   * Delete a line item.
   * Recalculates estimate totals.
   */
  deleteLineItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch existing line item
      const [existingItem] = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.id, input.id))
        .limit(1);

      if (!existingItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Line item not found",
        });
      }

      // Fetch estimate to check abilities
      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, existingItem.estimateId))
        .limit(1);

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      // Delete line item
      await db
        .delete(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.id, input.id));

      // Recalculate estimate totals
      const allLineItems = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.estimateId, existingItem.estimateId));

      if (allLineItems.length > 0) {
        const totals = calculateEstimateTotals(
          allLineItems as any,
          {
            companyDefaults: {
              laborMarkup: 20,
              materialMarkup: 15,
              equipmentMarkup: 10,
              subcontractorMarkup: 5,
            },
            markupBaseType: estimate.markupBase as "direct" | "direct_plus_overhead",
          },
          {
            type: estimate.overheadType as "percentage" | "fixed",
            value: Number(estimate.overheadValue),
          }
        );

        // Update denormalized totals on estimate
        await db
          .update(schema.estimates)
          .set({
            directCosts: totals.directCosts.toFixed(2),
            overheadAmount: totals.overhead.toFixed(2),
            markupAmount: totals.totalMarkup.toFixed(2),
            totalCost: totals.totalCost.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(schema.estimates.id, existingItem.estimateId));
      } else {
        // No line items left, reset totals to 0
        await db
          .update(schema.estimates)
          .set({
            directCosts: "0.00",
            overheadAmount: "0.00",
            markupAmount: "0.00",
            totalCost: "0.00",
            updatedAt: new Date(),
          })
          .where(eq(schema.estimates.id, existingItem.estimateId));
      }

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "EstimateLineItem",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          before: existingItem,
        },
      });

      return { success: true };
    }),

  /**
   * Submit estimate for approval.
   * Creates immutable version snapshot and changes status to submitted.
   */
  submit: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
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
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      // Get estimate with line items
      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId))
        .limit(1);

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      if (estimate.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft estimates can be submitted",
        });
      }

      // Fetch line items
      const lineItems = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.estimateId, input.estimateId))
        .orderBy(schema.estimateLineItems.orderIndex);

      // Begin transaction
      const result = await db.transaction(async (tx) => {
        const newVersion = estimate.currentVersion + 1;

        // Create immutable version snapshot
        await tx.insert(schema.estimateVersions).values({
          estimateId: input.estimateId,
          version: newVersion,
          status: "submitted",
          snapshot: {
            estimate: estimate,
            lineItems: lineItems,
            totals: {
              directCosts: estimate.directCosts,
              overheadAmount: estimate.overheadAmount,
              markupAmount: estimate.markupAmount,
              totalCost: estimate.totalCost,
            },
          },
          createdBy: ctx.userId!,
        });

        // Update estimate status
        const [updated] = await tx
          .update(schema.estimates)
          .set({
            status: "submitted",
            currentVersion: newVersion,
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.estimates.id, input.estimateId))
          .returning();

        return { estimate: updated, version: newVersion };
      });

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: input.estimateId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: estimate,
          after: result.estimate,
        },
      });

      return { success: true, version: result.version };
    }),

  /**
   * Delete an estimate.
   * Only allowed for draft estimates.
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

      // Fetch estimate
      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.id))
        .limit(1);

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load abilities
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      ForbiddenError.from(abilities).throwUnlessCan("delete", "Estimate");

      // Validate status is draft
      if (estimate.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft estimates can be deleted",
        });
      }

      // Delete estimate (cascade will delete line items via FK)
      await db.delete(schema.estimates).where(eq(schema.estimates.id, input.id));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          before: estimate,
        },
      });

      return { success: true };
    }),

  /**
   * Convert accepted estimate to active project.
   * Creates budget line items from estimate line items.
   */
  convertToProject: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
      }
      return await convertEstimateToProject({ tenant: ctx.tenant }, {
        estimateId: input.estimateId,
        userId: ctx.userId,
      });
    }),

  /**
   * Submit estimate for approval.
   * Validates status transition and updates both estimate and project status.
   */
  submitEstimate: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      const estimate = await db.query.estimates.findFirst({
        where: eq(schema.estimates.id, input.estimateId),
      });

      if (!estimate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
      }

      if (!canTransitionEstimate(estimate.status as EstimateStatus, "submitted")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot submit estimate with status '${estimate.status}'`,
        });
      }

      return await db.transaction(async (tx) => {
        // Update estimate status
        const [updated] = await tx.update(schema.estimates)
          .set({
            status: "submitted",
            submittedAt: new Date(),
          })
          .where(eq(schema.estimates.id, input.estimateId))
          .returning();

        // Update project status to "bidding"
        await tx.update(schema.projects)
          .set({ status: "bidding" })
          .where(eq(schema.projects.id, estimate.projectId));

        return updated;
      });
    }),

  /**
   * Generate bid from estimate.
   * Creates bid with immutable snapshot of estimate line items.
   */
  generateBid: protectedProcedure
    .input(generateBidSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      return await generateBidFromEstimate({ tenant: ctx.tenant }, {
        ...input,
        userId: ctx.userId,
      });
    }),

  /**
   * Send estimate to customer.
   * Sets status to "submitted" unconditionally (idempotent for all non-under_contract statuses).
   * Bypasses the state machine constraint in submitEstimate — business intent is "re-sendable at any time".
   */
  sendToCustomer: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
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

      ForbiddenError.from(abilities).throwUnlessCan("manage", "Estimate");

      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId))
        .limit(1);

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      if (estimate.status === "under_contract") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot re-send a proposal that is already under contract",
        });
      }

      const [updated] = await db
        .update(schema.estimates)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.estimates.id, input.estimateId))
        .returning();

      return updated;
    }),

  /**
   * Update bid status (won/lost).
   * Validates status transition and updates estimate status when bid is won.
   */
  updateBidStatus: protectedProcedure
    .input(updateBidStatusSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      const bid = await db.query.bids.findFirst({
        where: eq(schema.bids.id, input.bidId),
      });

      if (!bid) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bid not found" });
      }

      if (bid.status !== "submitted" && (input.status === "won" || input.status === "lost")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only mark submitted bids as won/lost",
        });
      }

      return await db.transaction(async (tx) => {
        // Update bid status
        const [updated] = await tx.update(schema.bids)
          .set({
            status: input.status,
            closedAt: input.status === "won" || input.status === "lost" ? new Date() : undefined,
            closedBy: input.status === "won" || input.status === "lost" ? ctx.userId : undefined,
            closedNotes: input.notes,
          })
          .where(eq(schema.bids.id, input.bidId))
          .returning();

        // If won, update estimate to accepted
        if (input.status === "won" && bid.estimateId) {
          await tx.update(schema.estimates)
            .set({
              status: "accepted",
              acceptedAt: new Date(),
            })
            .where(eq(schema.estimates.id, bid.estimateId));
        }

        return updated;
      });
    }),
});
