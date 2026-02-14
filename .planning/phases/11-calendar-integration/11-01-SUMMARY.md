---
phase: 11-calendar-integration
plan: 01
subsystem: calendar
tags: [calendar, google-calendar, microsoft-outlook, oauth, drizzle, zod, casl]

# Dependency graph
requires:
  - phase: 08-quickbooks-integration
    provides: OAuth connection pattern with encrypted refresh tokens
  - phase: 01-foundation
    provides: Multi-tenant schema provisioning pattern
provides:
  - Calendar Zod schemas and TypeScript types for connections, events, and sync state
  - Drizzle schema tables for calendar data in tenant schema
  - CASL permissions for calendar management across all roles
  - Per-user calendar connection storage with encrypted tokens
affects: [12-mobile-app, 13-ai-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-user calendar connections (not per-company) with userId field"
    - "Encrypted refresh tokens using AES-256-GCM pattern from QBO integration"
    - "Bidirectional event sync tracking with source and sourceEntityType fields"
    - "Webhook channel/subscription tracking for push notifications"

key-files:
  created:
    - packages/shared/src/types/calendar.ts
  modified:
    - packages/shared/src/types/auth.ts
    - packages/shared/src/types/index.ts
    - apps/api/src/auth/abilities.ts
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/src/tenant/context.ts

key-decisions:
  - "Per-user calendar connections (not per-company): Each user connects their own Google/Outlook calendar via OAuth"
  - "Encrypted refresh tokens using AES-256-GCM: Follows Phase 8 QBO pattern for secure long-lived token storage"
  - "Unique constraint on (provider, userId): One connection per provider per user to prevent duplicate connections"
  - "Calendar permissions via CASL: Admin manages all, PM/Superintendent can manage their own calendars, others read-only"
  - "Bidirectional sync support: source field tracks whether event originated from platform or external calendar"
  - "Project association optional: projectId nullable to support external-origin events that aren't tied to projects"

patterns-established:
  - "Calendar subject added to CASL AppSubjects for permission enforcement"
  - "Webhook metadata fields (channelId, resourceId, subscriptionId, expiresAt) for push notification management"
  - "Sync state tracking table with one-to-one relationship to calendar connections"

# Metrics
duration: 3 min
completed: 2026-02-14
---

# Phase 11 Plan 01: Calendar Foundation Summary

**Calendar database schema, Zod types, and CASL permissions established for Google Calendar and Microsoft Outlook integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T04:41:29Z
- **Completed:** 2026-02-14T04:44:54Z
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments

- Created comprehensive calendar type system with Zod schemas for connections, events, and sync state
- Added Calendar to CASL AppSubjects with role-based permissions (manage for admin/PM/superintendent, read for others)
- Built Drizzle tenant schema with three calendar tables (connections, events, sync_state)
- Updated tenant provisioning SQL to create calendar tables for new tenants
- Established per-user calendar connection pattern (not per-company) for OAuth flows

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared calendar types and update CASL subjects** - `8445bd5` (feat)
2. **Task 2: Add calendar tables to Drizzle tenant schema and provision script** - `de3b110` (feat)

## Files Created/Modified

- `packages/shared/src/types/calendar.ts` - Calendar Zod schemas and TypeScript types (created)
- `packages/shared/src/types/auth.ts` - Added "Calendar" to AppSubjects union type
- `packages/shared/src/types/index.ts` - Exported calendar types from shared package
- `apps/api/src/auth/abilities.ts` - Added Calendar permissions for all roles
- `apps/api/src/db/schema/tenant.ts` - Added calendarConnections, calendarEvents, calendarSyncState tables
- `apps/api/src/tenant/provision.ts` - Added CREATE TABLE statements for calendar tables
- `apps/api/src/tenant/context.ts` - Exposed calendar tables via tenant context

## Decisions Made

**Per-user calendar connections (not per-company):** Each user connects their own Google/Outlook calendar via OAuth. The `userId` field stores the Clerk user ID, and the unique constraint on `(provider, userId)` ensures one connection per provider per user. This allows different team members to sync their personal calendars with project milestones.

**Encrypted refresh tokens using AES-256-GCM:** Follows the Phase 8 QuickBooks integration pattern for secure long-lived token storage. Access tokens are short-lived (1 hour) and stored unencrypted, while refresh tokens are encrypted.

**Bidirectional sync support:** The `source` enum (`platform` | `external`) and `sourceEntityType`/`sourceEntityId` fields enable bidirectional sync. Platform-created events (like project milestones) can be pushed to external calendars, and external calendar events can be pulled into the platform.

**CASL role-based permissions:** Admin has full manage access via "manage all". Project managers and superintendents get "manage Calendar" (can connect/disconnect their own calendars). Accountants, estimators, foremen, and members get "read Calendar" (can view sync status). Per-user enforcement happens at the procedure level via userId checks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required for this foundation plan.

## Next Phase Readiness

Calendar foundation is complete with types, schema, permissions, and provisioning. Ready for Plan 02 (OAuth modules for Google and Microsoft) and Plan 03 (sync workers for bidirectional event sync).

The database layer is fully prepared:
- Per-user connection storage with encrypted token management
- Event tracking with conflict detection (ETag support)
- Sync state monitoring with error tracking
- Webhook metadata for push notification renewal

Next plans will build OAuth flows, sync workers, and UI on top of this foundation.

---
*Phase: 11-calendar-integration*
*Completed: 2026-02-14*

## Self-Check: PASSED

All key files verified:
- packages/shared/src/types/calendar.ts: FOUND
- All commits present in git history:
  - 8445bd5: Task 1 (calendar types and CASL)
  - de3b110: Task 2 (Drizzle schema and provisioning)
