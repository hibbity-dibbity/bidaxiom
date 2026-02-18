# Phase 26: Account Settings & Shell Cleanup - Research

**Researched:** 2026-02-17
**Domain:** Next.js App Router settings pages, shadcn/ui Sidebar, custom JWT/MFA auth
**Confidence:** HIGH — all findings are from direct codebase inspection

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACCT-01 | Consolidated account settings page at /settings/account with profile, password change, and MFA | Page skeleton exists; needs profile form, password change form, MFA section wired in |
| ACCT-02 | MFA can be enabled, disabled, and reconfigured from /settings/account | `auth.setupMfa` and `auth.verifyMfaSetup` mutations exist; disable mutation does NOT yet exist |
| ACCT-03 | Password can be changed from /settings/account without a separate URL | `auth.resetPassword` (token-based) exists; an authenticated `changePassword` mutation does NOT yet exist |
| ACCT-04 | User dropdown links directly to /settings/account — no separate "Settings" and "MFA" links | `user-menu.tsx` currently has two links: `/settings` (Settings) and `/mfa-setup` (MFA Settings); replace both with one link to `/settings/account` |
| NAV-01 | Sidebar is always visible on all pages with no toggle button or dynamic show/hide; legacy dynamic code removed | Sidebar currently uses `collapsible="icon"` with localStorage persistence and `SidebarTrigger`; change to `collapsible="none"` and remove toggle code |
</phase_requirements>

---

## Summary

Phase 26 is primarily a UI consolidation and code cleanup phase with a small backend addition. The codebase is well-structured and the changes are surgical.

**Account settings page** (`/settings/account/page.tsx`) already exists but is a stub containing only a `ThemeToggle` component. It needs to be expanded into a full account management page with three sections: profile (name display, email), password change, and MFA management.

**User dropdown** (`user-menu.tsx`) currently has two separate links — `Settings` → `/settings` and `MFA Settings` → `/mfa-setup`. These need to collapse into a single "Account Settings" link to `/settings/account`.

**Sidebar** uses the shadcn `SidebarProvider` / `Sidebar` component system with `collapsible="icon"`. The `AppSidebar` component has localStorage persistence logic and a `SidebarTrigger` toggle. The `TopBar` also conditionally renders a `SidebarTrigger` and a logo based on `open` state. All of this toggle machinery needs to be removed by switching to `collapsible="none"` and simplifying both components.

**Backend gap:** There is no `changePassword` mutation for authenticated users (the existing `resetPassword` is token-based, for unauthenticated password reset flows). Similarly, there is no `disableMfa` mutation. Both need to be added to the `authRouter` before the account settings page can be fully functional.

**Primary recommendation:** Build the account settings page as a single `"use client"` page with three `Card` sections. Add two new API mutations (`auth.changePassword` and `auth.disableMfa`). Remove sidebar toggle complexity by switching to `collapsible="none"`. Update user-menu to a single Account Settings link.

---

## Existing Code Inventory

### Settings Routes (apps/web/app/(dashboard)/settings/)

| Route | File | Current State |
|-------|------|---------------|
| `/settings` | `page.tsx` | Landing page with grid links to members, company, integrations, activity. No link to account. |
| `/settings/account` | `account/page.tsx` | STUB — renders only `<ThemeToggle />`. No profile, no password, no MFA. |
| `/settings/company` | `company/page.tsx` | Full company config form. No changes needed. |
| `/settings/members` | `members/page.tsx` | Team members. No changes needed. |
| `/settings/integrations` | `integrations/page.tsx` | QBO + Calendar. No changes needed. |
| `/settings/activity` | `activity/page.tsx` | Activity log. No changes needed. |

There is NO `layout.tsx` for the `/settings` group — all settings pages render directly inside the dashboard layout. No sub-nav to maintain.

### Layout Components (apps/web/components/layout/)

| File | Purpose | Phase 26 Impact |
|------|---------|-----------------|
| `app-shell.tsx` | Wraps sidebar + topbar. Uses `SidebarProvider`. | Minor: remove `SidebarProvider` toggle machinery if switching approach, or just keep provider with `collapsible="none"` |
| `sidebar.tsx` (`AppSidebar`) | Uses `collapsible="icon"`, localStorage persistence, `SidebarTrigger` in header | **Major change**: remove localStorage logic, remove `SidebarTrigger` in header, change to `collapsible="none"` |
| `sidebar-nav.tsx` | Nav link list. Static. | No change needed |
| `top-bar.tsx` | Renders `SidebarTrigger` when `open === true`, logo when `open === false` | **Major change**: remove the `{open && <SidebarTrigger>}` / `{!open && <Image>}` conditional; always show logo |
| `user-menu.tsx` | Dropdown with Settings + MFA Settings + Sign Out | **Change**: replace Settings link + MFA Settings link with single "Account Settings" → `/settings/account` |

### Auth Components

| File | Purpose | Phase 26 Impact |
|------|---------|-----------------|
| `app/(auth)/mfa-setup/page.tsx` | Standalone MFA setup page in auth layout (no sidebar) | Keep as-is (used for initial MFA enforcement on first login). The account settings page will add an *in-app* MFA reconfiguration flow. |
| `app/(auth)/reset-password/page.tsx` | Token-based reset (unauthenticated) | Keep as-is. Separate from the in-app change-password. |

### API Mutations (apps/api/src/trpc/routers/auth.ts)

| Mutation | Exists? | Notes |
|----------|---------|-------|
| `auth.setupMfa` | YES | Returns `{ secret, qrCodeDataUrl, backupCodes, hashedBackupCodes }`. Uses manual Bearer token auth (not `protectedProcedure`). |
| `auth.verifyMfaSetup` | YES | Input: `{ token: string(6), secret: string, hashedBackupCodes: string[] }`. Uses manual Bearer token auth. |
| `auth.changePassword` | NO | Must be created. Should accept `{ currentPassword, newPassword }` with Bearer token auth. |
| `auth.disableMfa` | NO | Must be created. Should accept `{ currentPassword }` or TOTP confirm before clearing `mfaEnabled`, `mfaSecret`, `mfaBackupCodes`. |
| `auth.resetPassword` | YES | Token-based, unauthenticated. Used by forgot-password flow — do not repurpose. |
| `auth.requestPasswordReset` | YES | Sends email link. Unauthenticated. Keep as-is. |

### Session Data Available in Client

The `AuthContext` (from `auth-context.tsx`) exposes:
- `user: { email, firstName, lastName }` — read-only snapshot from session cookie
- `hasMfa: boolean` — whether MFA is currently enabled
- `userId`, `orgId`, `orgRole`, `orgName`

User's `firstName` and `lastName` come from the iron-session cookie set at login time. To show profile info, no API call is needed. To UPDATE profile (if desired), a mutation would be needed — but the requirements don't mention profile editing, only viewing.

---

## Architecture Patterns

### Pattern 1: Expanding the Account Settings Page

The `/settings/account/page.tsx` stub will become a three-section page. Use `"use client"` since all three sections need form state. Each section is a `Card` component matching the style of `/settings/company/page.tsx`.

**Sections:**
1. **Profile** — Display-only (name, email from `useAuth()`). If editing name is desired, that requires a new mutation; per requirements, this is not listed, so display-only is fine.
2. **Change Password** — Form with `currentPassword`, `newPassword`, `confirmPassword`. Calls new `auth.changePassword` mutation via raw fetch to `/api/auth/token` then the tRPC endpoint (matching the pattern in `mfa-setup/page.tsx`).
3. **MFA** — Shows current MFA status (`hasMfa`). If disabled: shows "Enable MFA" button that triggers the QR code setup flow inline. If enabled: shows "Reconfigure MFA" and "Disable MFA" options.

**Existing ThemeToggle** already on the page — keep it as a fourth section (Appearance).

```typescript
// Pattern from existing mfa-setup/page.tsx — how to call auth API with access token:
const tokenResponse = await fetch("/api/auth/token");
const { accessToken } = await tokenResponse.json();

const response = await fetch(`${API_URL}/trpc/auth.setupMfa`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ json: {} }),
});
```

The same pattern applies for `changePassword` and `disableMfa`.

### Pattern 2: Static Sidebar

The shadcn `Sidebar` component supports `collapsible="none"` which disables all collapse behavior. From the source (`components/ui/sidebar.tsx` lines 186-199):

```typescript
if (collapsible === "none") {
  return (
    <div
      className={cn(
        "flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </div>
  )
}
```

With `collapsible="none"`, the `SidebarTrigger` renders but has no effect. The sidebar is always visible at its full width. The `SidebarProvider` can stay — it is still needed for the `SidebarInset` layout. The keyboard shortcut (`Ctrl+B`) to toggle will also be inert.

**Changes to `sidebar.tsx`:**
- Change `collapsible="icon"` to `collapsible="none"` on `<ShadcnSidebar>`
- Remove the entire `useEffect` for localStorage persistence (lines 35-53)
- Remove `mounted` state and `initializedRef`
- Remove the `useSidebar()` call (no longer needed after removing localStorage logic)
- Replace the conditional header (full logo vs. SidebarTrigger) with just the full logo always visible

**Changes to `top-bar.tsx`:**
- Remove `const { open } = useSidebar()` import
- Remove the conditional `{open && <SidebarTrigger>}` / `{!open && <Image logo>}` block
- Always render the logo (or remove logo from topbar — it will be in sidebar header)
- The `SidebarTrigger` in topbar can be kept for mobile (sheet mode) but the conditional `open &&` check should be removed

### Pattern 3: User Menu Update

In `user-menu.tsx`, replace:
```typescript
// REMOVE these two items:
<DropdownMenuItem asChild>
  <Link href="/settings" className="cursor-pointer">
    <Settings className="mr-2 h-4 w-4" />
    <span>Settings</span>
  </Link>
</DropdownMenuItem>
<DropdownMenuItem asChild>
  <Link href="/mfa-setup" className="cursor-pointer">
    <Shield className="mr-2 h-4 w-4" />
    <span>MFA Settings</span>
  </Link>
</DropdownMenuItem>
```

With:
```typescript
// ADD this single item:
<DropdownMenuItem asChild>
  <Link href="/settings/account" className="cursor-pointer">
    <Settings className="mr-2 h-4 w-4" />
    <span>Account Settings</span>
  </Link>
</DropdownMenuItem>
```

Remove the `Shield` import from `lucide-react` if not used elsewhere.

### Pattern 4: New API Mutations

Both new mutations follow the same pattern as `setupMfa` / `verifyMfaSetup` — they manually extract the Bearer token from the Authorization header, since they need to be authenticated but the `protectedProcedure` requires a full org context which may not always be available.

**`auth.changePassword`:**
```typescript
changePassword: publicProcedure
  .input(z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8)...
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Verify Bearer token -> get userId
    // 2. Load user by userId
    // 3. verifyPassword(user.passwordHash, input.currentPassword)
    // 4. If invalid -> throw UNAUTHORIZED "Current password is incorrect"
    // 5. hashPassword(input.newPassword) -> update users table
    // 6. Revoke all refresh tokens (force re-login everywhere except current session)
    // 7. Return { success: true }
  })
```

**`auth.disableMfa`:**
```typescript
disableMfa: publicProcedure
  .input(z.object({
    currentPassword: z.string(), // Require password confirmation to disable MFA
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Verify Bearer token -> get userId
    // 2. Load user by userId
    // 3. verifyPassword(user.passwordHash, input.currentPassword)
    // 4. Update users: mfaEnabled=false, mfaSecret=null, mfaBackupCodes=null
    // 5. Return { success: true }
  })
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Password form validation | Custom regex checks | Zod schema with `.regex()` — copy from existing `resetPassword` schema in `reset-password/page.tsx` |
| MFA QR code generation | Any new QR library | Reuse `auth.setupMfa` mutation — it already returns `qrCodeDataUrl` |
| MFA TOTP verification | Any new TOTP library | Reuse `auth.verifyMfaSetup` mutation |
| Password hashing | bcrypt directly | Reuse `hashPassword` / `verifyPassword` from `apps/api/src/auth/password.ts` |
| Sidebar toggle state | Custom context | shadcn `SidebarProvider` with `collapsible="none"` eliminates all toggle state |
| Form state management | Custom useState chains | `react-hook-form` + `zodResolver` — pattern already used in `reset-password/page.tsx` and `sign-in-form.tsx` |

---

## Common Pitfalls

### Pitfall 1: MFA Setup Page `hashedBackupCodes` Bug
**What goes wrong:** The existing `mfa-setup/page.tsx` sends `backupCodes` (plaintext) to `verifyMfaSetup`, but the API expects `hashedBackupCodes`. The type definition for `SetupData` on line 25-29 only includes `backupCodes: string[]`, missing `hashedBackupCodes`. The API's `setupMfa` returns BOTH fields. The existing page is broken — it stores plaintext backup codes in the database instead of hashed ones.
**How to avoid:** When building the in-app MFA setup flow on the account settings page, store both fields from the `setupMfa` response and send `hashedBackupCodes` to `verifyMfaSetup`. Fix the type definition.
**Warning signs:** If MFA backup codes can't be used to log in, this bug is active.

### Pitfall 2: Sidebar `SidebarProvider` Still Required
**What goes wrong:** Removing `SidebarProvider` entirely breaks `SidebarInset` which depends on the context it provides (CSS custom properties for width).
**How to avoid:** Keep `SidebarProvider` in `app-shell.tsx`. Only change `collapsible` prop on `AppSidebar`. The provider is the layout wrapper, not the toggle controller.

### Pitfall 3: `useSidebar()` Called Outside Provider
**What goes wrong:** `top-bar.tsx` calls `useSidebar()` to read the `open` state. After making the sidebar static, this call still works but the value is meaningless. If the call is removed and the import is left behind, TypeScript won't error but it's dead code.
**How to avoid:** Remove the `useSidebar()` call from `top-bar.tsx` when removing the conditional logo/trigger logic. The `SidebarTrigger` used for mobile (sheet) still works fine without reading `open`.

### Pitfall 4: Session `hasMfa` Stale After MFA Enable/Disable
**What goes wrong:** The iron-session cookie stores `hasMfa` at login time. After the user enables or disables MFA from the account settings page, the session cookie still reflects the old value. The `useAuth()` hook reads from this cookie snapshot. The MFA status indicator on the page will be wrong until next login.
**How to avoid:** After a successful enable/disable, either (a) call a server action to update the session cookie's `hasMfa` field, or (b) use local component state to optimistically update the displayed status without relying on `useAuth().hasMfa`. Option (b) is simpler. The middleware only checks `hasMfa` for enforcement redirect — since the user is already past that check, stale cookie is not a security issue for this phase.

### Pitfall 5: Change Password Revokes All Sessions
**What goes wrong:** The `resetPassword` mutation revokes ALL refresh tokens on password change. This is correct security behavior but will log out the user on other devices. On the current device, the iron-session cookie still contains a valid access token until it expires (15 minutes). The user appears logged in but background refreshes will fail.
**How to avoid:** After a successful `changePassword`, call the logout endpoint or at minimum show a toast explaining the user will be logged out of other sessions. Consider NOT revoking the current session's refresh token — but this adds complexity. For this phase, matching the existing behavior (revoke all) and informing the user is acceptable.

### Pitfall 6: Settings Landing Page Missing Account Link
**What goes wrong:** The `/settings/page.tsx` grid currently shows 4 cards (Members, Company, Integrations, Activity). If the user navigates to `/settings` directly, there is no path to `/settings/account`.
**How to avoid:** Add an "Account Settings" card to the settings landing page grid, or add sidebar nav entry. The user's request says "put an account section on the settings page" — this likely means `/settings/account` should be accessible from `/settings` as well as from the user dropdown.

---

## Code Examples

### Reading User Profile on Account Settings Page
```typescript
// Source: apps/web/lib/auth-context.tsx
"use client";
import { useAuth } from "@/lib/auth-context";

export function AccountSettingsPage() {
  const { user, hasMfa } = useAuth();
  // user.email, user.firstName, user.lastName available immediately (from session)
  // hasMfa: boolean — current MFA status
}
```

### Change Password Form Pattern
```typescript
// Source: Adapted from apps/web/app/(auth)/reset-password/page.tsx
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain a number"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
```

### Calling Authenticated tRPC Endpoints (raw fetch pattern)
```typescript
// Source: apps/web/app/(auth)/mfa-setup/page.tsx lines 54-72
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function callAuthEndpoint(procedure: string, body: object) {
  const tokenResponse = await fetch("/api/auth/token");
  const { accessToken } = await tokenResponse.json();

  const response = await fetch(`${API_URL}/trpc/${procedure}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ json: body }),
  });

  const data = await response.json();
  return data.result?.data?.json;
}
```

### Static Sidebar (collapsible="none")
```typescript
// Source: apps/web/components/ui/sidebar.tsx — collapsible="none" branch
// In apps/web/components/layout/sidebar.tsx, change:
<ShadcnSidebar collapsible="none" style={...}>
  <SidebarHeader className="h-14 shrink-0 border-b">
    <div className="flex h-full items-center px-4">
      <Image
        src="/bidaxiom-logo.png"
        alt="BidAxiom"
        width={192}
        height={32}
        className="dark:invert h-8 w-auto"
        priority
      />
    </div>
  </SidebarHeader>
  {/* Remove SidebarTrigger from header entirely */}
  ...
</ShadcnSidebar>
// Remove: useEffect for localStorage, mounted state, initializedRef, useSidebar() call
```

---

## Implementation Scope Summary

### Files to MODIFY

| File | Change |
|------|--------|
| `apps/web/app/(dashboard)/settings/account/page.tsx` | Replace stub with full page (profile display, change password, MFA management, appearance) |
| `apps/web/components/layout/user-menu.tsx` | Replace 2 links (Settings + MFA Settings) with 1 link (Account Settings → /settings/account) |
| `apps/web/components/layout/sidebar.tsx` | Remove localStorage/toggle logic; change `collapsible="icon"` to `collapsible="none"`; simplify header |
| `apps/web/components/layout/top-bar.tsx` | Remove `useSidebar()` and conditional logo/trigger block; always show logo |
| `apps/web/app/(dashboard)/settings/page.tsx` | Add Account Settings card to landing grid |
| `apps/api/src/trpc/routers/auth.ts` | Add `changePassword` and `disableMfa` mutations |

### Files to CREATE

| File | Purpose |
|------|---------|
| `apps/web/components/settings/change-password-form.tsx` | Extracted form component for password change section |
| `apps/web/components/settings/mfa-settings.tsx` | Extracted component for MFA enable/disable/reconfigure section |

### Files to LEAVE ALONE

| File | Reason |
|------|--------|
| `apps/web/app/(auth)/mfa-setup/page.tsx` | Still needed for initial MFA enforcement redirect on login |
| `apps/web/app/(auth)/reset-password/page.tsx` | Still needed for forgot-password email link flow |
| `apps/web/components/layout/app-shell.tsx` | No change needed; `SidebarProvider` stays |
| `apps/web/components/ui/sidebar.tsx` | shadcn component; do not modify |

---

## Open Questions

1. **Should the account settings page allow editing first/last name?**
   - What we know: Session stores `firstName`/`lastName`; no `updateProfile` mutation exists; requirements don't mention profile editing
   - What's unclear: Whether display-only profile section satisfies the user or they expect an editable form
   - Recommendation: Implement display-only for this phase; name editing can be a follow-up if requested

2. **MFA disable: require TOTP confirmation or password confirmation?**
   - What we know: No existing `disableMfa` mutation; disabling MFA is a sensitive operation
   - What's unclear: User preference for confirmation mechanism
   - Recommendation: Require current password confirmation (simpler, consistent with industry practice)

3. **Should `/settings` landing page also be updated?**
   - What we know: User said "put a link to account settings" in the user dropdown, not explicitly in the settings landing page
   - What's unclear: Whether the user also wants the settings landing grid updated
   - Recommendation: Add Account Settings card to the landing grid — it costs one card and makes the page more complete

---

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `apps/web/components/layout/` — sidebar.tsx, top-bar.tsx, user-menu.tsx, app-shell.tsx
- Direct file inspection: `apps/web/app/(dashboard)/settings/` — all settings pages
- Direct file inspection: `apps/api/src/trpc/routers/auth.ts` — all auth mutations
- Direct file inspection: `apps/web/components/ui/sidebar.tsx` — shadcn sidebar component with `collapsible="none"` branch
- Direct file inspection: `apps/web/lib/auth-context.tsx`, `session.ts`, `auth.ts` — session/auth pattern

### Secondary (MEDIUM confidence)
- None required — all findings from direct code inspection

---

## Metadata

**Confidence breakdown:**
- Existing code inventory: HIGH — direct file inspection
- Missing mutations (changePassword, disableMfa): HIGH — verified absence by searching all router files
- Sidebar static approach: HIGH — `collapsible="none"` branch confirmed in sidebar.tsx source
- MFA hashedBackupCodes bug: HIGH — cross-referenced mfa-setup page type with API return type

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable codebase, no external dependencies)
