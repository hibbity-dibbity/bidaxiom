---
phase: 11-calendar-integration
plan: 03
subsystem: integrations
tags: [sync, calendar, mappers, workers, webhooks, bullmq]
completed: 2026-02-14

# Dependency Graph
requires:
  - phase: 11-02
    provides: OAuth modules, client factories, shared queue infrastructure
  - phase: 08-03
    provides: Worker pattern (db/schema from tenant context, mapper testability)
provides:
  - Bidirectional event mappers (project milestones <-> calendar events)
  - Google Calendar incremental sync with syncToken
  - Microsoft Calendar delta sync with deltaLink
  - Webhook notification handlers for both providers
  - BullMQ worker processing 5 calendar sync operations
affects:
  - 11-04: tRPC procedures will queue sync jobs using calendarSyncQueue
  - 11-05: Frontend will trigger manual sync and view sync status

# Tech Stack
added: []
patterns:
  - Bidirectional event mapping (internal <-> provider formats)
  - Incremental sync with tokens (Google syncToken, Microsoft deltaLink)
  - 410 Gone error handling (expired token = clear and retry with full sync)
  - Webhook channel/subscription lifecycle management with renewal queuing
  - BullMQ worker with tenant context pattern (from Phase 8 QBO)

# Key Files
created:
  - apps/api/src/integrations/calendar/shared/mappers.ts (Event mappers)
  - apps/api/src/integrations/calendar/google/sync.ts (Google sync logic)
  - apps/api/src/integrations/calendar/google/webhooks.ts (Google webhook management)
  - apps/api/src/integrations/calendar/microsoft/sync.ts (Microsoft sync logic)
  - apps/api/src/integrations/calendar/microsoft/webhooks.ts (Microsoft webhook management)
  - apps/api/src/integrations/calendar/shared/workers.ts (BullMQ worker)
modified:
  - apps/api/src/integrations/calendar/shared/queue.ts (Re-exported redisConnection)

# Key Decisions
decisions:
  - name: Mappers handle all-day vs timed events differently
    rationale: Google uses 'date' field (YYYY-MM-DD) for all-day, 'dateTime' for timed events
    alternatives: Could normalize to single format, but provider APIs require distinction
    impact: Mappers check allDay flag and use appropriate field format for each provider

  - name: 410 Gone error triggers full sync retry
    rationale: Expired sync tokens can't be refreshed; must start fresh delta query
    alternatives: Could fail permanently and require user action
    impact: Automatic recovery from token expiration without user intervention

  - name: Webhook renewal queued before expiry
    rationale: Google channels expire in 7 days, Microsoft subscriptions in 3 days
    alternatives: Could rely on notification failures to trigger renewal
    impact: Proactive renewal (6 days for Google, 2 days for Microsoft) prevents missed events

  - name: Push-event generates all milestone events
    rationale: Project may have multiple dates (start, end) and phases (each with start/end)
    alternatives: Could push only changed events
    impact: Simple full sync of project milestones; update-or-create pattern handles changes

  - name: Worker accepts db/schema from tenant context
    rationale: Follows Phase 8 QBO mapper pattern for testability and separation of concerns
    alternatives: Could build tenant context inside sync functions
    impact: Sync functions are pure, testable, don't depend on global state

# Performance
duration: 6 min
tasks_completed: 2
files_created: 6
files_modified: 1
---

# Phase 11 Plan 03: Calendar Sync Engine Summary

**Event mappers, provider-specific sync logic with incremental tokens, webhook handlers, and BullMQ worker orchestrating all operations.**

## What Was Built

Built the complete calendar sync engine that makes project milestones appear on connected calendars:

### 1. Event Mappers (`shared/mappers.ts`)

**Bidirectional mapping between platform milestones and calendar events:**

- `projectToCalendarEvents(project, phases)`: Generates calendar events from project/phase dates
  - Project start event (if project.startDate exists)
  - Project end event (if project.endDate exists)
  - Phase start/end events (for each phase with dates)
  - Returns internal event format with sourceEntityType and sourceEntityId for tracking

- `mapGoogleEventToInternal(googleEvent)`: Google Calendar → internal format
  - Handles all-day (date field) vs timed (dateTime field)
  - Returns null for cancelled events (status === 'cancelled')
  - Preserves etag for conflict detection

- `mapMicrosoftEventToInternal(msEvent)`: Microsoft Graph → internal format
  - Returns null for deleted events ('@removed' property)
  - Uses isAllDay flag for all-day detection

- `internalToGoogleEvent(event)`: Internal → Google Calendar format
  - All-day events use date field (YYYY-MM-DD), exclusive end date
  - Timed events use dateTime field (ISO 8601)

- `internalToMicrosoftEvent(event)`: Internal → Microsoft Graph format
  - Subject, body, start/end with timezone, isAllDay flag

### 2. Google Sync Module (`google/sync.ts`)

**Incremental sync with syncToken:**

- `syncGoogleCalendar(params)`: Main sync function
  - If syncToken exists: incremental sync (only changes)
  - If no syncToken: full sync from 30 days ago
  - Paginate with nextPageToken until nextSyncToken received
  - Upsert events into calendarEvents table
  - Delete cancelled events
  - **410 Gone handling:** Clear syncToken and retry with full sync

- `pushEventToGoogle(params, eventData)`: Create event on Google Calendar
  - Uses calendar.events.insert with mapped event

- `updateGoogleEvent(params, externalEventId, eventData, etag)`: Update existing event
  - **If-Match header with etag for conflict detection**
  - **412 Precondition Failed:** Re-fetch and apply last-write-wins

- `deleteGoogleEvent(params, externalEventId)`: Delete event
  - Handles 404 (already deleted) gracefully

### 3. Google Webhooks Module (`google/webhooks.ts`)

**Push notification channel management:**

- `setupGoogleWebhook(params)`: Create webhook channel
  - Channel ID: `cal-${connectionId}-${timestamp}`
  - Expiration: 7 days from now
  - Token: connection ID for validation
  - **Queues renewal job for 6 days later**

- `handleGoogleWebhookNotification(headers)`: Process incoming notifications
  - Returns 200 for 'sync' resourceState (setup confirmation)
  - Returns { shouldSync: true } for 'exists' (change occurred)

- `renewGoogleChannel(params)`: Stop old channel, create new one
  - Prevents expiration-related missed events

- `stopGoogleChannel(params)`: Stop watching (on disconnect)

### 4. Microsoft Sync Module (`microsoft/sync.ts`)

**Delta sync with deltaLink:**

- `syncMicrosoftCalendar(params)`: Main sync function
  - If deltaLink exists: incremental sync
  - If no deltaLink: full delta from 30 days ago to 1 year from now
  - Paginate with @odata.nextLink until @odata.deltaLink received
  - Check for '@removed' property (deletion)
  - **410 Gone handling:** Clear deltaLink and retry with full sync

- `pushEventToMicrosoft(params, eventData)`: Create event
  - POST /me/calendar/events

- `updateMicrosoftEvent(params, externalEventId, eventData)`: Update event
  - PATCH /me/calendar/events/{id}

- `deleteMicrosoftEvent(params, externalEventId)`: Delete event
  - DELETE /me/calendar/events/{id}
  - Handles 404 gracefully

### 5. Microsoft Webhooks Module (`microsoft/webhooks.ts`)

**Graph subscription management:**

- `setupMicrosoftWebhook(params)`: Create subscription
  - ChangeType: created,updated,deleted
  - Resource: /me/calendars/{calendarId}/events
  - Expiration: 3 days (Microsoft max ~4230 minutes)
  - ClientState: connection ID for validation
  - **Queues renewal job for 2 days later**

- `handleMicrosoftWebhookNotification(body, query)`: Process notifications
  - **Validation request:** Return validationToken as plain text
  - **Notification request:** Extract subscriptionId and clientState

- `renewMicrosoftSubscription(params)`: PATCH subscription expiration
  - Updates expirationDateTime to 3 days from now
  - Queues next renewal

### 6. BullMQ Worker (`shared/workers.ts`)

**Orchestrates all calendar sync operations:**

**Worker configuration:**
- Queue: 'calendar-sync'
- Concurrency: 3 (conservative for calendar API rate limits)
- Rate limit: 60 jobs/min

**Common preamble for all jobs:**
1. Load tenant from public.tenants
2. Build tenant DB context (db + schema)
3. Load calendar connection from calendarConnections table
4. Check connection status (skip if not 'active')
5. **Check access token expiry and refresh if needed:**
   - Google: refreshGoogleCalendarToken (token doesn't rotate)
   - Microsoft: refreshMicrosoftCalendarToken (may rotate, update if changed)
6. Mark connection as 'expired' on refresh failure

**Operation routing:**

a. **full-sync:**
   - Update calendarSyncState to 'syncing'
   - Clear syncToken to force full sync
   - Call syncGoogleCalendar or syncMicrosoftCalendar
   - Store new syncToken
   - Update calendarSyncState: lastFullSyncAt, syncedEventCount

b. **incremental-sync:**
   - Update calendarSyncState to 'syncing'
   - Call sync function (uses existing syncToken)
   - Store new syncToken
   - Update calendarSyncState: lastIncrementalSyncAt

c. **push-event:**
   - Load project and phases from tenant DB
   - Generate events via projectToCalendarEvents
   - For each event:
     - Check if exists in calendarEvents table (by sourceEntityType + sourceEntityId)
     - If exists: updateGoogleEvent or updateMicrosoftEvent
     - If not: pushEventToGoogle or pushEventToMicrosoft, insert into calendarEvents
   - Update lastSyncAt on connection

d. **delete-event:**
   - Load calendar event from calendarEvents table
   - Call deleteGoogleEvent or deleteMicrosoftEvent
   - Delete from calendarEvents table

e. **renew-webhook:**
   - Call renewGoogleChannel or renewMicrosoftSubscription

**Error handling:**
- Rate limit (429): Throw to trigger BullMQ retry with backoff
- Auth error (401): Throw to retry (already attempted refresh)
- All retries exhausted: Update calendarSyncState with error info

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] All 7 files compile without TypeScript errors (skipLibCheck for library warnings)
- [x] Mappers correctly handle all-day events (date only, no time) vs timed events (dateTime with timezone)
- [x] Google sync handles 410 Gone by clearing syncToken and retrying
- [x] Microsoft sync handles 410 Gone by clearing deltaLink and retrying
- [x] Worker processes all 5 job types (full-sync, incremental-sync, push-event, delete-event, renew-webhook)
- [x] Webhook setup queues renewal jobs before expiry (6 days for Google, 2 days for Microsoft)
- [x] Push-event correctly generates events from project startDate, endDate, and phase dates
- [x] All sync functions accept db/schema parameters for testability

## Integration Points

**Provides to downstream plans:**
- Event mappers for bidirectional milestone <-> calendar conversion
- Incremental sync with token management (Google syncToken, Microsoft deltaLink)
- Webhook lifecycle management with automatic renewal
- BullMQ worker ready to process queued sync jobs
- Error recovery patterns (expired tokens, rate limits, conflicts)

**Will be consumed by:**
- 11-04: tRPC calendar router (queues push-event, delete-event, full-sync jobs)
- 11-04: Webhook routes (call handleGoogleWebhookNotification, handleMicrosoftWebhookNotification, queue incremental-sync)
- 11-04: Server startup (call startCalendarSyncWorker)
- 11-05: Frontend (manual sync triggers, sync status display)

## Task Commits

Each task was committed atomically:

1. **Task 1: Event mappers and provider-specific sync modules** - `37f1f48` (feat)
   - shared/mappers.ts: Bidirectional event mapping
   - google/sync.ts: Incremental sync with syncToken, 410 Gone handling
   - google/webhooks.ts: Channel management with renewal queuing
   - microsoft/sync.ts: Delta sync with deltaLink, 410 Gone handling
   - microsoft/webhooks.ts: Subscription management with renewal queuing

2. **Task 2: BullMQ worker** - `a56019a` (feat)
   - shared/workers.ts: Processes 5 operations for both providers
   - shared/queue.ts: Re-exported redisConnection for worker

## Next Steps

1. **Plan 11-04:** Create tRPC calendar router and webhook routes
   - Connection management endpoints (connect, disconnect, status)
   - Manual sync triggers (full-sync, push-event for project)
   - Webhook routes for both providers (/api/webhooks/calendar/google, /microsoft)
   - Worker startup in server.ts

2. **Plan 11-05:** Build frontend calendar connection UI
   - Calendar connection cards in settings
   - Connect/disconnect buttons triggering OAuth flows
   - Sync status display (last sync, event count, errors)
   - Manual sync buttons per project

## Self-Check: PASSED

**Created files exist:**
- FOUND: apps/api/src/integrations/calendar/shared/mappers.ts
- FOUND: apps/api/src/integrations/calendar/google/sync.ts
- FOUND: apps/api/src/integrations/calendar/google/webhooks.ts
- FOUND: apps/api/src/integrations/calendar/microsoft/sync.ts
- FOUND: apps/api/src/integrations/calendar/microsoft/webhooks.ts
- FOUND: apps/api/src/integrations/calendar/shared/workers.ts

**Modified files exist:**
- FOUND: apps/api/src/integrations/calendar/shared/queue.ts

**Commits exist:**
- FOUND: 37f1f48 (Task 1: Event mappers and sync modules)
- FOUND: a56019a (Task 2: BullMQ worker)

**Compilation check:**
- PASSED: All files compile without errors (skipLibCheck)
- PASSED: No application-level TypeScript errors
