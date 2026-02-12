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
 * @returns CASL Ability instance
 */
export function defineAbilitiesFor(role: string, userId: string): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  switch (role) {
    case "org:admin":
      // Owner/Admin: full access to everything in their org
      can("manage", "all");
      break;

    case "org:project_manager":
      can("manage", "Project");
      can("manage", "Budget");
      can("manage", "ChangeOrder");
      can("manage", "PayApplication");
      can("read", "Bid");
      can("read", "RFQ");
      can("read", "AuditLog");
      can("read", "User");
      cannot("manage", "CompanySettings");
      break;

    case "org:accountant":
      can("manage", "Budget");
      can("manage", "PayApplication");
      can("read", "ChangeOrder");
      can("read", "Project");
      can("read", "AuditLog");
      can("read", "User");
      cannot("manage", "CompanySettings");
      break;

    case "org:estimator":
      can("manage", "Bid");
      can("manage", "RFQ");
      can("read", "Project");
      can("read", "Budget");
      can("read", "User");
      cannot("manage", "CompanySettings");
      break;

    case "org:superintendent":
      can("read", "Project");
      can("update", "Project"); // Will refine with conditions when we have project entity
      can("read", "Budget");
      can("read", "ChangeOrder");
      can("read", "User");
      cannot("manage", "CompanySettings");
      cannot("delete", "all");
      break;

    case "org:foreman":
      can("read", "Project");
      can("read", "User");
      cannot("manage", "CompanySettings");
      cannot("delete", "all");
      break;

    case "org:member":
    default:
      // Member: read-only access to basic resources
      can("read", "Project");
      can("read", "Budget");
      can("read", "Bid");
      break;
  }

  return build();
}
