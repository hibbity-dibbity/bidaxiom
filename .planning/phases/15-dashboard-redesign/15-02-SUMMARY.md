---
phase: 15-dashboard-redesign
plan: 02
subsystem: web-ui
tags: [settings, activity-log, navigation]
dependency-graph:
  requires: [phase-01-auth, phase-02-company-config]
  provides: [settings-activity-page]
  affects: [settings-navigation]
tech-stack:
  added: []
  patterns: [next-app-router, trpc-query, lucide-icons]
key-files:
  created:
    - apps/web/app/(dashboard)/settings/activity/page.tsx
  modified:
    - apps/web/app/(dashboard)/settings/page.tsx
decisions: []
metrics:
  duration: 2 min
  completed: 2026-02-15
---

# Phase 15 Plan 02: Move Activity Feed to Settings Summary

Activity feed moved from dashboard to Settings section with dedicated /settings/activity page and Settings landing page card.

## Overview

**One-liner:** Activity Log page created in Settings with audit summary display, Settings landing page now shows 4 cards in 2-column grid

**What was built:**
- New `/settings/activity` page with audit feed (activity items, loading states, empty states)
- Activity Log card added to Settings landing page (4th card after Team Members, Company Profile, Integrations)
- Self-contained implementation with copied components (ActivityItem, getRelativeTime, actionIcons)

**Why it matters:**
Completes DASH-11 Settings-side requirements. Dashboard page rewrite (Plan 05) can now simply omit the activity feed without breaking functionality. Activity log remains accessible but moved to a more appropriate location.

## Implementation Details

### Task 1: Create Activity Log settings page

**Created:** `apps/web/app/(dashboard)/settings/activity/page.tsx`

**Components:**
- Page uses `trpc.audit.summary.useQuery()` for audit data
- Header: "Activity Log" with subtitle "Recent activity across your organization"
- Action count badge: "X actions today" when data available
- Loading state: 3 skeleton bars (h-12 rounded bg-muted animate-pulse)
- Empty state: "No recent activity yet" with invitation prompt
- ActivityItem component: icon, action description, entity type/id, relative time
- getRelativeTime helper: "Just now", "Xm ago", "Xh ago", "Xd ago", or date
- actionIcons mapping: create→Plus, invite→UserPlus, role_change→Shield, login→UserCheck

**Icons imported:** Activity, Plus, UserPlus, Shield, UserCheck, Building2

**Styling:** Consistent with Settings pages using `space-y-8` layout pattern

**Commit:** `c80af53`

### Task 2: Add Activity Log card to Settings landing page

**Modified:** `apps/web/app/(dashboard)/settings/page.tsx`

**Changes:**
- Added Activity icon import from lucide-react
- Added 4th card linking to /settings/activity
- Maintains 2-column grid layout (md:grid-cols-2) — now shows 2 rows with 4 cards
- Card follows exact same pattern as existing cards (Team Members, Company Profile, Integrations)
- Icon, title, description consistent with established pattern

**Card content:**
- Icon: Activity (text-primary)
- Title: "Activity Log"
- Description: "View recent activity across your organization"
- Link: /settings/activity

**Commit:** `04b2394`

## Technical Approach

**Component reuse strategy:** Copied ActivityItem, getRelativeTime, and actionIcons from dashboard page instead of sharing. This makes the Activity Log page self-contained and prevents coupling with the dashboard page, which will be rewritten in Plan 05.

**No dashboard changes:** Dashboard page remains unchanged. Plan 05 (Dashboard Page Rewrite) will remove the activity feed entirely and replace with Phase-specific widgets.

**Route accessibility:** `/settings/activity` now accessible via Next.js App Router. No additional routing configuration needed.

## Verification Results

**TypeScript check:** Pre-existing errors in codebase (Phase 14 legacy columns, QuickBooks types) — no new errors introduced by this plan.

**File verification:**
- [x] `apps/web/app/(dashboard)/settings/activity/page.tsx` exists
- [x] Settings page contains "Activity" link to `/settings/activity`

**Functional verification:**
- Activity Log page accessible at /settings/activity
- Settings landing page shows 4 cards in 2-column grid
- Activity Log card links correctly to /settings/activity
- tRPC audit.summary query used for data fetching

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | c80af53 | feat(15-02): create Activity Log settings page |
| 2 | 04b2394 | feat(15-02): add Activity Log card to Settings landing page |

## Next Steps

**For Plan 03 (Empty Dashboard States):**
- Dashboard page can safely reference that activity feed has moved to Settings
- Empty states should guide users to Settings > Activity Log for activity tracking

**For Plan 05 (Dashboard Page Rewrite):**
- Remove activity feed section entirely from dashboard page
- Remove ActivityItem, getRelativeTime, actionIcons from dashboard (already copied to Settings)
- Activity feed functionality preserved in Settings location

## Self-Check: PASSED

**Files created:**
- FOUND: apps/web/app/(dashboard)/settings/activity/page.tsx

**Commits:**
- FOUND: c80af53
- FOUND: 04b2394

**Links verified:**
- Settings page contains link to /settings/activity: FOUND
- Activity page uses trpc.audit.summary: FOUND
