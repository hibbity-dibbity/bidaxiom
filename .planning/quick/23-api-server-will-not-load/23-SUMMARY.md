---
phase: quick
plan: "23"
type: quick-task
subsystem: api-server
tags: [startup-resilience, redis, postgresql, minio, bullmq]
dependency_graph:
  requires: []
  provides: [graceful-startup-without-external-services]
  affects: [apps/api/src/server.ts, apps/api/src/integrations/quickbooks/queue.ts, apps/api/src/jobs/scheduled-reports.ts]
tech_stack:
  added: []
  patterns: [lazy-initialization, non-fatal-startup]
key_files:
  modified:
    - apps/api/src/server.ts
    - apps/api/src/integrations/quickbooks/queue.ts
    - apps/api/src/integrations/quickbooks/webhooks.ts
    - apps/api/src/integrations/quickbooks/cdc.ts
    - apps/api/src/integrations/quickbooks/sync/workers.ts
    - apps/api/src/trpc/routers/quickbooks.ts
    - apps/api/src/jobs/scheduled-reports.ts
    - apps/api/src/trpc/routers/report-schedule.ts
decisions:
  - "Non-fatal provisionAuthTables: console.warn instead of process.exit(1) — auth endpoints fail at request time, not startup"
  - "Lazy BullMQ queue getters: defer Redis connection until first queue.add() call so server starts without Redis running"
metrics:
  duration: "~15 min"
  completed: "2026-02-17"
  tasks: 3
  files: 8
---

# Quick Task 23: API Server Will Not Load — Summary

**One-liner:** Made all external-service connections (PostgreSQL auth provisioning, Redis/BullMQ queues) non-fatal at startup so the API server starts gracefully when Redis/PostgreSQL/MinIO are unavailable.

## What Was Done

### Problem

The API server crashed at startup whenever Redis, PostgreSQL, or MinIO were not running. Two root causes:

1. `provisionAuthTables()` failure in `server.ts` called `process.exit(1)` — immediately killing the process if PostgreSQL was unreachable during the startup sequence.
2. `qboSyncQueue` and `scheduledReportsQueue` were module-level constants instantiated with `new Queue()` at import time, establishing Redis connections immediately when the modules were loaded — before any request arrived.

### Fix 1: Non-fatal provisionAuthTables (Task 1)

In `apps/api/src/server.ts`, changed the `provisionAuthTables` catch block from:

```ts
// Before
process.exit(1);

// After
console.warn("Auth table provisioning failed (PostgreSQL may not be running):", (err as Error).message);
```

Auth table provisioning uses `CREATE TABLE IF NOT EXISTS` — it's idempotent and only matters once (first run). If PostgreSQL is unavailable at startup, auth endpoints will fail at request time with a proper error rather than crashing the whole server.

### Fix 2: Lazy BullMQ Queue Initialization (Task 2)

In both `apps/api/src/integrations/quickbooks/queue.ts` and `apps/api/src/jobs/scheduled-reports.ts`, replaced module-level `export const queue = new Queue(...)` with a lazy getter pattern:

```ts
// Before (connects to Redis at import time)
export const qboSyncQueue = new Queue<QboSyncJobData>('qbo-sync', { connection: redisConnection, ... });

// After (defers connection until first use)
let _qboSyncQueue: Queue<QboSyncJobData> | null = null;
export function getQboSyncQueue(): Queue<QboSyncJobData> {
  if (!_qboSyncQueue) {
    _qboSyncQueue = new Queue<QboSyncJobData>('qbo-sync', { connection: redisConnection, ... });
  }
  return _qboSyncQueue;
}
```

All callers updated (`webhooks.ts`, `cdc.ts`, `sync/workers.ts`, `trpc/routers/quickbooks.ts`, `trpc/routers/report-schedule.ts`) to call `getQboSyncQueue()` / `getScheduledReportsQueue()` instead of the old named constants.

## Commits

| Hash | Message |
|------|---------|
| 7959fa4 | fix(quick-23): make provisionAuthTables non-fatal in server.ts |
| b3ba3c1 | fix(quick-23): lazy-initialize BullMQ queues to defer Redis connections |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

Human-verified: server starts cleanly with PostgreSQL/Redis/MinIO down. Health check at `/health` returns 200. Normal startup confirmed with all services running (no regressions).

## Self-Check: PASSED

- [x] apps/api/src/server.ts — modified (non-fatal provisionAuthTables)
- [x] apps/api/src/integrations/quickbooks/queue.ts — modified (lazy getter)
- [x] apps/api/src/jobs/scheduled-reports.ts — modified (lazy getter)
- [x] All callers updated (webhooks.ts, cdc.ts, workers.ts, quickbooks.ts router, report-schedule.ts router)
- [x] Commit 7959fa4 exists
- [x] Commit b3ba3c1 exists
- [x] Zero TypeScript errors in modified files
