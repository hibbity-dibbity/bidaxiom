import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  createDocumentSchema,
  uploadVersionSchema,
  createFolderSchema,
  presignedUrlSchema,
  createTagSchema,
  removeTagSchema,
  searchDocumentsSchema,
  AuditAction,
} from "@construction/shared";
import { generateUploadUrl, generateDownloadUrl } from "../../storage/presigned.js";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, desc, and, isNull, inArray, like, sql } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";

/**
 * Load project-level abilities for the current user.
 * Queries project team memberships and builds CASL abilities with project context.
 * Reused from project router pattern.
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
 * Document and folder management router.
 * Handles pre-signed uploads, document versioning, and folder organization with CASL enforcement.
 */
export const documentRouter = router({
  /**
   * Get pre-signed URL for client-side file upload.
   * Returns uploadUrl (for PUT) and storageKey (to pass to document.create).
   */
  getUploadUrl: protectedProcedure
    .input(presignedUrlSchema)
    .mutation(async ({ ctx, input }) => {
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
      ForbiddenError.from(abilities).throwUnlessCan("create", "Document");

      // Validate file size (500MB max - also validated by Zod schema)
      const MAX_FILE_SIZE = 524288000; // 500MB in bytes
      if (input.fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File size exceeds maximum allowed size of 500MB`,
        });
      }

      // Verify project exists and belongs to this tenant
      const [project] = await ctx.tenant.db
        .select({ id: ctx.tenant.schema.projects.id })
        .from(ctx.tenant.schema.projects)
        .where(eq(ctx.tenant.schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Generate pre-signed upload URL
      const { uploadUrl, storageKey } = await generateUploadUrl(
        ctx.tenant.tenantId,
        input.projectId,
        input.fileName,
        input.contentType
      );

      return { uploadUrl, storageKey };
    }),

  /**
   * Create a document record after client uploads file via pre-signed URL.
   * Creates document + first version in a transaction.
   */
  create: protectedProcedure
    .input(createDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("create", "Document");

      // Verify project exists
      const [project] = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // If folderId provided, verify folder exists and belongs to same project
      if (input.folderId) {
        const [folder] = await db
          .select({ id: schema.folders.id, projectId: schema.folders.projectId })
          .from(schema.folders)
          .where(eq(schema.folders.id, input.folderId))
          .limit(1);

        if (!folder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Folder not found",
          });
        }

        if (folder.projectId !== input.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Folder does not belong to this project",
          });
        }
      }

      // Validate storage key includes tenant prefix (prevent cross-tenant key injection)
      const expectedPrefix = `tenants/${ctx.tenant.tenantId}/`;
      if (!input.storageKey.startsWith(expectedPrefix)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid storage key format",
        });
      }

      // Transaction: create document + first version + update currentVersionId
      const document = await db.transaction(async (tx) => {
        // Insert document
        const [newDocument] = await tx
          .insert(schema.documents)
          .values({
            projectId: input.projectId,
            folderId: input.folderId ?? null,
            name: input.name,
            fileSize: input.fileSize,
            contentType: input.contentType,
            createdBy: userId,
          })
          .returning();

        if (!newDocument) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create document",
          });
        }

        // Insert first version
        const [firstVersion] = await tx
          .insert(schema.documentVersions)
          .values({
            documentId: newDocument.id,
            versionNumber: 1,
            storageKey: input.storageKey,
            fileSize: input.fileSize,
            contentType: input.contentType,
            uploadedBy: userId,
            changeNotes: input.changeNotes ?? null,
          })
          .returning();

        // Update document.currentVersionId to point to first version
        await tx
          .update(schema.documents)
          .set({ currentVersionId: firstVersion.id })
          .where(eq(schema.documents.id, newDocument.id));

        return { ...newDocument, currentVersionId: firstVersion.id };
      });

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Document",
        entityId: document.id,
        action: AuditAction.CREATE,
        actorId: userId,
        changes: {
          after: { name: input.name, projectId: input.projectId, folderId: input.folderId },
        },
      });

      return document;
    }),

  /**
   * Upload a new version of an existing document.
   * Increments version number and updates currentVersionId.
   */
  uploadVersion: protectedProcedure
    .input(uploadVersionSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Fetch existing document to get projectId
      const [existingDoc] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, input.documentId))
        .limit(1);

      if (!existingDoc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Document");

      // Validate storage key includes tenant prefix
      const expectedPrefix = `tenants/${ctx.tenant.tenantId}/`;
      if (!input.storageKey.startsWith(expectedPrefix)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid storage key format",
        });
      }

      // Get current highest version number
      const versions = await db
        .select({ versionNumber: schema.documentVersions.versionNumber })
        .from(schema.documentVersions)
        .where(eq(schema.documentVersions.documentId, input.documentId))
        .orderBy(desc(schema.documentVersions.versionNumber))
        .limit(1);

      const nextVersionNumber = versions.length > 0 ? versions[0].versionNumber + 1 : 1;

      // Transaction: insert new version + update document
      const newVersion = await db.transaction(async (tx) => {
        // Insert new version
        const [version] = await tx
          .insert(schema.documentVersions)
          .values({
            documentId: input.documentId,
            versionNumber: nextVersionNumber,
            storageKey: input.storageKey,
            fileSize: input.fileSize,
            contentType: input.contentType,
            uploadedBy: userId,
            changeNotes: input.changeNotes ?? null,
          })
          .returning();

        // Update document: currentVersionId + denormalized fields
        await tx
          .update(schema.documents)
          .set({
            currentVersionId: version.id,
            fileSize: input.fileSize,
            contentType: input.contentType,
            updatedAt: new Date(),
          })
          .where(eq(schema.documents.id, input.documentId));

        return version;
      });

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Document",
        entityId: input.documentId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: {
            versionNumber: nextVersionNumber,
            fileSize: input.fileSize,
            changeNotes: input.changeNotes,
          },
        },
      });

      return newVersion;
    }),

  /**
   * List documents in a project, optionally filtered by folder.
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        folderId: z.string().uuid().nullable().optional(),
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

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Document");

      // Build WHERE clause
      const conditions = [eq(schema.documents.projectId, input.projectId)];

      if (input.folderId === null) {
        // Explicitly filtering for root-level documents (no folder)
        conditions.push(isNull(schema.documents.folderId));
      } else if (input.folderId) {
        // Filtering for specific folder
        conditions.push(eq(schema.documents.folderId, input.folderId));
      }

      // Query documents with uploader profile
      const rows = await db
        .select({
          id: schema.documents.id,
          projectId: schema.documents.projectId,
          folderId: schema.documents.folderId,
          name: schema.documents.name,
          fileSize: schema.documents.fileSize,
          contentType: schema.documents.contentType,
          currentVersionId: schema.documents.currentVersionId,
          createdBy: schema.documents.createdBy,
          createdAt: schema.documents.createdAt,
          updatedAt: schema.documents.updatedAt,
          profileId: schema.userProfiles.id,
          profileFirstName: schema.userProfiles.firstName,
          profileLastName: schema.userProfiles.lastName,
          profileEmail: schema.userProfiles.email,
        })
        .from(schema.documents)
        .leftJoin(
          schema.userProfiles,
          eq(schema.documents.createdBy, schema.userProfiles.clerkUserId)
        )
        .where(and(...conditions))
        .orderBy(schema.documents.name);

      // Transform rows to include nested uploadedByProfile
      const documents = rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        folderId: row.folderId,
        name: row.name,
        fileSize: row.fileSize,
        contentType: row.contentType,
        currentVersionId: row.currentVersionId,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        uploadedByProfile: row.profileId
          ? {
              id: row.profileId,
              fullName: row.profileFirstName && row.profileLastName
                ? `${row.profileFirstName} ${row.profileLastName}`
                : row.profileEmail,
              email: row.profileEmail,
            }
          : null,
      }));

      return documents;
    }),

  /**
   * Get download URL for a document.
   * Returns pre-signed GET URL for the current version.
   */
  getDownloadUrl: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch document with current version
      const [document] = await db
        .select({
          id: schema.documents.id,
          name: schema.documents.name,
          projectId: schema.documents.projectId,
          currentVersionId: schema.documents.currentVersionId,
          fileSize: schema.documents.fileSize,
          contentType: schema.documents.contentType,
        })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.documentId))
        .limit(1);

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      if (!document.currentVersionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Document has no versions",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Document");

      // Fetch current version to get storage key
      const [currentVersion] = await db
        .select({ storageKey: schema.documentVersions.storageKey })
        .from(schema.documentVersions)
        .where(eq(schema.documentVersions.id, document.currentVersionId))
        .limit(1);

      if (!currentVersion) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Current version not found",
        });
      }

      // Generate pre-signed download URL
      const downloadUrl = await generateDownloadUrl(
        currentVersion.storageKey,
        document.name,
        document.contentType || undefined
      );

      return {
        downloadUrl,
        fileName: document.name,
        contentType: document.contentType,
        fileSize: document.fileSize,
      };
    }),

  /**
   * Get version history for a document.
   */
  getVersionHistory: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Fetch document to get projectId
      const [document] = await db
        .select({ projectId: schema.documents.projectId })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.documentId))
        .limit(1);

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Document");

      // Query all versions
      const versions = await db
        .select()
        .from(schema.documentVersions)
        .where(eq(schema.documentVersions.documentId, input.documentId))
        .orderBy(desc(schema.documentVersions.versionNumber));

      return versions;
    }),

  /**
   * Delete a document (soft delete - archives in DB, does NOT delete S3 objects).
   */
  delete: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Fetch document to get projectId
      const [document] = await db
        .select({ projectId: schema.documents.projectId })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.documentId))
        .limit(1);

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("delete", "Document");

      // Delete from documents table (cascades to document_versions via FK)
      // NOTE: Does NOT delete actual S3 objects - orphaned storage cleanup via S3 lifecycle policies
      await db.delete(schema.documents).where(eq(schema.documents.id, input.documentId));

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Document",
        entityId: input.documentId,
        action: AuditAction.DELETE,
        actorId: userId,
        changes: {
          before: { projectId: document.projectId },
        },
      });

      return { success: true };
    }),

  /**
   * Create a folder for document organization.
   */
  createFolder: protectedProcedure
    .input(createFolderSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("create", "Folder");

      // Verify project exists
      const [project] = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // If parentId provided, verify parent exists and belongs to same project
      if (input.parentId) {
        const [parent] = await db
          .select({ id: schema.folders.id, projectId: schema.folders.projectId })
          .from(schema.folders)
          .where(eq(schema.folders.id, input.parentId))
          .limit(1);

        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent folder not found",
          });
        }

        if (parent.projectId !== input.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent folder does not belong to this project",
          });
        }
      }

      // Get max orderIndex for this parent to set new folder's orderIndex
      const maxOrderResult = await db
        .select({ maxOrder: schema.folders.orderIndex })
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.projectId, input.projectId),
            input.parentId
              ? eq(schema.folders.parentId, input.parentId)
              : isNull(schema.folders.parentId)
          )
        )
        .orderBy(desc(schema.folders.orderIndex))
        .limit(1);

      const nextOrderIndex = maxOrderResult.length > 0 ? (maxOrderResult[0].maxOrder ?? 0) + 1 : 0;

      // Insert folder
      const [folder] = await db
        .insert(schema.folders)
        .values({
          projectId: input.projectId,
          parentId: input.parentId ?? null,
          name: input.name,
          description: input.description ?? null,
          orderIndex: nextOrderIndex,
          createdBy: userId,
        })
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Folder",
        entityId: folder.id,
        action: AuditAction.CREATE,
        actorId: userId,
        changes: {
          after: { name: input.name, projectId: input.projectId, parentId: input.parentId },
        },
      });

      return folder;
    }),

  /**
   * List folders in a project, optionally filtered by parent.
   */
  listFolders: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        parentId: z.string().uuid().nullable().optional(),
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

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Folder");

      // Build WHERE clause
      const conditions = [eq(schema.folders.projectId, input.projectId)];

      if (input.parentId === null) {
        // Explicitly filtering for root folders
        conditions.push(isNull(schema.folders.parentId));
      } else if (input.parentId) {
        // Filtering for specific parent folder
        conditions.push(eq(schema.folders.parentId, input.parentId));
      }

      // Query folders
      const folders = await db
        .select()
        .from(schema.folders)
        .where(and(...conditions))
        .orderBy(schema.folders.orderIndex);

      return folders;
    }),

  /**
   * Rename a folder.
   */
  renameFolder: protectedProcedure
    .input(
      z.object({
        folderId: z.string().uuid(),
        name: z.string().min(1).max(100),
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
      const userId = ctx.userId;

      // Fetch folder to get projectId
      const [existingFolder] = await db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, input.folderId))
        .limit(1);

      if (!existingFolder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found",
        });
      }

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Folder");

      // Update folder name
      const [updatedFolder] = await db
        .update(schema.folders)
        .set({ name: input.name })
        .where(eq(schema.folders.id, input.folderId))
        .returning();

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Folder",
        entityId: input.folderId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          before: { name: existingFolder.name },
          after: { name: input.name },
        },
      });

      return updatedFolder;
    }),

  /**
   * Add a tag to a document.
   * Tag is normalized (trimmed, lowercase) to enable case-insensitive search.
   */
  addTag: protectedProcedure
    .input(createTagSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Verify document exists
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

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Document");

      // Normalize tag (trim, lowercase)
      const normalizedTag = input.tag.trim().toLowerCase();

      // Check if tag already exists on document (prevent duplicates)
      const [existingTag] = await db
        .select()
        .from(schema.documentTags)
        .where(
          and(
            eq(schema.documentTags.documentId, input.documentId),
            eq(schema.documentTags.tag, normalizedTag)
          )
        )
        .limit(1);

      if (existingTag) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tag already exists on this document",
        });
      }

      // Insert tag
      await db.insert(schema.documentTags).values({
        documentId: input.documentId,
        tag: normalizedTag,
        createdBy: userId,
      });

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Document",
        entityId: input.documentId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: { tags: { added: [normalizedTag] } },
        },
      });

      return { success: true };
    }),

  /**
   * Remove a tag from a document.
   */
  removeTag: protectedProcedure
    .input(removeTagSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Verify document exists
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

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Document");

      // Normalize tag for consistent deletion
      const normalizedTag = input.tag.trim().toLowerCase();

      // Delete tag
      await db
        .delete(schema.documentTags)
        .where(
          and(
            eq(schema.documentTags.documentId, input.documentId),
            eq(schema.documentTags.tag, normalizedTag)
          )
        );

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Document",
        entityId: input.documentId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: { tags: { removed: [normalizedTag] } },
        },
      });

      return { success: true };
    }),

  /**
   * Get all tags for a document.
   * Returns tags in chronological order (newest first).
   */
  getTags: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Verify document exists
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

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Document");

      // Query tags, ordered by createdAt DESC (newest first)
      const tags = await db
        .select({
          tag: schema.documentTags.tag,
          createdBy: schema.documentTags.createdBy,
          createdAt: schema.documentTags.createdAt,
        })
        .from(schema.documentTags)
        .where(eq(schema.documentTags.documentId, input.documentId))
        .orderBy(desc(schema.documentTags.createdAt));

      return tags;
    }),

  /**
   * Search documents with advanced filters.
   * Supports text search, tags (AND logic), category, and content type filters.
   */
  search: protectedProcedure
    .input(searchDocumentsSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Document");

      // Build WHERE conditions
      const conditions = [eq(schema.documents.projectId, input.projectId)];

      // Text search on document name (case-insensitive)
      if (input.query) {
        conditions.push(like(schema.documents.name, `%${input.query}%`));
      }

      // Category filter
      if (input.category) {
        conditions.push(eq(schema.documents.category, input.category));
      }

      // Content type filter
      if (input.contentTypes && input.contentTypes.length > 0) {
        conditions.push(inArray(schema.documents.contentType, input.contentTypes));
      }

      // Base query without tag filtering
      let query = db
        .select({
          id: schema.documents.id,
          projectId: schema.documents.projectId,
          folderId: schema.documents.folderId,
          name: schema.documents.name,
          category: schema.documents.category,
          description: schema.documents.description,
          fileSize: schema.documents.fileSize,
          contentType: schema.documents.contentType,
          currentVersionId: schema.documents.currentVersionId,
          createdBy: schema.documents.createdBy,
          createdAt: schema.documents.createdAt,
          updatedAt: schema.documents.updatedAt,
        })
        .from(schema.documents)
        .where(and(...conditions))
        .orderBy(desc(schema.documents.updatedAt))
        .limit(100);

      // Execute base query
      let documents = await query;

      // If tags filter provided, do manual filtering with AND logic
      // (must match ALL tags)
      if (input.tags && input.tags.length > 0) {
        const normalizedTags = input.tags.map(t => t.toLowerCase());

        // Get all document-tag mappings for these documents
        const documentIds = documents.map(d => d.id);

        if (documentIds.length > 0) {
          const docTags = await db
            .select({
              documentId: schema.documentTags.documentId,
              tag: schema.documentTags.tag,
            })
            .from(schema.documentTags)
            .where(inArray(schema.documentTags.documentId, documentIds));

          // Group tags by document
          const tagsByDoc = new Map<string, string[]>();
          for (const dt of docTags) {
            if (!tagsByDoc.has(dt.documentId)) {
              tagsByDoc.set(dt.documentId, []);
            }
            tagsByDoc.get(dt.documentId)!.push(dt.tag);
          }

          // Filter documents that have ALL required tags
          documents = documents.filter(doc => {
            const docTagList = tagsByDoc.get(doc.id) || [];
            return normalizedTags.every(reqTag => docTagList.includes(reqTag));
          });
        } else {
          documents = [];
        }
      }

      return documents;
    }),

  /**
   * Log document access (view or download).
   * Creates audit trail entry for compliance and analytics.
   */
  logAccess: protectedProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        action: z.enum(["view", "download"]),
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
      const userId = ctx.userId;

      // Verify document exists
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

      // Load abilities and check permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Document");

      // Insert access log
      // Note: ipAddress could be extracted from ctx.req if available in future
      await db.insert(schema.documentAccessLogs).values({
        documentId: input.documentId,
        userId: userId,
        action: input.action,
        ipAddress: null, // Can be added from request context if needed
      });

      // No audit log needed - this IS the audit log

      return { success: true };
    }),
});
