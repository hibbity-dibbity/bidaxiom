---
phase: 33-company-selector-in-user-dropdown
verified: 2026-02-18T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 33: Company Selector in User Dropdown — Verification Report

**Phase Goal:** A user who belongs to multiple companies can switch between them — and create a new company — without leaving their current page, using the top-nav user dropdown.
**Verified:** 2026-02-18
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening the user dropdown reveals a company selector section below Account Settings | VERIFIED | `user-menu.tsx` lines 93–103: `{organizations?.map((org) => ...)}` block placed after the Account Settings `DropdownMenuSeparator` |
| 2 | Each company appears as a list item with a Check icon (filled for active, invisible for others) | VERIFIED | Line 100: `<Check className={\`mr-2 h-4 w-4 ${org.id === orgId ? "opacity-100" : "opacity-0"}\`} />` — opacity trick implemented correctly |
| 3 | Clicking a non-active company switches org context and reloads the page | VERIFIED | Lines 55–59: `handleSwitch` calls `switchOrg(newOrgId)` from `useAuth()`; line 97: `onClick={() => handleSwitch(org.id)}` wired to each item |
| 4 | A "Create new company" item with a Plus icon appears below the company list and links to /onboarding | VERIFIED | Lines 105–110: `<Link href="/onboarding" ...><Plus .../><span>Create new company</span></Link>` |
| 5 | The standalone CompanySwitcher button is gone from the top bar | VERIFIED | `top-bar.tsx` has no `CompanySwitcher` import, no JSX reference; `company-switcher.tsx` deleted; zero grep hits across all `.tsx`/`.ts` files |
| 6 | The app compiles with no TypeScript errors (web app) | VERIFIED | `npx tsc --noEmit -p apps/web/tsconfig.json` — zero errors in any phase-33 file (`user-menu.tsx`, `top-bar.tsx`). Pre-existing API errors in `apps/api/` are unrelated and pre-date this phase |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components/layout/user-menu.tsx` | UserMenu with integrated company selector | VERIFIED | 119 lines; imports `trpc`, `Check`, `Plus`; calls `trpc.organization.list.useQuery()`; renders org list with Check opacity pattern; "Create new company" link; `w-64` width |
| `apps/web/components/layout/top-bar.tsx` | Cleaned top bar without CompanySwitcher | VERIFIED | 66 lines; imports only `UserMenu` (not CompanySwitcher); right-side layout: Search → Separator → Bell → Separator → UserMenu |
| `apps/web/components/layout/company-switcher.tsx` | Deleted — no longer referenced | VERIFIED DELETED | File does not exist on disk; `grep -r "company-switcher"` returns zero results |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `user-menu.tsx` | `trpc.organization.list` | `useQuery` call | WIRED | Line 28: `const { data: organizations } = trpc.organization.list.useQuery();` — confirmed present and used in JSX (line 94) |
| `user-menu.tsx` | `switchOrg` from `useAuth()` | `handleSwitch` function | WIRED | Line 26 destructures `switchOrg` from `useAuth()`; lines 55–59 define `handleSwitch` calling `await switchOrg(newOrgId)`; line 97 wires handler to each org item |
| `top-bar.tsx` | `UserMenu` only (no CompanySwitcher) | JSX | WIRED | Line 8: `import { UserMenu } from "./user-menu"` — only layout component imported; line 62: `<UserMenu />` — sole user-facing control in right rail |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NAV-02 | 33-01-PLAN.md, 33-02-PLAN.md | The user dropdown in the top navigation bar includes a company selector (switch between user's companies) and a "Create new company" option, positioned below the existing Account Settings link | SATISFIED | Company list rendered below Account Settings separator (line 92); "Create new company" present (lines 105–110); switching wired via `handleSwitch`/`switchOrg` |

No orphaned requirements: REQUIREMENTS.md maps NAV-02 to Phase 33, and both plans claim it. All IDs accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `top-bar.tsx` | 54 | `{/* Notification bell (placeholder) */}` comment | Info | Pre-existing comment for the Bell icon — the icon renders normally. Not introduced by phase 33, does not affect goal. |

No blockers. No warnings.

---

### Human Verification

Human verification was completed prior to this automated check. All 6 checks approved:

1. Top bar is clean — standalone CompanySwitcher gone
2. User dropdown contains company list with Check icons
3. Active company has visible Check mark
4. Company switch works (page reload to new tenant)
5. "Create new company" visible with Plus icon, navigates to /onboarding
6. Dropdown width comfortable (w-64)

---

### Gaps Summary

None. All 6 must-have truths are verified, all artifacts are substantive and wired, the sole requirement (NAV-02) is satisfied, and no blocker anti-patterns exist. Human verification was pre-approved.

---

_Verified: 2026-02-18_
_Verifier: Claude (gsd-verifier)_
