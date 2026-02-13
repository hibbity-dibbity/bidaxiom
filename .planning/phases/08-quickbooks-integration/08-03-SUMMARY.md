---
phase: 08-quickbooks-integration
plan: 03
subsystem: integrations
tags: [quickbooks, sync, bullmq, cdc, conflict-resolution]

# Dependency graph
requires:
  - phase: 08-01
    provides: QBO schema tables (qbo_connections, qbo_sync_state, qbo_entity_mappings, qbo_sync_notifications)
  - phase: 08-02
    provides: OAuth flow, queue setup, QBO client helpers (createQboClient, promisifyQbo)
provides:
  - BullMQ worker that processes bidirectional sync jobs
  - Entity mappers for project/invoice/bill sync
  - SyncToken conflict detection and resolution
  - CDC fallback for daily change reconciliation
affects: [08-04-ui-and-manual-sync, 08-05-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tenant context pattern: worker builds db/schema once per job, passes to mappers"
    - "SyncToken conflict handling: fetch latest, mark as 'conflict', no auto-merge"
    - "Rate limiting: 400 jobs/min via BullMQ limiter, 10 concurrent workers"
    - "Error classification: rate limit/auth → retry, SyncToken conflict → no retry"
    - "CDC with 30-day lookback limit for daily reconciliation"

key-files:
  created:
    - apps/api/src/integrations/quickbooks/sync/workers.ts
    - apps/api/src/integrations/quickbooks/sync/mappers/project.ts
    - apps/api/src/integrations/quickbooks/sync/mappers/invoice.ts
    - apps/api/src/integrations/quickbooks/sync/mappers/bill.ts
    - apps/api/src/integrations/quickbooks/sync/mappers/index.ts
    - apps/api/src/integrations/quickbooks/sync/conflict.ts
    - apps/api/src/integrations/quickbooks/cdc.ts
  modified: []

key-decisions:
  - "Mappers accept db/schema from worker (not building own tenant context)"
  - "SyncToken conflicts marked for user review, not auto-merged (financial data safety)"
  - "Invoice mapper is placeholder until Phase 6 (Payment Applications) is complete"
  - "Commitments not auto-created from QBO bills (requires user-driven workflow)"
  - "Sync failures after retry exhaustion create notifications for UI polling"
  - "CDC queries QBO directly via makeApiCall (no dedicated CDC helper in node-quickbooks)"

patterns-established:
  - "Worker-to-mapper flow: worker builds tenant context once, passes db/schema to all mapper calls"
  - "Error classification pattern: distinguish retriable errors from user-action-required conflicts"
  - "Notification pattern: worker creates qboSyncNotifications records when retries exhausted"

# Metrics
duration: 5 min
completed: 2026-02-13
---

# Phase 8 Plan 3: Sync Engine and CDC Summary

**BullMQ worker processes bidirectional sync jobs with conflict detection, entity mappers for project/bill sync (invoice placeholder), and CDC fallback for daily reconciliation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-13T17:10:50Z
- **Completed:** 2026-02-13T17:16:34Z
- **Tasks:** 2
- **Files modified:** 7 (7 created, 0 modified)

## Accomplishments

- BullMQ worker processes sync-to-qbo and sync-from-qbo jobs with concurrency 10 and rate limit 400/min
- Entity mappers for project (Platform Project <-> QBO Customer) and bill (Platform Commitment <-> QBO Bill)
- SyncToken conflict detection and resolution (fetches latest, marks as 'conflict' for user review)
- CDC queries QBO for changes since last sync (30-day lookback limit) and queues sync jobs
- Worker creates sync failure notifications when retries exhausted (for UI polling in Plan 08-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create entity mappers and conflict resolution** - `adf22f1` (feat)
2. **Task 2: Create BullMQ sync worker and CDC fallback** - `80341ea` (feat)

**Plan metadata:** (pending - will be added in state update)

## Files Created/Modified

**Created:**
- `apps/api/src/integrations/quickbooks/sync/conflict.ts` - SyncToken conflict detection and handling
- `apps/api/src/integrations/quickbooks/sync/mappers/project.ts` - Project <-> QBO Customer bidirectional mapper
- `apps/api/src/integrations/quickbooks/sync/mappers/invoice.ts` - Invoice mapper placeholder (requires Phase 6)
- `apps/api/src/integrations/quickbooks/sync/mappers/bill.ts` - Bill <-> QBO Bill bidirectional mapper
- `apps/api/src/integrations/quickbooks/sync/mappers/index.ts` - Dispatcher routes jobs to appropriate mapper
- `apps/api/src/integrations/quickbooks/sync/workers.ts` - BullMQ worker with concurrency 10, rate limit 400/min
- `apps/api/src/integrations/quickbooks/cdc.ts` - CDC fallback for daily change reconciliation

## Decisions Made

**Mapper context pattern:** Worker builds tenant context once per job via `createTenantDb(schemaName)`, passes `db` and `schema` to mapper functions. Mappers stay pure and testable by not building their own context.

**SyncToken conflict handling:** When QBO returns error code 5010, worker fetches latest entity from QBO, updates mapping with new SyncToken, sets syncStatus to 'conflict'. Does NOT auto-merge — financial data conflicts must be reviewed by users per research guidance.

**Invoice mapper placeholder:** Phase 6 (Payment Applications) will define the invoice data model. Invoice mapper exports functions but logs "not yet implemented" to allow worker to route invoice jobs without crashing.

**Commitment creation from QBO:** Bills synced from QBO only update existing mapped commitments. Commitments are NOT auto-created from QBO bills because construction commitments require user-driven workflow.

**Notification pattern:** When sync job fails after all retries exhausted, worker creates record in `qbo_sync_notifications` table. UI polls this table (Plan 08-04) to alert users about sync failures requiring attention.

**CDC direct API call:** node-quickbooks lacks dedicated CDC helper, so CDC module uses `makeApiCall` directly with `/company/{realmId}/cdc` endpoint.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 08-04 (UI and Manual Sync). Sync engine is complete and ready for UI integration. UI will need to:
- Poll `qbo_sync_notifications` table for failure alerts
- Provide manual sync buttons that queue jobs via `qboSyncQueue.add()`
- Display sync status from `qbo_sync_state` table
- Show entity mappings from `qbo_entity_mappings` table with conflict indicators

---
*Phase: 08-quickbooks-integration*
*Completed: 2026-02-13*
