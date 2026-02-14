---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/trpc/routers/user.ts
  - apps/web/app/(dashboard)/projects/[projectId]/page.tsx
  - apps/api/src/trpc/routers/project.ts
autonomous: true

must_haves:
  truths:
    - "Team member dropdown shows existing company users by name/email"
    - "Selecting a user from dropdown and clicking Add Member assigns them to the project"
    - "The + button opens an invite dialog for users not yet in the system"
    - "Existing team members display correctly with names in the team table"
  artifacts:
    - path: "apps/api/src/trpc/routers/user.ts"
      provides: "User list returning users.id as the identifier for team member assignment"
    - path: "apps/web/app/(dashboard)/projects/[projectId]/page.tsx"
      provides: "SearchableSelect dropdown using correct user ID field"
    - path: "apps/api/src/trpc/routers/project.ts"
      provides: "Team member queries joining on correct user identity"
  key_links:
    - from: "apps/web/app/(dashboard)/projects/[projectId]/page.tsx"
      to: "apps/api/src/trpc/routers/user.ts"
      via: "trpc.user.list query"
      pattern: "usersData.*items.*map"
    - from: "apps/web/app/(dashboard)/projects/[projectId]/page.tsx"
      to: "apps/api/src/trpc/routers/project.ts"
      via: "trpc.project.addTeamMember mutation"
      pattern: "addTeamMemberMutation.*mutate"
---

<objective>
Fix the team member dropdown identity mismatch caused by Phase 12 custom auth migration.

Purpose: After migrating from Clerk to custom authentication (Phase 12), the user identity
changed from Clerk user IDs (e.g., "user_abc123") to custom UUIDs from the public.users table.
The team member dropdown UI exists but is broken because:
1. `user.list` returns `clerkUserId` from tenant `user_profiles` (old Clerk IDs for pre-migration users)
2. `ctx.userId` is now the `users.id` UUID from the JWT
3. `projectTeamMembers.userId` stores whichever ID was used at assignment time
4. `loadProjectAbilities` compares `projectTeamMembers.userId` against `ctx.userId`, which no longer matches for old team assignments

The fix must:
- Make `user.list` return the public `users.id` as the value used for team member assignment
- Update `addTeamMember` to use the public `users.id`
- Fix the join in project `getById` so team member names resolve correctly
- Fix `loadProjectAbilities` so it matches `ctx.userId` against the correct column

Output: Working team member dropdown with correct identity resolution.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/api/src/trpc/routers/user.ts
@apps/api/src/trpc/routers/project.ts
@apps/web/app/(dashboard)/projects/[projectId]/page.tsx
@apps/api/src/trpc/procedures.ts (lazy-sync at line 55-91, note comment at line 80)
@apps/api/src/db/schema/tenant.ts (userProfiles.clerkUserId and projectTeamMembers.userId)
@apps/api/src/db/schema/public.ts (users table with id UUID and clerkUserId text)
@apps/api/src/auth/jwt.ts (userId = users.id UUID in JWT)
@apps/web/components/ui/searchable-select.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix user.list to return public users.id and fix project team member identity resolution</name>
  <files>
    apps/api/src/trpc/routers/user.ts
    apps/api/src/trpc/routers/project.ts
  </files>
  <action>
**In `apps/api/src/trpc/routers/user.ts` (user.list procedure):**

The current `user.list` returns `clerkUserId` from tenant `user_profiles`. For pre-migration users this is the old Clerk ID, but for team member assignment we need the public `users.id` UUID (which is what `ctx.userId` contains).

Update the `list` procedure to join `user_profiles` with `public.users` table to return the actual `users.id`:

1. Import `users` from `../../db/schema/public.js` and `db as publicDb` from `../../db/client.js` (publicDb is already imported).
2. After querying tenant `userProfiles`, for each user profile, look up the matching `public.users` record by matching `users.clerkUserId = userProfiles.clerkUserId` OR `users.id = userProfiles.clerkUserId` (the lazy-sync stores `users.id` in `clerkUserId` column for new users per procedures.ts line 80).
3. Return `userId` field (the public `users.id` UUID) alongside existing fields. If no public user match found, fall back to `clerkUserId` for backward compatibility.

Simplest approach: Do a single query that fetches all user profiles, then batch-lookup public users by collecting all `clerkUserId` values and querying `public.users` where `id IN (clerkUserIds) OR clerk_user_id IN (clerkUserIds)`. Build a map from clerkUserId -> users.id. Return `userId: map[profile.clerkUserId] || profile.clerkUserId` for each item.

**In `apps/api/src/trpc/routers/project.ts` (loadProjectAbilities function, ~line 25-44):**

The `loadProjectAbilities` function queries `projectTeamMembers.userId` matching `ctx.userId`. But old team members were added with the Clerk user ID, not the new UUID.

Fix by also checking against the user's `clerkUserId` from public.users table:
1. Import `users` from `../../db/schema/public.js` and `db as publicDb` from `../../db/client.js`.
2. Before the memberships query, look up the current user's `clerkUserId` from public.users: `SELECT clerk_user_id FROM users WHERE id = ctx.userId`.
3. Query `projectTeamMembers` where `userId = ctx.userId OR userId = clerkUserId` (using `or()` from drizzle-orm). This handles both old assignments (Clerk ID) and new assignments (UUID).

**In `apps/api/src/trpc/routers/project.ts` (getById procedure, team members query, ~line 286-301):**

The team members join currently does: `eq(projectTeamMembers.userId, userProfiles.clerkUserId)`. This works for old data (both store Clerk ID) but breaks for new data where `projectTeamMembers.userId` is the UUID.

Fix the join to handle both cases:
- Join `userProfiles` where `userProfiles.clerkUserId = projectTeamMembers.userId` (handles both old Clerk IDs and new UUIDs since lazy-sync stores `users.id` in `clerkUserId`).
- This should already work as-is IF the lazy-sync has run for the user. The join condition `eq(schema.projectTeamMembers.userId, schema.userProfiles.clerkUserId)` at line 299 is correct for both paths.

**In `apps/api/src/trpc/routers/project.ts` (addTeamMember procedure, ~line 441-490):**

Currently stores `input.userId` directly. This is correct as long as the frontend sends the `users.id` UUID (which it will after the user.list fix). No change needed here.

**In `apps/api/src/trpc/routers/project.ts` (removeTeamMember procedure):**

Same dual-identity check needed. Find the team member by `userId = input.userId OR userId = clerkUserId` to handle removing old Clerk-ID-based members.

**In `apps/api/src/trpc/routers/project.ts` (create procedure, auto-add creator as project_manager):**

Check that the auto-add at project creation uses `ctx.userId` (the new UUID). It should already since `ctx.userId` is used directly. Verify this is the case.
  </action>
  <verify>
Run `cd apps/api && npx tsc --noEmit` to verify no TypeScript errors.
Grep for any remaining `user.clerkUserId` references in the value passed to SearchableSelect to ensure frontend sends the correct ID.
  </verify>
  <done>
- `user.list` returns a `userId` field containing the public `users.id` UUID for each user
- `loadProjectAbilities` matches team memberships using both old Clerk IDs and new UUIDs
- Team member getById join resolves names correctly for both old and new team members
- `removeTeamMember` can handle both old and new user IDs
  </done>
</task>

<task type="auto">
  <name>Task 2: Update frontend to use users.id UUID for team member assignment</name>
  <files>
    apps/web/app/(dashboard)/projects/[projectId]/page.tsx
  </files>
  <action>
**In `apps/web/app/(dashboard)/projects/[projectId]/page.tsx`:**

The SearchableSelect for team members (~lines 1019-1032) currently maps users to:
```
value: user.clerkUserId,
label: user.firstName && user.lastName ? `${user.firstName} ${user.lastName} (${user.email})` : user.email,
```

Update to use the new `userId` field returned by the updated `user.list`:
```
value: user.userId,  // This is now the public users.id UUID
label: user.firstName && user.lastName ? `${user.firstName} ${user.lastName} (${user.email})` : user.email,
```

Also filter out users who are already team members to avoid duplicate assignment attempts. Use `project.teamMembers` to get existing member userIds and filter the dropdown options:
```
const existingMemberIds = new Set(project.teamMembers?.map((m: any) => m.userId) || []);
// In the SearchableSelect options, filter: usersData?.items.filter(u => !existingMemberIds.has(u.userId))
```

Note: The `existingMemberIds` set might contain old Clerk IDs for pre-migration members. This is acceptable because the dropdown will now only show `userId` (UUID) values, so old members just won't be filtered (which is fine -- adding them again will fail with a duplicate constraint, and the error toast will show).

Remove the debug `useEffect` blocks (~lines 213-237) that log project and customer data to console -- these are leftover from Phase 3 development.
  </action>
  <verify>
Run `cd apps/web && npx next lint` to check for lint errors.
Visually inspect the SearchableSelect renders correctly by checking the component accepts the same prop shape.
  </verify>
  <done>
- Team member dropdown uses `userId` (UUID) instead of `clerkUserId`
- Debug console.log statements removed from project detail page
- Adding a member from the dropdown calls `addTeamMember` with the correct UUID
  </done>
</task>

</tasks>

<verification>
1. Open a project detail page in the browser
2. Click "Add Member" button -- the SearchableSelect dropdown should appear with existing company users listed by name/email
3. Select a user from the dropdown, choose a role, and click "Add Member" -- the user should appear in the team table
4. The + button next to the dropdown should open the invite dialog for inviting new users
5. Existing team members should display with their names (not just user IDs) in the team table
6. TypeScript compiles without errors: `cd apps/api && npx tsc --noEmit`
</verification>

<success_criteria>
- Team member SearchableSelect dropdown shows all company users with correct names/emails
- Selecting a user and adding them to the project succeeds (no identity mismatch errors)
- Existing team members display correctly with resolved names
- Invite flow via + button works for new users not yet in the system
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/4-restore-team-member-dropdown-with-existi/4-SUMMARY.md`
</output>
