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
  shareDocumentSchema,
  revokeDocumentPermissionSchema,
  shareFolderSchema,
  revokeFolderPermissionSchema,
  getDocumentPermissionsSchema,
  AuditAction,
} from "@construction/shared";
import { generateUploadUrl, generateDownloadUrl } from "../../storage/presigned.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getStorageClient, getBucketName } from "../../storage/client.js";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor, loadDocumentPermissions } from "../../auth/abilities.js";
import { eq, desc, and, or, isNull, inArray, like, ilike, gte, lte, sql } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { sendDocumentEmail } from "../../services/email.js";

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
 * Helper to check document access with fallback to explicit permissions.
 * First checks project-level abilities via CASL.
 * If that fails, checks if user has explicit permission on the document or its folder.
 *
 * @param abilities - CASL abilities (project-level)
 * @param explicitPerms - Explicit document/folder permissions
 * @param document - Document with id and folderId
 * @param action - Action to check ("read", "update", "delete")
 * @throws TRPCError with FORBIDDEN code if access denied
 */
function checkDocumentAccess(
  abilities: ReturnType<typeof defineAbilitiesFor>,
  explicitPerms: Awaited<ReturnType<typeof loadDocumentPermissions>>,
  document: { id: string; folderId: string | null },
  action: "read" | "update" | "delete"
): void {
  // Try project-level abilities first
  try {
    ForbiddenError.from(abilities).throwUnlessCan(action, "Document");
    return; // Access granted via project-level permission
  } catch (err) {
    // Project-level check failed, try explicit permissions
  }

  // Check explicit permissions as fallback
  const hasExplicitAccess =
    (action === "read" &&
      (explicitPerms.documentIds.has(document.id) ||
       (document.folderId !== null && explicitPerms.folderIds.has(document.folderId)))) ||
    ((action === "update" || action === "delete") &&
      (explicitPerms.documentEditIds.has(document.id) ||
       (document.folderId !== null && explicitPerms.folderEditIds.has(document.folderId))));

  if (!hasExplicitAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to ${action} this document`,
    });
  }
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
   * Returns documents user has access to via project membership OR explicit permissions.
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

      // Load abilities and explicit permissions
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      const explicitPerms = await loadDocumentPermissions(db, schema, ctx.userId);

      // Build WHERE clause for project documents
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

      // Filter documents based on project-level abilities OR explicit permissions
      const canReadProjectDocuments = abilities.can("read", "Document");

      const documents = rows
        .filter((row) => {
          if (canReadProjectDocuments) {
            return true; // Project team member can see all project documents
          }

          // Check explicit permissions for non-team members
          return (
            explicitPerms.documentIds.has(row.id) ||
            (row.folderId !== null && explicitPerms.folderIds.has(row.folderId))
          );
        })
        .map((row) => ({
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
                fullName:
                  row.profileFirstName && row.profileLastName
                    ? `${row.profileFirstName} ${row.profileLastName}`
                    : row.profileEmail,
                email: row.profileEmail,
              }
            : null,
        }));

      return documents;
    }),

  /**
   * Unified document list query for the document center UI.
   * Returns all project documents with workflow metadata joined and author info.
   * Supports filtering by type, status, date range, author, and search.
   */
  listUnified: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        search: z.string().optional(),
        type: z.enum([
          "rfi",
          "submittal",
          "transmittal",
          "proposal",
          "change_order",
          "payment_app",
          "rfq",
          "file",
        ]).optional(),
        status: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        authorId: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
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

      if (!abilities.can("read", "Document")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Build WHERE conditions array
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [eq(schema.documents.projectId, input.projectId)];

      if (input.search) {
        conditions.push(ilike(schema.documents.name, `%${input.search}%`));
      }

      if (input.dateFrom) {
        conditions.push(gte(schema.documents.createdAt, new Date(input.dateFrom)));
      }

      if (input.dateTo) {
        conditions.push(lte(schema.documents.createdAt, new Date(input.dateTo + "T23:59:59Z")));
      }

      if (input.authorId) {
        conditions.push(eq(schema.documents.createdBy, input.authorId));
      }

      // Execute query with LEFT JOINs to document_workflows and user_profiles
      const rows = await db
        .select({
          // Document columns
          id: schema.documents.id,
          name: schema.documents.name,
          category: schema.documents.category,
          description: schema.documents.description,
          contentType: schema.documents.contentType,
          fileSize: schema.documents.fileSize,
          currentVersionId: schema.documents.currentVersionId,
          createdBy: schema.documents.createdBy,
          createdAt: schema.documents.createdAt,
          updatedAt: schema.documents.updatedAt,
          templateId: schema.documents.templateId,
          // Workflow columns (aliased)
          workflowId: schema.documentWorkflows.id,
          workflowType: schema.documentWorkflows.workflowType,
          workflowNumber: schema.documentWorkflows.workflowNumber,
          workflowStatus: schema.documentWorkflows.status,
          workflowTitle: schema.documentWorkflows.title,
          // Author name
          createdByName: sql<string>`COALESCE(${schema.userProfiles.firstName} || ' ' || ${schema.userProfiles.lastName}, ${schema.userProfiles.email})`,
        })
        .from(schema.documents)
        .leftJoin(
          schema.documentWorkflows,
          eq(schema.documentWorkflows.documentId, schema.documents.id)
        )
        .leftJoin(
          schema.userProfiles,
          eq(schema.documents.createdBy, schema.userProfiles.clerkUserId)
        )
        .where(and(...conditions))
        .orderBy(desc(schema.documents.createdAt))
        .limit(input.limit);

      // Post-query type filter
      const WORKFLOW_TYPES = ["rfi", "submittal", "transmittal"] as const;
      const CATEGORY_TYPES = ["proposal", "change_order", "payment_app", "rfq"] as const;

      let filtered = rows;

      if (input.type) {
        if ((WORKFLOW_TYPES as readonly string[]).includes(input.type)) {
          filtered = filtered.filter((row) => row.workflowType === input.type);
        } else if ((CATEGORY_TYPES as readonly string[]).includes(input.type)) {
          filtered = filtered.filter(
            (row) => row.category === input.type && row.workflowId === null
          );
        } else if (input.type === "file") {
          filtered = filtered.filter(
            (row) =>
              row.workflowId === null &&
              !(CATEGORY_TYPES as readonly string[]).includes(row.category ?? "")
          );
        }
      }

      // Post-query status filter (non-workflow docs always pass)
      if (input.status) {
        filtered = filtered.filter(
          (row) => row.workflowStatus === input.status || row.workflowId === null
        );
      }

      // Map to final shape with derived fields
      const RELATED_ENTITY_REGEX = /(RFI|SUB|TX|CO|PAY|RFQ)-[\w-]+/i;

      return filtered.map((row) => {
        const documentType =
          row.workflowType ??
          ((CATEGORY_TYPES as readonly string[]).includes(row.category ?? "")
            ? row.category
            : "file");

        const relatedEntityMatch = row.description
          ? RELATED_ENTITY_REGEX.exec(row.description)
          : null;
        const relatedEntity = relatedEntityMatch ? relatedEntityMatch[0] : null;

        return {
          id: row.id,
          name: row.name,
          category: row.category,
          description: row.description,
          contentType: row.contentType,
          fileSize: row.fileSize,
          currentVersionId: row.currentVersionId,
          createdBy: row.createdBy,
          createdByName: row.createdByName,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          templateId: row.templateId,
          workflowId: row.workflowId,
          workflowType: row.workflowType,
          workflowNumber: row.workflowNumber,
          workflowStatus: row.workflowStatus,
          workflowTitle: row.workflowTitle,
          documentType,
          relatedEntity,
        };
      });
    }),

  /**
   * Send a document download link via email.
   * Generates a 7-day presigned URL and sends it to the recipient.
   */
  sendByEmail: protectedProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        recipientEmail: z.string().email(),
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

      // Fetch document with current version info
      const [document] = await db
        .select({
          id: schema.documents.id,
          name: schema.documents.name,
          projectId: schema.documents.projectId,
          folderId: schema.documents.folderId,
          currentVersionId: schema.documents.currentVersionId,
        })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.documentId))
        .limit(1);

      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      if (!document.currentVersionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Document has no versions" });
      }

      // Check read access
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      const explicitPerms = await loadDocumentPermissions(db, schema, ctx.userId);
      checkDocumentAccess(abilities, explicitPerms, document, "read");

      // Fetch storage key from document_versions
      const [version] = await db
        .select({ storageKey: schema.documentVersions.storageKey })
        .from(schema.documentVersions)
        .where(eq(schema.documentVersions.id, document.currentVersionId))
        .limit(1);

      if (!version) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Current version not found",
        });
      }

      // Generate 7-day presigned download URL for email sharing
      const s3 = getStorageClient();
      const bucket = getBucketName();
      const downloadUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket,
          Key: version.storageKey,
          ResponseContentDisposition: `attachment; filename="${document.name}"`,
        }),
        { expiresIn: 7 * 24 * 3600 } // 7 days
      );

      // Send email with download link
      await sendDocumentEmail(input.recipientEmail, document.name, downloadUrl);

      return { success: true };
    }),

  /**
   * Get download URL for a document.
   * Returns pre-signed GET URL for the current version.
   * Checks project-level abilities first, then explicit permissions as fallback.
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
          folderId: schema.documents.folderId,
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

      // Load abilities and explicit permissions
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      const explicitPerms = await loadDocumentPermissions(db, schema, ctx.userId);

      // Check access with fallback to explicit permissions
      checkDocumentAccess(abilities, explicitPerms, document, "read");

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
        document.name
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
   * Checks project-level abilities first, then explicit permissions as fallback.
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

      // Fetch document to get projectId and folderId
      const [document] = await db
        .select({
          id: schema.documents.id,
          projectId: schema.documents.projectId,
          folderId: schema.documents.folderId,
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

      // Load abilities and explicit permissions
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      const explicitPerms = await loadDocumentPermissions(db, schema, ctx.userId);

      // Check access with fallback to explicit permissions
      checkDocumentAccess(abilities, explicitPerms, document, "read");

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
   * Checks project-level abilities first, then explicit edit permissions as fallback.
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

      // Fetch document to get projectId and folderId
      const [document] = await db
        .select({
          id: schema.documents.id,
          projectId: schema.documents.projectId,
          folderId: schema.documents.folderId,
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

      // Load abilities and explicit permissions
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      const explicitPerms = await loadDocumentPermissions(db, schema, ctx.userId);

      // Check delete access with fallback to explicit edit permissions
      checkDocumentAccess(abilities, explicitPerms, document, "delete");

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

  /**
   * Share a document with a user.
   * Grants explicit permission (view or edit) to a user who may not be on the project team.
   */
  shareDocument: protectedProcedure
    .input(shareDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Verify document exists and get projectId
      const [document] = await db
        .select({
          id: schema.documents.id,
          projectId: schema.documents.projectId,
          folderId: schema.documents.folderId,
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

      // Load abilities and check user has update permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Document");

      // Validate target user exists in tenant
      const [targetUser] = await db
        .select({ id: schema.userProfiles.id })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.clerkUserId, input.userId))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target user not found in this organization",
        });
      }

      // Upsert permission (insert or update on conflict)
      await db
        .insert(schema.documentPermissions)
        .values({
          documentId: input.documentId,
          userId: input.userId,
          permissionLevel: input.permissionLevel,
          grantedBy: userId,
          grantedAt: new Date(),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .onConflictDoUpdate({
          target: [schema.documentPermissions.documentId, schema.documentPermissions.userId],
          set: {
            permissionLevel: input.permissionLevel,
            grantedBy: userId,
            grantedAt: new Date(),
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
        });

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Document",
        entityId: input.documentId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: {
            permissions: {
              granted: {
                userId: input.userId,
                permissionLevel: input.permissionLevel,
              },
            },
          },
        },
      });

      return { success: true };
    }),

  /**
   * Revoke a document permission.
   * Only the user who granted the permission or an admin/PM can revoke.
   */
  revokeDocumentPermission: protectedProcedure
    .input(revokeDocumentPermissionSchema)
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

      // Load abilities and check user has update permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Document");

      // Get permission record to check if user can revoke
      const [permission] = await db
        .select({ grantedBy: schema.documentPermissions.grantedBy })
        .from(schema.documentPermissions)
        .where(
          and(
            eq(schema.documentPermissions.documentId, input.documentId),
            eq(schema.documentPermissions.userId, input.userId)
          )
        )
        .limit(1);

      if (!permission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Permission not found",
        });
      }

      // Check if user is the one who granted the permission or is admin/PM
      const canRevoke =
        permission.grantedBy === userId ||
        ctx.orgRole === "org:admin" ||
        ctx.orgRole === "org:project_manager";

      if (!canRevoke) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only revoke permissions you granted",
        });
      }

      // Delete permission
      await db
        .delete(schema.documentPermissions)
        .where(
          and(
            eq(schema.documentPermissions.documentId, input.documentId),
            eq(schema.documentPermissions.userId, input.userId)
          )
        );

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Document",
        entityId: input.documentId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: {
            permissions: {
              revoked: { userId: input.userId },
            },
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get all permissions granted for a document.
   * Returns list of users with access, permission levels, expiration dates, and grantor info.
   */
  getDocumentPermissions: protectedProcedure
    .input(getDocumentPermissionsSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Verify document exists and get projectId + folderId
      const [document] = await db
        .select({
          id: schema.documents.id,
          projectId: schema.documents.projectId,
          folderId: schema.documents.folderId,
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

      // Load abilities and check user has read permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });

      // Load explicit permissions for access fallback
      const explicitPerms = await loadDocumentPermissions(
        db,
        schema,
        userId
      );

      // Check access using helper
      checkDocumentAccess(abilities, explicitPerms, document, "read");

      // Query document permissions with user joins
      const permissions = await db
        .select({
          userId: schema.documentPermissions.userId,
          permissionLevel: schema.documentPermissions.permissionLevel,
          expiresAt: schema.documentPermissions.expiresAt,
          grantedBy: schema.documentPermissions.grantedBy,
          grantedAt: schema.documentPermissions.grantedAt,
          userFirstName: schema.userProfiles.firstName,
          userLastName: schema.userProfiles.lastName,
          userEmail: schema.userProfiles.email,
          grantedByFirstName: sql<string | null>`granted_by_profile.first_name`,
          grantedByLastName: sql<string | null>`granted_by_profile.last_name`,
        })
        .from(schema.documentPermissions)
        .leftJoin(
          schema.userProfiles,
          eq(schema.documentPermissions.userId, schema.userProfiles.clerkUserId)
        )
        .leftJoin(
          sql`${schema.userProfiles} AS granted_by_profile`,
          sql`${schema.documentPermissions.grantedBy} = granted_by_profile.clerk_user_id`
        )
        .where(eq(schema.documentPermissions.documentId, input.documentId))
        .orderBy(desc(schema.documentPermissions.grantedAt));

      // Transform to expected format
      const permissionsList = permissions.map((p) => ({
        userId: p.userId,
        user: {
          firstName: p.userFirstName,
          lastName: p.userLastName,
          email: p.userEmail,
        },
        permissionLevel: p.permissionLevel,
        expiresAt: p.expiresAt,
        grantedBy: p.grantedBy,
        grantedByUser: {
          firstName: p.grantedByFirstName,
          lastName: p.grantedByLastName,
        },
        grantedAt: p.grantedAt,
      }));

      return {
        success: true,
        permissions: permissionsList,
      };
    }),

  /**
   * Share a folder with a user.
   * Grants explicit permission (view or edit) with optional subfolder inheritance.
   */
  shareFolder: protectedProcedure
    .input(shareFolderSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Verify folder exists and get projectId
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

      // Load abilities and check user has update permission on Folder
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Folder");

      // Validate target user exists in tenant
      const [targetUser] = await db
        .select({ id: schema.userProfiles.id })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.clerkUserId, input.userId))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target user not found in this organization",
        });
      }

      // Upsert permission
      await db
        .insert(schema.folderPermissions)
        .values({
          folderId: input.folderId,
          userId: input.userId,
          permissionLevel: input.permissionLevel,
          includeSubfolders: input.includeSubfolders,
          grantedBy: userId,
          grantedAt: new Date(),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .onConflictDoUpdate({
          target: [schema.folderPermissions.folderId, schema.folderPermissions.userId],
          set: {
            permissionLevel: input.permissionLevel,
            includeSubfolders: input.includeSubfolders,
            grantedBy: userId,
            grantedAt: new Date(),
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
        });

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Folder",
        entityId: input.folderId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: {
            permissions: {
              granted: {
                userId: input.userId,
                permissionLevel: input.permissionLevel,
                includeSubfolders: input.includeSubfolders,
              },
            },
          },
        },
      });

      return { success: true };
    }),

  /**
   * Revoke a folder permission.
   * Only the user who granted the permission or an admin/PM can revoke.
   */
  revokeFolderPermission: protectedProcedure
    .input(revokeFolderPermissionSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Verify folder exists
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

      // Load abilities and check user has update permission
      const abilities = await loadProjectAbilities({
        tenant: ctx.tenant,
        userId: ctx.userId,
        orgRole: ctx.orgRole,
      });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Folder");

      // Get permission record to check if user can revoke
      const [permission] = await db
        .select({ grantedBy: schema.folderPermissions.grantedBy })
        .from(schema.folderPermissions)
        .where(
          and(
            eq(schema.folderPermissions.folderId, input.folderId),
            eq(schema.folderPermissions.userId, input.userId)
          )
        )
        .limit(1);

      if (!permission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Permission not found",
        });
      }

      // Check if user is the one who granted the permission or is admin/PM
      const canRevoke =
        permission.grantedBy === userId ||
        ctx.orgRole === "org:admin" ||
        ctx.orgRole === "org:project_manager";

      if (!canRevoke) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only revoke permissions you granted",
        });
      }

      // Delete permission
      await db
        .delete(schema.folderPermissions)
        .where(
          and(
            eq(schema.folderPermissions.folderId, input.folderId),
            eq(schema.folderPermissions.userId, input.userId)
          )
        );

      // Audit log
      await createAuditLog(db, schema, {
        entityType: "Folder",
        entityId: input.folderId,
        action: AuditAction.UPDATE,
        actorId: userId,
        changes: {
          after: {
            permissions: {
              revoked: { userId: input.userId },
            },
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get documents shared with the current user.
   * Returns documents where user has explicit permission (not via project team).
   */
  getSharedWithMe: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const userId = ctx.userId;

      // Load explicit permissions for this user
      const explicitPerms = await loadDocumentPermissions(db, schema, userId);

      // Build list of document IDs to fetch
      const documentIdsToFetch = Array.from(explicitPerms.documentIds);

      // If no explicit document permissions, return empty array
      if (documentIdsToFetch.length === 0 && explicitPerms.folderIds.size === 0) {
        return [];
      }

      // Query documents with explicit permissions or in folders with permissions
      const conditions = [];

      if (documentIdsToFetch.length > 0) {
        conditions.push(inArray(schema.documents.id, documentIdsToFetch));
      }

      if (explicitPerms.folderIds.size > 0) {
        const folderIdsArray = Array.from(explicitPerms.folderIds);
        conditions.push(inArray(schema.documents.folderId, folderIdsArray));
      }

      if (conditions.length === 0) {
        return [];
      }

      // Fetch documents
      const documents = await db
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
        .where(or(...conditions))
        .orderBy(desc(schema.documents.updatedAt))
        .limit(100);

      // For each document, get permission details
      const result = await Promise.all(
        documents.map(async (doc) => {
          // Check if permission is from document or folder
          let permissionLevel: "view" | "edit" = "view";
          let grantedBy: string | null = null;
          let grantedAt: Date | null = null;

          // Check document permissions first
          const [docPerm] = await db
            .select({
              permissionLevel: schema.documentPermissions.permissionLevel,
              grantedBy: schema.documentPermissions.grantedBy,
              grantedAt: schema.documentPermissions.grantedAt,
            })
            .from(schema.documentPermissions)
            .where(
              and(
                eq(schema.documentPermissions.documentId, doc.id),
                eq(schema.documentPermissions.userId, userId)
              )
            )
            .limit(1);

          if (docPerm) {
            permissionLevel = docPerm.permissionLevel as "view" | "edit";
            grantedBy = docPerm.grantedBy;
            grantedAt = docPerm.grantedAt;
          } else if (doc.folderId) {
            // Check folder permissions
            const [folderPerm] = await db
              .select({
                permissionLevel: schema.folderPermissions.permissionLevel,
                grantedBy: schema.folderPermissions.grantedBy,
                grantedAt: schema.folderPermissions.grantedAt,
              })
              .from(schema.folderPermissions)
              .where(
                and(
                  eq(schema.folderPermissions.folderId, doc.folderId),
                  eq(schema.folderPermissions.userId, userId)
                )
              )
              .limit(1);

            if (folderPerm) {
              permissionLevel = folderPerm.permissionLevel as "view" | "edit";
              grantedBy = folderPerm.grantedBy;
              grantedAt = folderPerm.grantedAt;
            }
          }

          // Get project name
          const [project] = await db
            .select({ name: schema.projects.name })
            .from(schema.projects)
            .where(eq(schema.projects.id, doc.projectId))
            .limit(1);

          // Get folder name if applicable
          let folderName: string | null = null;
          if (doc.folderId) {
            const [folder] = await db
              .select({ name: schema.folders.name })
              .from(schema.folders)
              .where(eq(schema.folders.id, doc.folderId))
              .limit(1);
            folderName = folder?.name ?? null;
          }

          // Get granter profile
          let grantedByProfile: { fullName: string; email: string } | null = null;
          if (grantedBy) {
            const [profile] = await db
              .select({
                firstName: schema.userProfiles.firstName,
                lastName: schema.userProfiles.lastName,
                email: schema.userProfiles.email,
              })
              .from(schema.userProfiles)
              .where(eq(schema.userProfiles.clerkUserId, grantedBy))
              .limit(1);

            if (profile) {
              grantedByProfile = {
                fullName:
                  profile.firstName && profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`
                    : profile.email,
                email: profile.email,
              };
            }
          }

          return {
            document: doc,
            project: { name: project?.name ?? "Unknown Project" },
            folder: folderName ? { name: folderName } : null,
            permissionLevel,
            grantedBy: grantedByProfile,
            grantedAt,
          };
        })
      );

      return result;
    }),
});
