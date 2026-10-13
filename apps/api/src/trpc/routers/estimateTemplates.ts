import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { authorizedProcedure } from "../procedures.js";
import {
  createTemplateSchema,
  createLaborRateTemplateSchema,
  applyTemplateSchema,
} from "@construction/shared";
import { eq, and, sql, isNull, or } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { defineAbilitiesFor } from "../../auth/abilities.js";

/**
 * Estimate templates router.
 * Handles cost code template and labor rate template CRUD operations,
 * template application to estimates, and template cloning.
 */
export const estimateTemplatesRouter = router({
  /**
   * List cost code templates.
   * Filters by scope (company, personal, all) and optional project type.
   */
  listCostCodeTemplates: authorizedProcedure
    .input(
      z.object({
        projectType: z.string().optional(),
        scope: z.enum(["company", "personal", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("read", "EstimateTemplate");

      const { db, schema } = ctx.tenant;

      // Build filters based on scope
      const scopeFilters = [];
      if (input.scope === "company") {
        scopeFilters.push(eq(schema.costCodeTemplates.scope, "company"));
      } else if (input.scope === "personal") {
        scopeFilters.push(
          and(
            eq(schema.costCodeTemplates.scope, "personal"),
            eq(schema.costCodeTemplates.createdBy, ctx.userId)
          )
        );
      } else {
        // 'all' - return both company and user's personal templates
        scopeFilters.push(
          or(
            eq(schema.costCodeTemplates.scope, "company"),
            and(
              eq(schema.costCodeTemplates.scope, "personal"),
              eq(schema.costCodeTemplates.createdBy, ctx.userId)
            )
          )
        );
      }

      // Build project type filter
      const projectTypeFilter = input.projectType
        ? or(
            eq(schema.costCodeTemplates.projectType, input.projectType),
            isNull(schema.costCodeTemplates.projectType)
          )
        : undefined;

      // Combine filters
      const whereClause = projectTypeFilter
        ? and(...scopeFilters, projectTypeFilter)
        : and(...scopeFilters);

      // Query templates with line item count
      const templates = await db
        .select({
          id: schema.costCodeTemplates.id,
          name: schema.costCodeTemplates.name,
          description: schema.costCodeTemplates.description,
          scope: schema.costCodeTemplates.scope,
          projectType: schema.costCodeTemplates.projectType,
          createdBy: schema.costCodeTemplates.createdBy,
          isActive: schema.costCodeTemplates.isActive,
          createdAt: schema.costCodeTemplates.createdAt,
          updatedAt: schema.costCodeTemplates.updatedAt,
          lineItemCount: sql<number>`(
            SELECT COUNT(*)
            FROM ${schema.templateLineItems}
            WHERE ${schema.templateLineItems.templateId} = ${schema.costCodeTemplates.id}
          )`,
        })
        .from(schema.costCodeTemplates)
        .where(whereClause);

      return templates;
    }),

  /**
   * Get cost code template by ID with all line items.
   */
  getCostCodeTemplateById: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("read", "EstimateTemplate");

      const { db, schema } = ctx.tenant;

      // Query template
      const [template] = await db
        .select()
        .from(schema.costCodeTemplates)
        .where(eq(schema.costCodeTemplates.id, input.id));

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Verify user can access this template
      if (
        template.scope === "personal" &&
        template.createdBy !== ctx.userId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access another user's personal template",
        });
      }

      // Query line items
      const lineItems = await db
        .select()
        .from(schema.templateLineItems)
        .where(eq(schema.templateLineItems.templateId, input.id))
        .orderBy(schema.templateLineItems.orderIndex);

      return {
        ...template,
        lineItems,
      };
    }),

  /**
   * Create cost code template.
   * Company templates require admin permission.
   * Personal templates require company setting allowPersonalTemplates.
   */
  createCostCodeTemplate: authorizedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Check permissions based on scope
      if (input.scope === "company") {
        // Company templates require create permission (admin only)
        ForbiddenError.from(ctx.abilities).throwUnlessCan(
          "create",
          "EstimateTemplate"
        );
      } else {
        // Personal templates require company to allow it
        const [companyProfile] = await db
          .select()
          .from(schema.companyProfiles)
          .orderBy(sql`valid_from DESC`)
          .limit(1);

        if (
          companyProfile?.allowPersonalTemplates === false
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Personal templates are disabled for this company",
          });
        }
      }

      // Insert template
      const [template] = await db
        .insert(schema.costCodeTemplates)
        .values({
          name: input.name,
          description: input.description,
          scope: input.scope,
          projectType: input.projectType,
          createdBy: ctx.userId,
          isActive: true,
        })
        .returning();

      return template;
    }),

  /**
   * Apply cost code template to estimate.
   * Deep clones all template line items to estimate.
   */
  applyCostCodeTemplate: authorizedProcedure
    .input(applyTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Load estimate to get project ID for abilities
      const [estimate] = await db
        .select({ projectId: schema.estimates.projectId })
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId));

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load project-level abilities
      const memberships = await db
        .select({
          projectId: schema.projectTeamMembers.projectId,
          role: schema.projectTeamMembers.role,
        })
        .from(schema.projectTeamMembers)
        .where(eq(schema.projectTeamMembers.userId, ctx.userId));

      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId,
        memberships
      );

      // Check permission to update estimate
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      // Begin transaction
      return await db.transaction(async (tx) => {
        // Query template with all line items
        const [template] = await tx
          .select()
          .from(schema.costCodeTemplates)
          .where(eq(schema.costCodeTemplates.id, input.templateId));

        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Template not found",
          });
        }

        const templateLineItems = await tx
          .select()
          .from(schema.templateLineItems)
          .where(eq(schema.templateLineItems.templateId, input.templateId))
          .orderBy(schema.templateLineItems.orderIndex);

        if (templateLineItems.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Template has no line items",
          });
        }

        // Deep clone each template line item to estimate
        let itemsAdded = 0;
        for (const templateItem of templateLineItems) {
          await tx.insert(schema.estimateLineItems).values({
            estimateId: input.estimateId,
            costCodeId: templateItem.costCodeId,
            description: templateItem.description,
            quantity: templateItem.quantity ?? "1",
            unit: templateItem.unit ?? "ea",
            unitCost: templateItem.estimatedUnitCost ?? "0",
            costType: templateItem.costType,
            orderIndex: templateItem.orderIndex,
            sourceTemplateId: input.templateId, // Track origin, NO FK constraint
          });
          itemsAdded++;
        }

        // Update estimate to track applied template
        await tx
          .update(schema.estimates)
          .set({
            appliedCostCodeTemplateId: input.templateId,
            updatedAt: new Date(),
          })
          .where(eq(schema.estimates.id, input.estimateId));

        return { success: true, itemsAdded };
      });
    }),

  /**
   * Delete cost code template.
   * Users can delete their own personal templates.
   * Admins can delete company templates.
   */
  deleteCostCodeTemplate: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Query template
      const [template] = await db
        .select()
        .from(schema.costCodeTemplates)
        .where(eq(schema.costCodeTemplates.id, input.id));

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Check permissions
      if (template.scope === "personal") {
        // Personal template - must be owned by user
        if (template.createdBy !== ctx.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot delete another user's personal template",
          });
        }
      } else {
        // Company template - requires delete permission
        ForbiddenError.from(ctx.abilities).throwUnlessCan(
          "delete",
          "EstimateTemplate"
        );
      }

      // Delete template (cascade deletes line items)
      await db
        .delete(schema.costCodeTemplates)
        .where(eq(schema.costCodeTemplates.id, input.id));

      return { success: true };
    }),

  /**
   * List labor rate templates.
   * Filters by scope (company, personal, all).
   */
  listLaborRateTemplates: authorizedProcedure
    .input(
      z.object({
        scope: z.enum(["company", "personal", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      // Check permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("read", "LaborRateTemplate");

      const { db, schema } = ctx.tenant;

      // Build filters based on scope
      let whereClause;
      if (input.scope === "company") {
        whereClause = eq(schema.laborRateTemplates.scope, "company");
      } else if (input.scope === "personal") {
        whereClause = and(
          eq(schema.laborRateTemplates.scope, "personal"),
          eq(schema.laborRateTemplates.createdBy, ctx.userId)
        );
      } else {
        // 'all' - return both company and user's personal templates
        whereClause = or(
          eq(schema.laborRateTemplates.scope, "company"),
          and(
            eq(schema.laborRateTemplates.scope, "personal"),
            eq(schema.laborRateTemplates.createdBy, ctx.userId)
          )
        );
      }

      const templates = await db
        .select()
        .from(schema.laborRateTemplates)
        .where(whereClause);

      return templates;
    }),

  /**
   * Create labor rate template.
   * Company templates require admin permission.
   * Personal templates require company setting allowPersonalTemplates.
   */
  createLaborRateTemplate: authorizedProcedure
    .input(createLaborRateTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Check permissions based on scope
      if (input.scope === "company") {
        // Company templates require create permission (admin only)
        ForbiddenError.from(ctx.abilities).throwUnlessCan(
          "create",
          "LaborRateTemplate"
        );
      } else {
        // Personal templates require company to allow it
        const [companyProfile] = await db
          .select()
          .from(schema.companyProfiles)
          .orderBy(sql`valid_from DESC`)
          .limit(1);

        if (
          companyProfile?.allowPersonalTemplates === false
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Personal templates are disabled for this company",
          });
        }
      }

      // Insert template
      const [template] = await db
        .insert(schema.laborRateTemplates)
        .values({
          name: input.name,
          description: input.description,
          scope: input.scope,
          rates: input.rates,
          createdBy: ctx.userId,
          isActive: true,
        })
        .returning();

      return template;
    }),

  /**
   * Apply labor rate template to estimate.
   * Updates unitCost for all labor line items based on template rates.
   */
  applyLaborRateTemplate: authorizedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        estimateId: z.string().uuid(),
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

      // Load estimate to get project ID for abilities
      const [estimate] = await db
        .select({ projectId: schema.estimates.projectId })
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId));

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }

      // Load project-level abilities
      const memberships = await db
        .select({
          projectId: schema.projectTeamMembers.projectId,
          role: schema.projectTeamMembers.role,
        })
        .from(schema.projectTeamMembers)
        .where(eq(schema.projectTeamMembers.userId, ctx.userId));

      const abilities = defineAbilitiesFor(
        ctx.orgRole ?? "org:member",
        ctx.userId,
        memberships
      );

      // Check permission to update estimate
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      // Query labor rate template
      const [template] = await db
        .select()
        .from(schema.laborRateTemplates)
        .where(eq(schema.laborRateTemplates.id, input.templateId));

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Labor rate template not found",
        });
      }

      // Query all labor line items in the estimate
      const laborLineItems = await db
        .select()
        .from(schema.estimateLineItems)
        .where(
          and(
            eq(schema.estimateLineItems.estimateId, input.estimateId),
            eq(schema.estimateLineItems.costType, "labor")
          )
        );

      let itemsUpdated = 0;

      // Update each labor line item with matching rate from template
      for (const lineItem of laborLineItems) {
        // Extract labor classification from description
        // Example: "Foreman - Site Prep" -> "Foreman"
        const classificationMatch = lineItem.description.match(/^([^-]+)/);
        const classification = classificationMatch
          ? classificationMatch[1].trim()
          : null;

        if (classification && template.rates[classification]) {
          const rate = template.rates[classification];
          await db
            .update(schema.estimateLineItems)
            .set({
              unitCost: rate.toString(),
              updatedAt: new Date(),
            })
            .where(eq(schema.estimateLineItems.id, lineItem.id));

          itemsUpdated++;
        }
      }

      // Update estimate to track applied labor rate template
      await db
        .update(schema.estimates)
        .set({
          appliedLaborRateTemplateId: input.templateId,
          updatedAt: new Date(),
        })
        .where(eq(schema.estimates.id, input.estimateId));

      return { success: true, itemsUpdated };
    }),

  /**
   * Delete labor rate template.
   * Users can delete their own personal templates.
   * Admins can delete company templates.
   */
  deleteLaborRateTemplate: authorizedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.abilities || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Query template
      const [template] = await db
        .select()
        .from(schema.laborRateTemplates)
        .where(eq(schema.laborRateTemplates.id, input.id));

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Check permissions
      if (template.scope === "personal") {
        // Personal template - must be owned by user
        if (template.createdBy !== ctx.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot delete another user's personal template",
          });
        }
      } else {
        // Company template - requires delete permission
        ForbiddenError.from(ctx.abilities).throwUnlessCan(
          "delete",
          "LaborRateTemplate"
        );
      }

      // Delete template
      await db
        .delete(schema.laborRateTemplates)
        .where(eq(schema.laborRateTemplates.id, input.id));

      return { success: true };
    }),
});
