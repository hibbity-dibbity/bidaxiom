"use client";

import { createContext, useContext, useMemo } from "react";
import { AbilityBuilder, PureAbility } from "@casl/ability";
import { createContextualCan } from "@casl/react";
import type { AppActions, AppSubjects } from "@construction/shared";

/**
 * Application ability type (same as server-side).
 */
export type AppAbility = PureAbility<[AppActions, AppSubjects]>;

/**
 * Define CASL abilities for a given role and user.
 * Isomorphic — same logic as server-side abilities.ts.
 *
 * NOTE: Keep in sync with apps/api/src/auth/abilities.ts.
 * In future, consider sharing this via the shared package.
 */
export function defineAbilitiesFor(role: string, userId: string): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  switch (role) {
    case "org:admin":
      can("manage", "all");
      break;

    case "org:project_manager":
      can("manage", "Project");
      can("manage", "Budget");
      can("manage", "ChangeOrder");
      can("manage", "PayApplication");
      can("read", "Bid");
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
      can("read", "Project");
      can("read", "Budget");
      can("read", "User");
      cannot("manage", "CompanySettings");
      break;

    case "org:superintendent":
      can("read", "Project");
      can("update", "Project");
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
      can("read", "Project");
      can("read", "Budget");
      can("read", "Bid");
      break;
  }

  return build();
}

/**
 * Default empty ability (no permissions).
 */
const defaultAbility = new PureAbility<[AppActions, AppSubjects]>();

/**
 * React context for CASL abilities.
 */
export const AbilityContext = createContext<AppAbility>(defaultAbility);

/**
 * Hook to access current user's abilities.
 *
 * Usage:
 *   const abilities = useAbilities();
 *   if (abilities.can('create', 'Project')) { ... }
 */
export function useAbilities(): AppAbility {
  return useContext(AbilityContext);
}

/**
 * Declarative permission check component.
 *
 * Usage:
 *   <Can I="create" a="Project">
 *     <CreateProjectButton />
 *   </Can>
 */
export const Can = createContextualCan(AbilityContext.Consumer);
