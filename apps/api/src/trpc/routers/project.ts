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
  transitionLifecyclePhaseSchema,
  setProjectModeSchema,
  lifecyclePhaseEnum,
  projectModeEnum,
  LIFECYCLE_ORDER,
  LIFECYCLE_PHASE_LABELS,
  BLOCKED_DELETION_PHASES,
  type LifecyclePhase,
  type DeletableCheckResult,
  DEFAULT_PROJECT_FOLDERS,
  DEFAULT_PROJECT_PHASES,
  AuditAction,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { tryAutoAdvance } from "../../lib/lifecycle-state-machine.js";
import { eq, desc, inArray, and, like, or, asc, count, sql, gte, lte, isNull, isNotNull, ilike, ne } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { db as publicDb } from "../../db/client.js";
import { users } from "../../db/schema/public.js";
import { generateUniqueProjectSlug } from "../../utils/slug.js";
import { generateJobNumber } from "../../utils/job-number.js";
import { afterPhaseChange } from "../../services/projectAutomation.js";
import { queueProjectSyncOnChange } from "../../integrations/quickbooks/autoSync.js";

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
        // Auto-generate job number, skipping any already-used numbers
        let result = generateJobNumber(jobNumberSettings);
        const MAX_ATTEMPTS = 1000;
        let attempts = 0;
        while (attempts < MAX_ATTEMPTS) {
          const [existing] = await db
            .select({ id: schema.projects.id })
            .from(schema.projects)
            .where(ilike(schema.projects.jobNumber, result.jobNumber))
            .limit(1);
          if (!existing) break; // unique — use this number
          // Already taken — advance counter and try next
          result = generateJobNumber(result.updatedSettings);
          attempts++;
        }
        if (attempts >= MAX_ATTEMPTS) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to generate a unique job number. Please reset the sequence in company settings.",
          });
        }
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

      // Resolve projectMode: use input value, or fall back to user's defaultProjectMode preference
      let projectMode: string = input.projectMode ?? "gc_advanced";
      if (!input.projectMode) {
        const [profile] = await db
          .select({ defaultProjectMode: schema.userProfiles.defaultProjectMode })
          .from(schema.userProfiles)
          .where(eq(schema.userProfiles.clerkUserId, userId))
          .limit(1);
        if (profile?.defaultProjectMode) {
          projectMode = profile.defaultProjectMode;
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
        // Hard uniqueness check inside transaction — prevents both race conditions
        // and manually-entered duplicates. Client-side blur validation is advisory only.
        if (finalJobNumber) {
          const [duplicate] = await tx
            .select({ id: schema.projects.id })
            .from(schema.projects)
            .where(ilike(schema.projects.jobNumber, finalJobNumber))
            .limit(1);
          if (duplicate) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Job number ${finalJobNumber} is already in use. Please choose a different number.`,
            });
          }
        }

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
            projectMode: projectMode as "simple" | "gc_advanced",
            customerBudget: input.customerBudget != null ? String(input.customerBudget) : null,
            buildingWidth: input.buildingWidth != null ? String(input.buildingWidth) : null,
            buildingLength: input.buildingLength != null ? String(input.buildingLength) : null,
            buildingHeight: input.buildingHeight != null ? String(input.buildingHeight) : null,
            buildingSqft: (input.buildingWidth != null && input.buildingLength != null)
              ? String(input.buildingWidth * input.buildingLength)
              : null,
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
      await queueProjectSyncOnChange(ctx.tenant, project.id);

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

      // Build WHERE conditions — always exclude soft-deleted projects
      const conditions = [isNull(schema.projects.deletedAt)];

      if (input.status) {
        conditions.push(eq(schema.projects.status, input.status));
      }

      if (input.lifecyclePhase) {
        conditions.push(eq(schema.projects.lifecyclePhase, input.lifecyclePhase));
      }

      if (input.search) {
        const searchCond = or(
          like(schema.projects.name, `%${input.search}%`),
          like(schema.projects.street1, `%${input.search}%`),
          like(schema.projects.city, `%${input.search}%`),
          like(schema.projects.state, `%${input.search}%`)
        );
        if (searchCond) conditions.push(searchCond);
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
            lifecyclePhase: schema.projects.lifecyclePhase,
            projectMode: schema.projects.projectMode,
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

      // Query project — exclude soft-deleted
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(and(isNull(schema.projects.deletedAt), eq(schema.projects.id, input.id)))
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

      // Query project — exclude soft-deleted
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(and(isNull(schema.projects.deletedAt), eq(schema.projects.slug, input.slug)))
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
      if (input.customerId !== undefined && input.customerId !== existingProject.customerId) {
        const [cust] = await db.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.id, input.customerId)).limit(1);
        if (!cust) throw new TRPCError({ code: "BAD_REQUEST", message: "That customer no longer exists." });
        updateValues.customerId = input.customerId;
      }
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
      if (input.customerBudget !== undefined)
        updateValues.customerBudget =
          input.customerBudget !== null ? String(input.customerBudget) : null;

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
        // Hard uniqueness check — prevent duplicate job numbers on edit.
        // Excludes the project being edited so it can keep its own number.
        if (input.jobNumber !== undefined && input.jobNumber !== null && input.jobNumber !== "") {
          const [duplicate] = await tx
            .select({ id: schema.projects.id })
            .from(schema.projects)
            .where(and(
              ilike(schema.projects.jobNumber, input.jobNumber),
              ne(schema.projects.id, input.id)
            ))
            .limit(1);
          if (duplicate) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Job number ${input.jobNumber} is already in use. Please choose a different number.`,
            });
          }
        }

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
      if (updated) await queueProjectSyncOnChange(ctx.tenant, input.id);

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

  /**
   * Manually transition a project to a different lifecycle phase.
   * Transitions are unrestricted — any phase to any phase in one action.
   * RBAC: org:admin, or project-level estimator or project_administrator.
   */
  transitionLifecyclePhase: protectedProcedure
    .input(transitionLifecyclePhaseSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }

      const { db, schema } = ctx.tenant;

      // Load project
      const [project] = await db
        .select({ id: schema.projects.id, lifecyclePhase: schema.projects.lifecyclePhase })
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      // RBAC: must be org:admin, or have project team role of 'estimator', 'project_manager', or 'project_administrator'
      const isOrgAdmin = ctx.orgRole === "org:admin";
      const memberships = await db
        .select({ role: schema.projectTeamMembers.role })
        .from(schema.projectTeamMembers)
        .where(eq(schema.projectTeamMembers.projectId, input.projectId));
      const canTransition =
        isOrgAdmin ||
        memberships.some(
          (m) =>
            m.role === "estimator" ||
            m.role === "project_manager" ||
            m.role === "project_administrator"
        );

      if (!canTransition) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only Project Managers, Estimators, and Project Administrators can transition lifecycle phases.",
        });
      }

      const toIdx = LIFECYCLE_ORDER.indexOf(input.toPhase);
      const fromIdx = LIFECYCLE_ORDER.indexOf(project.lifecyclePhase as LifecyclePhase);
      const isBackward = toIdx < fromIdx;

      // Execute transition in transaction
      await db.transaction(async (tx: any) => {
        await tx
          .update(schema.projects)
          .set({ lifecyclePhase: input.toPhase, updatedAt: new Date() })
          .where(eq(schema.projects.id, input.projectId));

        await tx.insert(schema.projectLifecycleTransitions).values({
          projectId: input.projectId,
          fromPhase: project.lifecyclePhase,
          toPhase: input.toPhase,
          triggeredBy: "user",
          actorId: ctx.userId!,
          reason: input.reason ?? null,
          eventSource: null,
        });
      });

      await createAuditLog(db, schema, {
        entityType: "Project",
        entityId: input.projectId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId!,
        changes: {
          before: { lifecyclePhase: project.lifecyclePhase },
          after: { lifecyclePhase: input.toPhase },
        },
        metadata: { triggeredBy: "user", isBackward },
      });
      await afterPhaseChange(ctx.tenant, input.projectId, input.toPhase).catch((e) => console.error("[automation] prompt cleanup failed", e));

      const [updated] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);
      return updated;
    }),

  /**
   * Set project mode (Simple vs GC/Advanced).
   * Mode changes are never blocked by lifecycle phase — any phase is allowed.
   * RBAC: org:admin, or project-level estimator or project_administrator.
   */
  setMode: protectedProcedure
    .input(setProjectModeSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }

      const { db, schema } = ctx.tenant;

      // RBAC: must be org:admin, or project-level estimator, project_manager, or project_administrator
      // NOTE: do NOT check lifecyclePhase here — mode changes are never locked by phase
      const isOrgAdmin = ctx.orgRole === "org:admin";
      const memberships = await db
        .select({ role: schema.projectTeamMembers.role })
        .from(schema.projectTeamMembers)
        .where(eq(schema.projectTeamMembers.projectId, input.projectId));
      const canSetMode =
        isOrgAdmin ||
        memberships.some(
          (m) =>
            m.role === "estimator" ||
            m.role === "project_manager" ||
            m.role === "project_administrator"
        );

      if (!canSetMode) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only Estimators and Project Administrators can change project mode.",
        });
      }

      await db
        .update(schema.projects)
        .set({ projectMode: input.mode, updatedAt: new Date() })
        .where(eq(schema.projects.id, input.projectId));

      await createAuditLog(db, schema, {
        entityType: "Project",
        entityId: input.projectId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId!,
        changes: { after: { projectMode: input.mode } },
        metadata: {},
      });

      const [updated] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);
      return updated;
    }),

  /**
   * Pre-flight check: can this project be deleted?
   * Returns {canDelete: true} or {canDelete: false, reasons: [...]} with ALL blocking factors.
   * Admin-only (org:admin).
   */
  checkDeletable: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<DeletableCheckResult> => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (ctx.orgRole !== "org:admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin required" });

      const { db, schema } = ctx.tenant;

      const [project] = await db.select({
        lifecyclePhase: schema.projects.lifecyclePhase,
        deletedAt: schema.projects.deletedAt,
      }).from(schema.projects).where(eq(schema.projects.id, input.projectId)).limit(1);

      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (project.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Project already deleted" });

      const reasons: string[] = [];

      // Check lifecycle phase
      if (BLOCKED_DELETION_PHASES.includes(project.lifecyclePhase as LifecyclePhase)) {
        const label = LIFECYCLE_PHASE_LABELS[project.lifecyclePhase as LifecyclePhase] ?? project.lifecyclePhase;
        reasons.push(`Project is in ${label} phase`);
      }

      // Check financial records in parallel
      const [coCount, commitCount] = await Promise.all([
        db.select({ count: count() }).from(schema.changeOrders).where(eq(schema.changeOrders.projectId, input.projectId)),
        db.select({ count: count() }).from(schema.commitments).where(eq(schema.commitments.projectId, input.projectId)),
      ]);

      const coTotal = Number(coCount[0]?.count ?? 0);
      const commitTotal = Number(commitCount[0]?.count ?? 0);

      if (coTotal > 0) reasons.push(`${coTotal} change order${coTotal !== 1 ? "s" : ""}`);
      if (commitTotal > 0) reasons.push(`${commitTotal} committed cost record${commitTotal !== 1 ? "s" : ""}`);

      return { canDelete: reasons.length === 0, reasons };
    }),

  /**
   * Soft-delete a project. Sets deleted_at, deleted_by, deletion_reason and writes audit log.
   * Admin-only (org:admin).
   */
  softDelete: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), reason: z.string().min(1, "Reason required") }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (ctx.orgRole !== "org:admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin required" });

      const { db, schema } = ctx.tenant;
      const now = new Date();

      const [project] = await db.select({ id: schema.projects.id, name: schema.projects.name, deletedAt: schema.projects.deletedAt })
        .from(schema.projects).where(eq(schema.projects.id, input.projectId)).limit(1);

      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (project.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Project already deleted" });

      await db.update(schema.projects)
        .set({ deletedAt: now, deletedBy: ctx.userId, deletionReason: input.reason })
        .where(eq(schema.projects.id, input.projectId));

      await createAuditLog(db, schema, {
        entityType: "project",
        entityId: input.projectId,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: {
          after: { deletion_reason: input.reason, name: project.name },
        },
      });

      return { success: true };
    }),

  /**
   * Restore a soft-deleted project. Clears deleted_at, sets restored_at, writes audit log.
   * Admin-only (org:admin).
   */
  restore: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (ctx.orgRole !== "org:admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin required" });

      const { db, schema } = ctx.tenant;
      const now = new Date();

      const [project] = await db.select({ id: schema.projects.id, name: schema.projects.name, deletedAt: schema.projects.deletedAt })
        .from(schema.projects).where(eq(schema.projects.id, input.projectId)).limit(1);

      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (!project.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Project is not deleted" });

      await db.update(schema.projects)
        .set({ deletedAt: null, deletedBy: null, deletionReason: null, restoredAt: now })
        .where(eq(schema.projects.id, input.projectId));

      await createAuditLog(db, schema, {
        entityType: "project",
        entityId: input.projectId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          after: { restored: true, name: project.name },
        },
      });

      return { success: true };
    }),

  /**
   * List soft-deleted projects. Lazy-purges rows older than 30 days before returning.
   * Admin-only (org:admin).
   */
  listDeleted: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (ctx.orgRole !== "org:admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin required" });

      const { db, schema } = ctx.tenant;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Lazy purge: hard-delete rows older than 30 days (fire before returning list)
      await db.delete(schema.projects)
        .where(and(isNotNull(schema.projects.deletedAt), lte(schema.projects.deletedAt, thirtyDaysAgo)));

      // Return remaining soft-deleted projects
      const deleted = await db.select({
        id: schema.projects.id,
        name: schema.projects.name,
        slug: schema.projects.slug,
        jobNumber: schema.projects.jobNumber,
        deletedAt: schema.projects.deletedAt,
        deletedBy: schema.projects.deletedBy,
        deletionReason: schema.projects.deletionReason,
      })
        .from(schema.projects)
        .where(isNotNull(schema.projects.deletedAt))
        .orderBy(desc(schema.projects.deletedAt));

      // Enrich with deleter's name from user_profiles
      const result = await Promise.all(deleted.map(async (p) => {
        let deletedByName: string | null = null;
        if (p.deletedBy) {
          const [profile] = await db.select({ firstName: schema.userProfiles.firstName, lastName: schema.userProfiles.lastName, email: schema.userProfiles.email })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.clerkUserId, p.deletedBy))
            .limit(1);
          if (profile) {
            deletedByName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || null;
          }
        }
        const deletedAtDate = p.deletedAt!;
        const daysRemaining = Math.max(0, 30 - Math.floor((Date.now() - deletedAtDate.getTime()) / (24 * 60 * 60 * 1000)));
        return { ...p, deletedByName, daysRemaining };
      }));

      return result;
    }),

  /**
   * Acknowledge restore banner by setting restored_at = null.
   * No admin check — any project member can dismiss the banner.
   */
  acknowledgeRestore: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });

      const { db, schema } = ctx.tenant;
      await db.update(schema.projects)
        .set({ restoredAt: null })
        .where(eq(schema.projects.id, input.projectId));

      return { success: true };
    }),

  /**
   * Get the full lifecycle transition history for a project.
   * Ordered by created_at descending (most recent first).
   * Readable by all authenticated users with access to the project.
   */
  getTransitionHistory: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }

      const { db, schema } = ctx.tenant;

      const rows = await db
        .select({
          id: schema.projectLifecycleTransitions.id,
          projectId: schema.projectLifecycleTransitions.projectId,
          fromPhase: schema.projectLifecycleTransitions.fromPhase,
          toPhase: schema.projectLifecycleTransitions.toPhase,
          triggeredBy: schema.projectLifecycleTransitions.triggeredBy,
          actorId: schema.projectLifecycleTransitions.actorId,
          reason: schema.projectLifecycleTransitions.reason,
          eventSource: schema.projectLifecycleTransitions.eventSource,
          createdAt: schema.projectLifecycleTransitions.createdAt,
          actorFirstName: schema.userProfiles.firstName,
          actorLastName: schema.userProfiles.lastName,
        })
        .from(schema.projectLifecycleTransitions)
        .leftJoin(
          schema.userProfiles,
          eq(schema.projectLifecycleTransitions.actorId, schema.userProfiles.clerkUserId)
        )
        .where(eq(schema.projectLifecycleTransitions.projectId, input.projectId))
        .orderBy(desc(schema.projectLifecycleTransitions.createdAt));

      return rows;
    }),

  /**
   * Get header stats for a project.
   * Returns 5 financial metrics + 4 tab badge counts in a single round-trip via Promise.all.
   * Used by the project chrome header and tab badge components.
   */
  getHeaderStats: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const { projectId } = input;

      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Project");

      // Run all sub-queries in parallel
      const [
        acceptedEstimate,
        approvedCOSum,
        projectBudget,
        changeOrdersCount,
        proposalsCount,
        documentsCount,
      ] = await Promise.all([
        // 1. Accepted estimate totalCost, directCosts, overheadAmount
        db
          .select({
            totalCost: schema.estimates.totalCost,
            directCosts: schema.estimates.directCosts,
            overheadAmount: schema.estimates.overheadAmount,
          })
          .from(schema.estimates)
          .where(
            and(
              eq(schema.estimates.projectId, projectId),
              eq(schema.estimates.status, "accepted")
            )
          )
          .orderBy(desc(schema.estimates.createdAt))
          .limit(1),

        // 2. Sum of approved CO total_amount
        db
          .select({ total: sql<string>`COALESCE(SUM(total_amount), 0)` })
          .from(schema.changeOrders)
          .where(
            and(
              eq(schema.changeOrders.projectId, projectId),
              eq(schema.changeOrders.status, "approved")
            )
          ),

        // 3. Project budget field + customerBudget
        db
          .select({
            budget: schema.projects.budget,
            customerBudget: schema.projects.customerBudget,
          })
          .from(schema.projects)
          .where(eq(schema.projects.id, projectId))
          .limit(1),

        // 6. Change orders count (tab badge)
        db
          .select({ count: count() })
          .from(schema.estimates)
          .where(and(eq(schema.estimates.projectId, projectId), eq(schema.estimates.kind, "change_order"))),

        // 7. Proposals count (tab badge)
        db
          .select({ count: count() })
          .from(schema.estimates)
          .where(and(eq(schema.estimates.projectId, projectId), eq(schema.estimates.kind, "proposal"))),

        // 8. Documents count
        db
          .select({ count: count() })
          .from(schema.documents)
          .where(eq(schema.documents.projectId, projectId)),

      ]);

      // Post-query computation
      const estimateTotal = acceptedEstimate[0]?.totalCost ? Number(acceptedEstimate[0].totalCost) : null;
      const approvedCOTotal = Number(approvedCOSum[0]?.total ?? 0);
      const rawBudget = projectBudget[0]?.budget ?? null;
      const budgetNum = rawBudget !== null ? parseFloat(rawBudget) : NaN;
      const safeBudget = isNaN(budgetNum) ? null : budgetNum;

      let contractValue: number;
      if (estimateTotal !== null) {
        contractValue = estimateTotal + approvedCOTotal;
      } else if (safeBudget !== null) {
        contractValue = safeBudget;
      } else {
        contractValue = 0;
      }

      const billedTotal = 0; // No payment applications any more
      const retainageTotal = 0;
      const paidToDate = 0; // Placeholder — no payments table yet

      // Accepted estimate's total costs (direct + overhead) = cost basis
      const estimateDirectCosts = acceptedEstimate[0]?.directCosts
        ? Number(acceptedEstimate[0].directCosts)
        : null;
      const estimateOverheadAmount = acceptedEstimate[0]?.overheadAmount
        ? Number(acceptedEstimate[0].overheadAmount)
        : null;

      // Customer budget from project row
      const rawCustomerBudget = projectBudget[0]?.customerBudget ?? null;
      const customerBudgetNum =
        rawCustomerBudget !== null ? parseFloat(rawCustomerBudget) : NaN;
      const customerBudgetAmount = isNaN(customerBudgetNum)
        ? null
        : customerBudgetNum;

      // Projected Profit = estimateTotal - (directCosts + overheadAmount)
      // This equals the markup amount from the accepted estimate.
      // CO revenue is already in contractValue but CO cost data is not yet
      // tracked — do NOT add approvedCOTotal here, as that would inflate profit.
      // Only computable when we have an accepted estimate with cost fields.
      let projectedProfit: number | null = null;
      if (
        estimateTotal !== null &&
        estimateDirectCosts !== null &&
        estimateOverheadAmount !== null
      ) {
        projectedProfit =
          estimateTotal - (estimateDirectCosts + estimateOverheadAmount);
      }

      // Projected Margin = projectedProfit / contractValue (decimal, not percentage)
      let projectedMargin: number | null = null;
      if (projectedProfit !== null && contractValue > 0) {
        projectedMargin = projectedProfit / contractValue;
      }

      // Customer budget delta = contractValue - customerBudget
      // Positive = contract is over customer budget (customer over budget)
      // Negative = contract is under customer budget (customer has headroom)
      let customerBudgetDelta: number | null = null;
      if (customerBudgetAmount !== null && contractValue > 0) {
        customerBudgetDelta = contractValue - customerBudgetAmount;
      }

      return {
        contractValue,
        billedToDate: billedTotal,
        paidToDate,
        balanceToComplete: contractValue - paidToDate,
        retainageHeld: retainageTotal,
        changeOrdersCount: Number(changeOrdersCount[0]?.count ?? 0),
        proposalsCount: Number(proposalsCount[0]?.count ?? 0),
        documentsCount: Number(documentsCount[0]?.count ?? 0),
        projectedProfit,
        projectedMargin,
        customerBudgetAmount,
        customerBudgetDelta,
      };
    }),
});
