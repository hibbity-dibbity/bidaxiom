import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createProjectSchema,
  updateProjectSchema,
  teamMemberSchema,
  projectPhaseSchema,
  projectRoleEnum,
  projectStatusEnum,
  DEFAULT_PROJECT_FOLDERS,
  DEFAULT_PROJECT_PHASES,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, inArray, and, like, or } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { db as publicDb } from "../../db/client.js";
import { users } from "../../db/schema/public.js";

/**
 * Load project-level abilities for the current user.
 * Queries project team memberships and builds CASL abilities with project context.
 */
async function loadProjectAbilities(ctx: {
  tenant: NonNullable<Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>>;
  userId: string;
  orgRole: string | null;
}) {
  // userId is guaranteed non-null by protectedProcedure
  // Look up the user's Clerk ID from public.users table for backward compatibility
  const [publicUser] = await publicDb
    .select({
      clerkUserId: users.clerkUserId,
    })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  const clerkUserId = publicUser?.clerkUserId;

  // Query memberships matching either the new UUID or old Clerk ID
  const memberships = await ctx.tenant.db
    .select({
      projectId: ctx.tenant.schema.projectTeamMembers.projectId,
      role: ctx.tenant.schema.projectTeamMembers.role,
    })
    .from(ctx.tenant.schema.projectTeamMembers)
    .where(
      clerkUserId
        ? or(
            eq(ctx.tenant.schema.projectTeamMembers.userId, ctx.userId),
            eq(ctx.tenant.schema.projectTeamMembers.userId, clerkUserId)
          )
        : eq(ctx.tenant.schema.projectTeamMembers.userId, ctx.userId)
    );

  return defineAbilitiesFor(
    ctx.orgRole ?? "org:member",
    ctx.userId,
    memberships
  );
}

/**
 * Project management router.
 * Handles project CRUD, team management, phase management with CASL enforcement and audit logging.
 */
export const projectRouter = router({
  /**
   * Create a new project with team, folders, and phases.
   * Auto-adds the creating user as project manager.
   * Auto-generates default folder structure and phases if not provided.
   */
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      // Runtime null checks for TypeScript
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("create", "Project");

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Transaction: create project + team + folders + phases atomically
      const project = await db.transaction(async (tx) => {
        // Insert project
        const [newProject] = await tx
          .insert(schema.projects)
          .values({
            name: input.name,
            customerId: input.customerId,
            description: input.description,
            location: input.location,
            projectType: input.projectType,
            startDate: input.startDate ? new Date(input.startDate) : null,
            endDate: input.endDate ? new Date(input.endDate) : null,
            costCodes: input.costCodes,
            createdBy: userId,
          })
          .returning();

        if (!newProject) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create project",
          });
        }

        // Auto-add creator as project manager
        await tx.insert(schema.projectTeamMembers).values({
          projectId: newProject.id,
          userId,
          role: "project_manager",
          assignedBy: userId,
        });

        // Add additional team members
        if (input.teamMembers.length > 0) {
          await tx.insert(schema.projectTeamMembers).values(
            input.teamMembers.map((member) => ({
              projectId: newProject.id,
              userId: member.userId,
              role: member.role,
              assignedBy: userId,
            }))
          );
        }

        // Create default folder structure
        await tx.insert(schema.folders).values(
          DEFAULT_PROJECT_FOLDERS.map((folder) => ({
            projectId: newProject.id,
            parentId: null,
            name: folder.name,
            description: folder.description,
            orderIndex: folder.order,
            createdBy: userId,
          }))
        );

        // Create project phases
        const phasesToInsert = input.phases.length > 0 ? input.phases : DEFAULT_PROJECT_PHASES;
        await tx.insert(schema.projectPhases).values(
          phasesToInsert.map((phase) => ({
            projectId: newProject.id,
            name: phase.name,
            orderIndex: phase.orderIndex,
            startDate: "startDate" in phase && phase.startDate ? new Date(phase.startDate) : null,
            endDate: "endDate" in phase && phase.endDate ? new Date(phase.endDate) : null,
          }))
        );

        return newProject;
      });

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Project",
        entityId: project.id,
        action: AuditAction.CREATE,
        actorId: userId,
        changes: {
          after: project,
        },
      });

      return project;
    }),

  /**
   * List projects with filters.
   * org:admin sees all projects.
   * Other roles see only projects they're assigned to.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: projectStatusEnum.optional(),
        search: z.string().optional(),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
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

      // Build WHERE conditions
      const conditions = [];

      if (input.status) {
        conditions.push(eq(schema.projects.status, input.status));
      }

      if (input.search) {
        conditions.push(
          or(
            like(schema.projects.name, `%${input.search}%`),
            like(schema.projects.location, `%${input.search}%`)
          )
        );
      }

      // For non-admins: filter to only projects they're team members of
      if (ctx.orgRole !== "org:admin") {
        const userMemberships = await db
          .select({ projectId: schema.projectTeamMembers.projectId })
          .from(schema.projectTeamMembers)
          .where(eq(schema.projectTeamMembers.userId, ctx.userId));

        const projectIds = userMemberships.map((m) => m.projectId);

        if (projectIds.length === 0) {
          // No projects for this user
          return { items: [], total: 0 };
        }

        conditions.push(inArray(schema.projects.id, projectIds));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalResult] = await Promise.all([
        db
          .select()
          .from(schema.projects)
          .where(whereClause)
          .orderBy(desc(schema.projects.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: schema.projects.id })
          .from(schema.projects)
          .where(whereClause),
      ]);

      return {
        items,
        total: totalResult.length,
      };
    }),

  /**
   * Get project by ID with team members and phases.
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

      // Query project
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.id))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("read", "Project");

      // Query team members with user profiles
      const teamMembers = await db
        .select({
          id: schema.projectTeamMembers.id,
          userId: schema.projectTeamMembers.userId,
          role: schema.projectTeamMembers.role,
          assignedAt: schema.projectTeamMembers.assignedAt,
          email: schema.userProfiles.email,
          firstName: schema.userProfiles.firstName,
          lastName: schema.userProfiles.lastName,
        })
        .from(schema.projectTeamMembers)
        .leftJoin(
          schema.userProfiles,
          eq(schema.projectTeamMembers.userId, schema.userProfiles.clerkUserId)
        )
        .where(eq(schema.projectTeamMembers.projectId, input.id));

      // Query phases
      const phases = await db
        .select()
        .from(schema.projectPhases)
        .where(eq(schema.projectPhases.projectId, input.id))
        .orderBy(schema.projectPhases.orderIndex);

      return {
        ...project,
        teamMembers,
        phases,
      };
    }),

  /**
   * Update project fields.
   */
  update: protectedProcedure
    .input(updateProjectSchema)
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
      const userId = ctx.userId;

      // Query existing project
      const [existingProject] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.id))
        .limit(1);

      if (!existingProject) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "Project");

      // Build update values (only include defined fields)
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateValues.name = input.name;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.location !== undefined) updateValues.location = input.location;
      if (input.projectType !== undefined) updateValues.projectType = input.projectType;
      if (input.status !== undefined) updateValues.status = input.status;
      if (input.startDate !== undefined)
        updateValues.startDate = input.startDate ? new Date(input.startDate) : null;
      if (input.endDate !== undefined)
        updateValues.endDate = input.endDate ? new Date(input.endDate) : null;
      if (input.costCodes !== undefined) updateValues.costCodes = input.costCodes;

      const [updated] = await db
        .update(schema.projects)
        .set(updateValues)
        .where(eq(schema.projects.id, input.id))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Project",
        entityId: input.id,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          before: existingProject,
          after: updated,
        },
      });

      return updated;
    }),

  /**
   * Archive a project (soft delete).
   */
  archive: protectedProcedure
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
      const userId = ctx.userId;

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("delete", "Project");

      await db
        .update(schema.projects)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, input.id));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Project",
        entityId: input.id,
        action: AuditAction.DELETE,
        actorId: userId,
        changes: {
          after: { status: "archived" },
        },
      });

      return { success: true };
    }),

  /**
   * Add a team member to a project.
   */
  addTeamMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string().min(1),
        role: projectRoleEnum,
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
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      const actorId = ctx.userId;

      // Check permission (manage ProjectTeam is typically limited to admins and PMs)
      ForbiddenError.from(abilities).throwUnlessCan("manage", "ProjectTeam");

      const [teamMember] = await db
        .insert(schema.projectTeamMembers)
        .values({
          projectId: input.projectId,
          userId: input.userId,
          role: input.role,
          assignedBy: actorId,
        })
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "ProjectTeam",
        entityId: input.projectId,
        action: AuditAction.CREATE,
        actorId,
        changes: {
          after: teamMember,
        },
      });

      return teamMember;
    }),

  /**
   * Remove a team member from a project.
   */
  removeTeamMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string().min(1),
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
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      const actorId = ctx.userId;

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("manage", "ProjectTeam");

      // Look up the user's Clerk ID to handle removing old team members
      const [publicUser] = await publicDb
        .select({
          clerkUserId: users.clerkUserId,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      const clerkUserId = publicUser?.clerkUserId;

      // Delete matching either UUID or Clerk ID
      await db
        .delete(schema.projectTeamMembers)
        .where(
          and(
            eq(schema.projectTeamMembers.projectId, input.projectId),
            clerkUserId
              ? or(
                  eq(schema.projectTeamMembers.userId, input.userId),
                  eq(schema.projectTeamMembers.userId, clerkUserId)
                )
              : eq(schema.projectTeamMembers.userId, input.userId)
          )
        );

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "ProjectTeam",
        entityId: input.projectId,
        action: AuditAction.DELETE,
        actorId,
        changes: {
          before: { userId: input.userId },
        },
      });

      return { success: true };
    }),

  /**
   * Update project phases.
   * Replaces all existing phases with new ones.
   */
  updatePhases: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        phases: z.array(projectPhaseSchema),
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
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      const userId = ctx.userId;

      // Check permission
      ForbiddenError.from(abilities).throwUnlessCan("update", "Project");

      // Transaction: delete old phases, insert new ones
      const phases = await db.transaction(async (tx) => {
        // Delete existing phases
        await tx
          .delete(schema.projectPhases)
          .where(eq(schema.projectPhases.projectId, input.projectId));

        // Insert new phases
        if (input.phases.length > 0) {
          return await tx
            .insert(schema.projectPhases)
            .values(
              input.phases.map((phase) => ({
                projectId: input.projectId,
                name: phase.name,
                orderIndex: phase.orderIndex,
                startDate: phase.startDate ? new Date(phase.startDate) : null,
                endDate: phase.endDate ? new Date(phase.endDate) : null,
              }))
            )
            .returning();
        }

        return [];
      });

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Project",
        entityId: input.projectId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: { phases },
        },
      });

      return phases;
    }),
});
