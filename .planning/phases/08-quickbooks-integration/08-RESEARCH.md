# Phase 8: QuickBooks Integration - Research

**Researched:** 2026-02-12
**Domain:** QuickBooks Online API Integration, OAuth 2.0, Bi-directional Sync
**Confidence:** HIGH

## Summary

QuickBooks Online (QBO) integration requires implementing OAuth 2.0 authorization flow, bi-directional data synchronization between the construction management platform and QBO, and robust error handling with retry mechanisms. The integration must handle three critical patterns: OAuth token lifecycle management (tokens expire hourly, refresh tokens expire in 101 days with rotation), change detection via webhooks (migrating to CloudEvents format by May 15, 2026) supplemented by Change Data Capture (CDC) API for missed events, and conflict resolution using SyncToken-based optimistic locking.

Key architectural decisions: Use official `intuit-oauth` package for OAuth flow, `node-quickbooks` for API operations, BullMQ with Redis for job queue (retry logic for sync failures), and store encrypted OAuth tokens in tenant schema. QBO has strict rate limits (500 requests/minute, 10 concurrent max) requiring exponential backoff retry strategy. The platform must track sync state per entity type with last successful sync timestamp and maintain bidirectional mapping between internal IDs and QBO entity IDs.

**Primary recommendation:** Implement sync queue with BullMQ for reliable background processing, use webhooks (CloudEvents format) for real-time change detection with daily CDC fallback calls, store per-tenant QBO connection state in tenant schema with AES-encrypted refresh tokens, and implement SyncToken-based optimistic locking for conflict detection.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `intuit-oauth` | Latest (3.x+) | OAuth 2.0 client for QBO | Official Intuit OAuth library, handles token creation/refresh, ID token validation |
| `node-quickbooks` | Latest (4.x+) | QuickBooks Online API wrapper | Community standard, comprehensive entity support, OAuth2-compatible, active maintenance |
| `bullmq` | Latest (5.x+) | Redis-based job queue | Production-grade queue system with built-in retry, scheduling, concurrency control, persistence |
| `ioredis` | Latest (5.x+) | Redis client | Required by BullMQ, high-performance, cluster support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@bull-board/api` + `@bull-board/fastify` | Latest | Queue monitoring dashboard | Development and production monitoring of sync jobs |
| `zod` | Already in stack | Webhook payload validation | Validate CloudEvents webhook structure before processing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node-quickbooks` | Direct Axios/Fetch calls | More control but lose type safety, must implement pagination, error handling, rate limiting manually |
| BullMQ | `pg-boss` (Postgres-based queue) | Fewer dependencies but slower, less feature-rich, no built-in dashboard |
| Webhooks + CDC | Polling only | Simpler but higher API usage, slower sync, still need CDC for reliability |

**Installation:**
```bash
npm install intuit-oauth node-quickbooks bullmq ioredis
npm install -D @bull-board/api @bull-board/fastify
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── integrations/
│   └── quickbooks/
│       ├── oauth.ts              # OAuth flow: authorize URL, token exchange, refresh
│       ├── client.ts             # QBO API client factory (per-tenant)
│       ├── sync/
│       │   ├── queue.ts          # BullMQ queue setup
│       │   ├── workers.ts        # Sync job processors
│       │   ├── mappers/          # Entity mapping logic
│       │   │   ├── project.ts    # Project <-> Customer/Job
│       │   │   ├── invoice.ts    # Invoice <-> Invoice
│       │   │   └── bill.ts       # Bill <-> Bill
│       │   └── conflict.ts       # SyncToken conflict resolution
│       ├── webhooks.ts           # CloudEvents webhook handler
│       └── cdc.ts                # Change Data Capture polling
├── db/schema/
│   └── tenant.ts                 # Add qbo_connections, qbo_sync_state, qbo_entity_mappings
└── trpc/routers/
    └── quickbooks.ts             # tRPC endpoints: connect, disconnect, syncStatus, manualSync
```

### Pattern 1: OAuth Token Lifecycle Management

**What:** QBO access tokens expire in 1 hour, refresh tokens expire in 101 days with rotation (each refresh returns new refresh token, invalidating previous).

**When to use:** All QBO API operations must check token expiration before making requests.

**Example:**
```typescript
// Source: https://github.com/intuit/oauth-jsclient
import OAuthClient from 'intuit-oauth';

// Initialize OAuth client (per request, using tenant config)
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID!,
  clientSecret: process.env.QBO_CLIENT_SECRET!,
  environment: process.env.QBO_ENVIRONMENT || 'sandbox',
  redirectUri: `${process.env.API_URL}/api/integrations/quickbooks/callback`,
  logging: true,
});

// Step 1: Generate authorization URL (user clicks to connect QBO)
const authUri = oauthClient.authorizeUri({
  scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
  state: tenantId, // Pass tenant ID to link connection after callback
});

// Step 2: Exchange authorization code for tokens (in callback route)
const authResponse = await oauthClient.createToken(code);
const tokens = authResponse.getToken();
// tokens = { access_token, refresh_token, expires_in: 3600, x_refresh_token_expires_in: 8726400 (101 days) }

// Store ENCRYPTED refresh_token in DB (tenant schema: qbo_connections table)
await storeEncryptedTokens(tenantId, tokens);

// Step 3: Refresh token before API calls (in API client factory)
async function getValidToken(tenantId: string) {
  const connection = await getQboConnection(tenantId);

  // Check if access token expired (1 hour)
  const tokenAge = Date.now() - connection.tokenUpdatedAt.getTime();
  if (tokenAge < 3500000) { // 58 minutes (buffer)
    return connection.accessToken; // Still valid
  }

  // Refresh token
  oauthClient.token.refresh_token = await decryptToken(connection.encryptedRefreshToken);
  const authResponse = await oauthClient.refresh();
  const newTokens = authResponse.getToken();

  // CRITICAL: Store NEW refresh_token (old one is now invalid)
  await updateEncryptedTokens(tenantId, newTokens);

  return newTokens.access_token;
}
```

**Critical notes:**
- ALWAYS store the new refresh_token from refresh() call - old one becomes invalid
- 2026 policy change: response includes `x_refresh_token_expires_in` field (101 days in seconds)
- Reconnect URL field (in developer portal) becomes mandatory in January 2026

### Pattern 2: Bi-directional Sync with Conflict Resolution

**What:** Sync entities between platform and QBO using SyncToken for optimistic locking. QBO returns SyncToken with every entity; updates require current SyncToken or fail.

**When to use:** All entity updates (projects, invoices, bills). Use sparse updates to only send changed fields.

**Example:**
```typescript
// Source: https://github.com/mcohen01/node-quickbooks
import QuickBooks from 'node-quickbooks';

// Create QB client (after getting valid access token)
const qbo = new QuickBooks({
  clientId: process.env.QBO_CLIENT_ID!,
  clientSecret: process.env.QBO_CLIENT_SECRET!,
  token: accessToken,
  realmId: connection.realmId, // QBO company ID from OAuth callback
  useSandbox: process.env.QBO_ENVIRONMENT === 'sandbox',
  debug: false,
  minorversion: 75, // Mandatory as of Aug 1, 2025 (v1-74 deprecated)
});

// Sparse update (only send changed fields + SyncToken)
async function syncProjectToQbo(projectId: string) {
  const project = await getProject(projectId);
  const mapping = await getQboMapping(projectId, 'project');

  if (!mapping) {
    // Create new customer in QBO
    const customer = await qbo.createCustomer({
      DisplayName: project.name,
      CompanyName: project.name,
      PrimaryEmailAddr: { Address: project.contactEmail },
      // Store our project ID in custom field (requires Premium API)
      CustomField: [{ DefinitionId: 'platform_project_id', StringValue: projectId }],
    });

    // Store bidirectional mapping
    await createQboMapping({
      tenantId: project.tenantId,
      entityType: 'project',
      platformId: projectId,
      qboId: customer.Id,
      qboSyncToken: customer.SyncToken, // Store for next update
    });

    return customer;
  }

  // Update existing customer (sparse mode)
  try {
    const updated = await qbo.updateCustomer({
      Id: mapping.qboId,
      SyncToken: mapping.qboSyncToken, // Required for optimistic locking
      sparse: true, // Only update specified fields
      DisplayName: project.name,
    });

    // Update stored SyncToken
    await updateQboMapping(mapping.id, { qboSyncToken: updated.SyncToken });

    return updated;
  } catch (err) {
    if (err.Fault?.Error?.[0]?.code === '5010') {
      // Stale SyncToken - entity was modified in QBO
      // Fetch latest from QBO and resolve conflict
      const fresh = await qbo.getCustomer(mapping.qboId);
      await handleConflict({
        entityType: 'project',
        platformData: project,
        qboData: fresh,
        mapping,
      });
      throw new Error('Conflict detected - retry after resolution');
    }
    throw err;
  }
}
```

### Pattern 3: Webhook + CDC Hybrid Change Detection

**What:** Use CloudEvents webhooks for real-time change notifications, with daily CDC fallback to catch missed events.

**When to use:** All QBO integrations. Webhooks provide instant sync, CDC ensures no data loss.

**Example:**
```typescript
// Webhook handler (CloudEvents format - MANDATORY by May 15, 2026)
// Source: https://blogs.intuit.com/2025/11/12/upcoming-change-to-webhooks-payload-structure/
import { z } from 'zod';

const cloudEventSchema = z.object({
  specversion: z.literal('1.0'),
  type: z.string(), // e.g., 'com.intuit.quickbooks.accounting.invoice.create'
  source: z.string(),
  id: z.string(),
  time: z.string(),
  datacontenttype: z.literal('application/json'),
  data: z.object({
    realmId: z.string(),
    entities: z.array(z.object({
      name: z.string(), // e.g., 'Invoice'
      id: z.string(),
      operation: z.enum(['Create', 'Update', 'Delete', 'Void']),
      lastUpdated: z.string(),
    })),
  }),
});

export async function handleQboWebhook(payload: unknown, signature: string) {
  // Verify webhook signature (Intuit-Signature header)
  const isValid = verifyIntuitWebhookSignature(payload, signature);
  if (!isValid) throw new Error('Invalid webhook signature');

  const event = cloudEventSchema.parse(payload);
  const { realmId, entities } = event.data;

  // Find tenant by realmId
  const connection = await getQboConnectionByRealmId(realmId);
  if (!connection) {
    console.warn(`Webhook for unknown realmId: ${realmId}`);
    return;
  }

  // Queue sync jobs for each entity
  for (const entity of entities) {
    await qboSyncQueue.add('sync-from-qbo', {
      tenantId: connection.tenantId,
      entityType: entity.name.toLowerCase(), // 'invoice', 'bill', etc.
      qboId: entity.id,
      operation: entity.operation,
    });
  }
}

// CDC fallback (run daily via cron)
// Source: https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/change-data-capture
async function runDailyCdc(tenantId: string) {
  const connection = await getQboConnection(tenantId);
  const syncState = await getQboSyncState(tenantId);

  // Query changes since last successful sync (or last 24h if first run)
  const changedSince = syncState.lastSuccessfulSync || new Date(Date.now() - 86400000);

  const qbo = await createQboClient(tenantId);

  // CDC endpoint: comma-separated entities
  const entities = 'Customer,Invoice,Bill,Payment';
  const cdcResult = await qbo.reportChangeDataCapture({
    entities,
    changedSince: changedSince.toISOString(),
  });

  // Queue sync jobs for changed entities
  for (const [entityType, items] of Object.entries(cdcResult)) {
    for (const item of items as Array<{ Id: string }>) {
      await qboSyncQueue.add('sync-from-qbo', {
        tenantId,
        entityType: entityType.toLowerCase(),
        qboId: item.Id,
        operation: 'Update', // CDC doesn't specify operation
      });
    }
  }

  // Update sync state
  await updateQboSyncState(tenantId, { lastSuccessfulSync: new Date() });
}
```

### Pattern 4: BullMQ Sync Queue with Retry

**What:** Process sync jobs asynchronously with exponential backoff retry for failures.

**When to use:** All sync operations (webhooks, CDC, manual sync).

**Example:**
```typescript
// Source: https://docs.bullmq.io
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required for BullMQ
});

// Create queue
export const qboSyncQueue = new Queue('qbo-sync', {
  connection,
  defaultJobOptions: {
    attempts: 5, // Retry up to 5 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 500 }, // Keep last 500 failed jobs
  },
});

// Create worker
const qboSyncWorker = new Worker(
  'qbo-sync',
  async (job) => {
    const { tenantId, entityType, qboId, operation } = job.data;

    try {
      // Rate limit: max 500 req/min, 10 concurrent
      await rateLimiter.acquire(tenantId);

      // Sync entity from QBO to platform
      if (job.name === 'sync-from-qbo') {
        await syncFromQbo(tenantId, entityType, qboId, operation);
      }

      // Sync entity from platform to QBO
      if (job.name === 'sync-to-qbo') {
        await syncToQbo(tenantId, entityType, job.data.platformId);
      }

      // Update last successful sync timestamp
      await updateQboSyncState(tenantId, {
        [`last${entityType}Sync`]: new Date(),
      });

    } catch (err) {
      // Check if error is retryable
      if (isRateLimitError(err)) {
        // QBO rate limit - wait longer
        throw new Error('RATE_LIMIT'); // Will retry with backoff
      }

      if (isAuthError(err)) {
        // Token expired - refresh and retry
        await refreshQboToken(tenantId);
        throw new Error('TOKEN_REFRESH'); // Retry immediately
      }

      if (isSyncTokenConflict(err)) {
        // Optimistic lock failure - needs manual resolution
        await notifyUserOfConflict(tenantId, entityType, qboId);
        throw err; // Don't retry - user must resolve
      }

      throw err; // Other errors - retry with backoff
    }
  },
  {
    connection,
    concurrency: 10, // Process 10 jobs concurrently (respects QBO limit)
    limiter: {
      max: 400, // Max 400 jobs per minute (buffer under 500 limit)
      duration: 60000,
    },
  }
);

// Handle worker events
qboSyncWorker.on('completed', (job) => {
  console.log(`Sync job ${job.id} completed`);
});

qboSyncWorker.on('failed', (job, err) => {
  console.error(`Sync job ${job?.id} failed:`, err);

  // After all retries exhausted, notify user
  if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
    notifyUserOfSyncFailure(job.data.tenantId, job.data.entityType, err);
  }
});
```

### Anti-Patterns to Avoid

- **Storing unencrypted refresh tokens**: QBO refresh tokens grant full account access for 101 days. MUST encrypt at rest (AES-256) with per-tenant keys.
- **Ignoring SyncToken updates**: Every QBO API response includes updated SyncToken. If not stored, next update will fail with stale version error.
- **Polling without CDC**: Querying all entities every N minutes wastes rate limit quota. Use webhooks + CDC instead.
- **Not handling token rotation**: Each refresh() call returns NEW refresh token - old one becomes invalid immediately.
- **Hardcoding minorversion < 75**: Versions 1-74 are deprecated (Aug 1, 2025). Always use minorversion 75+.
- **Syncing during QBO maintenance windows**: QBO has scheduled maintenance. Implement circuit breaker pattern to pause sync during outages.
- **Not tracking per-entity sync state**: Must track last successful sync timestamp per entity type (customers, invoices, bills) for CDC queries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 flow | Custom token exchange/refresh | `intuit-oauth` | Handles token rotation, ID validation, scope management, error codes; missing rotation logic causes auth failures |
| API pagination | Manual STARTPOSITION loops | `node-quickbooks` query helpers | QBO uses offset pagination (max 1000 results); manual loops risk infinite loops, duplicate records |
| Rate limiting | Custom request throttling | BullMQ limiter + Redis | QBO has per-minute (500) AND concurrent (10) limits; naive throttling misses concurrent limit |
| Webhook signature verification | Custom crypto verification | Intuit webhook SDK (if available) or verify against Intuit docs | Signature scheme may change; custom implementation breaks on updates |
| Entity conflict resolution | Auto-merge strategies | User-facing conflict UI | Financial data conflicts MUST be human-reviewed; auto-merge risks incorrect GL entries |
| Token encryption | Custom AES implementation | `crypto.createCipheriv` with per-tenant keys in KMS/env | Key management, IV generation, padding errors - use proven patterns |
| Job retry logic | setTimeout loops | BullMQ retry + backoff | Retry state persistence, backoff calculation, dead-letter queue - complex to get right |

**Key insight:** QuickBooks integration has deep edge cases (token rotation, SyncToken versioning, rate limit combinations, CloudEvents migration). Community libraries (intuit-oauth, node-quickbooks) encode years of production battle-testing. Custom implementations will hit undocumented quirks and break on QBO API changes.

## Common Pitfalls

### Pitfall 1: Refresh Token Rotation Not Handled

**What goes wrong:** Store initial refresh token, use it multiple times, then it stops working (401 errors).

**Why it happens:** QBO rotates refresh tokens on EVERY refresh call. Each refresh() returns a new refresh_token and invalidates the previous one. If you don't store the new token, you're locked out until user re-authorizes.

**How to avoid:**
- ALWAYS overwrite stored refresh_token with the new one from refresh() response
- Use database transactions to ensure token update happens atomically with sync operation
- Add `tokenUpdatedAt` timestamp to track token freshness
- Implement token refresh lock (mutex) to prevent concurrent refresh calls

**Warning signs:**
- 401 errors after successful refresh calls
- Refresh token works once, then fails
- Users must re-authorize frequently

### Pitfall 2: CloudEvents Webhook Migration Missed

**What goes wrong:** Webhooks stop working after May 15, 2026. Integration breaks silently until daily CDC runs.

**Why it happens:** Intuit is migrating webhook payload format from legacy to CloudEvents (1.0 spec). Old format will be disabled May 15, 2026. Apps not updated will lose real-time sync.

**How to avoid:**
- Update webhook handler to parse CloudEvents schema (see Pattern 3)
- Test in sandbox environment (migration toggle available in developer portal)
- Update SDK if using official SDKs:
  - Java SDK 6.5.2+
  - PHP SDK 6.2.2+
  - .Net SDK 14.7.3+
- Subscribe to Intuit Developer blog for migration updates

**Warning signs:**
- Webhook payload structure doesn't match CloudEvents spec
- No `specversion: "1.0"` field in webhook body
- Webhooks return 200 but sync jobs don't enqueue

### Pitfall 3: SyncToken Stale from Concurrent Edits

**What goes wrong:** User edits project in platform, sync job tries to update QBO, gets "Stale object error" (5010).

**Why it happens:** QBO uses optimistic locking via SyncToken. Every update increments SyncToken. If QBO entity was edited (in QBO UI or another app) between your fetch and update, your SyncToken is outdated.

**How to avoid:**
- Fetch latest entity before every update (don't cache for long)
- Catch error 5010, refetch entity, present conflict UI to user
- Don't auto-retry 5010 errors - can create update loops
- Store `lastSyncedAt` timestamp per entity to detect staleness

**Warning signs:**
- Error code 5010 in QBO API responses
- Update calls fail after successful creation
- Sync works in test but fails in production (more concurrent users)

### Pitfall 4: Rate Limit Underestimation

**What goes wrong:** Bulk sync jobs (100+ invoices) fail midway with 429 errors, leaving data partially synced.

**Why it happens:** QBO has TWO rate limits: 500 requests/minute AND 10 concurrent requests. Naive rate limiters only handle per-minute, missing concurrent limit. Batch operations hit concurrent limit first.

**How to avoid:**
- Use BullMQ concurrency setting (max 10 workers)
- Implement per-minute limiter (400/min buffer under 500 limit)
- Exponential backoff on 429 errors (retry after 30s, 60s, 120s)
- Prefer batch endpoints where available (e.g., batch query vs individual gets)
- Monitor rate limit headers in responses (if provided)

**Warning signs:**
- 429 errors during bulk operations
- Sync works for small datasets, fails for large
- Errors at ~10 concurrent jobs even under per-minute limit

### Pitfall 5: Sandbox vs Production Environment Mismatch

**What goes wrong:** Integration works in sandbox but fails in production with "Invalid realmId" or "Company not found".

**Why it happens:** Sandbox and production are separate environments with different realmIds, different OAuth keys, different API endpoints. Hardcoding sandbox realmId or using wrong OAuth credentials.

**How to avoid:**
- Store `environment` field in qbo_connections table ('sandbox' | 'production')
- Use environment-specific OAuth keys (developer portal has separate credentials)
- Initialize OAuthClient with correct environment per connection
- NEVER hardcode realmId - always fetch from OAuth callback

**Warning signs:**
- Works in dev, fails in prod
- "Unauthorized" errors despite valid access token
- RealmId not found errors

### Pitfall 6: Deleted Entities Not Handled

**What goes wrong:** Sync fails trying to update QBO entity that was deleted/inactivated.

**Why it happens:** QBO doesn't physically delete records - it marks them `Active: false`. If you try to update inactive entity, API returns error. Your mapping table still references deleted entity.

**How to avoid:**
- Check `Active` field before syncing
- Handle "Entity not found" errors by marking mapping as `qboDeleted: true`
- Don't delete platform entity when QBO entity inactivated - preserve for history
- Provide UI to "reconnect" deleted entities or create new ones

**Warning signs:**
- "Object Not Found" errors on update
- Sync works initially, fails days later
- Deleted invoices/customers cause sync failures

## Code Examples

Verified patterns from official sources:

### OAuth 2.0 Complete Flow

```typescript
// Source: https://github.com/intuit/oauth-jsclient
import OAuthClient from 'intuit-oauth';
import crypto from 'crypto';

// 1. Generate authorization URL (redirect user to QBO login)
export function getQboAuthUrl(tenantId: string) {
  const oauthClient = new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID!,
    clientSecret: process.env.QBO_CLIENT_SECRET!,
    environment: process.env.QBO_ENVIRONMENT as 'sandbox' | 'production',
    redirectUri: `${process.env.API_URL}/api/integrations/quickbooks/callback`,
  });

  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
    state: tenantId, // Return tenant ID after OAuth callback
  });

  return authUri;
}

// 2. Handle OAuth callback (exchange code for tokens)
export async function handleQboCallback(code: string, realmId: string, state: string) {
  const tenantId = state; // Tenant ID from state parameter

  const oauthClient = new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID!,
    clientSecret: process.env.QBO_CLIENT_SECRET!,
    environment: process.env.QBO_ENVIRONMENT as 'sandbox' | 'production',
    redirectUri: `${process.env.API_URL}/api/integrations/quickbooks/callback`,
  });

  const authResponse = await oauthClient.createToken(code);
  const token = authResponse.getToken();

  // Encrypt refresh token (never store plaintext)
  const encryptedRefreshToken = encryptToken(token.refresh_token);

  // Store connection in tenant schema
  await createQboConnection({
    tenantId,
    realmId, // QBO company ID
    accessToken: token.access_token, // Short-lived (1 hour) - OK to store unencrypted
    encryptedRefreshToken,
    tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + token.x_refresh_token_expires_in * 1000),
    environment: process.env.QBO_ENVIRONMENT as 'sandbox' | 'production',
    status: 'active',
  });

  return { success: true, tenantId, realmId };
}

// 3. Token encryption (AES-256-GCM)
function encryptToken(token: string): string {
  const key = Buffer.from(process.env.QBO_ENCRYPTION_KEY!, 'hex'); // 32 bytes
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  const key = Buffer.from(process.env.QBO_ENCRYPTION_KEY!, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Entity Mapping and Sparse Update

```typescript
// Source: https://github.com/mcohen01/node-quickbooks
import QuickBooks from 'node-quickbooks';

// Bidirectional sync: Platform Project <-> QBO Customer
async function syncProjectToQbo(projectId: string) {
  const project = await getProject(projectId);
  const mapping = await getQboMapping({ platformId: projectId, entityType: 'project' });

  const qbo = await createQboClient(project.tenantId);

  if (!mapping) {
    // CREATE: Project doesn't exist in QBO yet
    const customer = await new Promise((resolve, reject) => {
      qbo.createCustomer(
        {
          DisplayName: project.name,
          CompanyName: project.name,
          Notes: `Platform Project ID: ${projectId}`, // Embed our ID for reverse lookup
        },
        (err, customer) => {
          if (err) reject(err);
          else resolve(customer);
        }
      );
    });

    // Store bidirectional mapping
    await createQboMapping({
      tenantId: project.tenantId,
      entityType: 'project',
      platformId: projectId,
      qboId: customer.Id,
      qboSyncToken: customer.SyncToken,
      direction: 'bidirectional',
    });

    return customer;
  }

  // UPDATE: Sparse update (only changed fields)
  try {
    const updated = await new Promise((resolve, reject) => {
      qbo.updateCustomer(
        {
          Id: mapping.qboId,
          SyncToken: mapping.qboSyncToken,
          sparse: true,
          DisplayName: project.name, // Only update name
        },
        (err, customer) => {
          if (err) reject(err);
          else resolve(customer);
        }
      );
    });

    // Update stored SyncToken for next update
    await updateQboMapping(mapping.id, { qboSyncToken: updated.SyncToken });

    return updated;
  } catch (err) {
    // Handle SyncToken conflict
    if (err.Fault?.Error?.[0]?.code === '5010') {
      return handleSyncTokenConflict(projectId, mapping.qboId);
    }
    throw err;
  }
}

// Conflict resolution: Fetch latest, let user choose
async function handleSyncTokenConflict(projectId: string, qboId: string) {
  const project = await getProject(projectId);
  const qbo = await createQboClient(project.tenantId);

  // Fetch latest from QBO
  const qboCustomer = await new Promise((resolve, reject) => {
    qbo.getCustomer(qboId, (err, customer) => {
      if (err) reject(err);
      else resolve(customer);
    });
  });

  // Create conflict record for user to resolve
  await createConflictRecord({
    tenantId: project.tenantId,
    entityType: 'project',
    platformId: projectId,
    qboId,
    platformData: { name: project.name },
    qboData: { DisplayName: qboCustomer.DisplayName },
    qboSyncToken: qboCustomer.SyncToken,
  });

  // Notify user
  await notifyUserOfConflict(project.tenantId, 'project', projectId);

  throw new Error('SYNC_CONFLICT'); // Don't retry - await user resolution
}
```

### Change Data Capture Fallback

```typescript
// Source: https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/change-data-capture

// Daily CDC job (cron: 0 2 * * * - runs at 2am daily)
export async function runDailyCdc(tenantId: string) {
  const connection = await getQboConnection(tenantId);
  if (!connection || connection.status !== 'active') return;

  const syncState = await getQboSyncState(tenantId);
  const qbo = await createQboClient(tenantId);

  // Query changes since last successful sync (or last 30 days max)
  const changedSince = syncState.lastCdcSync || new Date(Date.now() - 30 * 86400000);

  // CDC endpoint format: /cdc?entities=Entity1,Entity2&changedSince=ISO_TIMESTAMP
  const entities = ['Customer', 'Invoice', 'Bill', 'Payment'];

  for (const entityType of entities) {
    try {
      const cdcUrl = `/company/${connection.realmId}/cdc?entities=${entityType}&changedSince=${changedSince.toISOString()}`;

      const cdcResult = await new Promise((resolve, reject) => {
        // node-quickbooks doesn't have CDC helper, use makeApiCall
        qbo.makeApiCall({
          url: cdcUrl,
          method: 'GET',
        }, (err, response) => {
          if (err) reject(err);
          else resolve(response);
        });
      });

      const changedEntities = cdcResult.CDCResponse?.[0]?.QueryResponse?.[0]?.[entityType] || [];

      // Queue sync jobs for each changed entity
      for (const entity of changedEntities) {
        await qboSyncQueue.add('sync-from-qbo', {
          tenantId,
          entityType: entityType.toLowerCase(),
          qboId: entity.Id,
          syncReason: 'cdc',
        });
      }

      console.log(`CDC: Found ${changedEntities.length} changed ${entityType} for tenant ${tenantId}`);
    } catch (err) {
      console.error(`CDC failed for ${entityType}:`, err);
      // Continue with other entity types
    }
  }

  // Update last CDC sync timestamp
  await updateQboSyncState(tenantId, { lastCdcSync: new Date() });
}
```

### BullMQ Queue Setup with Monitoring

```typescript
// Source: https://docs.bullmq.io
import { Queue, Worker, QueueEvents } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { FastifyInstance } from 'fastify';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

// Create queue
export const qboSyncQueue = new Queue('qbo-sync', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100, age: 86400 }, // Keep 1 day
    removeOnFail: { count: 500, age: 604800 }, // Keep 1 week
  },
});

// Create worker
const qboSyncWorker = new Worker(
  'qbo-sync',
  async (job) => {
    const { tenantId, entityType, qboId, platformId, operation } = job.data;

    // Rate limiting (400/min, 10 concurrent)
    await rateLimiter.waitForToken(tenantId);

    if (job.name === 'sync-from-qbo') {
      await syncFromQbo(tenantId, entityType, qboId);
    } else if (job.name === 'sync-to-qbo') {
      await syncToQbo(tenantId, entityType, platformId);
    }
  },
  {
    connection: redisConnection,
    concurrency: 10, // QBO concurrent limit
    limiter: {
      max: 400, // 400 jobs per minute (buffer under 500)
      duration: 60000,
    },
  }
);

// Queue events for monitoring
const queueEvents = new QueueEvents('qbo-sync', { connection: redisConnection });

queueEvents.on('completed', ({ jobId }) => {
  console.log(`Job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed: ${failedReason}`);
});

// Bull Board for monitoring (mount on Fastify)
export function setupQueueDashboard(app: FastifyInstance) {
  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: [new BullMQAdapter(qboSyncQueue)],
    serverAdapter,
  });

  serverAdapter.setBasePath('/admin/queues');
  app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OAuth 1.0 | OAuth 2.0 | 2017 | Must use OAuth 2.0 flow; old apps must migrate |
| Legacy webhook payload | CloudEvents 1.0 | May 15, 2026 | All webhooks must parse CloudEvents format or lose real-time sync |
| Minor version 1-74 | Minor version 75+ | Aug 1, 2025 | Must specify `minorversion=75` or higher; old versions ignored |
| 100-day refresh token | 101-day with rotation | Ongoing | Each refresh returns NEW token; must update stored token |
| Polling for changes | Webhooks + CDC | 2023+ | Webhooks provide instant sync, CDC catches missed events |
| Custom fields in Notes | Custom Fields API (Premium) | Dec 2025 | GraphQL-based metadata for customers, invoices, vendors |
| Projects API unavailable | Projects API (Premium) | July 2025 | Can sync projects directly vs. using Customer/Job workaround |

**Deprecated/outdated:**
- OAuth 1.0: Removed. All new apps must use OAuth 2.0.
- Minor versions < 75: Ignored as of Aug 1, 2025. Responses default to v75.
- Legacy webhook format: Disabled May 15, 2026. Must migrate to CloudEvents.
- Desktop API (on-premise): Different API entirely; this research covers Online only.

## Open Questions

1. **Custom Fields API Access**
   - What we know: Premium API for Gold/Platinum partners, requires GraphQL + REST combo
   - What's unclear: Qualification process for Premium APIs, pricing tier requirements
   - Recommendation: Start with Notes field for storing platform IDs; upgrade to Custom Fields if available

2. **Projects API Availability**
   - What we know: Available as Premium API since July 2025 for QBO Plus/Advanced/Enterprise users
   - What's unclear: Whether API is available for all tenant QBO subscription levels, or just Plus/Advanced
   - Recommendation: Implement Customer-based project mapping first; add Projects API as enhancement if tenant has access

3. **Webhook Signature Verification Format**
   - What we know: CloudEvents webhooks have `Intuit-Signature` header
   - What's unclear: Exact signature algorithm (HMAC-SHA256?), where webhook secret is obtained
   - Recommendation: Test in sandbox with CloudEvents enabled; check developer portal for webhook secret and verification docs

4. **Rate Limit Headers**
   - What we know: 500 req/min, 10 concurrent hard limits
   - What's unclear: Whether QBO returns rate limit headers (X-RateLimit-Remaining, etc.) in responses
   - Recommendation: Implement conservative client-side rate limiting (400/min, 10 concurrent) regardless of headers

5. **Reconnect URL (2026 Requirement)**
   - What we know: Becomes mandatory field in app settings (January 2026)
   - What's unclear: Exact URL format, what happens at this URL (re-auth flow?)
   - Recommendation: Monitor Intuit Developer blog for clarification; likely URL where users can reconnect expired integrations

## Sources

### Primary (HIGH confidence)
- [Intuit Developer - QuickBooks Online API](https://developer.intuit.com/app/developer/qbo/docs/develop) - Official API documentation
- [intuit-oauth GitHub](https://github.com/intuit/oauth-jsclient) - Official OAuth client source code and examples
- [node-quickbooks GitHub](https://github.com/mcohen01/node-quickbooks) - Community standard QB client, active maintenance
- [BullMQ Documentation](https://docs.bullmq.io) - Official queue system docs with patterns
- [Intuit Developer Blog - CloudEvents Migration](https://blogs.intuit.com/2025/11/12/upcoming-change-to-webhooks-payload-structure/) - Mandatory webhook format change
- [Intuit Developer Blog - Refresh Token Policy](https://blogs.intuit.com/2025/11/12/important-changes-to-refresh-token-policy/) - Token rotation requirements
- [Intuit Developer Blog - Projects API](https://blogs.intuit.com/2025/11/21/unlocking-project-tracking-with-the-projects-api/) - Premium Projects API announcement
- [Intuit Developer Blog - Custom Fields API](https://blogs.intuit.com/2025/12/01/custom-fields-api-extending-quickbooks-online-with-flexible-metadata/) - Premium Custom Fields API
- [Intuit Developer - Change Data Capture](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/change-data-capture) - CDC API documentation
- [Intuit Developer - Minor Versions](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/minor-versions) - API versioning policy

### Secondary (MEDIUM confidence)
- [Merge.dev - QuickBooks API Integration Guide](https://www.merge.dev/blog/quickbooks-api) - Best practices overview
- [Coefficient - QuickBooks API Rate Limits](https://coefficient.io/quickbooks-api/quickbooks-api-rate-limits) - Rate limiting details
- [Intuit Developer Blog - Webhooks Best Practices](https://blogs.intuit.com/2023/04/18/best-practices-for-using-webhooks-with-quickbooks-online/) - Webhook patterns
- [Intuit Developer Blog - CDC Best Practices](https://blogs.intuit.com/2023/08/24/building-smarter-with-intuit-stay-in-sync-with-cdc/) - CDC usage patterns
- [Auth0 - Token Storage Best Practices](https://auth0.com/docs/secure/security-guidance/data-security/token-storage) - OAuth token security
- [Obsidian Security - Refresh Token Security](https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices) - Token encryption patterns

### Tertiary (LOW confidence)
- Various Stack Overflow discussions on QBO integration patterns (used for validation, not primary source)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Intuit libraries and community-proven node-quickbooks, BullMQ is production-standard
- Architecture: HIGH - Patterns verified against official docs, webhook/CDC hybrid is Intuit-recommended approach
- Pitfalls: HIGH - Token rotation, CloudEvents migration, SyncToken conflicts documented in official blog posts and support forums
- Code examples: HIGH - All examples sourced from official GitHub repos or Intuit developer docs

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days) - QBO API is stable, but monitor Intuit Developer Blog for policy changes (CloudEvents deadline, Premium API rollout)

**Key dependencies on existing codebase:**
- Multi-tenant schema pattern: qbo_connections, qbo_sync_state, qbo_entity_mappings tables in tenant schema
- Redis (already in stack via Docker): Required for BullMQ queue
- Webhook pattern: Already established with Clerk webhooks (svix verification) - similar pattern for QBO webhooks
- tRPC router: Add quickbooks.ts router for connect/disconnect/syncStatus endpoints
- Encryption: Need QBO_ENCRYPTION_KEY env var (32-byte hex) for refresh token encryption
