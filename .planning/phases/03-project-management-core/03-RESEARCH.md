# Phase 3: Project Management Core - Research

**Researched:** 2026-02-12
**Domain:** Multi-tenant project management with document storage, version control, and team-based access control
**Confidence:** MEDIUM-HIGH

## Summary

Phase 3 implements the project management foundation that all subsequent phases depend on. Users must be able to create projects with comprehensive metadata (name, location, type, dates, team assignments), manage project documents with folder structure and version control, and enforce granular access controls at the project level. This phase extends the existing schema-per-tenant architecture with new project-related tables, implements document storage with cloud-agnostic S3-compatible APIs, and builds on the existing CASL authorization patterns to support project-level permissions.

The implementation presents three key architectural challenges: (1) document storage must be cloud-agnostic while maintaining tenant isolation, (2) version control must track document lineage without complexity explosion, and (3) access control must extend from organization-level roles to project-level team permissions. Research indicates that modern construction management follows industry-standard folder structures with document type categorization (contracts, specifications, RFIs, submittals, invoices) and relies heavily on audit trails for compliance.

**Primary recommendation:** Use MinIO (or S3-compatible storage) with tenant-prefixed paths for document isolation, implement parent-child document versioning with a separate `document_versions` table to avoid JOIN complexity, extend CASL abilities with project-specific conditions that check team membership, and adopt construction industry standard folder structures with CSI MasterFormat alignment for cost code integration in Phase 4.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Current (0.45.1+) | Project schema, document metadata, team relationships | Already in use; excellent PostgreSQL support with JSONB for flexible metadata |
| tRPC | Current (11.10.0+) | Type-safe project CRUD and document upload APIs | Already in use; end-to-end type safety with React Query integration |
| CASL | Current (6.8.0+) | Project-level access control with conditions | Already in use; supports entity-level permissions beyond role-based access |
| Zod | Current (3.25.76+) | Project creation validation, document metadata schemas | Already in use; runtime validation with TypeScript inference |
| MinIO | Latest | S3-compatible object storage (local dev, cloud-agnostic production) | Open-source, AWS S3 compatible, supports tenant isolation via prefixes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-s3 | ^3.x | S3-compatible storage client | File upload/download to MinIO or AWS S3 |
| @aws-sdk/s3-request-presigner | ^3.x | Pre-signed URLs for client-side uploads | Large file uploads without proxying through API |
| React Hook Form | Current (7.71.1+) | Project creation forms, document upload forms | Already in use; integrates with Zod and shadcn/ui |
| shadcn/ui Dialog | Current | Document upload modal, project creation wizard | Already in use; accessible modal components |
| date-fns or dayjs | ^3.x or ^1.x | Date range validation (project start/end dates) | Lightweight date manipulation without moment.js overhead |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MinIO | UploadThing, Vercel Blob | Managed services are easier but add vendor lock-in; violates cloud-agnostic requirement |
| Parent-child version table | Event sourcing with snapshots | Event sourcing offers complete history but adds complexity for simple version tracking |
| Project-level CASL conditions | Separate permission table with project_id JOIN | Permission table is more flexible but requires manual sync; CASL conditions are declarative |
| S3-compatible storage | Database BYTEA storage | Database storage avoids external dependencies but doesn't scale for large files (specs, drawings) |

**Installation:**
```bash
# New dependencies for Phase 3
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner date-fns
pnpm add -D @types/node # (if not already installed)

# Development: MinIO for local S3-compatible storage
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── db/schema/
│   ├── tenant.ts              # Add projects, project_team_members, documents, document_versions
│   └── seed/
│       └── project-types.ts   # Reference data: project types, default phases
├── trpc/routers/
│   ├── project.ts             # Project CRUD (create, list, get, update, archive)
│   └── document.ts            # Document upload, download, version history
├── storage/
│   ├── client.ts              # S3-compatible storage client factory
│   ├── upload.ts              # Upload service with tenant isolation
│   └── download.ts            # Download service with pre-signed URLs
└── auth/
    └── abilities.ts           # UPDATED: Add project-level conditions to CASL rules

apps/web/app/(dashboard)/
├── projects/
│   ├── page.tsx               # Project list view
│   ├── new/
│   │   └── page.tsx           # Project creation wizard
│   └── [projectId]/
│       ├── page.tsx           # Project dashboard (budget, schedule, activity)
│       ├── team/
│       │   └── page.tsx       # Team member management
│       └── documents/
│           └── page.tsx       # Document browser with folder tree
└── components/
    └── project/
        ├── project-form.tsx   # Reusable project creation/edit form
        ├── document-uploader.tsx # Document upload with drag-drop
        └── document-tree.tsx  # Folder structure browser
```

### Pattern 1: Tenant-Isolated S3 Storage
**What:** Store documents in S3-compatible storage with tenant-scoped prefixes to prevent cross-tenant access.

**When to use:** All document uploads and downloads in multi-tenant SaaS applications.

**Example:**
```typescript
// apps/api/src/storage/client.ts
import { S3Client } from "@aws-sdk/client-s3";

export function createStorageClient(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT, // MinIO local or AWS S3
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // Required for MinIO
  });
}

// apps/api/src/storage/upload.ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { TenantSchema } from "../db/schema/tenant.js";

export async function uploadDocument(
  tenantId: string,
  projectId: string,
  file: Buffer,
  metadata: { fileName: string; contentType: string }
): Promise<string> {
  const s3 = createStorageClient();
  const bucket = process.env.S3_BUCKET_NAME!;

  // CRITICAL: Tenant isolation via path prefix
  const key = `tenants/${tenantId}/projects/${projectId}/${metadata.fileName}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file,
    ContentType: metadata.contentType,
    Metadata: {
      tenantId,
      projectId,
      uploadedAt: new Date().toISOString(),
    },
  }));

  return key; // Store this in documents table
}
```

**Source:** [AWS S3 Multi-Tenant Design Patterns](https://aws.amazon.com/blogs/storage/design-patterns-for-multi-tenant-access-control-on-amazon-s3/)

### Pattern 2: Document Version Control with Parent-Child Relationships
**What:** Track document versions with a parent-child relationship where each version points to its predecessor, enabling version history queries without complex JOINs.

**When to use:** Any document that requires version history (contracts, specifications, drawings).

**Example:**
```typescript
// apps/api/src/db/schema/tenant.ts
export function createTenantSchema(schemaName: string) {
  const schema = pgSchema(schemaName);

  const documents = schema.table("documents", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    folderId: uuid("folder_id"), // NULL = root folder
    currentVersionId: uuid("current_version_id"), // Points to latest version
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  const documentVersions = schema.table("document_versions", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(), // 1, 2, 3, ...
    storageKey: text("storage_key").notNull(), // S3 object key
    fileSize: integer("file_size").notNull(), // bytes
    contentType: text("content_type").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
    changeNotes: text("change_notes"), // Optional version notes
  });

  return { schema, documents, documentVersions, /* ... */ };
}

// Query pattern: Get version history
const versionHistory = await tenantDb
  .select()
  .from(documentVersions)
  .where(eq(documentVersions.documentId, docId))
  .orderBy(desc(documentVersions.versionNumber));
```

**Source:** Adapted from [MongoDB Document Versioning Pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/) and [Azure Cosmos DB Document Versioning](https://learn.microsoft.com/en-us/samples/azure-samples/cosmos-db-design-patterns/document-versioning/)

### Pattern 3: Project-Level Access Control with CASL Conditions
**What:** Extend organization-level CASL abilities with project-specific conditions that check team membership before allowing actions.

**When to use:** Any resource scoped to a project (documents, budgets, change orders, etc.).

**Example:**
```typescript
// apps/api/src/auth/abilities.ts
import { AbilityBuilder, PureAbility } from "@casl/ability";

export function defineAbilitiesFor(role: string, userId: string, projectTeams?: ProjectTeamMembership[]) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  // Project-level permissions based on team membership
  const userProjectIds = projectTeams?.map(t => t.projectId) ?? [];

  switch (role) {
    case "org:admin":
      can("manage", "all");
      break;

    case "org:project_manager":
      // Can manage projects they're assigned to
      can("manage", "Project", { id: { $in: userProjectIds } });
      can("manage", "Document", { projectId: { $in: userProjectIds } });
      can("read", "Project"); // Can view all projects in org
      break;

    case "org:superintendent":
      // Can update projects they're assigned to, but not delete
      can("read", "Project", { id: { $in: userProjectIds } });
      can("update", "Project", { id: { $in: userProjectIds } });
      can("manage", "Document", { projectId: { $in: userProjectIds } });
      cannot("delete", "Project");
      break;

    case "org:member":
      // Read-only for assigned projects
      can("read", "Project", { id: { $in: userProjectIds } });
      can("read", "Document", { projectId: { $in: userProjectIds } });
      break;
  }

  return build();
}

// Usage in tRPC procedure
export const projectRouter = router({
  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // CASL automatically checks: can("update", "Project", { id: input.id })
      ForbiddenError.from(ctx.abilities).throwUnlessCan("update", "Project", { id: input.id });

      return await ctx.tenant.db
        .update(projects)
        .set({ name: input.name })
        .where(eq(projects.id, input.id));
    }),
});
```

**Source:** [CASL Documentation - Conditions](https://casl.js.org/v6/en/guide/conditions-in-depth)

### Pattern 4: Construction Folder Structure with CSI Alignment
**What:** Organize project documents using industry-standard folder hierarchy that aligns with CSI divisions for future cost code integration.

**When to use:** Project document organization in construction management systems.

**Example:**
```typescript
// apps/api/src/db/seed/folder-templates.ts
export const DEFAULT_FOLDER_STRUCTURE = [
  { name: "Contracts", order: 1, description: "Owner contracts, subcontracts, purchase orders" },
  { name: "Drawings", order: 2, description: "Architectural, structural, MEP drawings" },
  { name: "Specifications", order: 3, description: "Project specifications organized by CSI division" },
  { name: "Submittals", order: 4, description: "Material and equipment submittals" },
  { name: "RFIs", order: 5, description: "Requests for Information" },
  { name: "Change Orders", order: 6, description: "Owner and subcontractor change orders" },
  { name: "Payment Applications", order: 7, description: "AIA G702/G703 forms, lien waivers" },
  { name: "Invoices", order: 8, description: "AP/AR documentation" },
  { name: "Reports", order: 9, description: "Daily reports, inspection reports, progress photos" },
  { name: "Closeout", order: 10, description: "As-builts, warranties, O&M manuals" },
];

// Create default folders when project is created
async function createProjectFolders(projectId: string, tenantDb: TenantSchema) {
  await tenantDb.insert(folders).values(
    DEFAULT_FOLDER_STRUCTURE.map(f => ({
      projectId,
      name: f.name,
      parentId: null, // Root level
      order: f.order,
      description: f.description,
    }))
  );
}
```

**Source:** [Procore Construction Document Control](https://www.procore.com/library/construction-document-control), [eSub Construction Document Organization](https://esub.com/how-to-organize-construction-documents/)

### Pattern 5: Pre-Signed URLs for Client-Side File Uploads
**What:** Generate temporary pre-signed S3 URLs that allow frontend to upload directly to storage without proxying through API server.

**When to use:** Large file uploads (drawings, specifications) to reduce API server load and improve performance.

**Example:**
```typescript
// apps/api/src/storage/presigned.ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function generateUploadUrl(
  tenantId: string,
  projectId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; storageKey: string }> {
  const s3 = createStorageClient();
  const bucket = process.env.S3_BUCKET_NAME!;
  const key = `tenants/${tenantId}/projects/${projectId}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  // URL expires in 15 minutes
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  return { uploadUrl, storageKey: key };
}

// tRPC procedure
export const documentRouter = router({
  getUploadUrl: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      fileName: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenant.tenantId;
      return await generateUploadUrl(
        tenantId,
        input.projectId,
        input.fileName,
        input.contentType
      );
    }),
});

// Frontend usage
const upload = async (file: File) => {
  // Step 1: Get pre-signed URL from API
  const { uploadUrl, storageKey } = await trpc.document.getUploadUrl.mutate({
    projectId,
    fileName: file.name,
    contentType: file.type,
  });

  // Step 2: Upload directly to S3
  await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  // Step 3: Record document metadata in database
  await trpc.document.create.mutate({
    projectId,
    name: file.name,
    storageKey,
    fileSize: file.size,
    contentType: file.type,
  });
};
```

**Source:** [tRPC File Upload with AWS S3](https://www.adarsha.dev/blog/trpc-file-upload-aws-s3), [Next.js 15 File Upload Tutorial](https://strapi.io/blog/epic-next-js-15-tutorial-part-5-file-upload-using-server-actions)

### Anti-Patterns to Avoid

- **Storing files in PostgreSQL:** BYTEA columns work for small files but cause performance degradation with large drawings/specifications. Use S3-compatible storage instead.
- **Global S3 buckets without tenant prefixes:** Creates risk of cross-tenant data leakage. Always use tenant-scoped path prefixes.
- **Unlimited file uploads without size validation:** Prevent abuse with file size limits (e.g., 50MB for documents, 500MB for drawings).
- **Synchronous file processing in API routes:** Large file uploads block request handlers. Use pre-signed URLs for client-side uploads.
- **Hard-coded folder structure:** Projects vary (commercial, residential, infrastructure). Make folder templates configurable per company type.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File storage | Custom file storage abstraction | S3-compatible API (@aws-sdk/client-s3) | S3 API is industry standard; MinIO provides local dev compatibility; switching providers is trivial |
| Document versioning | Git-like diff system | Parent-child version table with snapshots | Construction documents are binary (PDFs, DWG); diffing is unnecessary; full snapshots are simpler |
| File type validation | Custom MIME type checker | Zod with file extension allowlist | MIME types can be spoofed; extension + size validation is sufficient for construction docs |
| Presigned URL generation | Custom signing algorithm | @aws-sdk/s3-request-presigner | Pre-signed URLs involve HMAC signatures with timestamp validation; AWS SDK handles edge cases |
| Folder tree rendering | Recursive React components | react-arborist or shadcn/ui TreeView | Folder trees with drag-drop, expand/collapse, and lazy loading are complex; use battle-tested libraries |

**Key insight:** Construction document management has been solved by Procore, Autodesk, and other platforms. Don't invent novel approaches—adopt proven patterns (folder hierarchy, version snapshots, audit trails) and focus on differentiating features in later phases (QuickBooks sync, calendar integration).

## Common Pitfalls

### Pitfall 1: Cross-Tenant Document Access via S3 Key Guessing
**What goes wrong:** If S3 keys use sequential IDs or predictable patterns, attackers can access other tenants' documents by enumerating keys.

**Why it happens:** Developers use `projects/${projectId}/document.pdf` without tenant prefix, or use sequential integer IDs instead of UUIDs.

**How to avoid:**
- Always include tenant ID in S3 key: `tenants/${tenantId}/projects/${projectId}/${uuid}.pdf`
- Use UUIDs for all identifiers (projects, documents, folders)
- Set S3 bucket policy to deny access unless IAM role matches tenant

**Warning signs:**
- S3 keys don't include tenant identifier
- Document IDs are sequential integers
- No server-side validation that project belongs to requesting tenant

**Source:** [AWS Multi-Tenant S3 Isolation](https://aws.amazon.com/blogs/apn/partitioning-and-isolating-multi-tenant-saas-data-with-amazon-s3/)

### Pitfall 2: Document Versions Causing JOIN Explosion
**What goes wrong:** Querying document lists requires JOINs across documents → documentVersions → storage metadata, causing N+1 queries or slow performance.

**Why it happens:** Normalizing every piece of metadata (file size, content type, upload date) into separate tables.

**How to avoid:**
- Store current version metadata denormalized in `documents` table (fileSize, contentType, currentVersionId)
- Only query `documentVersions` when displaying version history (rare operation)
- Use PostgreSQL JSONB for flexible metadata that varies by document type

**Warning signs:**
- Every document list query JOINs 3+ tables
- Page load time increases linearly with document count
- Database query profiler shows N+1 patterns

### Pitfall 3: CASL Conditions Not Enforced at Database Level
**What goes wrong:** Frontend checks CASL permissions but backend doesn't re-verify, allowing attackers to bypass UI restrictions via direct API calls.

**Why it happens:** Trusting client-side authorization checks; forgetting to enforce CASL in tRPC procedures.

**How to avoid:**
- ALWAYS call `ForbiddenError.from(ctx.abilities).throwUnlessCan(action, subject)` in tRPC mutations
- Load user's project team memberships when building CASL abilities in context
- Add integration tests that verify non-team members cannot access project documents

**Warning signs:**
- tRPC procedures only use `protectedProcedure` without CASL checks
- Authorization logic only exists in frontend components
- No integration tests for cross-tenant/cross-project access prevention

**Source:** [tRPC Authorization Guide](https://trpc.io/docs/server/authorization)

### Pitfall 4: File Upload Without Virus Scanning
**What goes wrong:** Malicious users upload infected files that spread to team members downloading documents.

**Why it happens:** Assuming SaaS users are trustworthy; skipping security scans to reduce complexity.

**How to avoid:**
- For v1: Document the risk in security docs; rely on browser-level protection
- For production: Integrate ClamAV or AWS S3 virus scanning on upload
- Add `scanStatus` field to documents table (pending, clean, infected)

**Warning signs:**
- No mention of virus scanning in security documentation
- File uploads go directly to storage without any validation beyond MIME type

### Pitfall 5: No File Size Limits Leading to Storage Quota Exhaustion
**What goes wrong:** Users upload multi-GB files (video walkthroughs, large CAD models), exhausting S3 storage quotas and incurring unexpected costs.

**Why it happens:** Forgetting to validate file sizes on both client and server; no monitoring of storage usage per tenant.

**How to avoid:**
- Set max file size limits: 50MB for PDFs/documents, 500MB for drawings
- Validate file size in both frontend (immediate feedback) and backend (security)
- Track storage usage per tenant; alert when approaching limits

**Warning signs:**
- No file size validation in upload procedures
- No storage usage tracking in database
- No alerts configured for S3 storage costs

## Code Examples

Verified patterns from official sources:

### Project Creation with Team Assignment
```typescript
// apps/api/src/trpc/routers/project.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { projects, projectTeamMembers } from "../../db/schema/tenant.js";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  projectType: z.enum(["commercial", "residential", "infrastructure", "industrial"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  budget: z.number().positive().optional(),
  costCodes: z.array(z.number().int().min(0).max(49)), // CSI divisions
  teamMembers: z.array(z.object({
    userId: z.string(),
    role: z.enum(["project_manager", "superintendent", "foreman", "viewer"]),
  })),
});

export const projectRouter = router({
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId, tenant } = ctx;
      if (!tenant) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Check organization-level permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("create", "Project");

      const [project] = await tenant.db.transaction(async (tx) => {
        // Insert project
        const [newProject] = await tx.insert(projects).values({
          name: input.name,
          description: input.description,
          location: input.location,
          projectType: input.projectType,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          budget: input.budget,
          costCodes: input.costCodes,
          createdBy: userId,
        }).returning();

        // Assign team members
        if (input.teamMembers.length > 0) {
          await tx.insert(projectTeamMembers).values(
            input.teamMembers.map(tm => ({
              projectId: newProject.id,
              userId: tm.userId,
              role: tm.role,
              assignedBy: userId,
            }))
          );
        }

        // Create default folder structure
        await createProjectFolders(newProject.id, tx);

        return [newProject];
      });

      // Audit log
      await ctx.tenant.auditLog({
        entityType: "Project",
        entityId: project.id,
        action: "create",
        actorId: userId,
        changes: { after: project },
      });

      return project;
    }),
});
```

### Document Upload with Version Control
```typescript
// apps/api/src/trpc/routers/document.ts
export const documentRouter = router({
  uploadVersion: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      storageKey: z.string(), // Uploaded via pre-signed URL
      fileSize: z.number(),
      contentType: z.string(),
      changeNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId, tenant } = ctx;
      if (!tenant) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Fetch document and verify access
      const [doc] = await tenant.db
        .select()
        .from(documents)
        .where(eq(documents.id, input.documentId));

      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      // Check project-level permission
      ForbiddenError.from(ctx.abilities).throwUnlessCan("update", "Document", {
        projectId: doc.projectId
      });

      // Get current version number
      const versions = await tenant.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, input.documentId))
        .orderBy(desc(documentVersions.versionNumber))
        .limit(1);

      const nextVersionNumber = (versions[0]?.versionNumber ?? 0) + 1;

      // Create new version
      const [newVersion] = await tenant.db.insert(documentVersions).values({
        documentId: input.documentId,
        versionNumber: nextVersionNumber,
        storageKey: input.storageKey,
        fileSize: input.fileSize,
        contentType: input.contentType,
        uploadedBy: userId,
        changeNotes: input.changeNotes,
      }).returning();

      // Update document's current version pointer
      await tenant.db
        .update(documents)
        .set({ currentVersionId: newVersion.id })
        .where(eq(documents.id, input.documentId));

      return newVersion;
    }),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Database BLOB storage | S3-compatible object storage | ~2015 | Scales horizontally; CDN integration; cost-effective for large files |
| Monolithic file upload | Pre-signed URLs with client-side upload | ~2018 | Reduces server load; improves upload performance; better UX |
| Role-based access only | Attribute-based with conditions (CASL) | ~2020 | Enables project-level permissions beyond org roles |
| Single folder structure | Configurable templates per project type | ~2022 | Supports diverse construction projects (commercial vs residential) |
| Sequential document IDs | UUID v4 for all identifiers | ~2023 | Prevents enumeration attacks in multi-tenant systems |

**Deprecated/outdated:**
- **Multer/Busboy for file uploads in Next.js:** Next.js 13+ recommends Server Actions with FormData
- **Moment.js:** Deprecated; use date-fns or dayjs for date manipulation
- **AWS SDK v2:** Deprecated; use @aws-sdk/client-s3 (v3) with modular imports
- **Manual S3 URL signing:** Use @aws-sdk/s3-request-presigner instead of custom HMAC
- **PostgreSQL SERIAL types:** Use IDENTITY columns or UUIDs (as of PostgreSQL 10+)

## Open Questions

1. **File retention and archival policy**
   - What we know: Construction projects generate large amounts of data; regulations may require 7+ year retention
   - What's unclear: Should archived projects be moved to cheaper storage tiers (S3 Glacier)? When can documents be permanently deleted?
   - Recommendation: For v1, keep all documents in hot storage. Add archive policy in Phase 4 after understanding actual storage costs.

2. **Document preview and thumbnails**
   - What we know: Users expect to preview PDFs and images without downloading
   - What's unclear: Should we generate thumbnails server-side (requires ImageMagick/Sharp) or use client-side rendering?
   - Recommendation: For v1, rely on browser's native PDF preview. Add thumbnail generation in a later phase if user feedback demands it.

3. **Large drawing file support (AutoCAD DWG, Revit RVT)**
   - What we know: CAD files can exceed 1GB; require specialized viewers
   - What's unclear: Do users expect to view DWG files in-browser, or is download-only acceptable?
   - Recommendation: Start with download-only support. Evaluate third-party CAD viewers (Autodesk Forge) based on user demand.

4. **Document OCR and full-text search**
   - What we know: Searching within PDF specs and contracts is valuable
   - What's unclear: Should we implement full-text search at document creation or as a later enhancement?
   - Recommendation: Defer to Phase 4 or later. Full-text search requires PostgreSQL pg_trgm or external service (Elasticsearch), adding complexity.

5. **Project templates and cloning**
   - What we know: Users create similar projects repeatedly (residential subdivisions, multi-site retail)
   - What's unclear: Should we support project templates with pre-configured cost codes, team roles, and folder structures?
   - Recommendation: Implement basic cloning (copy project metadata) in Phase 3. Advanced templating can be added after user feedback.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM Official Documentation](https://orm.drizzle.team/docs/overview) - Schema definition, migrations, PostgreSQL patterns
- [tRPC Authorization Guide](https://trpc.io/docs/server/authorization) - Context propagation, middleware patterns
- [CASL Documentation](https://casl.js.org/v6/en/guide/intro) - Attribute-based access control with conditions
- [@aws-sdk/client-s3 Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/) - S3-compatible storage client
- [MinIO S3 Compatibility](https://min.io/product/s3-compatibility) - Cloud-agnostic object storage

### Secondary (MEDIUM confidence)
- [AWS Multi-Tenant S3 Design Patterns](https://aws.amazon.com/blogs/storage/design-patterns-for-multi-tenant-access-control-on-amazon-s3/) - Tenant isolation strategies (Jan 2025)
- [Procore Construction Document Control](https://www.procore.com/library/construction-document-control) - Industry best practices for folder structure
- [CSI MasterFormat 2026 Guide](https://archdesk.com/blog/2026-guide-csi-masterformat) - Cost code structure for construction
- [MongoDB Document Versioning Pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/) - Versioning strategies
- [Next.js 15 File Upload Tutorial](https://strapi.io/blog/epic-next-js-15-tutorial-part-5-file-upload-using-server-actions) - Server Actions with FormData
- [PostgreSQL JSONB Guide](https://www.architecture-weekly.com/p/postgresql-jsonb-powerful-storage) - JSONB vs relational columns

### Tertiary (LOW confidence)
- Various WebSearch results on construction document types, folder structures - Provides industry context but not technical implementation details

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use except AWS SDK (well-documented, industry standard)
- Architecture patterns: MEDIUM-HIGH - Patterns verified from official docs (AWS, CASL, Drizzle) but not yet implemented in this codebase
- Pitfalls: MEDIUM - Based on general multi-tenant SaaS security patterns and AWS guidance, not construction-specific incidents
- Document folder structure: MEDIUM - Based on industry standards (Procore, eSub) but not validated with construction professionals

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days for stable technologies; AWS SDK, Drizzle, tRPC are mature)
