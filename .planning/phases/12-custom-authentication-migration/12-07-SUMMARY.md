---
phase: 12-custom-authentication-migration
plan: 07
subsystem: frontend-ui
tags: [clerk-migration, ui-components, organization-management]

dependency_graph:
  requires:
    - 12-04-PLAN (API auth layer using custom JWT)
    - 12-05-PLAN (Frontend auth infrastructure)
  provides:
    - Custom organization switcher component
    - Custom user menu component
    - Custom onboarding flow
    - Custom member management page
  affects:
    - All dashboard pages
    - All layout components

tech_stack:
  added:
    - "Custom CompanySwitcher using shadcn/ui DropdownMenu"
    - "Custom UserMenu with Avatar component"
    - "Custom onboarding form with tRPC"
    - "Custom members management with full CRUD"
  patterns:
    - "useAuth hook for user/org context"
    - "trpc.organization router for all org operations"
    - "Client-side form validation with toast notifications"
    - "Admin-gated actions using orgRole check"

key_files:
  created:
    - apps/web/app/api/auth/logout/route.ts
  modified:
    - apps/web/components/layout/company-switcher.tsx
    - apps/web/components/layout/user-menu.tsx
    - apps/web/app/(dashboard)/onboarding/page.tsx
    - apps/web/app/(dashboard)/settings/members/page.tsx
    - apps/web/app/(dashboard)/page.tsx
    - apps/web/components/layout/breadcrumbs.tsx

decisions:
  - title: "Session destruction via API route"
    rationale: "UserMenu calls /api/auth/logout POST endpoint which destroys iron-session; cleaner than inline server action"
    impact: "Sign-out is async but reliable; redirects to /sign-in after success"
  - title: "Organization list fetch on mount"
    rationale: "CompanySwitcher uses trpc.organization.list.useQuery to show all user's orgs"
    impact: "One additional query on page load but necessary for switcher dropdown"
  - title: "Full page reload after org switch"
    rationale: "switchOrg calls API then window.location.reload() to refresh all data with new context"
    impact: "Not ideal UX but ensures consistent state across all components during migration"
  - title: "Admin-only UI elements conditionally rendered"
    rationale: "Members page checks isAdmin = orgRole === 'org:admin' to show/hide invite form and actions"
    impact: "Clean separation of admin vs member views; no need for separate routes"

metrics:
  duration: 4.2 min
  tasks_completed: 2
  files_created: 1
  files_modified: 6
  commits: 2
  completed_at: 2026-02-14

verification:
  - All Clerk UI components replaced (OrganizationSwitcher, UserButton, CreateOrganization, OrganizationProfile)
  - Zero @clerk/nextjs imports remain in apps/web/
  - CompanySwitcher shows org list from tRPC
  - UserMenu displays user initials and provides sign-out
  - Onboarding creates org via organization.create mutation
  - Members page supports full CRUD: invite, list, role change, remove, revoke invitation
  - Dashboard uses custom auth context for org name
  - Admin actions properly gated by role check
---

# Phase 12 Plan 07: Replace Dashboard Clerk UI Components Summary

**One-liner:** Custom organization switcher, user menu, onboarding, and members management replacing all Clerk dashboard UI components with tRPC-powered alternatives

## Overview

Replaced the last remaining Clerk UI components in the dashboard with custom implementations using our auth context and organization tRPC router.

**Key Achievement:** Zero Clerk UI imports remain in the frontend. All dashboard interactions now use custom components backed by our organization management API.

## Implementation Details

### Task 1: CompanySwitcher and UserMenu Components

**CompanySwitcher (`apps/web/components/layout/company-switcher.tsx`):**
- Replaced `OrganizationSwitcher` with shadcn/ui `DropdownMenu`
- Uses `trpc.organization.list.useQuery()` to fetch user's organizations
- Displays current org name with checkmark next to active org
- Calls `switchOrg(orgId)` from AuthContext to change organization
- Includes "Create New Company" link to `/onboarding`
- Loading state with skeleton while fetching orgs

**UserMenu (`apps/web/components/layout/user-menu.tsx`):**
- Replaced `UserButton` with shadcn/ui `Avatar` + `DropdownMenu`
- Generates user initials from firstName/lastName or email
- Displays user name and email in dropdown header
- Menu items:
  - Settings → `/settings`
  - MFA Settings → `/mfa-setup`
  - Sign Out → calls `/api/auth/logout` endpoint
- Avatar styled to match existing 8x8 size

**Logout Endpoint (`apps/web/app/api/auth/logout/route.ts`):**
- POST endpoint destroys iron-session
- UserMenu calls this then redirects to `/sign-in`
- Clean separation of concerns vs inline server action

**Commit:** `628bf37` - "feat(12-07): replace CompanySwitcher and UserMenu with custom components"

### Task 2: Onboarding, Members Page, and Dashboard

**Onboarding Page (`apps/web/app/(dashboard)/onboarding/page.tsx`):**
- Replaced `CreateOrganization` component with custom form
- Uses `trpc.organization.list.useQuery()` to check existing orgs
- If user has orgs, redirects to dashboard (invited path)
- If no orgs, shows company creation form:
  - Input: company name (3-100 chars, required)
  - Submit: `trpc.organization.create.useMutation()`
  - On success: reloads page to trigger context update
- Toast notifications for success/error

**Members Page (`apps/web/app/(dashboard)/settings/members/page.tsx`):**
- Replaced `OrganizationProfile` with custom member management UI
- Three main sections:

1. **Invite Form (Admin Only):**
   - Email input + role select
   - Uses `trpc.organization.invite.useMutation()`
   - 7 role options: admin, project_manager, accountant, estimator, superintendent, foreman, member
   - Toast notification on success

2. **Members List:**
   - Table with columns: Member (avatar + name), Email, Role, Joined, Actions
   - Admin view: role select dropdown for inline editing
   - Non-admin view: read-only role badge
   - Admin actions: remove member button
   - Uses `trpc.organization.listMembers.useQuery()`
   - Uses `trpc.organization.updateMemberRole.useMutation()` for role changes
   - Uses `trpc.organization.removeMember.useMutation()` with confirmation dialog

3. **Pending Invitations (Admin Only):**
   - Table with columns: Email, Role, Expires, Actions
   - Revoke button per invitation
   - Uses `trpc.organization.listInvitations.useQuery()`
   - Uses `trpc.organization.revokeInvitation.useMutation()` with confirmation

**Dashboard Page (`apps/web/app/(dashboard)/page.tsx`):**
- Replaced `useOrganization()` from Clerk with `useAuth()` from custom context
- Uses `orgName` from context instead of `organization?.name`
- All existing functionality preserved (stats, quick actions, recent activity)

**Breadcrumbs (`apps/web/components/layout/breadcrumbs.tsx`):**
- Replaced `useOrganization()` with `useAuth()`
- Uses `orgName` from custom context

**Commit:** `d7bb839` - "feat(12-07): replace onboarding, members page, and dashboard with custom components"

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

**TypeScript Compilation:**
- No errors in modified files
- Pre-existing errors in other files (calendar, document routers) are unrelated

**Clerk Import Check:**
- `grep -r "@clerk/nextjs"` in apps/web/ returns 0 files
- All Clerk UI components successfully removed

**Component Functionality:**
- CompanySwitcher: fetches orgs, displays dropdown, switches via context
- UserMenu: shows avatar with initials, dropdown with settings/MFA/sign-out
- Onboarding: creates org via tRPC, redirects on success
- Members: full CRUD with role management, admin-gated actions
- Dashboard: displays org name from custom context

## Testing Notes

**Not Tested (requires running servers):**
- Actual org switching flow (requires session update)
- Sign-out functionality (requires session destruction)
- Member invitation email sending
- Member removal and role updates

**Can Be Verified in Next Execution:**
- Start web + API servers
- Create org via onboarding
- Switch orgs via CompanySwitcher
- Invite member via Members page
- Change member role
- Remove member
- Sign out via UserMenu

## Impact

**Frontend Code:**
- Zero Clerk UI component dependencies
- All organization management uses custom tRPC router
- Consistent UI patterns with shadcn/ui components
- Admin role checks for sensitive actions

**Backend Code:**
- No changes (organization router already existed from Plan 03)

**Migration Status:**
- Plan 06 (Auth Routes) → Sign-in/sign-up custom pages
- **Plan 07 (Dashboard UI) → COMPLETE** ✓
- Plan 08 (Middleware) → Next

## Self-Check: PASSED

**Created files exist:**
```
FOUND: apps/web/app/api/auth/logout/route.ts
```

**Modified files exist:**
```
FOUND: apps/web/components/layout/company-switcher.tsx
FOUND: apps/web/components/layout/user-menu.tsx
FOUND: apps/web/app/(dashboard)/onboarding/page.tsx
FOUND: apps/web/app/(dashboard)/settings/members/page.tsx
FOUND: apps/web/app/(dashboard)/page.tsx
FOUND: apps/web/components/layout/breadcrumbs.tsx
```

**Commits exist:**
```
FOUND: 628bf37
FOUND: d7bb839
```

All files created/modified, all commits present.
