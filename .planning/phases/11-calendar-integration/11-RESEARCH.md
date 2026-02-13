# Phase 11: Calendar Integration - Research

**Researched:** 2026-02-13
**Domain:** Calendar API Integration (Google Calendar, Microsoft Graph/Outlook)
**Confidence:** HIGH

## Summary

Calendar integration requires implementing OAuth 2.0 flows for both Google Calendar and Microsoft 365/Outlook, establishing bi-directional sync using webhooks with periodic polling fallback, and managing token lifecycle, webhook subscription renewal, and conflict resolution. The phase builds on existing QuickBooks OAuth patterns (Phase 8) but introduces unique challenges around recurring events, timezone handling, and webhook reliability.

**Primary recommendation:** Use official SDKs (`googleapis` npm package for Google, `@microsoft/microsoft-graph-client` for Microsoft), implement webhook-based real-time sync with scheduled full-sync fallback (daily/weekly), store sync tokens for incremental updates, use existing AES-256-GCM encryption pattern for token storage, leverage BullMQ for background sync workers, and implement sync_version/etag-based conflict resolution.

**Key insight:** Calendar webhooks are NOT 100% reliable—both Google and Microsoft acknowledge that notifications can be dropped. Periodic full sync (using delta queries/sync tokens) is mandatory, not optional.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | Latest (includes @googleapis/calendar 14.2.0) | Google Calendar API client | Google's official Node.js SDK, includes OAuth 2.0 support, type-safe |
| @microsoft/microsoft-graph-client | Latest (3.x+) | Microsoft Graph API client | Microsoft's official SDK for Graph API, supports Node.js 12+ |
| BullMQ | Latest (existing) | Background job processing | Already in use for QuickBooks sync, proven pattern for queue-based sync |
| Drizzle ORM | Latest (existing) | Database access | Multi-tenant schema support, existing token storage patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rrule | 2.8.x+ | Recurring event expansion | When displaying recurring events as individual instances |
| date-fns-tz | 3.x+ | Timezone conversion | When converting between UTC and user/company timezones |
| @microsoft/microsoft-graph-types | Latest | TypeScript types for Graph API | For type safety with Microsoft Graph responses |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Official SDKs | Nylas Universal Calendar API | Nylas abstracts both providers but adds external dependency, cost, and reduces control |
| BullMQ workers | Direct webhook-to-DB writes | Immediate writes skip retry/rate-limit logic, risking data loss on failures |
| Scheduled polling | Webhooks only | Missed notifications cause permanent sync gaps without fallback |

**Installation:**
```bash
npm install googleapis @microsoft/microsoft-graph-client @microsoft/microsoft-graph-types
npm install rrule date-fns-tz  # If recurring event expansion needed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/integrations/calendar/
├── google/
│   ├── oauth.ts           # Google OAuth flow (authorize, callback, refresh)
│   ├── client.ts          # Google Calendar API client factory
│   ├── sync.ts            # Delta sync logic using syncToken
│   └── webhooks.ts        # Channel setup, validation, renewal
├── microsoft/
│   ├── oauth.ts           # Microsoft OAuth flow
│   ├── client.ts          # Graph API client factory
│   ├── sync.ts            # Delta query logic using deltaToken
│   └── webhooks.ts        # Subscription setup, validation, renewal
├── shared/
│   ├── crypto.ts          # Token encryption (reuse QuickBooks pattern)
│   ├── queue.ts           # BullMQ calendar sync queue
│   ├── workers.ts         # Sync job processors
│   ├── conflict.ts        # Conflict resolution (last-write-wins with etag)
│   └── mappers.ts         # Platform event <-> internal event mapping
└── schemas.ts             # Drizzle schema for calendar connections, events
```

### Pattern 1: OAuth 2.0 with Offline Access
**What:** Request offline access during authorization to obtain refresh tokens that work when users are offline
**When to use:** All calendar integrations (both Google and Microsoft)
**Example:**
```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/web-server
// Google Calendar OAuth
import { google } from 'googleapis';

function getGoogleAuthUrl(tenantId: string): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.API_URL}/api/integrations/calendar/google/callback`
  );

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',  // CRITICAL: Enables refresh token
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    state: tenantId,  // Pass tenantId for callback association
    prompt: 'consent' // Force consent to ensure refresh token is returned
  });
}

// Microsoft Graph OAuth
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authority: 'https://login.microsoftonline.com/common'
  }
};

const cca = new ConfidentialClientApplication(msalConfig);

// Request offline_access scope for refresh tokens
const authCodeUrlParameters = {
  scopes: ['Calendars.ReadWrite', 'offline_access'],
  redirectUri: `${process.env.API_URL}/api/integrations/calendar/microsoft/callback`,
  state: tenantId
};
```

### Pattern 2: Incremental Sync with Sync/Delta Tokens
**What:** Use sync tokens (Google) or delta tokens (Microsoft) to fetch only changed events since last sync
**When to use:** All background sync operations, both webhook-triggered and scheduled
**Example:**
```typescript
// Source: https://developers.google.com/workspace/calendar/api/guides/sync
// Google Calendar incremental sync
async function syncGoogleCalendar(calendarId: string, storedSyncToken?: string) {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const params: any = {
    calendarId,
    maxResults: 100,
  };

  if (storedSyncToken) {
    // Incremental sync - only changed events
    params.syncToken = storedSyncToken;
  } else {
    // Initial full sync - need time range
    params.timeMin = new Date().toISOString();
  }

  let nextPageToken: string | undefined;
  let newSyncToken: string | undefined;
  const events = [];

  do {
    if (nextPageToken) params.pageToken = nextPageToken;

    const response = await calendar.events.list(params);
    events.push(...(response.data.items || []));

    nextPageToken = response.data.nextPageToken;
    newSyncToken = response.data.nextSyncToken;  // Only on final page
  } while (nextPageToken);

  // Store newSyncToken for next incremental sync
  return { events, nextSyncToken: newSyncToken };
}

// Source: https://learn.microsoft.com/en-us/graph/delta-query-events
// Microsoft Graph delta query
async function syncMicrosoftCalendar(calendarId: string, storedDeltaToken?: string) {
  const client = getMicrosoftGraphClient(accessToken);

  let url = storedDeltaToken
    ? storedDeltaToken  // Use stored delta link (includes all params)
    : `/me/calendarView/delta?startDateTime=${startDate}&endDateTime=${endDate}`;

  let events = [];
  let newDeltaToken: string | undefined;

  while (url) {
    const response = await client.api(url).get();
    events.push(...response.value);

    url = response['@odata.nextLink'];  // More pages
    newDeltaToken = response['@odata.deltaLink'];  // Final page
  }

  return { events, nextDeltaToken: newDeltaToken };
}
```

### Pattern 3: Webhook Setup with Automatic Renewal
**What:** Establish push notification channels/subscriptions with background jobs to renew before expiration
**When to use:** Real-time event sync for both Google and Microsoft calendars
**Example:**
```typescript
// Source: https://developers.google.com/workspace/calendar/api/guides/push
// Google Calendar push notifications (channels expire in ~1 week)
async function setupGoogleWebhook(calendarId: string, tenantId: string) {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const channelId = `${tenantId}-${calendarId}-${Date.now()}`;
  const expirationMs = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

  const channel = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: `${process.env.API_URL}/api/webhooks/calendar/google`,
      expiration: expirationMs.toString(),
      token: tenantId  // For webhook validation
    }
  });

  // Store channel for renewal BEFORE expiration
  await db.insert(googleChannels).values({
    channelId: channel.data.id,
    resourceId: channel.data.resourceId,
    calendarId,
    tenantId,
    expiresAt: new Date(parseInt(channel.data.expiration)),
    createdAt: new Date()
  });

  // Schedule renewal job for 6 days from now (1 day before expiry)
  await calendarSyncQueue.add('renew-google-channel', {
    channelId,
    tenantId
  }, {
    delay: 6 * 24 * 60 * 60 * 1000  // 6 days
  });
}

// Source: https://learn.microsoft.com/en-us/graph/api/subscription-update
// Microsoft Graph webhooks (expiration varies by resource)
async function setupMicrosoftWebhook(calendarId: string, tenantId: string) {
  const client = getMicrosoftGraphClient(accessToken);

  // Calendar subscriptions expire based on resource type limits
  const expirationDateTime = new Date();
  expirationDateTime.setHours(expirationDateTime.getHours() + 4230); // Max for calendar

  const subscription = await client.api('/subscriptions').post({
    changeType: 'created,updated,deleted',
    notificationUrl: `${process.env.API_URL}/api/webhooks/calendar/microsoft`,
    resource: `/me/calendars/${calendarId}/events`,
    expirationDateTime: expirationDateTime.toISOString(),
    clientState: tenantId  // For webhook validation
  });

  // Store subscription for renewal
  await db.insert(microsoftSubscriptions).values({
    subscriptionId: subscription.id,
    calendarId,
    tenantId,
    expiresAt: new Date(subscription.expirationDateTime),
    createdAt: new Date()
  });

  // Schedule renewal 1 day before expiration
  const renewalDelay = new Date(subscription.expirationDateTime).getTime() - Date.now() - (24 * 60 * 60 * 1000);
  await calendarSyncQueue.add('renew-microsoft-subscription', {
    subscriptionId: subscription.id,
    tenantId
  }, {
    delay: renewalDelay
  });
}
```

### Pattern 4: Conflict Resolution with ETags
**What:** Use ETag/version fields to detect concurrent modifications and apply last-write-wins strategy
**When to use:** When syncing changes from internal platform to external calendar
**Example:**
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-30-last-write-wins/view
async function syncEventToGoogle(internalEvent: Event, googleEvent: any) {
  // Check if internal event is newer than Google event
  const internalModified = new Date(internalEvent.updatedAt);
  const googleModified = new Date(googleEvent.updated);

  if (internalModified <= googleModified) {
    // Google event is newer - update internal from Google
    await updateInternalEvent(internalEvent.id, googleEvent);
    return { direction: 'from-google', conflict: false };
  }

  // Internal event is newer - update Google from internal
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEvent.id,
      requestBody: mapInternalToGoogle(internalEvent),
      // Include If-Match header with ETag to detect concurrent updates
      headers: {
        'If-Match': googleEvent.etag
      }
    });

    return { direction: 'to-google', conflict: false };
  } catch (error) {
    if (error.code === 412) {  // Precondition Failed - ETag mismatch
      // Concurrent modification detected
      // Re-fetch Google event and retry with last-write-wins
      const latest = await calendar.events.get({
        calendarId: 'primary',
        eventId: googleEvent.id
      });

      return syncEventToGoogle(internalEvent, latest.data);
    }
    throw error;
  }
}
```

### Pattern 5: BullMQ Worker for Calendar Sync
**What:** Background workers process calendar sync jobs with automatic retry, rate limiting, and token refresh
**When to use:** All calendar sync operations (webhook-triggered, scheduled, manual)
**Example:**
```typescript
// Source: Adapted from apps/api/src/integrations/quickbooks/sync/workers.ts
import { Worker, Job } from 'bullmq';

export interface CalendarSyncJobData {
  tenantId: string;
  provider: 'google' | 'microsoft';
  calendarId: string;
  operation: 'full-sync' | 'incremental-sync' | 'event-update';
  eventId?: string;
  syncReason: 'webhook' | 'scheduled' | 'manual';
}

export function startCalendarSyncWorker(): Worker {
  const worker = new Worker<CalendarSyncJobData>(
    'calendar-sync',
    async (job: Job<CalendarSyncJobData>) => {
      const { tenantId, provider, calendarId, operation, syncReason } = job.data;

      console.log(`Processing calendar sync: ${provider} ${operation} for tenant ${tenantId}`);

      // 1. Load tenant and calendar connection
      const connection = await loadCalendarConnection(tenantId, provider);

      if (!connection) {
        console.log(`No ${provider} connection for tenant ${tenantId}`);
        return;
      }

      // 2. Refresh token if expired
      if (new Date(connection.tokenExpiresAt) <= new Date()) {
        const refreshed = await refreshToken(provider, connection.encryptedRefreshToken);
        await updateStoredTokens(connection.id, refreshed);
        connection.accessToken = refreshed.accessToken;
      }

      // 3. Execute sync based on operation
      if (operation === 'full-sync' || !connection.syncToken) {
        await performFullSync(provider, connection, calendarId);
      } else {
        await performIncrementalSync(provider, connection, calendarId);
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,  // Conservative - calendars have strict rate limits
      limiter: {
        max: 100,      // 100 jobs per minute (well under quota)
        duration: 60000
      }
    }
  );

  return worker;
}
```

### Anti-Patterns to Avoid
- **Polling without sync tokens:** Fetching all events repeatedly wastes quota and bandwidth. Always use sync/delta tokens.
- **Webhook-only sync:** Webhooks can be lost. Always combine with scheduled full sync as fallback.
- **Storing tokens in plaintext:** OAuth tokens are credentials. Use AES-256-GCM encryption (existing pattern).
- **Ignoring timezone metadata:** Store events in UTC, preserve original timezone for display/recurrence rules.
- **Hand-rolling recurring event expansion:** RRULE is complex. Use library (`rrule` npm) or let provider expand instances.
- **Assuming webhook delivery order:** Webhooks can arrive out-of-order. Use timestamp/etag for ordering.
- **Not handling token rotation:** Microsoft rotates refresh tokens. Always store the new token from refresh response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 flow | Custom OAuth implementation | Official SDKs (`googleapis`, `@microsoft/microsoft-graph-client`) | SDK handles token lifecycle, automatic refresh, error retry, API versioning |
| Recurring event expansion | RRULE parser | `rrule` npm package or provider's instance expansion API | RRULE spec is 50+ pages, edge cases (DST, leap years, EXDATE) are complex |
| Webhook reliability | Webhook-only sync | Webhooks + scheduled delta sync | Both Google and Microsoft acknowledge <100% webhook reliability |
| Token encryption | Custom crypto | Reuse existing `crypto.ts` (AES-256-GCM) from QuickBooks integration | Proven pattern, handles IV/auth tag correctly, key rotation ready |
| Background job processing | Direct API calls in request handlers | BullMQ workers (existing) | Retry logic, rate limiting, job persistence, distributed processing |
| Timezone conversion | Manual offset calculation | `date-fns-tz` or native `Intl.DateTimeFormat` | DST transitions, historical offset changes, IANA database updates |
| Conflict detection | Timestamp comparison only | ETag/sync_version optimistic locking | Detects concurrent updates, prevents lost writes, provider-native pattern |

**Key insight:** Calendar APIs are deceptively complex. Recurring events, timezone handling, webhook reliability, and token lifecycle all have subtle failure modes. Use proven libraries and follow provider best practices.

## Common Pitfalls

### Pitfall 1: Webhook Notification Loss
**What goes wrong:** Relying solely on webhooks causes permanent sync gaps when notifications are dropped (which both providers acknowledge happens)
**Why it happens:** Network issues, server downtime, provider outages, rate limiting can all cause webhook delivery failure
**How to avoid:** Implement scheduled full sync (using delta/sync tokens) at least daily. Webhooks provide real-time updates, scheduled sync ensures eventual consistency.
**Warning signs:** Users report events not syncing, audit logs show gaps in webhook deliveries, sync timestamps are stale

### Pitfall 2: Channel/Subscription Expiration
**What goes wrong:** Webhooks stop working when channels (Google, ~7 days) or subscriptions (Microsoft, varies) expire without renewal
**Why it happens:** Forgetting to track expiration, renewal job failures, background worker downtime
**How to avoid:** Store expiration timestamp on creation, schedule renewal job 1+ days before expiry, monitor renewal failures, implement alerts for expired channels/subscriptions
**Warning signs:** Real-time sync stops after 7 days (Google) or variable period (Microsoft), no webhook notifications received

### Pitfall 3: Recurring Event Mishandling
**What goes wrong:** Displaying recurring events as single entry, not capturing exceptions/modifications to instances, breaking recurrence rules on sync
**Why it happens:** Treating recurring events like simple events, not understanding master vs instance relationship
**How to avoid:** Store recurrence metadata (RRULE, master event ID), track modified/deleted instances separately, use provider's instance expansion API or `rrule` library, never modify RRULE during sync round-trips
**Warning signs:** Users report missing recurring event instances, exceptions not appearing, recurrence pattern broken after sync

### Pitfall 4: Timezone Data Loss
**What goes wrong:** Converting events to UTC and losing original timezone causes wrong display times during DST transitions, breaks "floating" events (no timezone)
**Why it happens:** Over-simplifying by storing only UTC timestamp without timezone metadata
**How to avoid:** Store both UTC timestamp AND original IANA timezone name (e.g., "America/New_York"), preserve "floating" events (all-day, no timezone), use `date-fns-tz` for display conversion
**Warning signs:** Events show wrong time after DST change, all-day events span two days for some users, meeting times shift unexpectedly

### Pitfall 5: Token Refresh Race Conditions
**What goes wrong:** Multiple concurrent sync jobs refresh the same expired token, causing token rotation conflicts and authentication failures
**Why it happens:** BullMQ processes multiple jobs in parallel, each checks token expiration independently
**How to avoid:** Implement token refresh lock (Redis lock with TTL), check token again after acquiring lock, store refreshed token atomically, handle token rotation (Microsoft may rotate refresh token)
**Warning signs:** Intermittent 401 errors during sync, audit logs show multiple refresh attempts simultaneously, stale token errors

### Pitfall 6: Rate Limit Quota Exhaustion
**What goes wrong:** Exceeding Google's 1,000,000 queries/day or Microsoft's per-mailbox limits causes API throttling and sync failures
**Why it happens:** Polling too frequently without sync tokens, not batching requests, inefficient full syncs
**How to avoid:** Use sync/delta tokens for incremental updates only, batch operations where possible, implement exponential backoff on 429 responses, monitor quota usage via provider dashboards
**Warning signs:** 429 (Too Many Requests) errors, sync delays increasing, Google/Microsoft quota warning emails

### Pitfall 7: Calendar vs CalendarView Confusion (Microsoft)
**What goes wrong:** Using `/calendar/events` returns all events without time bounds, causing huge responses and quota waste
**Why it happens:** Not understanding Microsoft's calendarView vs events endpoints
**How to avoid:** Use `/calendarView/delta?startDateTime=X&endDateTime=Y` for bounded sync, `/events` for single event operations only
**Warning signs:** Initial sync extremely slow, huge API responses, quota exhaustion

### Pitfall 8: Company vs User Calendar Scope Confusion
**What goes wrong:** Connecting user's personal calendar when user intended company-wide calendar, or vice versa
**Why it happens:** OAuth consent flow doesn't clearly distinguish personal vs organization calendars
**How to avoid:** Present clear UI choice before OAuth ("Connect your personal calendar" vs "Connect company calendar"), store scope preference, use appropriate Microsoft Graph endpoints (`/me/calendar` vs `/groups/{id}/calendar`)
**Warning signs:** Wrong events syncing, users confused about which calendar is connected, privacy concerns from syncing personal events to company

### Pitfall 9: Webhook Endpoint Timeout
**What goes wrong:** Calendar providers (e.g., Calendly) expect webhook endpoints to respond within 10 seconds; slow processing causes retries and eventual webhook disabling
**Why it happens:** Processing sync logic synchronously in webhook handler instead of queuing background job
**How to avoid:** Webhook handler ONLY validates payload and queues BullMQ job, returns 200 immediately. All sync processing happens in worker.
**Warning signs:** Webhook delivery retries in provider logs, webhooks disabled after repeated failures, 504 timeout errors

### Pitfall 10: Not Handling Deleted Events
**What goes wrong:** Delta/sync responses include deleted events (`@removed` property or `status: 'cancelled'`), but code ignores them, causing deleted events to persist
**Why it happens:** Expecting only created/updated events in sync response
**How to avoid:** Check for deletion markers (`@removed` in Microsoft, `status: 'cancelled'` in Google), soft-delete or hard-delete internal events accordingly
**Warning signs:** Events not disappearing after deletion in external calendar, sync drift increasing over time

## Code Examples

Verified patterns from official sources:

### Google Calendar Token Refresh
```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/web-server
import { google } from 'googleapis';

async function refreshGoogleToken(encryptedRefreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.API_URL}/api/integrations/calendar/google/callback`
  );

  // Decrypt stored refresh token
  const refreshToken = decryptToken(encryptedRefreshToken);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // SDK automatically refreshes access token when needed
  const { credentials } = await oauth2Client.refreshAccessToken();

  return {
    accessToken: credentials.access_token,
    tokenExpiresAt: new Date(credentials.expiry_date),
    // Google does NOT rotate refresh tokens - reuse existing
    refreshToken: refreshToken
  };
}
```

### Microsoft Graph Token Refresh (with Rotation)
```typescript
// Source: https://learn.microsoft.com/en-us/graph/sdks/choose-authentication-providers
import { ConfidentialClientApplication } from '@azure/msal-node';

async function refreshMicrosoftToken(encryptedRefreshToken: string) {
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      authority: 'https://login.microsoftonline.com/common'
    }
  });

  const refreshToken = decryptToken(encryptedRefreshToken);

  const response = await cca.acquireTokenByRefreshToken({
    refreshToken,
    scopes: ['Calendars.ReadWrite', 'offline_access']
  });

  return {
    accessToken: response.accessToken,
    tokenExpiresAt: new Date(response.expiresOn),
    // Microsoft MAY rotate refresh token - store new one if provided
    refreshToken: response.refreshToken || refreshToken
  };
}
```

### Webhook Validation
```typescript
// Source: https://developers.google.com/workspace/calendar/api/guides/push
// Google Calendar webhook handler
app.post('/api/webhooks/calendar/google', async (req, res) => {
  const channelId = req.headers['x-goog-channel-id'];
  const resourceState = req.headers['x-goog-resource-state'];
  const token = req.headers['x-goog-channel-token'];

  // Validate sync message (first notification on channel setup)
  if (resourceState === 'sync') {
    console.log(`Channel ${channelId} setup confirmed`);
    return res.status(200).send();
  }

  // Validate token matches stored channel
  const channel = await db.query.googleChannels.findFirst({
    where: eq(googleChannels.channelId, channelId)
  });

  if (!channel || channel.tenantId !== token) {
    console.error(`Invalid channel or token: ${channelId}`);
    return res.status(403).send();
  }

  // Queue incremental sync job (don't process inline)
  await calendarSyncQueue.add('incremental-sync', {
    tenantId: channel.tenantId,
    provider: 'google',
    calendarId: channel.calendarId,
    operation: 'incremental-sync',
    syncReason: 'webhook'
  });

  // Return 200 immediately
  res.status(200).send();
});

// Source: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
// Microsoft Graph webhook validation
app.post('/api/webhooks/calendar/microsoft', async (req, res) => {
  // Validation request (sent when creating subscription)
  if (req.query.validationToken) {
    return res.status(200).send(req.query.validationToken);
  }

  const { value } = req.body;

  for (const notification of value) {
    const { subscriptionId, clientState, changeType, resource } = notification;

    // Validate clientState matches stored subscription
    const subscription = await db.query.microsoftSubscriptions.findFirst({
      where: eq(microsoftSubscriptions.subscriptionId, subscriptionId)
    });

    if (!subscription || subscription.tenantId !== clientState) {
      console.error(`Invalid subscription or clientState: ${subscriptionId}`);
      continue;  // Skip this notification, process others
    }

    // Queue sync job
    await calendarSyncQueue.add('incremental-sync', {
      tenantId: subscription.tenantId,
      provider: 'microsoft',
      calendarId: subscription.calendarId,
      operation: 'incremental-sync',
      syncReason: 'webhook'
    });
  }

  res.status(202).send();  // Microsoft expects 202 Accepted
});
```

### Handling Deleted Events in Delta Sync
```typescript
// Source: https://learn.microsoft.com/en-us/graph/delta-query-events
async function processCalendarDeltas(deltaResponse: any, tenantId: string) {
  for (const event of deltaResponse.value) {
    // Microsoft Graph marks deletions with @removed property
    if (event['@removed']) {
      await db
        .delete(calendarEvents)
        .where(
          and(
            eq(calendarEvents.tenantId, tenantId),
            eq(calendarEvents.externalId, event.id)
          )
        );
      continue;
    }

    // Google Calendar marks deletions with status: 'cancelled'
    if (event.status === 'cancelled') {
      await db
        .delete(calendarEvents)
        .where(
          and(
            eq(calendarEvents.tenantId, tenantId),
            eq(calendarEvents.externalId, event.id)
          )
        );
      continue;
    }

    // Normal create/update
    await upsertCalendarEvent(event, tenantId);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling every N minutes | Webhooks + delta sync fallback | Ongoing best practice | Webhooks provide real-time updates, delta sync ensures reliability |
| Exchange Web Services (EWS) | Microsoft Graph API | EWS deprecated Oct 1, 2026 | All Microsoft calendar integrations must use Graph API |
| Refresh tokens indefinite | Refresh token expiration/rotation | OAuth 2.1 (2026+) | Microsoft rotates refresh tokens, must store new token from refresh response |
| Implicit grant flow | Authorization Code + PKCE | OAuth 2.1 requirement | More secure, prevents token interception |
| Storing offset (e.g., "-07:00") | Storing IANA timezone (e.g., "America/Los_Angeles") | Best practice 2025+ | Handles DST transitions correctly, future-proof |
| Manual sync token management | SDK-managed incremental sync | Modern SDKs (2024+) | Reduces complexity, fewer bugs |

**Deprecated/outdated:**
- **Exchange Web Services (EWS):** Deprecated by Microsoft, end-of-support October 1, 2026. Use Microsoft Graph API.
- **Google Calendar API v2:** Deprecated. Use v3.
- **OAuth Implicit Grant:** Removed in OAuth 2.1. Use Authorization Code with PKCE.
- **Storing raw UTC only:** Loses timezone context. Store UTC + IANA timezone.

## Open Questions

1. **Should we support shared/delegated calendars?**
   - What we know: Google and Microsoft both support shared calendars with delegated access
   - What's unclear: If construction teams need to connect shared company calendars vs individual user calendars, or both
   - Recommendation: Phase 11 focuses on individual user calendars. If company-wide calendar needed, add in later phase. Requires different OAuth scopes and UI.

2. **What's the right sync frequency for scheduled fallback?**
   - What we know: Webhooks provide real-time updates but aren't 100% reliable
   - What's unclear: How often construction project milestones change in practice
   - Recommendation: Start with daily scheduled full sync (using delta tokens). Monitor sync lag metrics and adjust if needed. For high-priority projects, consider hourly.

3. **Should we support recurring project milestones?**
   - What we know: Calendar APIs support recurring events via RRULE
   - What's unclear: If construction milestones are recurring (e.g., weekly site inspections)
   - Recommendation: Support one-time events in Phase 11. If recurring milestones needed, add RRULE support in follow-up phase. Saves complexity.

4. **How to handle calendar conflicts (double-booking)?**
   - What we know: Multiple calendar providers support free/busy queries
   - What's unclear: If platform should prevent users from creating conflicting milestones
   - Recommendation: Phase 11 is read-only sync (milestones → calendar). Don't implement conflict detection yet. If users want calendar events → milestones sync, add conflict detection in later phase.

5. **What about Apple iCloud Calendar?**
   - What we know: Requirements mention Google and Microsoft/Outlook only
   - What's unclear: If construction teams use iCloud
   - Recommendation: Phase 11 covers Google + Microsoft (satisfies requirements). iCloud uses CalDAV (different protocol). Add if users request.

## Sources

### Primary (HIGH confidence)
- [Google Calendar API Sync Guide](https://developers.google.com/workspace/calendar/api/guides/sync) - Incremental sync with sync tokens
- [Google Calendar API Push Notifications](https://developers.google.com/workspace/calendar/api/guides/push) - Webhook setup and channel management
- [Microsoft Graph Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-events) - Delta sync for calendar events
- [Google OAuth 2.0 Web Server](https://developers.google.com/identity/protocols/oauth2/web-server) - OAuth flow with offline access
- [Google Calendar API Quotas](https://developers.google.com/workspace/calendar/api/guides/quota) - Rate limits and quota management
- [Microsoft Graph Throttling Limits](https://learn.microsoft.com/en-us/graph/throttling-limits) - Service-specific rate limits
- [Microsoft Graph Webhooks](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks) - Subscription setup and validation
- [Microsoft Graph Subscription Update](https://learn.microsoft.com/en-us/graph/api/subscription-update) - Renewing webhook subscriptions

### Secondary (MEDIUM confidence)
- [Implement Bidirectional Calendar Sync - Developer Guide 2025](https://calendhub.com/blog/implement-bidirectional-calendar-sync-2025/) - Architecture patterns and conflict resolution
- [How to Implement Last-Write-Wins](https://oneuptime.com/blog/post/2026-01-30-last-write-wins/view) - Conflict resolution strategies
- [Timezone Conversion Best Practices](https://www.datetimeapp.com/learn/timezone-conversion-best-practices) - UTC and IANA timezone handling
- [How to Build a Task Scheduler with BullMQ](https://oneuptime.com/blog/post/2026-01-26-task-scheduler-bullmq-nodejs/view) - Background job scheduling
- [BullMQ Job Schedulers](https://docs.bullmq.io/guide/job-schedulers) - Repeatable jobs and scheduled tasks
- [The Deceptively Complex World of Calendar Events and RRULEs](https://www.nylas.com/blog/calendar-events-rrules/) - Recurring event complexity
- [Calendar Webhook Integration - Developer Guide 2025](https://calendhub.com/blog/calendar-webhook-integration-developer-guide-2025/) - Webhook reliability and best practices
- [Best Calendar APIs in 2025](https://www.cronofy.com/blog/best-calendar-apis) - Google vs Microsoft comparison
- [@googleapis/calendar npm](https://www.npmjs.com/package/@googleapis/calendar) - Official Google Calendar SDK
- [@microsoft/microsoft-graph-client npm](https://www.npmjs.com/package/@microsoft/microsoft-graph-client) - Official Microsoft Graph SDK

### Tertiary (LOW confidence)
- Various community discussions on webhook reliability, recurring events, and timezone handling (validated against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDKs verified via npm, existing BullMQ pattern proven in Phase 8
- Architecture: HIGH - Patterns verified against official documentation, adapted from working QuickBooks integration
- Pitfalls: MEDIUM-HIGH - Webhook reliability confirmed by official docs, other pitfalls cross-verified with multiple sources
- Rate limits: HIGH - Official Microsoft and Google documentation
- OAuth flows: HIGH - Official provider documentation
- Conflict resolution: MEDIUM - Best practices from industry sources, not provider-mandated
- Recurring events: MEDIUM - RRULE complexity acknowledged but not fully explored (deferred to Open Questions)

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (30 days - calendar APIs are stable, but OAuth 2.1 migration ongoing)

**Key assumptions:**
- Phase 11 focuses on one-way sync (platform milestones → external calendars) based on requirements. Bi-directional sync mentioned but not required for success criteria.
- Individual user calendars (not company-wide shared calendars) are primary use case.
- QuickBooks OAuth encryption pattern (AES-256-GCM) and BullMQ worker pattern are proven and should be reused.
- Construction project milestones are typically one-time events (not recurring).
