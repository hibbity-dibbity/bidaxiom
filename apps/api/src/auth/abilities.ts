import { AbilityBuilder, PureAbility } from "@casl/ability";
import type { AppActions, AppSubjects } from "@construction/shared";
import { eq, and, or, gt, isNull, sql } from "drizzle-orm";
import type { TenantSchema } from "../db/schema/tenant.js";

type TenantDb = { db: ReturnType<typeof import("drizzle-orm/node-postgres")["drizzle"]> };

/**
 * Application ability type used throughout the app.
 */
export type AppAbility = PureAbility<[AppActions, AppSubjects]>;

/**
 * Explicit document permissions structure.
 * Used to supplement project-level permissions with granular sharing.
 */
export interface ExplicitDocumentPermissions {
  documentIds: Set<string>;
  folderIds: Set<string>;
  documentEditIds: Set<string>;
  folderEditIds: Set<string>;
}

/**
 * Load explicit document and folder permissions for a user.
 * Queries document_permissions and folder_permissions tables.
 *
 * IMPORTANT: This helper is NOT called automatically by defineAbilitiesFor.
 * It should be called explicitly in document routers to avoid N+1 queries.
 *
 * Usage pattern:
 * ```typescript
 * const explicitPerms = await loadDocumentPermissions(db, schema, userId);
 * const abilities = defineAbilitiesFor(role, userId, projectTeamMemberships, explicitPerms);
 * ```
 *
 * @param db - Tenant database connection
 * @param schema - Tenant schema
 * @param userId - User ID
 * @returns Object with sets of document/folder IDs the user has access to
 */
export async function loadDocumentPermissions(
  db: TenantDb["db"],
  schema: TenantSchema,
  userId: string
): Promise<ExplicitDocumentPermissions> {
  const now = new Date();

  // Query document permissions (active only)
  const docPerms = await db
    .select({
      documentId: schema.documentPermissions.documentId,
      permissionLevel: schema.documentPermissions.permissionLevel,
    })
    .from(schema.documentPermissions)
    .where(
      and(
        eq(schema.documentPermissions.userId, userId),
        or(
          isNull(schema.documentPermissions.expiresAt),
          gt(schema.documentPermissions.expiresAt, now)
        )
      )
    );

  // Query folder permissions (active only)
  const folderPerms = await db
    .select({
      folderId: schema.folderPermissions.folderId,
      permissionLevel: schema.folderPermissions.permissionLevel,
    })
    .from(schema.folderPermissions)
    .where(
      and(
        eq(schema.folderPermissions.userId, userId),
        or(
          isNull(schema.folderPermissions.expiresAt),
          gt(schema.folderPermissions.expiresAt, now)
        )
      )
    );

  return {
    documentIds: new Set(docPerms.map((p) => p.documentId)),
    folderIds: new Set(folderPerms.map((p) => p.folderId)),
    documentEditIds: new Set(
      docPerms.filter((p) => p.permissionLevel === "edit").map((p) => p.documentId)
    ),
    folderEditIds: new Set(
      folderPerms.filter((p) => p.permissionLevel === "edit").map((p) => p.folderId)
    ),
  };
}

/**
 * Define CASL abilities for a given role and user.
 *
 * Called per-request (stateless). Role comes from organization membership,
 * NEVER from the frontend.
 *
 * @param role - Organization role (e.g., "org:admin", "org:member")
 * @param userId - User ID (for ownership-based rules)
 * @param projectTeamMemberships - Optional array of project team memberships for project-level scoping
 * @param explicitDocumentPermissions - Optional explicit document/folder permissions (call loadDocumentPermissions first)
 * @returns CASL Ability instance
 */
export function defineAbilitiesFor(
  role: string,
  userId: string,
  projectTeamMemberships?: Array<{ projectId: string; role: string }>,
  explicitDocumentPermissions?: ExplicitDocumentPermissions
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  // Extract project IDs from team memberships for scoping
  const userProjectIds = projectTeamMemberships?.map(t => t.projectId) ?? [];

  // Convert explicit permission sets to arrays for CASL $in operator
  const explicitDocIds = explicitDocumentPermissions
    ? Array.from(explicitDocumentPermissions.documentIds)
    : [];
  const explicitFolderIds = explicitDocumentPermissions
    ? Array.from(explicitDocumentPermissions.folderIds)
    : [];
  const explicitDocEditIds = explicitDocumentPermissions
    ? Array.from(explicitDocumentPermissions.documentEditIds)
    : [];
  const explicitFolderEditIds = explicitDocumentPermissions
    ? Array.from(explicitDocumentPermissions.folderEditIds)
    : [];

  // IMPORTANT: Explicit permissions supplement, not replace, project-level permissions.
  // Admin and PM roles maintain full access regardless of explicit grants.
  // Explicit permissions allow extending access to users who are NOT on the project team.

  switch (role) {
    case "org:admin":
      // Owner/Admin: full access to everything in their org
      can("manage", "all");
      break;

    case "org:project_manager":
      can("read", "Project"); // Can list all projects
      can("manage", "Project", { id: { $in: userProjectIds } }); // Can manage assigned projects
      can("manage", "Budget");
      can("manage", "Commitment");
      can("manage", "ChangeOrder");
      can("manage", "PayApplication");
      can("manage", "PaymentApp");
      can("manage", "LienWaiver");
      can("manage", "Document", { projectId: { $in: userProjectIds } });
      can("manage", "Folder", { projectId: { $in: userProjectIds } });
      can("manage", "Workflow", { projectId: { $in: userProjectIds } });
      can("manage", "RFQ");
      can("read", "Bid");
      can("read", "SubcontractorDirectory");
      can("manage", "Calendar");
      can("manage", "Report");
      can("read", "AuditLog");
      can("read", "User");
      cannot("manage", "CompanySettings");
      cannot("manage", "QuickBooks");
      break;

    case "org:accountant":
      can("read", "Project", { id: { $in: userProjectIds } });
      can("manage", "Budget");
      can("manage", "Commitment");
      can("read", "Commitment");
      can("manage", "PayApplication");
      can("manage", "PaymentApp");
      can("manage", "LienWaiver");
      can("manage", "Document", { projectId: { $in: userProjectIds } });
      can("manage", "Folder", { projectId: { $in: userProjectIds } });
      can("read", "Workflow", { projectId: { $in: userProjectIds } });
      can("approve", "Workflow");
      can("read", "ChangeOrder");
      can("approve", "ChangeOrder");
      can("read", "RFQ");
      can("read", "Bid");
      can("read", "Calendar");
      can("manage", "Report");
      can("read", "QuickBooks");
      can("read", "AuditLog");
      can("read", "User");
      cannot("manage", "CompanySettings");
      cannot("manage", "QuickBooks");
      break;

    case "org:estimator":
      can("read", "Project", { id: { $in: userProjectIds } });
      can("manage", "Bid");
      can("manage", "RFQ");
      can("manage", "SubcontractorDirectory");
      can("read", "Budget");
      can("read", "Commitment");
      can("read", "ChangeOrder");
      can("read", "PaymentApp");
      can("read", "LienWaiver");
      can("read", "Document", { projectId: { $in: userProjectIds } });
      can("read", "Folder", { projectId: { $in: userProjectIds } });
      can("create", "Workflow", { projectId: { $in: userProjectIds } });
      can("read", "Workflow", { projectId: { $in: userProjectIds } });
      can("update", "Workflow", { projectId: { $in: userProjectIds } });
      can("read", "Calendar");
      can("read", "Report");
      can("read", "User");
      cannot("manage", "CompanySettings");
      break;

    case "org:superintendent":
      can("read", "Project", { id: { $in: userProjectIds } });
      can("update", "Project", { id: { $in: userProjectIds } });
      can("manage", "Document", { projectId: { $in: userProjectIds } });
      can("manage", "Folder", { projectId: { $in: userProjectIds } });
      can("create", "Workflow", { projectId: { $in: userProjectIds } });
      can("read", "Workflow", { projectId: { $in: userProjectIds } });
      can("update", "Workflow", { projectId: { $in: userProjectIds } });
      can("delete", "Workflow", { projectId: { $in: userProjectIds }, status: "draft" });
      can("read", "Budget");
      can("read", "Commitment");
      can("read", "ChangeOrder");
      can("approve", "ChangeOrder");
      can("read", "PaymentApp");
      can("approve", "PaymentApp");
      can("read", "LienWaiver");
      can("read", "RFQ");
      can("read", "Bid");
      can("manage", "Calendar");
      can("read", "Report");
      can("read", "User");
      cannot("manage", "CompanySettings");
      cannot("delete", "all");
      break;

    case "org:foreman":
      can("read", "Project", { id: { $in: userProjectIds } });
      can("read", "Budget");
      can("read", "Commitment");
      can("read", "ChangeOrder");
      can("read", "PaymentApp");
      can("read", "LienWaiver");
      can("read", "RFQ");
      can("read", "Document", { projectId: { $in: userProjectIds } });
      can("read", "Folder", { projectId: { $in: userProjectIds } });
      can("read", "Workflow", { projectId: { $in: userProjectIds } });
      can("update", "Workflow", { projectId: { $in: userProjectIds }, submittedBy: userId });
      can("read", "Calendar");
      can("read", "Report");
      can("read", "User");
      cannot("manage", "CompanySettings");
      cannot("delete", "all");
      break;

    case "org:member":
    default:
      // Member: read-only access to basic resources they're assigned to
      can("read", "Project", { id: { $in: userProjectIds } });
      can("read", "Document", { projectId: { $in: userProjectIds } });
      can("read", "Folder", { projectId: { $in: userProjectIds } });
      can("read", "Workflow", { projectId: { $in: userProjectIds } });
      can("read", "Budget");
      can("read", "Commitment");
      can("read", "ChangeOrder");
      can("read", "PaymentApp");
      can("read", "LienWaiver");
      can("read", "Bid");
      can("read", "Calendar");
      can("read", "Report");
      break;
  }

  // Add explicit document/folder permission rules (applies to all roles except admin who already has "manage all")
  // These rules supplement project-level permissions defined above
  if (explicitDocumentPermissions && role !== "org:admin") {
    // Documents with explicit view or edit permission
    if (explicitDocIds.length > 0) {
      can("read", "Document", { id: { $in: explicitDocIds } });
    }
    if (explicitDocEditIds.length > 0) {
      can("update", "Document", { id: { $in: explicitDocEditIds } });
    }

    // Documents in folders with explicit permissions (inheritance)
    if (explicitFolderIds.length > 0) {
      can("read", "Document", { folderId: { $in: explicitFolderIds } });
    }
    if (explicitFolderEditIds.length > 0) {
      can("update", "Document", { folderId: { $in: explicitFolderEditIds } });
    }

    // Folders with explicit permissions
    if (explicitFolderIds.length > 0) {
      can("read", "Folder", { id: { $in: explicitFolderIds } });
    }
    if (explicitFolderEditIds.length > 0) {
      can("update", "Folder", { id: { $in: explicitFolderEditIds } });
    }
  }

  return build();
}
