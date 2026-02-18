# Phase 33: Company Selector in User Dropdown - Research

**Researched:** 2026-02-18
**Domain:** React dropdown UI integration with existing auth/multi-tenant switching mechanism
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-02 | The user dropdown in the top navigation bar includes a company selector (switch between user's companies) and a "Create new company" option, positioned below the existing Account Settings link | Full backend + frontend switching infrastructure already exists. Task is purely a UI reorganization: move company-list + create-new-company items from `CompanySwitcher` component into `UserMenu` component, then remove or hide `CompanySwitcher` from the top bar. |

</phase_requirements>

---

## Summary

This phase is a UI reorganization, not a feature build. The complete multi-company backend is already implemented and functional. The `auth.switchOrganization` tRPC mutation exists, the `/api/auth/switch-org` Next.js route handler exists, the `switchOrg` function exists in `AuthContext`, and the `organization.list` tRPC query exists. Company switching already works end-to-end.

The current UI places company switching in a dedicated `CompanySwitcher` button in the top bar — a separate dropdown trigger sitting between the notification bell and the user avatar. The goal is to move that company list and the "Create new company" link into the `UserMenu` dropdown (the avatar button on the far right), positioning the company section below the existing "Account Settings" link. Once that content is in `UserMenu`, the standalone `CompanySwitcher` component and its separator in `top-bar.tsx` are removed.

The implementation touches exactly three files: `apps/web/components/layout/user-menu.tsx` (add company selector section), `apps/web/components/layout/top-bar.tsx` (remove `<CompanySwitcher />` and its `<Separator />`), and optionally the `CompanySwitcher` component file itself (can be deleted or left unused). No backend changes. No tRPC changes. No auth changes. No session changes.

**Primary recommendation:** Copy the company-list query and switch/create logic from `company-switcher.tsx` into `user-menu.tsx`, add it below the Account Settings separator, then strip `CompanySwitcher` from `top-bar.tsx`.

---

## What Currently Exists (HIGH confidence — source code read directly)

### Current Top Bar Layout

`apps/web/components/layout/top-bar.tsx` renders (right side, left to right):
1. Search button
2. `<Separator orientation="vertical" />`
3. Notification bell button
4. `<Separator orientation="vertical" />`
5. `<CompanySwitcher />` ← this is what gets removed
6. `<Separator orientation="vertical" />`
7. `<UserMenu />`

### Current CompanySwitcher (`apps/web/components/layout/company-switcher.tsx`)

Full working implementation:
- Reads `{ orgId, orgName, switchOrg }` from `useAuth()`
- Queries `trpc.organization.list.useQuery()` for all user orgs
- Renders a `DropdownMenu` with:
  - Each org as a `DropdownMenuItem` with a `Check` icon (filled when active)
  - A `DropdownMenuSeparator`
  - A "Create New Company" `DropdownMenuItem` linking to `/onboarding`
- Calls `switchOrg(newOrgId)` on org click — which POSTs to `/api/auth/switch-org` and then calls `window.location.reload()`

### Current UserMenu (`apps/web/components/layout/user-menu.tsx`)

Current structure inside `DropdownMenuContent`:
```
DropdownMenuLabel        ← user name + email
DropdownMenuSeparator
DropdownMenuItem         ← Account Settings → /settings/account
DropdownMenuSeparator
DropdownMenuItem         ← Sign Out
```

Target structure after Phase 33:
```
DropdownMenuLabel        ← user name + email
DropdownMenuSeparator
DropdownMenuItem         ← Account Settings → /settings/account
DropdownMenuSeparator
DropdownMenuLabel        ← "Switch Company" section heading (or just list items)
[each org as DropdownMenuItem with Check icon for active]
DropdownMenuSeparator
DropdownMenuItem         ← Create new company → /onboarding (Plus icon)
DropdownMenuSeparator
DropdownMenuItem         ← Sign Out
```

### switchOrg Mechanism (HIGH confidence)

`useAuth()` exposes `switchOrg(orgId: string): Promise<void>`:
```typescript
// apps/web/lib/auth-context.tsx
const switchOrg = useCallback(async (orgId: string) => {
  const response = await fetch("/api/auth/switch-org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: orgId }),
  });
  if (response.ok) {
    const data = await response.json();
    setSession(prev => ({ ...prev, orgId: data.org.id, orgRole: data.org.role, orgName: data.org.name }));
    window.location.reload();  // full page reload to refresh all tenant-scoped data
  }
}, []);
```

The `/api/auth/switch-org` route handler:
1. Reads current session
2. Calls `trpc.auth.switchOrganization.mutate({ organizationId })` on the backend
3. Backend verifies membership, issues a new JWT with the new `orgId` in claims
4. Route handler seals updated session (with new `accessToken`, `orgId`, `orgRole`, `orgName`) into the iron-session cookie
5. Returns `{ org: { id, name, role } }`

Active org is stored in the iron-session cookie (`construction_session`) as `orgId` + `orgName` + `orgRole`, and also encoded in the JWT access token.

### Organization List Query (HIGH confidence)

```typescript
// Already available in UserMenu after adding import:
const { data: organizations, isLoading } = trpc.organization.list.useQuery();
// Returns: Array<{ id, name, slug, role, tenantId }>
```

### "Create New Company" Route (HIGH confidence)

The onboarding page lives at `apps/web/app/(dashboard)/onboarding/page.tsx` and is reachable at `/onboarding`. It currently redirects to dashboard if the user already has an org (designed for first-time setup), but that redirect logic will fire for multi-org users. This is a pre-existing behavior quirk — the `/onboarding` page currently redirects away if `organizations.length > 0`. The "Create new company" link in `CompanySwitcher` already uses this route. Phase 33 carries this behavior over unchanged; fixing the onboarding page for multi-org users is explicitly out of scope per the prior decisions.

---

## Standard Stack

### Core (all already installed — no new dependencies needed)

| Library | Purpose | How Used |
|---------|---------|----------|
| `@radix-ui/react-dropdown-menu` | Dropdown primitives | `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator` all available in `components/ui/dropdown-menu.tsx` |
| `lucide-react` | Icons | `Check`, `Plus`, `Building2` (or `Building`) for company section |
| `@trpc/react-query` | Data fetching | `trpc.organization.list.useQuery()` |
| `@/lib/auth-context` | Auth state + switchOrg | `useAuth()` hook |
| `iron-session` | Session persistence | Already handles org storage — no changes needed |

### No New Packages Required

This phase requires zero new npm packages. All infrastructure is in place.

---

## Architecture Patterns

### Where Each File Lives

```
apps/web/
├── components/layout/
│   ├── top-bar.tsx          # Remove <CompanySwitcher /> + its <Separator />
│   ├── user-menu.tsx        # Add company selector section
│   └── company-switcher.tsx # Can be deleted (no longer referenced)
└── app/(dashboard)/
    └── onboarding/
        └── page.tsx         # No changes needed (carries existing behavior)
```

### Pattern: Inline Company List in UserMenu

Move the company-list rendering directly into `user-menu.tsx`. The component already imports `useAuth()`. Add the `trpc.organization.list.useQuery()` call and the company-switching `DropdownMenuItem` list.

The existing `CompanySwitcher` is a 78-line file — the relevant logic is compact and clean to inline:

```typescript
// Source: apps/web/components/layout/company-switcher.tsx (read 2026-02-18)
// Pattern to replicate inside user-menu.tsx:

const { orgId, orgName, orgRole, user, switchOrg } = useAuth();
const { data: organizations } = trpc.organization.list.useQuery();

const handleSwitch = async (newOrgId: string) => {
  if (newOrgId !== orgId) {
    await switchOrg(newOrgId);
  }
};

// In JSX, after the Account Settings separator:
<DropdownMenuSeparator />
<DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1">
  Switch Company
</DropdownMenuLabel>
{organizations?.map((org) => (
  <DropdownMenuItem
    key={org.id}
    onClick={() => handleSwitch(org.id)}
    className="cursor-pointer"
  >
    <Check className={`mr-2 h-4 w-4 ${org.id === orgId ? "opacity-100" : "opacity-0"}`} />
    <span className="truncate">{org.name}</span>
  </DropdownMenuItem>
))}
<DropdownMenuSeparator />
<DropdownMenuItem asChild>
  <Link href="/onboarding" className="cursor-pointer">
    <Plus className="mr-2 h-4 w-4" />
    <span>Create new company</span>
  </Link>
</DropdownMenuItem>
<DropdownMenuSeparator />
{/* existing Sign Out item */}
```

### Pattern: TopBar Cleanup

In `top-bar.tsx`, remove exactly:
1. The `import { CompanySwitcher }` line
2. The `<CompanySwitcher />` JSX element
3. The `<Separator orientation="vertical" className="h-4" />` that immediately precedes it

The remaining top bar right section becomes: Search → Separator → Notification bell → Separator → UserMenu.

### Anti-Patterns to Avoid

- **Duplicating the fetch:** Do not add a second `trpc.organization.list.useQuery()` call at the top-bar level. Keep the query inside `UserMenu` where it's only executed when the dropdown is rendered.
- **Adding a loading skeleton inside UserMenu:** The existing `CompanySwitcher` shows a full Skeleton during load. Inside the user menu, it is better to simply not render the company list section while loading — or render it with no items. A skeleton inside a dropdown menu would look odd.
- **Calling `trpc.auth.switchOrganization` directly from the frontend:** Always go through `switchOrg()` from `useAuth()` — it handles session cookie update, state update, and page reload. Do not replicate this logic.
- **Linking "Create new company" to `/settings/company` or `/organization/new`:** The existing route is `/onboarding`. Use it as-is.
- **Using rounded-xl, border, or shadow on any wrapper:** The flat design system (Phase 32) applies to card/panel components. `DropdownMenuContent` is a popover-class component and retains its own rounding — do not add extra card wrappers inside the dropdown.
- **Single-org hiding:** Do not hide the company section when the user has only one org. The requirement (NAV-02) says the company selector must be present — it lets users create a new company and see which company they're in.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Company switching | Custom fetch + session update logic | `switchOrg()` from `useAuth()` | Already handles JWT refresh, session cookie seal, React state update, and page reload correctly |
| User's org list | Custom DB query or local state | `trpc.organization.list.useQuery()` | Already implemented in `organization.ts` router, handles auth, returns `id/name/slug/role` |
| Active org indicator | Custom state comparison | `orgId` from `useAuth()` compared to `org.id` | Already the pattern in `CompanySwitcher`; no new state needed |
| Dropdown primitives | Custom popover | Radix `DropdownMenu*` from `components/ui/dropdown-menu.tsx` | Already in use in `UserMenu`; composable |

**Key insight:** 95% of this feature is already built. The only work is repositioning existing UI elements.

---

## Common Pitfalls

### Pitfall 1: Onboarding Page Redirect for Multi-Org Users
**What goes wrong:** Clicking "Create new company" navigates to `/onboarding`, but `onboarding/page.tsx` immediately redirects back to `/` if the user already belongs to any organization (`organizations.length > 0`).
**Why it happens:** The onboarding page was designed for first-time users only (no-org state).
**How to avoid:** This is a known pre-existing behavior. Phase 33's scope is to add the link — it does not fix the onboarding page for multi-org users. Document this as a known limitation and carry the existing behavior forward identically to the current `CompanySwitcher` behavior (which also links to `/onboarding`).
**Warning signs:** If a UAT tester clicks "Create new company" and is immediately redirected back — that is expected, pre-existing behavior, not a Phase 33 regression.

### Pitfall 2: UserMenu Width Too Narrow for Company Names
**What goes wrong:** `UserMenu` currently uses `w-56` (224px) on `DropdownMenuContent`. Company names may truncate poorly if they are longer than the label area.
**Why it happens:** The `w-56` width was sized for the current 3-item menu. Adding a company list with org names needs slightly more horizontal space.
**How to avoid:** Use `w-64` (256px) or keep `w-56` with `truncate` on org name spans (as `CompanySwitcher` already does with `max-w-[150px]`). Keep truncation consistent.
**Warning signs:** Org names being clipped in the middle of the word or overflowing the dropdown container.

### Pitfall 3: Missing `trpc` Import in UserMenu
**What goes wrong:** `user-menu.tsx` currently does not import `trpc` — it only imports `useAuth`. Adding the query requires importing `trpc` from `@/lib/trpc`.
**Why it happens:** `UserMenu` was originally auth-only; no data fetching was needed.
**How to avoid:** Add `import { trpc } from "@/lib/trpc";` at the top of the file. This is the same import used in `company-switcher.tsx` and `onboarding/page.tsx`.

### Pitfall 4: Leaving CompanySwitcher Referenced in TopBar
**What goes wrong:** Deleting `company-switcher.tsx` without removing its import from `top-bar.tsx` causes a TypeScript compile error.
**Why it happens:** Two files reference the component — `top-bar.tsx` (import + JSX) and possibly `app-shell.tsx` (indirectly via TopBar). Only `top-bar.tsx` directly imports it.
**How to avoid:** Update `top-bar.tsx` first (remove import + JSX), then delete or archive `company-switcher.tsx`.

### Pitfall 5: `window.location.reload()` UX during Switch
**What goes wrong:** Switching company triggers a full page reload — the user sees a flash/blank screen momentarily.
**Why it happens:** The `switchOrg()` implementation in `auth-context.tsx` explicitly calls `window.location.reload()` after updating session state. This is intentional — it ensures all tenant-scoped tRPC query caches are invalidated.
**How to avoid:** This is expected and correct behavior. Do not try to optimize it away in Phase 33. The reload ensures the new org's data loads cleanly without stale cache from the previous org.

---

## Code Examples

### Full Updated UserMenu Structure

```typescript
// Source: derived from apps/web/components/layout/user-menu.tsx (read 2026-02-18)
// and apps/web/components/layout/company-switcher.tsx (read 2026-02-18)

"use client";

import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { LogOut, Settings, Check, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function UserMenu() {
  const { user, orgId, switchOrg } = useAuth();
  const router = useRouter();
  const { data: organizations } = trpc.organization.list.useQuery();

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleSwitch = async (newOrgId: string) => {
    if (newOrgId !== orgId) {
      await switchOrg(newOrgId);
    }
  };

  const handleSignOut = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) router.push("/sign-in");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* User identity */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Account settings */}
        <DropdownMenuItem asChild>
          <Link href="/settings/account" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Account Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* Company selector */}
        {organizations && organizations.length > 0 && (
          <>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="cursor-pointer"
              >
                <Check className={`mr-2 h-4 w-4 ${org.id === orgId ? "opacity-100" : "opacity-0"}`} />
                <span className="truncate">{org.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            <span>Create new company</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* Sign out */}
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### TopBar After Cleanup

```typescript
// Source: apps/web/components/layout/top-bar.tsx (read 2026-02-18)
// Remove: import { CompanySwitcher }
// Remove: <CompanySwitcher /> element and its preceding <Separator />

// Right side becomes:
<div className="flex items-center gap-3">
  <Button variant="outline" size="sm" className="h-8 gap-2" onClick={onSearchOpen}>
    <Search className="h-4 w-4" />
    <span className="hidden sm:inline">Search</span>
    <kbd className="hidden sm:inline ...">⌘K</kbd>
  </Button>

  <Separator orientation="vertical" className="h-4" />

  <Button variant="ghost" size="icon" className="h-8 w-8">
    <Bell className="h-4 w-4" />
    <span className="sr-only">Notifications</span>
  </Button>

  <Separator orientation="vertical" className="h-4" />

  <UserMenu />
</div>
```

---

## Design System Constraints (from Phase 31 + 32 decisions)

These apply to any new elements added to `UserMenu`:

| Constraint | Source | Application |
|------------|--------|-------------|
| Primary color: `hsl(188 80% 45%)` (cyan-teal) | Phase 31 | Avatar background uses `bg-primary` — keep as-is |
| Secondary buttons: outline with `border-primary text-primary` | Phase 31 decision | Not applicable to dropdown items |
| Flat design system: no `rounded-xl`, no `border`, no `shadow` on card/panel | Phase 32 | `DropdownMenuContent` is a popover, not a card — it retains its own `rounded-md border shadow-md` as designed. Do not wrap inner content in `<Card>` |
| Hover affordance: `hover:bg-accent` | Phase 32 (dropdowns exempted) | `DropdownMenuItem` already uses `focus:bg-accent` from its base class — no changes needed |

The `DropdownMenuContent` component (from `components/ui/dropdown-menu.tsx`) uses `rounded-md border bg-popover shadow-md` in its base class. This is correct — it is a popover, not a card. The flat design system explicitly exempts dropdown and popover components (confirmed in Phase 32 human verification: "dropdowns/popovers still slightly rounded").

---

## State of the Art

| Old Approach | Current Approach | Impact on Phase 33 |
|--------------|------------------|-------------------|
| Clerk `OrganizationSwitcher` component | Custom `CompanySwitcher` in top-bar + custom auth JWT | Phase 33 only moves the UI into UserMenu — backend layer is already custom |
| Separate standalone switcher UI | Integrated into user dropdown | This IS Phase 33 |

---

## Open Questions

1. **What happens when a user has only one company?**
   - What we know: The company list will show one item (with a Check mark). The "Create new company" link is always present.
   - What's unclear: Whether showing one org item in the dropdown (that the user can't switch away from) looks odd — they'd just see their current org with a checkmark, non-clickable-feeling.
   - Recommendation: Show the list regardless of count. The "Create new company" option is the main value for single-org users. Alternatively, conditionally hide the org list when `organizations.length <= 1` and only show "Create new company" — but this is a planner/UX decision.

2. **Should "Create new company" be present even when user is not admin?**
   - What we know: Any authenticated user can create an org via `organization.create`. There's no role restriction on creation.
   - What's unclear: Whether the product intends to allow non-admins to create new companies.
   - Recommendation: Show "Create new company" for all users (matches current `CompanySwitcher` behavior — no role check there).

3. **Section header label for the company list?**
   - What we know: NAV-02 says "company selector section" — implies visual grouping below Account Settings.
   - What's unclear: Whether to use a `DropdownMenuLabel` heading like "Switch Company" or just show the items directly.
   - Recommendation: Use a `DropdownMenuLabel` with a small, muted label such as "Switch Company" or "Companies" to clearly separate this section from Account Settings above.

---

## Sources

### Primary (HIGH confidence — source code read directly)

- `apps/web/components/layout/company-switcher.tsx` — complete current switcher implementation
- `apps/web/components/layout/user-menu.tsx` — complete current user menu
- `apps/web/components/layout/top-bar.tsx` — complete top bar layout
- `apps/web/lib/auth-context.tsx` — `switchOrg` implementation, `useAuth` interface
- `apps/web/lib/session.ts` — `SessionData` interface, iron-session cookie config
- `apps/web/app/api/auth/switch-org/route.ts` — switch-org route handler
- `apps/api/src/trpc/routers/auth.ts` — `switchOrganization` mutation (lines 837-906)
- `apps/api/src/trpc/routers/organization.ts` — `organization.list` query (lines 223-242)
- `apps/web/app/(dashboard)/onboarding/page.tsx` — "Create new company" destination
- `apps/web/components/ui/dropdown-menu.tsx` — available dropdown primitives
- `.planning/phases/32-flat-design-system/32-VERIFICATION.md` — flat design constraints
- `.planning/REQUIREMENTS.md` — NAV-02 exact requirement text

### Secondary (MEDIUM confidence)

- `.planning/phases/30-brand-identity-and-sidebar-cleanup/30-VERIFICATION.md` — Phase 30 completion confirmed; top bar layout stable

---

## Metadata

**Confidence breakdown:**
- Current code state: HIGH — all files read directly from source
- Backend switching mechanism: HIGH — complete implementation verified in source
- UI reorganization approach: HIGH — straightforward inline of existing component logic
- Onboarding page behavior for multi-org: HIGH — confirmed by reading source (redirect when orgs exist)
- Design constraints: HIGH — Phase 31/32 verified and passed

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable — no external dependencies, purely internal code reorganization)
