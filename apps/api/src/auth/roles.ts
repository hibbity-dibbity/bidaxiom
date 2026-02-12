/**
 * Role definitions and hierarchy for the construction domain.
 *
 * Roles map to Clerk organization roles. Custom roles beyond admin/member
 * are configured in Clerk Dashboard -> Organizations -> Roles.
 */

export const ROLES = {
  "org:admin": {
    label: "Owner / Admin",
    description: "Full company management, all permissions",
    level: 100,
  },
  "org:project_manager": {
    label: "Project Manager",
    description: "Manage projects, budgets, change orders, pay apps",
    level: 80,
  },
  "org:accountant": {
    label: "Accountant",
    description: "Manage financials, pay apps, view all budgets",
    level: 70,
  },
  "org:estimator": {
    label: "Estimator",
    description: "Manage bids, RFQs, view budgets",
    level: 60,
  },
  "org:superintendent": {
    label: "Superintendent",
    description: "View projects, update daily logs, limited budget view",
    level: 50,
  },
  "org:foreman": {
    label: "Foreman",
    description: "View assigned projects, submit daily reports",
    level: 40,
  },
  "org:member": {
    label: "Member",
    description: "Read-only access to assigned projects",
    level: 10,
  },
} as const;

export type RoleKey = keyof typeof ROLES;

export interface RolePermissions {
  role: RoleKey;
  label: string;
  description: string;
  level: number;
}

/**
 * Get role info by key. Returns member defaults for unknown roles.
 */
export function getRoleInfo(role: string): RolePermissions {
  const info = ROLES[role as RoleKey];
  if (info) {
    return { role: role as RoleKey, ...info };
  }
  return {
    role: "org:member",
    ...ROLES["org:member"],
  };
}
