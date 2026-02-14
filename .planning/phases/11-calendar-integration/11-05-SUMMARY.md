---
phase: 11-calendar-integration
plan: 05
subsystem: ui
tags: [react, calendar, oauth, integrations, trpc]

# Dependency graph
requires:
  - phase: 11-04
    provides: Calendar tRPC router with connection and sync procedures
  - phase: 08-05
    provides: QuickBooks integration UI pattern for connection cards
provides:
  - Calendar connection UI for Google and Microsoft on integrations page
  - OAuth callback handler page for calendar authorization flow
  - Project sync controls for per-project and bulk calendar sync
  - Real-time sync status monitoring with 5-second polling
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Calendar connection card with 4 states (not connected, connected, error, expired)
    - Provider-specific styling using conditional classes
    - OAuth redirect flow with callback page and auto-redirect
    - Independent error handling per integration section
    - Real-time sync status updates via polling

key-files:
  created:
    - apps/web/components/integrations/calendar-connection-card.tsx
    - apps/web/components/integrations/calendar-sync-status.tsx
    - apps/web/components/integrations/calendar-project-sync.tsx
    - apps/web/app/(dashboard)/settings/integrations/calendar/callback/page.tsx
  modified:
    - apps/web/app/(dashboard)/settings/integrations/page.tsx

key-decisions:
  - "CalendarConnectionCard supports both Google and Microsoft providers with distinct styling via provider prop"
  - "Sync status badges use color-coded states (idle=gray, syncing=blue, synced=green, error=red)"
  - "CalendarProjectSync uses simple conditional rendering instead of Collapsible component (component doesn't exist in project)"
  - "Integrations page restructured into sections with Separator for visual hierarchy"
  - "5-second polling interval matches QBO pattern for near-real-time updates"
  - "Active connection check enables project sync controls only when calendar is connected"

patterns-established:
  - "Connection card pattern: status badge in header, connection details in content, action buttons in footer"
  - "OAuth callback pattern: loading spinner → success checkmark → auto-redirect after 2 seconds"
  - "Error isolation: each integration section handles its own errors independently"
  - "Sync state nullability: handle all syncState fields as nullable from left join"

# Metrics
duration: 5 min
completed: 2026-02-14
---

# Phase 11 Plan 05: Calendar Integration Frontend UI Summary

**Calendar connection management UI with OAuth flow, sync controls, and real-time status monitoring on the integrations settings page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T05:00:08Z
- **Completed:** 2026-02-14T05:06:07Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments

- Created CalendarConnectionCard supporting both Google Calendar and Microsoft Outlook providers
- Built OAuth callback page with loading, success, and error states
- Restructured integrations page into QuickBooks and Calendar sections
- Added per-project and bulk project sync controls
- Implemented 5-second polling for near-real-time sync status updates
- Calendar integration follows QuickBooks patterns for consistency

## Task Commits

Each task was committed atomically:

1. **Task 1: Create calendar connection card and sync status components** - `59f4d4a` (feat)
   - CalendarConnectionCard with OAuth connect/disconnect, manual sync, sync all projects
   - CalendarSyncStatus displays detailed sync state with last sync times
   - CalendarProjectSync lists projects with per-project sync buttons
   - Fixed authUrl property name (API returns `url` not `authUrl`)
   - Fixed project.list pagination (returns `{ items, total }`)
   - Used simple conditional rendering instead of Collapsible component

2. **Task 2: Add calendar OAuth callback page and update integrations page** - `d0c892e` (feat)
   - Calendar callback page handles Google and Microsoft OAuth redirects
   - Exchanges code for tokens via tRPC mutation
   - Integrations page restructured with QuickBooks and Calendar sections
   - Calendar section shows both providers side by side
   - Project sync controls shown when any connection is active
   - Independent error handling for each integration

## Files Created/Modified

- `apps/web/components/integrations/calendar-connection-card.tsx` - Calendar connection card with OAuth and sync controls (created)
- `apps/web/components/integrations/calendar-sync-status.tsx` - Sync status display component (created)
- `apps/web/components/integrations/calendar-project-sync.tsx` - Per-project sync controls (created)
- `apps/web/app/(dashboard)/settings/integrations/calendar/callback/page.tsx` - OAuth callback handler (created)
- `apps/web/app/(dashboard)/settings/integrations/page.tsx` - Restructured with QuickBooks and Calendar sections

## Decisions Made

**CalendarConnectionCard supports both providers:** Single component with `provider` prop ("google" | "microsoft") handles both Google Calendar and Microsoft Outlook. Provider-specific styling uses conditional classes for icon color and background.

**Sync status badge color coding:** Visual distinction for sync states improves user experience. Idle (gray), syncing (blue with spinner), synced (green), error (red) provide at-a-glance status understanding.

**Simple conditional rendering for project sync:** Collapsible component doesn't exist in the project. Used simple `{isOpen && <div>...</div>}` pattern with state toggle for clean expand/collapse behavior.

**Section-based integrations page structure:** Separating QuickBooks and Calendar into distinct sections with Separator improves visual hierarchy and allows independent error handling. Each section can fail or load independently.

**5-second polling for sync status:** Matches QuickBooks integration pattern (established in Phase 8). Balances near-real-time updates with reduced API load. Suitable for monitoring background sync jobs.

**Active connection gating for project sync:** `CalendarProjectSync` component only shown when `activeCalendarConnection` exists (status === 'active'). Prevents showing project sync controls when no calendar is connected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed authUrl property name mismatch**
- **Found during:** Task 1, writing CalendarConnectionCard component
- **Issue:** Plan assumed API returns `{ authUrl }` but Plan 04 implementation returns `{ url }`
- **Fix:** Changed `window.location.href = data.authUrl` to `data.url`
- **Files modified:** apps/web/components/integrations/calendar-connection-card.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 59f4d4a

**2. [Rule 3 - Blocking] Fixed project.list pagination structure**
- **Found during:** Task 1, writing CalendarProjectSync component
- **Issue:** Component assumed `trpc.project.list` returns array, but API returns `{ items, total }`
- **Fix:** Changed `projects?.map(...)` to `projectsData?.items || []` and accessed `.items.map(...)`
- **Files modified:** apps/web/components/integrations/calendar-project-sync.tsx
- **Verification:** TypeScript compilation passes, no type errors
- **Committed in:** 59f4d4a

**3. [Rule 3 - Blocking] Replaced Collapsible component with simple conditional rendering**
- **Found during:** Task 1, writing CalendarProjectSync component
- **Issue:** Plan specified using `@/components/ui/collapsible` but component doesn't exist in project
- **Fix:** Used simple `{isOpen && <div>...</div>}` with state and toggle button for expand/collapse behavior
- **Files modified:** apps/web/components/integrations/calendar-project-sync.tsx
- **Verification:** TypeScript compilation passes, functionality equivalent
- **Committed in:** 59f4d4a

**4. [Rule 2 - Missing Critical] Added nullability handling for syncState fields**
- **Found during:** Task 2, integrating with API response
- **Issue:** API uses left join so syncState fields are nullable, but component type didn't reflect this
- **Fix:** Updated CalendarConnectionCardProps type to mark syncState fields as nullable (syncStatus, syncedEventCount, etc.)
- **Files modified:** apps/web/components/integrations/calendar-connection-card.tsx
- **Verification:** TypeScript type errors resolved, null coalescing added
- **Committed in:** d0c892e

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing critical)
**Impact on plan:** All deviations were necessary for correctness and compatibility with existing API/component structure. No scope creep. All fixes align with established patterns in the project.

## Component Features Detail

### CalendarConnectionCard

**States:**
1. **Not connected:** "Not Connected" badge, provider logo/icon, "Connect [Provider]" button
2. **Connected:** "Connected" badge, email, calendar ID, last sync time, sync status, event count, webhook expiry, action buttons (Sync Now, Sync All Projects, Disconnect)
3. **Error:** "Error" badge, error message in alert, "Reconnect" button
4. **Expired:** "Expired" badge, webhook expired message, "Reconnect" button

**Mutations:**
- `getAuthUrl` → redirects to OAuth page
- `disconnect` → disconnects and invalidates cache
- `manualSync` → triggers incremental sync
- `syncAllProjects` → queues push-event jobs for all user's projects

**Styling:**
- Google: blue icon and background
- Microsoft: orange icon and background
- Follows QBO card layout exactly

### CalendarSyncStatus

**Display:**
- Sync status badge with color coding
- Last full sync (relative time)
- Last incremental sync (relative time)
- Events synced count
- Error count (red if > 0)
- Last error message in Alert (if exists)

### CalendarProjectSync

**Features:**
- Collapsible section with project count in header
- Queries `trpc.project.list` for user's projects
- Per-project card with name, status badge, job number
- "Sync to Calendar" button per project
- Mutation calls `trpc.calendar.syncProject`
- Toast notification on success/error
- Loading spinner on active sync

### Calendar Callback Page

**Flow:**
1. Extract `provider`, `code`, `state` from URL
2. Validate all params present and provider is valid
3. Call `trpc.calendar.handleCallback` mutation
4. Loading state: spinner with "Connecting [Provider]..."
5. Success state: green checkmark, auto-redirect after 2 seconds
6. Error state: red alert, "Return to Integrations" button

### Integrations Page Structure

**Before:** Single QuickBooks section
**After:** Two sections separated by `<Separator />`

1. **QuickBooks Online section:** Unchanged QBO components
2. **Calendar Integration section:**
   - Description text
   - 2-column grid for Google and Microsoft cards
   - Project sync controls (if any connection active)
   - Independent error handling

**Polling:**
- `trpc.quickbooks.getStatus`: 5000ms interval
- `trpc.calendar.getConnections`: 5000ms interval

## Issues Encountered

None

## User Setup Required

None - OAuth credentials are configured server-side in environment variables (configured in Phase 11-02).

Users can now:
1. Navigate to `/settings/integrations`
2. Click "Connect Google Calendar" or "Connect Microsoft Outlook"
3. Complete OAuth flow in browser
4. Return to integrations page and see connected calendar
5. Sync individual projects or all projects to calendar
6. Monitor sync status in real-time

## Next Phase Readiness

Calendar integration frontend is complete. Phase 11 is ready for final verification.

The UI provides full user control over:
- Connecting and disconnecting calendars (Google and Microsoft)
- Monitoring sync status with real-time updates
- Triggering manual syncs (incremental and full)
- Syncing project milestones to calendar (per-project and bulk)

Frontend components follow established patterns from QuickBooks integration, ensuring consistency across the application.

---
*Phase: 11-calendar-integration*
*Completed: 2026-02-14*

## Self-Check: PASSED

All key files verified:
- FOUND: apps/web/components/integrations/calendar-connection-card.tsx
- FOUND: apps/web/components/integrations/calendar-sync-status.tsx
- FOUND: apps/web/components/integrations/calendar-project-sync.tsx
- FOUND: apps/web/app/(dashboard)/settings/integrations/calendar/callback/page.tsx

All commits present in git history:
- 59f4d4a: Task 1 (calendar connection card and sync status components)
- d0c892e: Task 2 (OAuth callback page and integrations page update)
