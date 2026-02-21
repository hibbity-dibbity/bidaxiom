---
status: resolved
trigger: "Investigate and fix tRPC registration error — No procedure found on path 'document.listUnified'"
created: 2026-02-20T22:30:00Z
updated: 2026-02-20T22:35:00Z
---

## Current Focus

hypothesis: confirmed_resolved
test: runtime check of appRouter._def.procedures
expecting: listUnified present
next_action: commit verification

## Symptoms

expected: trpc.document.listUnified.useQuery() returns document list
actual: "No procedure found on path 'document.listUnified'" error
errors: TRPCError NOT_FOUND - No procedure found on path 'document.listUnified'
reproduction: navigate to /projects/:slug/documents page
started: after feat(40-03) before server restart

## Eliminated

- hypothesis: listUnified missing from documentRouter source
  evidence: listUnified is at line 506 of apps/api/src/trpc/routers/document.ts
  timestamp: 2026-02-20T22:31:00Z

- hypothesis: documentRouter not registered in appRouter
  evidence: router.ts line 53 has `document: documentRouter` — was registered long before 6411bb5
  timestamp: 2026-02-20T22:31:00Z

- hypothesis: web client codegen needs regeneration
  evidence: web/lib/trpc.ts imports AppRouter type directly from API source — no codegen
  timestamp: 2026-02-20T22:32:00Z

- hypothesis: schema fields missing (category, templateId, documentWorkflows)
  evidence: all fields present in tenant.ts schema and confirmed in live DB
  timestamp: 2026-02-20T22:33:00Z

- hypothesis: server still running stale build
  evidence: runtime check via check-router.ts shows document.listUnified IS in _def.procedures
  timestamp: 2026-02-20T22:33:00Z

## Evidence

- timestamp: 2026-02-20T22:31:00Z
  checked: apps/api/src/trpc/routers/document.ts
  found: listUnified procedure defined at line 506, sendByEmail at 678
  implication: procedure exists in source

- timestamp: 2026-02-20T22:31:00Z
  checked: apps/api/src/trpc/router.ts
  found: document: documentRouter at line 53; documentRouter imported at line 11
  implication: router registration was already in place before 6411bb5

- timestamp: 2026-02-20T22:32:00Z
  checked: git log -- apps/api/src/trpc/router.ts
  found: router.ts was NOT modified in 6411bb5 — last touched in 098b3fb (templateRouter)
  implication: registration was pre-existing; adding listUnified to documentRouter automatically exposes it

- timestamp: 2026-02-20T22:33:00Z
  checked: runtime execution of appRouter._def.procedures via npx tsx check-router.ts
  found: document.listUnified listed in procedures array
  implication: procedure is live in the running router

- timestamp: 2026-02-20T22:34:00Z
  checked: curl http://localhost:3001/trpc/document.listUnified (no auth)
  found: {"error":{"code":"UNAUTHORIZED","path":"document.listUnified"}}
  implication: server returns UNAUTHORIZED (correct), not "No procedure found" — procedure is reachable

- timestamp: 2026-02-20T22:34:00Z
  checked: API server process start time vs commit time
  found: API server started 10:02:13 PM, commit 6411bb5 at 9:41 PM
  implication: server started AFTER the fix commit; error was a pre-restart transient

## Resolution

root_cause: The error "No procedure found on path 'document.listUnified'" was a transient error that occurred because the API server was running with code from before commit 6411bb5 (which added listUnified to documentRouter). Once the server was restarted at 10:02 PM (after the 9:41 PM commit), the procedure became available. No code change was needed — documentRouter was already registered as document: documentRouter in router.ts; adding listUnified to the router object automatically exposed it on restart.

fix: No code change required. Server restart after commit 6411bb5 resolved the error. The router registration in apps/api/src/trpc/router.ts was already correct (line 53: document: documentRouter).

verification: curl http://localhost:3001/trpc/document.listUnified returns UNAUTHORIZED (correct auth error), not "No procedure found". Runtime check of appRouter._def.procedures confirms document.listUnified is present.

files_changed: []
