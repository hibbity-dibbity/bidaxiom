---
phase: 11-calendar-integration
plan: 02
subsystem: integrations
tags: [oauth, calendar, google, microsoft, queue, encryption]
completed: 2026-02-14

# Dependency Graph
requires:
  - phase: 08-quickbooks-integration
    provides: Encryption pattern and BullMQ queue infrastructure
provides:
  - Google Calendar OAuth 2.0 flow (offline access, refresh tokens)
  - Microsoft Graph OAuth 2.0 flow (MSAL with account serialization)
  - Google Calendar API v3 client factory
  - Microsoft Graph client factory
  - Calendar sync BullMQ queue with retry strategy
  - Token encryption re-export from QBO module
affects:
  - 11-03: Sync workers will use OAuth modules and client factories
  - 11-04: tRPC procedures will use OAuth functions for connection flow
  - 11-05: Frontend will initiate OAuth flows

# Tech Stack
added:
  - googleapis@171.4.0 (Google Calendar API v3)
  - @microsoft/microsoft-graph-client@3.0.7 (Microsoft Graph SDK)
  - @azure/msal-node@5.0.4 (Microsoft authentication library)
  - @microsoft/microsoft-graph-types@2.x (dev dependency, TypeScript types)
patterns:
  - OAuth 2.0 with offline access for refresh tokens
  - MSAL account serialization for multi-tenant token management
  - BullMQ queue reuse from QBO integration
  - AES-256-GCM encryption reuse from QBO module

# Key Files
created:
  - apps/api/src/integrations/calendar/shared/crypto.ts (Re-exports QBO encryption)
  - apps/api/src/integrations/calendar/shared/queue.ts (BullMQ calendar sync queue)
  - apps/api/src/integrations/calendar/google/oauth.ts (Google OAuth flow)
  - apps/api/src/integrations/calendar/google/client.ts (Google Calendar v3 client)
  - apps/api/src/integrations/calendar/microsoft/oauth.ts (Microsoft OAuth with MSAL)
  - apps/api/src/integrations/calendar/microsoft/client.ts (Microsoft Graph client)
modified:
  - apps/api/package.json (added 3 dependencies + 1 dev dependency)
  - package-lock.json (dependency tree)

# Key Decisions
decisions:
  - name: Re-export QBO encryption instead of duplicating
    rationale: Single source of truth for token encryption, same AES-256-GCM key
    alternatives: Could create separate encryption module, but QBO pattern is proven
    impact: Both integrations use same QBO_ENCRYPTION_KEY env var (rename in Phase 12)

  - name: MSAL account serialization instead of raw refresh tokens
    rationale: MSAL doesn't expose refresh tokens directly; stores in internal cache
    alternatives: Could bypass MSAL and use direct HTTP calls to token endpoint
    impact: We serialize account info and use acquireTokenSilent for refresh

  - name: Reuse redisConnection from QBO queue
    rationale: Both integrations share same Redis instance, different queue names
    alternatives: Could create separate Redis connection per integration
    impact: Consistent connection configuration, simpler infrastructure

# Performance
duration: 4 min
tasks_completed: 2
files_created: 6
files_modified: 2
---

# Phase 11 Plan 02: Calendar OAuth and Infrastructure Summary

**OAuth 2.0 flows for Google Calendar and Microsoft Graph with client factories, shared encryption, and BullMQ sync queue.**

## What Was Built

Built the OAuth 2.0 authentication infrastructure for both Google Calendar and Microsoft Outlook:

1. **Shared Crypto Module** (`shared/crypto.ts`)
   - Re-exports `encryptToken` and `decryptToken` from QBO module
   - Uses same AES-256-GCM encryption with QBO_ENCRYPTION_KEY
   - Single source of truth for token encryption
   - TODO comment for Phase 12 env var rename

2. **Calendar Sync Queue** (`shared/queue.ts`)
   - BullMQ queue named 'calendar-sync'
   - Reuses `redisConnection` from QBO queue
   - 5 retry attempts with exponential backoff (2s → 32s)
   - Job data: provider, connectionId, operation, projectId, phaseId, eventId, syncReason
   - Operations: full-sync, incremental-sync, push-event, delete-event, renew-webhook

3. **Google OAuth Module** (`google/oauth.ts`)
   - `getGoogleCalendarAuthUrl(tenantId, userId)`: Generate auth URL with offline access
   - `handleGoogleCalendarCallback(code, state)`: Exchange code for tokens
   - `refreshGoogleCalendarToken(encryptedRefreshToken)`: Refresh access token
   - Scopes: calendar.events, calendar.readonly
   - CRITICAL: `access_type: 'offline'` and `prompt: 'consent'` for refresh token
   - Note: Google does NOT rotate refresh tokens (reuse same token)

4. **Google Client Factory** (`google/client.ts`)
   - `createGoogleCalendarClient(accessToken)`: Returns configured calendar v3 client
   - Used for events.list, events.insert, events.update, events.delete, events.watch

5. **Microsoft OAuth Module** (`microsoft/oauth.ts`)
   - `getMicrosoftCalendarAuthUrl(tenantId, userId)`: Generate auth URL (async)
   - `handleMicrosoftCalendarCallback(code, state)`: Exchange code for tokens
   - `refreshMicrosoftCalendarToken(encryptedAccountInfo)`: Refresh using account
   - Uses MSAL ConfidentialClientApplication
   - Scopes: Calendars.ReadWrite, offline_access, User.Read
   - MSAL pattern: Serializes account info instead of raw refresh tokens
   - Uses `acquireTokenSilent` for refresh (MSAL manages token cache internally)

6. **Microsoft Client Factory** (`microsoft/client.ts`)
   - `createMicrosoftGraphClient(accessToken)`: Returns configured Graph client
   - Used for /me/calendar/events, /me/calendarView/delta, /subscriptions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MSAL account serialization for refresh tokens**
- **Found during:** Task 2, Microsoft OAuth implementation
- **Issue:** MSAL doesn't expose refresh tokens in `acquireTokenByCode` response
- **Root cause:** MSAL manages refresh tokens internally in its token cache
- **Fix:** Serialize account info from response, use `acquireTokenSilent` for refresh
- **Files modified:** microsoft/oauth.ts
- **Verification:** Compilation passes, pattern follows MSAL best practices
- **Committed in:** 9faf35c

---

**Total deviations:** 1 auto-fixed (MSAL API design pattern)
**Impact on plan:** Necessary adaptation to MSAL's token management design. Functionality equivalent.

## Environment Variables Required

| Variable | Source | Purpose |
|----------|--------|---------|
| `GOOGLE_CALENDAR_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials | OAuth client ID |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials | OAuth client secret |
| `MICROSOFT_CALENDAR_CLIENT_ID` | Azure Portal → App Registrations | OAuth client ID |
| `MICROSOFT_CALENDAR_CLIENT_SECRET` | Azure Portal → App Registrations → Certificates & secrets | OAuth client secret |
| `API_URL` | Application base URL | OAuth redirect URI construction |
| `QBO_ENCRYPTION_KEY` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 32-byte hex key (already exists from Phase 8) |
| `REDIS_HOST` | Redis server hostname | BullMQ connection (already exists from Phase 8) |
| `REDIS_PORT` | Redis server port | BullMQ connection (already exists from Phase 8) |

## Integration Points

**Provides to downstream plans:**
- OAuth authorization URL generation for both providers
- OAuth callback token exchange for both providers
- Token refresh handling (Google: simple reuse, Microsoft: MSAL account-based)
- Calendar API client factories for sync operations
- BullMQ queue for calendar sync job processing

**Will be consumed by:**
- 11-03: Sync workers (uses client factories, queue)
- 11-04: tRPC calendar router (uses OAuth functions for connect/disconnect)
- 11-05: Frontend OAuth callback pages (redirect after authorization)

## Verification Results

- [x] Dependencies installed: googleapis@171.4.0, @microsoft/microsoft-graph-client@3.0.7, @azure/msal-node@5.0.4
- [x] All modules compile without errors (ignoring library TS18028 warnings)
- [x] Google OAuth exports: getGoogleCalendarAuthUrl, handleGoogleCalendarCallback, refreshGoogleCalendarToken, GoogleCalendarTokens
- [x] Google client exports: createGoogleCalendarClient
- [x] Microsoft OAuth exports: getMicrosoftCalendarAuthUrl, handleMicrosoftCalendarCallback, refreshMicrosoftCalendarToken, MicrosoftCalendarTokens
- [x] Microsoft client exports: createMicrosoftGraphClient
- [x] Shared crypto re-exports: encryptToken, decryptToken from QBO module
- [x] Shared queue exports: calendarSyncQueue, CalendarSyncJobData
- [x] Queue reuses redisConnection from QBO
- [x] Named imports from crypto (ESM compatibility)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create shared modules** - `ebb6aab` (chore)
   - googleapis, @microsoft/microsoft-graph-client, @azure/msal-node, @microsoft/microsoft-graph-types
   - shared/crypto.ts re-exports QBO encryption
   - shared/queue.ts with BullMQ calendar-sync queue

2. **Task 2: Create OAuth modules and client factories** - `9faf35c` (feat)
   - Google OAuth with offline access and refresh token support
   - Google Calendar API v3 client factory
   - Microsoft OAuth using MSAL with account serialization
   - Microsoft Graph client factory

**Plan metadata:** (not yet committed - will be committed in next step)

## Next Steps

1. **Plan 11-03:** Build sync workers and event mappers
   - Worker setup using BullMQ with redisConnection
   - Implement delta sync for Google (syncToken) and Microsoft (deltaToken)
   - Event mappers: platform milestone <-> calendar event
   - Webhook notification handlers

2. **Plan 11-04:** Create tRPC calendar router and webhook routes
   - Connection management endpoints (connect, disconnect, status)
   - OAuth callback handlers (Google and Microsoft)
   - Webhook route registration for both providers
   - Worker startup in server.ts

3. **Plan 11-05:** Build frontend calendar connection UI
   - Calendar connection cards in settings
   - OAuth flow initiation and callback handling
   - Sync status display
   - Project milestone sync toggle

## Self-Check: PASSED

**Created files exist:**
- FOUND: apps/api/src/integrations/calendar/shared/crypto.ts
- FOUND: apps/api/src/integrations/calendar/shared/queue.ts
- FOUND: apps/api/src/integrations/calendar/google/oauth.ts
- FOUND: apps/api/src/integrations/calendar/google/client.ts
- FOUND: apps/api/src/integrations/calendar/microsoft/oauth.ts
- FOUND: apps/api/src/integrations/calendar/microsoft/client.ts

**Commits exist:**
- FOUND: ebb6aab (Task 1: dependencies and shared modules)
- FOUND: 9faf35c (Task 2: OAuth modules and client factories)

**Dependencies installed:**
- FOUND: googleapis@171.4.0
- FOUND: @microsoft/microsoft-graph-client@3.0.7
- FOUND: @azure/msal-node@5.0.4
- FOUND: @microsoft/microsoft-graph-types (dev dependency)
