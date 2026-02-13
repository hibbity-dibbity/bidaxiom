import { AbilityBuilder, PureAbility } from "@casl/ability";
import type { AppActions, AppSubjects } from "@construction/shared";

/**
 * Application ability type used throughout the app.
 */
export type AppAbility = PureAbility<[AppActions, AppSubjects]>;

/**
 * Define CASL abilities for a given role and user.
 *
 * Called per-request (stateless). Role comes from Clerk org membership,
 * NEVER from the frontend.
 *
 * @param role - Clerk organization role (e.g., "org:admin", "org:member")
 * @param userId - Clerk user ID (for ownership-based rules)
 * @param projectTeamMemberships - Optional array of project team memberships for project-level scoping
 * @returns CASL Ability instance
 */
export function defineAbilitiesFor(
  role: string,
  userId: string,
  projectTeamMemberships?: Array<{ projectId: string; role: string }>
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  // Extract project IDs from team memberships for scoping
  const userProjectIds = projectTeamMemberships?.map(t => t.projectId) ?? [];

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
      break;
  }

  return build();
}
