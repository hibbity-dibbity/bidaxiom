---
phase: 08-quickbooks-integration
plan: 04
subsystem: integrations
tags: [trpc, webhooks, worker, quickbooks]
completed: 2026-02-13

# Dependency Graph
requires:
  - phase: 08-01
    provides: QBO database schema, CASL permissions
  - phase: 08-02
    provides: OAuth helpers, encryption, queue, client factory
provides:
  - QuickBooks tRPC router with 8 procedures
  - CloudEvents webhook handler
  - OAuth callback route
  - Sync worker auto-startup
affects:
  - Frontend will consume tRPC quickbooks endpoints
  - QBO webhooks will trigger sync jobs via CloudEvents format
  - Server boot process includes worker initialization

# Tech Stack
added: []
patterns:
  - Admin-only QBO management with CASL
  - OAuth callback redirect pattern (API -> frontend -> tRPC)
  - CloudEvents webhook format (MANDATORY as of May 15, 2026)
  - Non-fatal worker startup (graceful degradation if Redis unavailable)

# Key Files
created:
  - apps/api/src/trpc/routers/quickbooks.ts (8 procedures)
  - apps/api/src/integrations/quickbooks/webhooks.ts (CloudEvents handler)
modified:
  - apps/api/src/trpc/router.ts (registered quickbooks router)
  - apps/api/src/webhooks/routes.ts (added QBO webhook + OAuth callback routes)
  - apps/api/src/server.ts (worker startup on boot)

# Key Decisions
decisions:
  - name: OAuth callback redirect pattern
    rationale: QBO redirects to API, API redirects to frontend with code/realmId, frontend calls tRPC mutation. Keeps token exchange authenticated (user's Clerk session is active in browser).
    alternatives: Could handle token exchange entirely in API callback route, but would require session management separate from tRPC context.
    impact: Frontend needs a callback page at /settings/integrations/quickbooks/callback

  - name: Runtime null checks for tenant/abilities
    rationale: TypeScript doesn't know that authorizedProcedure guarantees non-null tenant/abilities. Follow project router pattern with explicit runtime checks.
    alternatives: Could use non-null assertions (!), but runtime checks are safer and match existing codebase patterns.
    impact: All procedures have 5-line boilerplate null check at start

  - name: Non-fatal worker startup
    rationale: Redis may not be running in all environments (local dev without Docker). Try/catch with warning lets API start without worker.
    alternatives: Could make worker startup required (fail hard if Redis unavailable), but reduces dev flexibility.
    impact: Developer can run API without Redis for non-QBO features

  - name: CloudEvents webhook format
    rationale: QuickBooks deprecated old webhook format. CloudEvents is MANDATORY as of May 15, 2026.
    alternatives: None - old format will stop working.
    impact: Webhook payload structure is different from legacy format (nested data.entities array)

# Performance
duration: 7 min
tasks_completed: 2
files_created: 2
files_modified: 3
commits: 2
---

# Phase 08 Plan 04: QuickBooks tRPC Router and Webhooks Summary

**One-liner:** tRPC router with 8 admin-controlled procedures, CloudEvents webhook handler with HMAC verification, OAuth callback redirect pattern, and auto-starting sync worker

## What Was Built

### Task 1: QuickBooks tRPC Router (Commit: b2d7108)

Created comprehensive tRPC router with 8 procedures:

1. **`getAuthUrl` (mutation, admin-only):**
   - Generates QuickBooks authorization URL
   - Checks for existing active connection (prevents duplicate connections)
   - Passes tenantId as state parameter for CSRF protection

2. **`handleCallback` (mutation, protected):**
   - Exchanges authorization code for access/refresh tokens
   - Validates state parameter matches tenantId
   - Encrypts refresh token with AES-256-GCM
   - Creates qbo_connections record
   - Initializes sync state for all 6 entity types
   - Audit logs connection event

3. **`disconnect` (mutation, admin-only):**
   - Updates connection status to 'disconnected'
   - Clears access token and encrypted refresh token
   - Audit logs disconnection event

4. **`getStatus` (query, admin + accountant):**
   - Returns connection metadata (realmId, companyName, status, lastSyncAt, environment)
   - Returns sync state for all entity types (lastSuccessfulSync, syncStatus, syncedCount, errorCount)
   - Returns `{ connected: false }` if no connection exists

5. **`getNotifications` (query, admin + accountant):**
   - Fetches up to 50 most recent sync notifications
   - Optional `includeDismissed` parameter (defaults to false)
   - Ordered by createdAt desc

6. **`dismissNotification` (mutation, admin-only):**
   - Sets `dismissed = true` for specific notification by UUID

7. **`dismissAllNotifications` (mutation, admin-only):**
   - Dismisses all undismissed notifications
   - Returns count of dismissed notifications

8. **`manualSync` (mutation, admin-only):**
   - Input: `entityType` enum (project, invoice, bill, all)
   - Verifies active QBO connection exists
   - Queries platform entities without QBO mappings
   - Queries platform entities WITH mappings (for updates)
   - Queues sync-to-qbo jobs in BullMQ
   - Updates qbo_sync_state to 'syncing'
   - Returns `{ jobsQueued: number }`

**Permission model:**
- Admin (org:admin): Full access to all 8 procedures
- Accountant (org:accountant): Read-only access to getStatus and getNotifications
- Other roles: No access

**Router registered in app router:** `quickbooks: quickbooksRouter`

### Task 2: Webhook Handler and Routes (Commit: 30d6b36)

**CloudEvents Webhook Handler (`webhooks.ts`):**
- Validates HMAC-SHA256 signature using QBO_WEBHOOK_VERIFIER_TOKEN
- Parses CloudEvents 1.0 payload with Zod schema
- Finds tenant by realmId (queries public.tenants, then checks each tenant's qbo_connections)
- Maps QBO entity names to platform types (Customer→project, Invoice→invoice, Bill→bill, Payment→payment, Vendor→vendor)
- Queues sync-from-qbo jobs for each entity in webhook
- Returns `{ processed: number }`

**Webhook Route (`/api/integrations/quickbooks/webhook`):**
- POST endpoint accepting CloudEvents payloads
- Raw body parser (already configured in webhook plugin)
- Signature verification via Intuit-Signature header
- Returns 401 for invalid signature, 500 for processing errors

**OAuth Callback Route (`/api/integrations/quickbooks/callback`):**
- GET endpoint accepting code, realmId, state query params
- Redirects to frontend: `${CORS_ORIGIN}/settings/integrations/quickbooks/callback?code=...&realmId=...&state=...`
- Frontend page will call tRPC `handleCallback` mutation with params

**Worker Startup (`server.ts`):**
- Imports `startQboSyncWorker` from sync/workers.ts
- Calls on server boot (after S3 bucket check)
- Non-fatal: try/catch with warning if Redis unavailable
- Logs "QBO sync worker started" on success

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**OAuth Flow:**
1. Admin clicks "Connect QuickBooks" → Frontend calls `quickbooks.getAuthUrl`
2. API returns QuickBooks authorization URL
3. User redirects to QBO, authorizes
4. QBO redirects to `GET /api/integrations/quickbooks/callback?code=...&realmId=...&state=tenantId`
5. API redirects to `${CORS_ORIGIN}/settings/integrations/quickbooks/callback?code=...&realmId=...&state=...`
6. Frontend page calls `quickbooks.handleCallback({ code, realmId, state })`
7. API exchanges code for tokens, stores encrypted refresh token, creates connection

**Webhook Flow:**
1. QBO sends CloudEvents payload to `POST /api/integrations/quickbooks/webhook`
2. API verifies HMAC signature
3. API finds tenant by realmId
4. API queues sync-from-qbo jobs in BullMQ
5. Worker processes jobs asynchronously (implemented in future plans)

**Manual Sync Flow:**
1. Admin triggers manual sync via `quickbooks.manualSync({ entityType: 'project' | 'invoice' | 'bill' | 'all' })`
2. API queries platform entities (with and without QBO mappings)
3. API queues sync-to-qbo jobs in BullMQ
4. API updates qbo_sync_state to 'syncing'
5. Returns count of jobs queued

## Verification Results

- [x] TypeScript compilation passes for quickbooks.ts and router.ts (no errors in my files)
- [x] 8 procedures: getAuthUrl, handleCallback, disconnect, getStatus, getNotifications, dismissNotification, dismissAllNotifications, manualSync
- [x] Admin-only permissions enforced via CASL `abilities.can("manage", "QuickBooks")`
- [x] Accountant read permissions via `abilities.can("read", "QuickBooks")`
- [x] Runtime null checks for tenant/abilities in all procedures
- [x] quickbooks router registered in appRouter
- [x] Webhook route at /api/integrations/quickbooks/webhook
- [x] OAuth callback route at /api/integrations/quickbooks/callback
- [x] Worker startup in server.ts with non-fatal error handling

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `QBO_WEBHOOK_VERIFIER_TOKEN` | HMAC key for webhook signature verification |
| `CORS_ORIGIN` | Frontend URL for OAuth callback redirect |
| `REDIS_HOST` | Redis server for BullMQ worker (default: localhost) |
| `REDIS_PORT` | Redis port for BullMQ worker (default: 6379) |

## Next Steps

**Plan 08-05 (Sync Engine):**
- Implement BullMQ worker processors for sync-to-qbo and sync-from-qbo jobs
- Entity mappers for project, invoice, bill, payment, vendor, customer
- Token refresh logic before API calls
- Sync notification creation on retry exhaustion

**Plan 08-06 (Frontend UI):**
- Connect/disconnect buttons in settings
- Connection status display with sync state table
- Sync notification list with dismiss actions
- Manual sync trigger buttons

## Self-Check: PASSED

**Created files exist:**
- FOUND: apps/api/src/trpc/routers/quickbooks.ts
- FOUND: apps/api/src/integrations/quickbooks/webhooks.ts

**Commits exist:**
- FOUND: b2d7108 (Task 1: QuickBooks tRPC router)
- FOUND: 30d6b36 (Task 2: Webhook handler and routes)

**Router verification:**
- FOUND: quickbooks router imported in apps/api/src/trpc/router.ts
- FOUND: quickbooks router registered in appRouter

**Webhook routes verification:**
- FOUND: handleQboWebhook imported in apps/api/src/webhooks/routes.ts
- FOUND: POST /api/integrations/quickbooks/webhook route registered
- FOUND: GET /api/integrations/quickbooks/callback route registered

**Worker startup verification:**
- FOUND: startQboSyncWorker imported in apps/api/src/server.ts
- FOUND: Worker startup call with try/catch

---

**Plan execution time:** 7 minutes
**Commits:** `b2d7108`, `30d6b36`
**Next plan:** 08-05 (QuickBooks Sync Engine)
