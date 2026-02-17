---
phase: 23-api-server-will-not-load
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/server.ts
  - apps/api/src/integrations/quickbooks/queue.ts
  - apps/api/src/jobs/scheduled-reports.ts
autonomous: false
requirements: [QUICK-23]

must_haves:
  truths:
    - "API server starts successfully when PostgreSQL is unreachable"
    - "API server starts successfully when Redis is unreachable"
    - "API server starts successfully when MinIO is unreachable"
    - "Startup warnings are logged for each unavailable service (not silently swallowed)"
    - "Server reaches fastify.listen() and binds port even when external services are down"
  artifacts:
    - path: "apps/api/src/server.ts"
      provides: "Non-fatal startup for all external services"
      contains: "console.warn.*Auth table provisioning failed"
    - path: "apps/api/src/integrations/quickbooks/queue.ts"
      provides: "Lazy Queue instantiation to defer Redis connection"
    - path: "apps/api/src/jobs/scheduled-reports.ts"
      provides: "Lazy Queue instantiation to defer Redis connection"
  key_links:
    - from: "apps/api/src/server.ts"
      to: "provisionAuthTables"
      via: "try/catch with console.warn instead of process.exit(1)"
      pattern: "console\\.warn.*Auth table"
    - from: "apps/api/src/integrations/quickbooks/queue.ts"
      to: "new Queue"
      via: "lazy getter function — no module-level Queue instantiation"
      pattern: "getQboSyncQueue"
    - from: "apps/api/src/jobs/scheduled-reports.ts"
      to: "new Queue"
      via: "lazy getter function — no module-level Queue instantiation"
      pattern: "getScheduledReportsQueue"
---

<objective>
Make the API server resilient to missing external services at startup. Currently a PostgreSQL ECONNREFUSED during `provisionAuthTables` calls `process.exit(1)`, preventing the server from ever binding. Additionally, BullMQ Queue objects are instantiated at module-level in `queue.ts` and `scheduled-reports.ts`, causing Redis connection attempts at import time — before any try/catch in server.ts can help.

Purpose: The server should always reach fastify.listen() with degraded functionality and clear warning messages when services are absent, rather than hard-crashing.
Output: Server starts and binds port 3001 in all service-availability combinations.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/api/src/server.ts
@apps/api/src/integrations/quickbooks/queue.ts
@apps/api/src/jobs/scheduled-reports.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make provisionAuthTables non-fatal in server.ts</name>
  <files>apps/api/src/server.ts</files>
  <action>
In server.ts, find the provisionAuthTables try/catch block (currently lines 73-80):

  try {
    await provisionAuthTables(pool);
  } catch (err) {
    console.error("Auth table provisioning failed:", err);
    // This is fatal - auth won't work without these tables
    process.exit(1);
  }

Replace it with a non-fatal warning that continues startup:

  try {
    await provisionAuthTables(pool);
  } catch (err) {
    // Non-fatal: tables already exist in production, or Postgres is temporarily unavailable.
    // Auth endpoints will fail at request time if DB is unreachable, not at startup.
    console.warn("Auth table provisioning failed (PostgreSQL may not be running):", (err as Error).message);
  }

Remove the process.exit(1) call and the "This is fatal" comment. Log err.message (not the full error object) to keep startup output clean — the stack trace adds no actionable info here. No other changes to server.ts.
  </action>
  <verify>
Confirm process.exit(1) is gone from the provisionAuthTables block:
  grep -n "process.exit" apps/api/src/server.ts
Should show zero results, or only results in the graceful shutdown handler and the fastify.listen catch (both of which are legitimate).

Confirm the warn line exists:
  grep -n "Auth table provisioning failed" apps/api/src/server.ts
Should show console.warn on that line.
  </verify>
  <done>
process.exit(1) removed from provisionAuthTables catch block. The catch logs a console.warn with the error message and execution continues. Server startup proceeds past this point even when PostgreSQL is unreachable.
  </done>
</task>

<task type="auto">
  <name>Task 2: Lazy-initialize BullMQ Queues to defer Redis connections</name>
  <files>
    apps/api/src/integrations/quickbooks/queue.ts
    apps/api/src/jobs/scheduled-reports.ts
  </files>
  <action>
Root cause: new Queue(...) at module-level in both files causes BullMQ to attempt a Redis connection the instant these modules are imported. This happens before server.ts can do anything — the try/catch around startQboSyncWorker() only guards the function call, not the module-level Queue constructor that already ran on import.

Fix for apps/api/src/integrations/quickbooks/queue.ts:

Step 1 — Find all callers of qboSyncQueue in the codebase:
  grep -rn "qboSyncQueue" apps/api/src/ --include="*.ts"

Step 2 — Replace the module-level export const qboSyncQueue = new Queue(...) with a lazy getter function. Keep all the same Queue configuration options, just move them inside the function:

  let _qboSyncQueue: Queue<QboSyncJobData> | null = null;

  export function getQboSyncQueue(): Queue<QboSyncJobData> {
    if (!_qboSyncQueue) {
      _qboSyncQueue = new Queue<QboSyncJobData>('qbo-sync', {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100, age: 86400 },
          removeOnFail: { count: 500, age: 604800 },
        },
      });
    }
    return _qboSyncQueue;
  }

Step 3 — Update every caller found in step 1: change import { qboSyncQueue } to import { getQboSyncQueue } and change qboSyncQueue.add(...) to getQboSyncQueue().add(...). Do not leave the old const export — remove it entirely.

Fix for apps/api/src/jobs/scheduled-reports.ts:

Same pattern. Find callers first:
  grep -rn "scheduledReportsQueue" apps/api/src/ --include="*.ts"

Replace the module-level export const scheduledReportsQueue = new Queue(...) (around line 42) with:

  let _scheduledReportsQueue: Queue<ScheduledReportJobData> | null = null;

  export function getScheduledReportsQueue(): Queue<ScheduledReportJobData> {
    if (!_scheduledReportsQueue) {
      _scheduledReportsQueue = new Queue<ScheduledReportJobData>('scheduled-reports', {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 50, age: 86400 },
          removeOnFail: { count: 200, age: 604800 },
        },
      });
    }
    return _scheduledReportsQueue;
  }

Update all callers similarly.

Note: startScheduledReportsWorker() and startQboSyncWorker() already create new Worker(...) inside the function body — those are fine as-is and need no changes.
  </action>
  <verify>
1. No top-level new Queue calls remain in either file:
     grep -n "new Queue" apps/api/src/integrations/quickbooks/queue.ts
     grep -n "new Queue" apps/api/src/jobs/scheduled-reports.ts
   Both should show new Queue only inside the getter function body, not at the module top level.

2. All callers updated — no remaining imports of the old names:
     grep -rn "import.*qboSyncQueue[^)G]" apps/api/src/ --include="*.ts"
     grep -rn "import.*scheduledReportsQueue[^)G]" apps/api/src/ --include="*.ts"
   Should return no results (old const-style imports replaced with getter imports).

3. TypeScript compiles clean:
     cd apps/api && npx tsc --noEmit 2>&1 | head -30
   Should show no errors.
  </verify>
  <done>
Both queue files export lazy getter functions. No new Queue(...) executes at import time. All callers updated to use the getter. TypeScript compiles without errors.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - provisionAuthTables failure is now a console.warn, not process.exit(1)
    - BullMQ Queue instantiation deferred until first getter call (no Redis connection at import time)
    - API server should reach port binding even with all external services down
  </what-built>
  <how-to-verify>
    1. Stop PostgreSQL, Redis, and MinIO locally (or simply run without them started).
    2. Start the API server:
         cd apps/api && npm run dev
    3. Confirm the server reaches the line: "API server running at http://localhost:3001"
    4. Confirm warning messages appear for each unavailable service — they should say:
         - "Auth table provisioning failed (PostgreSQL may not be running): ..."
         - "S3 bucket initialization failed (MinIO may not be running): ..."
         - "QBO sync worker failed to start (Redis may not be running): ..."
         - "Scheduled reports worker failed to start (Redis may not be running): ..."
    5. Confirm the health check responds:
         curl http://localhost:3001/health
       Expected: {"status":"ok","timestamp":"...","version":"0.0.1"}
    6. Restart with all services running and confirm normal startup (no regressions).
  </how-to-verify>
  <resume-signal>Type "approved" if server starts cleanly with services down, or describe what failed.</resume-signal>
</task>

</tasks>

<verification>
- [ ] process.exit(1) removed from provisionAuthTables catch block in server.ts
- [ ] Both queue files use lazy getter pattern — no module-level new Queue() calls
- [ ] All callers of the old queue exports updated to use getter functions
- [ ] TypeScript compiles without errors
- [ ] Server starts and binds port 3001 with external services unavailable
- [ ] Health check at /health returns 200 OK
- [ ] Warning messages are informative (include error message, identify which service)
- [ ] No regressions when services ARE running
</verification>

<success_criteria>
Running npm run dev in apps/api completes startup and logs "API server running at http://localhost:3001" regardless of whether PostgreSQL, Redis, or MinIO are reachable. Each unavailable service produces a console.warn identifying the service. The /health endpoint responds with 200.
</success_criteria>

<output>
After completion, create .planning/quick/23-api-server-will-not-load/23-SUMMARY.md following the summary template.
</output>
