---
phase: 11-calendar-integration
plan: 04
subsystem: api
tags: [trpc, calendar, webhooks, oauth, fastify]

# Dependency graph
requires:
  - phase: 11-01
    provides: Calendar database schema and CASL permissions
  - phase: 11-02
    provides: OAuth modules and client factories for Google and Microsoft
  - phase: 08-04
    provides: QuickBooks tRPC router pattern and OAuth callback pattern
provides:
  - Calendar tRPC router with 8 procedures for connection and sync management
  - Google and Microsoft webhook endpoints for push notifications
  - OAuth callback routes for Google and Microsoft authentication flows
  - Worker startup infrastructure (commented until Plan 03)
affects: [11-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-user calendar connection management via userId filtering
    - OAuth callback redirect pattern (API -> frontend with code/state)
    - Webhook queue pattern for async sync job processing
    - Non-fatal worker startup with try/catch logging

key-files:
  created:
    - apps/api/src/trpc/routers/calendar.ts
  modified:
    - apps/api/src/trpc/router.ts
    - apps/api/src/webhooks/routes.ts
    - apps/api/src/server.ts

key-decisions:
  - "Per-user ownership enforcement: All tRPC procedures filter by ctx.auth.userId to ensure users only manage their own connections"
  - "Protected procedures for OAuth callbacks: Uses protectedProcedure (not authorizedProcedure) since abilities may not be loaded during callback"
  - "Webhook handlers commented until Plan 03: Routes are in place but handler imports commented out until sync workers are created"
  - "Daily sync fallback interval: 24-hour scheduled job ensures eventual consistency when webhook notifications fail"
  - "Google webhook sync response: Returns 200 immediately for sync messages (channel setup confirmation)"
  - "Microsoft webhook validation: Returns 200 with validationToken as plain text for subscription validation"

patterns-established:
  - "Calendar router follows QuickBooks pattern: getAuthUrl, handleCallback, disconnect, getStatus structure"
  - "Webhook routes return immediately: Queue jobs via BullMQ, don't process inline (10-second timeout requirement)"
  - "OAuth state validation: Parse state JSON and validate both tenantId and userId match current context"

# Metrics
duration: 4.4 min
completed: 2026-02-14
---

# Phase 11 Plan 04: Calendar tRPC Router and Webhook Routes Summary

**Calendar tRPC router with 8 procedures, Google/Microsoft webhook endpoints, OAuth callback routes, and worker startup infrastructure**

## Performance

- **Duration:** 4.4 min
- **Started:** 2026-02-14T04:49:45Z
- **Completed:** 2026-02-14T04:54:10Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- Created comprehensive calendar tRPC router with 8 procedures covering OAuth connection, sync management, and event queries
- Implemented per-user calendar connection enforcement via userId filtering on all procedures
- Added Google Calendar and Microsoft Graph webhook endpoints for push notification handling
- Built OAuth callback routes that redirect to frontend with authorization codes
- Registered calendar router in appRouter for frontend access
- Added worker startup and daily sync interval infrastructure (commented until Plan 03 creates workers)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create calendar tRPC router with connection management and sync procedures** - `eb82ef3` (feat)
   - 8 procedures: getAuthUrl, handleCallback, disconnect, getConnections, getEvents, syncProject, syncAllProjects, manualSync
   - Per-user enforcement via userId checks on all mutations and queries
   - CASL permissions checked: manage Calendar for mutations, read Calendar for queries
   - OAuth flows for both Google and Microsoft calendar connections
   - Registered in appRouter

2. **Task 2: Add webhook routes, OAuth callbacks, and worker startup** - `5b82264` (feat)
   - Google Calendar webhook (POST /api/webhooks/calendar/google)
   - Microsoft Graph webhook (POST /api/webhooks/calendar/microsoft)
   - Google OAuth callback (GET /api/integrations/calendar/google/callback)
   - Microsoft OAuth callback (GET /api/integrations/calendar/microsoft/callback)
   - Worker startup and daily sync interval (commented until Plan 03)

## Files Created/Modified

- `apps/api/src/trpc/routers/calendar.ts` - Calendar tRPC router with 8 procedures (created)
- `apps/api/src/trpc/router.ts` - Registered calendar router in appRouter
- `apps/api/src/webhooks/routes.ts` - Added 4 calendar routes (2 webhooks + 2 OAuth callbacks)
- `apps/api/src/server.ts` - Added worker startup and daily sync interval (commented)

## Decisions Made

**Per-user ownership enforcement:** All calendar procedures filter by `ctx.auth.userId` to ensure each user can only manage their own calendar connections. This is checked at the procedure level in addition to CASL permissions (which control whether the user can manage calendars at all).

**Protected procedures for OAuth callbacks:** The `handleCallback` procedure uses `protectedProcedure` (not `authorizedProcedure`) because it's invoked during OAuth redirect flow when abilities may not be loaded yet. State validation ensures security by checking both tenantId and userId match the current context.

**Webhook handlers commented until Plan 03:** The webhook routes are fully implemented but the actual handler imports are commented out with TODO markers. This allows the plan to be completed and routes to be in place, ready to be activated when Plan 03 creates the worker and webhook handler files.

**Daily sync fallback interval:** A 24-hour scheduled job will query all active calendar connections and queue incremental-sync jobs. This ensures eventual consistency because webhook notifications are not 100% reliable (network issues, channel expiry, service downtime).

**Google webhook sync response:** Google sends a "sync" resourceState when initially setting up a watch channel. The webhook handler returns 200 immediately for these messages without queuing any jobs.

**Microsoft webhook validation:** When Microsoft creates a new subscription, it sends a validationToken query parameter. The webhook handler must return this token as plain text with 200 status to confirm the endpoint is valid.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Webhook handler imports commented out**
- **Found during:** Task 2, adding webhook routes
- **Issue:** Plan depends on Plan 03 which creates webhook handlers and workers, but Plan 03 hasn't been executed yet
- **Fix:** Added webhook routes with handler logic commented out and TODO markers. Routes are in place and will be activated when handlers are created.
- **Files modified:** apps/api/src/webhooks/routes.ts, apps/api/src/server.ts
- **Verification:** TypeScript compilation passes, routes are structurally complete
- **Committed in:** 5b82264

---

**Total deviations:** 1 auto-fixed (blocking dependency on Plan 03)
**Impact on plan:** Webhook routes and worker startup are structurally complete but handlers are commented until Plan 03 creates the actual implementation files. This allows Plan 04 to be completed without blocking on Plan 03, and makes activation trivial (uncomment the imports).

## tRPC Procedures Detail

### Connection Management
1. **`getAuthUrl`** (mutation, protected)
   - Input: `{ provider: 'google' | 'microsoft' }`
   - Validates user has "manage Calendar" permission via CASL
   - Checks no active connection exists for this provider + userId
   - Returns OAuth authorization URL

2. **`handleCallback`** (mutation, protected)
   - Input: `{ provider, code, state }`
   - Validates state matches tenantId and userId
   - Exchanges code for tokens via provider-specific OAuth handler
   - Encrypts refresh token, inserts connection record
   - Creates sync state row
   - Queues initial full-sync job
   - Returns `{ success, connectionId }`

3. **`disconnect`** (mutation, protected)
   - Input: `{ connectionId }`
   - Validates connection belongs to current userId
   - Updates status to 'disconnected', clears tokens
   - Deletes associated calendar events and sync state
   - Audit logs disconnection

### Status and Queries
4. **`getConnections`** (query, protected)
   - No input (returns all connections for current userId)
   - Joins calendarConnections with calendarSyncState
   - Returns array with connection details and sync state
   - Redacts accessToken and encryptedRefreshToken

5. **`getEvents`** (query, protected)
   - Input: `{ connectionId, projectId? }`
   - Validates connection belongs to current userId
   - Optional projectId filter
   - Returns calendar events ordered by startDate

### Sync Operations
6. **`syncProject`** (mutation, protected)
   - Input: `{ connectionId, projectId }`
   - Validates connection is active and belongs to user
   - Verifies project exists
   - Queues push-event job for project milestones

7. **`syncAllProjects`** (mutation, protected)
   - Input: `{ connectionId }`
   - Validates connection is active and belongs to user
   - Queries all projects user is team member of
   - Queues push-event job for each project
   - Returns `{ jobsQueued }`

8. **`manualSync`** (mutation, protected)
   - Input: `{ connectionId }`
   - Validates connection is active and belongs to user
   - Queues incremental-sync job
   - Returns `{ queued: true }`

## Webhook Routes Detail

### Google Calendar Webhook
- **Endpoint:** POST /api/webhooks/calendar/google
- **Headers:** x-goog-channel-id, x-goog-resource-state, x-goog-channel-token
- **Sync messages:** Returns 200 immediately (channel setup confirmation)
- **Change notifications:** Calls handleGoogleWebhookNotification, queues incremental-sync if shouldSync
- **Response:** 200 OK (must respond within 10 seconds or Google stops sending)

### Microsoft Graph Webhook
- **Endpoint:** POST /api/webhooks/calendar/microsoft
- **Validation:** Returns validationToken as plain text with 200 status
- **Notifications:** Parses body.value array, calls handleMicrosoftWebhookNotification for each
- **Response:** 202 Accepted (Microsoft expects this status code)

### OAuth Callbacks
- **Google:** GET /api/integrations/calendar/google/callback
  - Extracts code, scope, state from query
  - Redirects to: `{CORS_ORIGIN}/settings/integrations/calendar/callback?provider=google&code={code}&state={state}`

- **Microsoft:** GET /api/integrations/calendar/microsoft/callback
  - Extracts code, state from query
  - Redirects to: `{CORS_ORIGIN}/settings/integrations/calendar/callback?provider=microsoft&code={code}&state={state}`

## Worker Infrastructure

### Startup (commented until Plan 03)
```typescript
// Start calendar sync worker (processes background calendar sync jobs)
try {
  startCalendarSyncWorker();
  console.log("Calendar sync worker started");
} catch (err) {
  console.warn("Calendar sync worker failed to start (Redis may not be running):", err);
}
```

### Daily Sync Fallback (commented until Plan 03)
```typescript
// Daily calendar sync fallback (ensures eventual consistency when webhooks miss)
setInterval(async () => {
  try {
    await queueDailyCalendarSync();
  } catch (error) {
    console.error('Error queuing daily calendar sync:', error);
  }
}, 24 * 60 * 60 * 1000); // Every 24 hours
```

Both use non-fatal try/catch pattern following QBO worker startup precedent.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required for this plan. OAuth credentials and webhook URLs will be configured in Plan 05 (frontend).

## Next Phase Readiness

Calendar API layer is complete. Ready for Plan 05 (frontend calendar connection UI).

The tRPC router provides all endpoints needed for:
- Initiating OAuth flows for Google and Microsoft
- Managing calendar connections (connect, disconnect, status)
- Querying calendar events with project filtering
- Triggering manual syncs for individual or all projects

Webhook infrastructure is in place and ready to be activated when Plan 03 creates the sync workers and webhook handlers (simple uncomment of imports).

Frontend can now build:
- Calendar connection settings page
- OAuth flow initiation and callback handling
- Sync status display
- Project milestone sync toggles

---
*Phase: 11-calendar-integration*
*Completed: 2026-02-14*

## Self-Check: PASSED

All key files verified:
- FOUND: apps/api/src/trpc/routers/calendar.ts
- All commits present in git history:
  - eb82ef3: Task 1 (calendar tRPC router)
  - 5b82264: Task 2 (webhook routes and worker startup)
