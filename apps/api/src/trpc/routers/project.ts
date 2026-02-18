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
  listProjectsSchema,
  DEFAULT_PROJECT_FOLDERS,
  DEFAULT_PROJECT_PHASES,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, inArray, and, like, or, asc, count, sql, gte, lte, isNull } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { db as publicDb } from "../../db/client.js";
import { users } from "../../db/schema/public.js";
import { generateUniqueProjectSlug } from "../../utils/slug.js";
import { generateJobNumber } from "../../utils/job-number.js";

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

      // Get company profile for job number settings
      const [companyProfile] = await db
        .select()
        .from(schema.companyProfiles)
        .where(isNull(schema.companyProfiles.validTo))
        .limit(1);

      const jobNumberSettings = companyProfile?.jobNumberSettings;

      // Auto-generation and counter increment logic
      let finalJobNumber = input.jobNumber; // Start with manual input (if provided)
      let updatedJobSettings = jobNumberSettings;

      if (!finalJobNumber && jobNumberSettings?.enabled) {
        // Auto-generate job number
        const result = generateJobNumber(jobNumberSettings);
        finalJobNumber = result.jobNumber;
        updatedJobSettings = result.updatedSettings;
      }

      // If manual job number provided and auto-generation is enabled, increment counter
      // to prevent future auto-generated numbers from conflicting
      if (input.jobNumber && jobNumberSettings?.enabled) {
        // Extract only the sequence digits from the manual job number using the template's
        // {N+} length. E.g. template "{YY}{NNNN}" has 4 N's, so extract exactly 4 trailing
        // digits from "265000" → "5000" (not all 6 digits → "265000").
        const templateSeqMatch = jobNumberSettings.template.match(/\{(N+)\}/);
        const sequenceLength = templateSeqMatch ? templateSeqMatch[1].length : null;
        const seqRegex = sequenceLength
          ? new RegExp(`(\\d{${sequenceLength}})$`)
          : /(\d+)$/;
        const sequenceMatch = input.jobNumber.match(seqRegex);
        if (sequenceMatch) {
          const manualSequence = parseInt(sequenceMatch[1], 10);
          // Set nextSequenceNumber to be one higher than manual entry
          if (manualSequence >= jobNumberSettings.nextSequenceNumber) {
            updatedJobSettings = {
              ...jobNumberSettings,
              nextSequenceNumber: manualSequence + 1,
            };
          }
        }
      }

      // Generate unique slug before creating project
      const projectSlug = await generateUniqueProjectSlug(
        finalJobNumber || null,
        input.name,
        db,
        schema
      );

      // Transaction: create project + team + folders + phases atomically
      const project = await db.transaction(async (tx) => {
        // Update company profile with new sequence number if changed
        if (updatedJobSettings && updatedJobSettings !== jobNumberSettings) {
          await tx
            .update(schema.companyProfiles)
            .set({ jobNumberSettings: updatedJobSettings })
            .where(isNull(schema.companyProfiles.validTo));
        }

        // Insert project
        const [newProject] = await tx
          .insert(schema.projects)
          .values({
            name: input.name,
            jobNumber: finalJobNumber || null,
            slug: projectSlug,
            customerId: input.customerId,
            description: input.description,
            location: null, // Legacy column - no longer used
            street1: input.location?.street1 || null,
            street2: input.location?.street2 || null,
            city: input.location?.city || null,
            state: input.location?.state || null,
            zip: input.location?.zipCode || null,
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
    .input(listProjectsSchema)
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
            like(schema.projects.street1, `%${input.search}%`),
            like(schema.projects.city, `%${input.search}%`),
            like(schema.projects.state, `%${input.search}%`)
          )
        );
      }

      if (input.customerId) {
        conditions.push(eq(schema.projects.customerId, input.customerId));
      }

      if (input.startDateFrom) {
        conditions.push(gte(schema.projects.startDate, new Date(input.startDateFrom)));
      }

      if (input.startDateTo) {
        conditions.push(lte(schema.projects.startDate, new Date(input.startDateTo)));
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

      // Filter by assigned user (if provided)
      if (input.assignedUserId) {
        const assignedProjectIds = await db
          .select({ projectId: schema.projectTeamMembers.projectId })
          .from(schema.projectTeamMembers)
          .where(eq(schema.projectTeamMembers.userId, input.assignedUserId));

        const projectIds = assignedProjectIds.map((m) => m.projectId);

        if (projectIds.length === 0) {
          // No projects for this user
          return { items: [], total: 0 };
        }

        conditions.push(inArray(schema.projects.id, projectIds));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Determine sort order
      const sortColumn = {
        name: schema.projects.name,
        jobNumber: schema.projects.jobNumber,
        status: schema.projects.status,
        createdAt: schema.projects.createdAt,
        startDate: schema.projects.startDate,
      }[input.sortBy];

      const orderByClause = input.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      // Query with customer join
      const [items, totalResult] = await Promise.all([
        db
          .select({
            id: schema.projects.id,
            name: schema.projects.name,
            jobNumber: schema.projects.jobNumber,
            slug: schema.projects.slug,
            customerId: schema.projects.customerId,
            customerName: sql<string>`COALESCE(${schema.customers.companyName}, ${schema.customers.contactName})`,
            description: schema.projects.description,
            location: schema.projects.location,
            street1: schema.projects.street1,
            street2: schema.projects.street2,
            city: schema.projects.city,
            state: schema.projects.state,
            zip: schema.projects.zip,
            projectType: schema.projects.projectType,
            status: schema.projects.status,
            startDate: schema.projects.startDate,
            endDate: schema.projects.endDate,
            budget: schema.projects.budget,
            costCodes: schema.projects.costCodes,
            metadata: schema.projects.metadata,
            createdBy: schema.projects.createdBy,
            createdAt: schema.projects.createdAt,
            updatedAt: schema.projects.updatedAt,
          })
          .from(schema.projects)
          .leftJoin(schema.customers, eq(schema.projects.customerId, schema.customers.id))
          .where(whereClause)
          .orderBy(orderByClause)
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: count() })
          .from(schema.projects)
          .where(whereClause),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
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
   * Get project by slug with team members, phases, and customer details.
   */
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string().min(1) }))
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
        .where(eq(schema.projects.slug, input.slug))
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
        .where(eq(schema.projectTeamMembers.projectId, project.id));

      // Query phases
      const phases = await db
        .select()
        .from(schema.projectPhases)
        .where(eq(schema.projectPhases.projectId, project.id))
        .orderBy(schema.projectPhases.orderIndex);

      // Query customer details
      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, project.customerId))
        .limit(1);

      return {
        ...project,
        teamMembers,
        phases,
        customer: customer || null,
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
      if (input.jobNumber !== undefined) updateValues.jobNumber = input.jobNumber;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.location !== undefined) {
        // Map structured location to DB columns
        updateValues.location = null; // Legacy column - no longer used
        updateValues.street1 = input.location.street1 || null;
        updateValues.street2 = input.location.street2 || null;
        updateValues.city = input.location.city || null;
        updateValues.state = input.location.state || null;
        updateValues.zip = input.location.zipCode || null;
      }
      if (input.projectType !== undefined) updateValues.projectType = input.projectType;
      if (input.status !== undefined) updateValues.status = input.status;
      if (input.startDate !== undefined)
        updateValues.startDate = input.startDate ? new Date(input.startDate) : null;
      if (input.endDate !== undefined)
        updateValues.endDate = input.endDate ? new Date(input.endDate) : null;
      if (input.costCodes !== undefined) updateValues.costCodes = input.costCodes;

      // Regenerate slug if name or jobNumber changed
      if (input.name !== undefined || input.jobNumber !== undefined) {
        const newName = input.name ?? existingProject.name;
        const newJobNumber = input.jobNumber !== undefined ? input.jobNumber : existingProject.jobNumber;

        updateValues.slug = await generateUniqueProjectSlug(
          newJobNumber,
          newName,
          db,
          schema,
          input.id
        );
      }

      // Load company profile for job number settings
      const [companyProfile] = await db
        .select()
        .from(schema.companyProfiles)
        .where(isNull(schema.companyProfiles.validTo))
        .limit(1);

      const jobNumberSettings = companyProfile?.jobNumberSettings;
      let updatedJobSettings = jobNumberSettings;

      // If manual job number provided and auto-generation is enabled, advance counter
      // to prevent future auto-generated numbers from conflicting
      if (input.jobNumber && jobNumberSettings?.enabled) {
        const templateSeqMatch = jobNumberSettings.template.match(/\{(N+)\}/);
        const sequenceLength = templateSeqMatch ? templateSeqMatch[1].length : null;
        const seqRegex = sequenceLength
          ? new RegExp(`(\\d{${sequenceLength}})$`)
          : /(\d+)$/;
        const sequenceMatch = input.jobNumber.match(seqRegex);
        if (sequenceMatch) {
          const manualSequence = parseInt(sequenceMatch[1], 10);
          if (manualSequence >= jobNumberSettings.nextSequenceNumber) {
            updatedJobSettings = {
              ...jobNumberSettings,
              nextSequenceNumber: manualSequence + 1,
            };
          }
        }
      }

      const updated = await db.transaction(async (tx) => {
        // Advance job number counter if needed
        if (updatedJobSettings && updatedJobSettings !== jobNumberSettings) {
          await tx
            .update(schema.companyProfiles)
            .set({ jobNumberSettings: updatedJobSettings })
            .where(isNull(schema.companyProfiles.validTo));
        }

        const [updatedProject] = await tx
          .update(schema.projects)
          .set(updateValues)
          .where(eq(schema.projects.id, input.id))
          .returning();

        return updatedProject;
      });

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
