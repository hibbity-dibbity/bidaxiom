---
phase: 08-quickbooks-integration
plan: 02
subsystem: integrations
tags: [oauth, encryption, queue, quickbooks]
completed: 2026-02-13

# Dependency Graph
requires: []
provides:
  - QuickBooks OAuth 2.0 flow
  - Token encryption infrastructure
  - QBO API client factory
  - Sync job queue
affects:
  - Future QBO sync operations (all depend on these modules)

# Tech Stack
added:
  - intuit-oauth@4.2.2 (official Intuit OAuth 2.0 client)
  - node-quickbooks@2.0.48 (community QBO API wrapper)
  - bullmq@5.69.1 (Redis-based job queue)
  - ioredis@5.9.3 (Redis client)
patterns:
  - AES-256-GCM encryption for sensitive tokens
  - OAuth 2.0 with refresh token rotation
  - Exponential backoff retry strategy
  - Promise wrapper for callback-based APIs

# Key Files
created:
  - apps/api/src/integrations/quickbooks/crypto.ts (AES-256-GCM token encryption)
  - apps/api/src/integrations/quickbooks/oauth.ts (OAuth 2.0 flow functions)
  - apps/api/src/integrations/quickbooks/client.ts (QBO API client factory)
  - apps/api/src/integrations/quickbooks/queue.ts (BullMQ sync queue)
modified:
  - apps/api/package.json (added 4 dependencies)
  - package-lock.json (dependency tree)

# Key Decisions
decisions:
  - name: Use ConnectionOptions instead of IORedis instance for BullMQ
    rationale: Avoids version conflicts between app ioredis and BullMQ's bundled version
    alternatives: Could have pinned ioredis versions, but connection options pattern is cleaner
    impact: Queue and workers will share connection config, not instance

  - name: Use 'any' type for untyped OAuth/QB client libraries
    rationale: intuit-oauth and node-quickbooks have no TypeScript definitions
    alternatives: Could write custom .d.ts files, but would require reverse-engineering APIs
    impact: Limited type safety for OAuth/QB client calls, mitigated by well-typed wrapper functions

  - name: promisifyQbo helper for callback-style APIs
    rationale: node-quickbooks uses (err, result) callbacks; modern async/await is clearer
    alternatives: Could use util.promisify, but custom helper gives better type inference
    impact: All sync operations will use clean async/await syntax

# Performance
duration: 5 min
tasks_completed: 2
files_created: 4
files_modified: 2
---

# Phase 08 Plan 02: QuickBooks OAuth and Infrastructure Summary

**One-liner:** OAuth 2.0 flow with refresh token rotation, AES-256-GCM encryption, QBO API client factory (minorversion 75), and BullMQ queue with 5-attempt exponential backoff.

## What Was Built

Built the foundational integration infrastructure for QuickBooks Online:

1. **Token Encryption Module** (`crypto.ts`)
   - AES-256-GCM encryption/decryption for refresh tokens
   - 32-byte hex key from QBO_ENCRYPTION_KEY environment variable
   - Format: `iv:authTag:encrypted` (all hex-encoded)
   - Authenticated encryption prevents tampering

2. **OAuth Module** (`oauth.ts`)
   - `getQboAuthUrl(tenantId)`: Generate authorization URL with Accounting and OpenId scopes
   - `handleQboCallback(code, realmId, tenantId)`: Exchange code for access/refresh tokens
   - `refreshQboToken(encryptedRefreshToken)`: Refresh access token with rotation handling
   - CRITICAL: Returns new refresh token on refresh (old token becomes invalid)

3. **QBO API Client Factory** (`client.ts`)
   - `createQboClient(accessToken, realmId)`: Create configured QB API client
   - Enforces minorversion 75 (mandatory since Aug 2025 deprecation)
   - `promisifyQbo<T>()`: Wrapper to convert callback-style methods to Promises
   - Sandbox/production environment switching

4. **BullMQ Sync Queue** (`queue.ts`)
   - Job queue for all QBO sync operations
   - 5 retry attempts with exponential backoff (2s → 4s → 8s → 16s → 32s)
   - Retention: 100 completed jobs or 1 day, 500 failed jobs or 1 week
   - Job data type: `QboSyncJobData` with entity type, IDs, operation, sync reason

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed crypto module import for ESM compatibility**
- **Found during:** Task 1 compilation
- **Issue:** `import crypto from 'crypto'` fails with "Module has no default export"
- **Fix:** Changed to named imports: `import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'`
- **Files modified:** apps/api/src/integrations/quickbooks/crypto.ts
- **Commit:** 3d95080

**2. [Rule 3 - Blocking] Used ConnectionOptions instead of IORedis instance**
- **Found during:** Task 2 compilation
- **Issue:** BullMQ connection type error - IORedis version mismatch (app uses 5.9.3, BullMQ bundles 5.9.2)
- **Fix:** Changed from `new IORedis({...})` to `ConnectionOptions` config object
- **Files modified:** apps/api/src/integrations/quickbooks/queue.ts
- **Commit:** ae5f0b8
- **Rationale:** Avoids version conflicts; BullMQ creates its own connection from options

**3. [Rule 1 - Bug] Changed untyped library return types from 'typeof' to 'any'**
- **Found during:** Task 2 compilation
- **Issue:** TypeScript error on `typeof OAuthClient` and `typeof QuickBooks` for runtime values
- **Fix:** Changed return types to `any` since libraries lack type definitions
- **Files modified:** oauth.ts, client.ts
- **Commit:** ae5f0b8
- **Rationale:** intuit-oauth and node-quickbooks have no @types packages

## Integration Points

**Provides to downstream plans:**
- OAuth flow for connecting tenant accounts to QuickBooks
- Token encryption/decryption for secure storage
- QBO API client creation for sync operations
- Job queue for reliable async syncing

**Will be consumed by:**
- 08-03: QBO connection schema and tRPC endpoints (uses OAuth functions)
- 08-04: Sync workers (uses queue, client factory, promisifyQbo)
- 08-05: Webhook handlers (uses queue to enqueue sync jobs)

## Environment Variables Required

| Variable | Source | Purpose |
|----------|--------|---------|
| `QBO_CLIENT_ID` | Intuit Developer Portal → Keys & credentials | OAuth client ID |
| `QBO_CLIENT_SECRET` | Intuit Developer Portal → Keys & credentials | OAuth client secret |
| `QBO_ENCRYPTION_KEY` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 32-byte hex key for AES-256-GCM |
| `QBO_ENVIRONMENT` | Set to 'sandbox' or 'production' | QBO API environment |
| `API_URL` | Application base URL | OAuth redirect URI construction |
| `REDIS_HOST` | Redis server hostname (default: localhost) | BullMQ connection |
| `REDIS_PORT` | Redis server port (default: 6379) | BullMQ connection |

## Verification Results

- [x] All modules compile without errors (isolated module checks passed)
- [x] Dependencies installed: intuit-oauth@4.2.2, node-quickbooks@2.0.48, bullmq@5.69.1, ioredis@5.9.3
- [x] OAuth module exports: getQboAuthUrl, handleQboCallback, refreshQboToken
- [x] Crypto module exports: encryptToken, decryptToken
- [x] Client module exports: createQboClient, promisifyQbo
- [x] Queue module exports: qboSyncQueue, QboSyncJobData, redisConnection
- [x] Queue configured with 5 retries and exponential backoff (2s initial delay)
- [x] Client factory enforces minorversion 75

**Note:** Full `npx tsc --noEmit` shows TS7016 warnings for missing type definitions (expected). Individual module compilation passes cleanly.

## Next Steps

1. **Plan 08-03:** Create QBO connection database schema and tRPC endpoints
   - Schema: qbo_connections table with encrypted tokens, realmId, connection status
   - Endpoints: connect flow initiation, callback handler, disconnect, token refresh

2. **Plan 08-04:** Build sync workers
   - Worker setup using BullMQ with redisConnection
   - Implement sync logic for each entity type
   - Token refresh handling before API calls

3. **Plan 08-05:** Implement webhook handlers
   - Webhook signature verification
   - Parse entity change notifications
   - Enqueue sync jobs to qboSyncQueue

## Self-Check: PASSED

**Created files exist:**
- FOUND: apps/api/src/integrations/quickbooks/crypto.ts
- FOUND: apps/api/src/integrations/quickbooks/oauth.ts
- FOUND: apps/api/src/integrations/quickbooks/client.ts
- FOUND: apps/api/src/integrations/quickbooks/queue.ts

**Commits exist:**
- FOUND: 3d95080 (Task 1: dependencies and crypto module)
- FOUND: ae5f0b8 (Task 2: OAuth, client factory, queue)

**Dependencies installed:**
- FOUND: intuit-oauth@4.2.2
- FOUND: node-quickbooks@2.0.48
- FOUND: bullmq@5.69.1
- FOUND: ioredis@5.9.3
