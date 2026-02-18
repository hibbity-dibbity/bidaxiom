---
phase: 33-company-selector-in-user-dropdown
plan: "01"
subsystem: navigation/layout
tags: [user-menu, company-switcher, top-bar, nav-consolidation, trpc]
dependency_graph:
  requires: []
  provides: [integrated-company-selector-in-user-menu, cleaned-top-bar]
  affects: [apps/web/components/layout/user-menu.tsx, apps/web/components/layout/top-bar.tsx]
tech_stack:
  added: []
  patterns: [trpc-query-in-layout-component, opacity-check-icon-pattern]
key_files:
  created: []
  modified:
    - apps/web/components/layout/user-menu.tsx
    - apps/web/components/layout/top-bar.tsx
  deleted:
    - apps/web/components/layout/company-switcher.tsx
decisions:
  - Company selector integrated into UserMenu via trpc.organization.list.useQuery; delegates to switchOrg from useAuth()
  - CompanySwitcher deleted entirely (not archived) — all functionality absorbed by UserMenu
  - DropdownMenuContent widened from w-56 to w-64 to accommodate org names with Check icon
metrics:
  duration: "~2 min"
  completed: "2026-02-18"
  tasks_completed: 2
  files_changed: 3
---

# Phase 33 Plan 01: Company Selector in User Dropdown Summary

**One-liner:** Merged company switcher into UserMenu dropdown using trpc.organization.list.useQuery and opacity-based Check icon pattern, eliminating the standalone CompanySwitcher top-bar control.

## What Was Built

The standalone `CompanySwitcher` button that appeared in the top bar has been removed. Its functionality — listing user organizations, switching context via `switchOrg`, and linking to `/onboarding` for new company creation — is now embedded in the `UserMenu` dropdown.

The dropdown now presents in this order:
1. User name + email (label)
2. Account Settings (link)
3. --- separator ---
4. One `DropdownMenuItem` per organization (Check icon: opacity-100 for active, opacity-0 for others)
5. --- separator ---
6. Create new company (link to `/onboarding`)
7. --- separator ---
8. Sign Out

The top bar right side now has exactly: Search button → Separator → Bell → Separator → UserMenu.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add company selector section to UserMenu | 71fe541 | apps/web/components/layout/user-menu.tsx |
| 2 | Remove CompanySwitcher from top bar and delete the component | 7d70b7b | apps/web/components/layout/top-bar.tsx, apps/web/components/layout/company-switcher.tsx (deleted) |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `apps/web/components/layout/user-menu.tsx` exists with all required patterns (trpc.organization.list.useQuery, handleSwitch, Check, Plus, onboarding, w-64)
- [x] `apps/web/components/layout/top-bar.tsx` contains no CompanySwitcher references
- [x] `apps/web/components/layout/company-switcher.tsx` does not exist
- [x] No other web file imports company-switcher
- [x] TypeScript reports no errors in layout files
- [x] Commits 71fe541 and 7d70b7b confirmed in git log
