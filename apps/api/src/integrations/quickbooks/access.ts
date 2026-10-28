import { eq, isNull, sql } from 'drizzle-orm';
import { refreshQboToken } from './oauth.js';
import { encryptToken } from './crypto.js';
import { QboUserError } from './client.js';
import { sendQboReconnectAlertEmail, splitEmails } from '../../services/email.js';

/**
 * The one place a QuickBooks access token is renewed.
 *
 * QuickBooks hands out a new refresh token every time one is used. When the worker (ten jobs at once), the payment check and
 * the connection check each renewed the token on their own, they raced: several used the same old refresh token, and
 * QuickBooks answered "refresh token is invalid" even though the connection was fine. So renewals are serialized here, in this
 * process and (with a database lock) across processes, and each one re-reads the saved token first, because another caller may
 * have just renewed it.
 */

type Db = any;
type Schema = any;

const inflight = new Map<string, Promise<{ accessToken: string; realmId: string }>>();

export const RECONNECT_MESSAGE = 'QuickBooks needs to be reconnected. Open Settings > Integrations and press Reconnect QuickBooks.';

const looksRevoked = (e: unknown) => /refresh token is invalid|invalid_grant|authorize again|token.*(revoked|expired)/i.test(String((e as any)?.message ?? e) + JSON.stringify((e as any)?.intuit_tid ?? ''));

async function markNeedsReconnect(db: Db, schema: Schema, connId: string, detail?: string): Promise<void> {
  const changed = await db.update(schema.qboConnections).set({ status: 'expired', updatedAt: new Date() }).where(eq(schema.qboConnections.id, connId)).returning({ id: schema.qboConnections.id });
  if (changed.length > 0) {
    await db
      .insert(schema.qboSyncNotifications)
      .values({ entityType: 'connection', entityId: connId, message: detail ?? RECONNECT_MESSAGE, severity: 'error', dismissed: false })
      .catch(() => undefined);
    // Only the first failure (the change to expired) sends the email, so a dead connection does not mail again every minute.
    await sendReconnectAlert(db, schema, detail ?? RECONNECT_MESSAGE);
  }
}

/** Email the addresses the company chose, if it turned alerts on. Never throws: the alert must not hide the real error. */
async function sendReconnectAlert(db: Db, schema: Schema, detail: string): Promise<void> {
  try {
    const [p] = await db
      .select({ on: schema.companyProfiles.qboAlertEnabled, emails: schema.companyProfiles.qboAlertEmails })
      .from(schema.companyProfiles)
      .where(isNull(schema.companyProfiles.validTo))
      .limit(1);
    const to = p?.on ? splitEmails(p.emails ?? '') : [];
    if (to.length > 0) await sendQboReconnectAlertEmail(to, detail);
  } catch (e) {
    console.error('[qbo-token] could not send the reconnect alert:', e instanceof Error ? e.message : e);
  }
}

export async function getFreshAccess(db: Db, schema: Schema, connId: string): Promise<{ accessToken: string; realmId: string }> {
  const running = inflight.get(connId);
  if (running) return running;
  const p = (async () => {
    return db.transaction(async (tx: Db) => {
      // Another process may be renewing too; wait for it, then read what it saved.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'qbo-token:' + connId}))`);
      const [conn] = await tx.select().from(schema.qboConnections).where(eq(schema.qboConnections.id, connId)).limit(1);
      if (!conn) throw new QboUserError('No QuickBooks connection.');
      if (conn.status !== 'active') throw new QboUserError(RECONNECT_MESSAGE);
      if (conn.accessToken && new Date(conn.tokenExpiresAt) > new Date(Date.now() + 60_000)) {
        return { accessToken: conn.accessToken as string, realmId: conn.realmId as string };
      }
      try {
        const fresh = await refreshQboToken(conn.encryptedRefreshToken);
        // QuickBooks has already retired the old refresh token. Save the new one on its own connection, at once, so that
        // nothing later in this transaction (or a restart right now) can roll it back and lose it.
        await db
          .update(schema.qboConnections)
          .set({
            accessToken: fresh.accessToken,
            encryptedRefreshToken: encryptToken(fresh.refreshToken),
            tokenExpiresAt: fresh.tokenExpiresAt,
            refreshTokenExpiresAt: fresh.refreshTokenExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(schema.qboConnections.id, conn.id));
        return { accessToken: fresh.accessToken, realmId: conn.realmId as string };
      } catch (e) {
        console.error('[qbo-token] refresh failed:', String((e as any)?.message ?? e), 'tid=', (e as any)?.intuit_tid ?? '-', 'body=', JSON.stringify((e as any)?.authResponse?.json ?? (e as any)?.originalMessage ?? '').slice(0, 300));
        if (looksRevoked(e)) {
          const err = new QboUserError(`${RECONNECT_MESSAGE} (QuickBooks said: ${String((e as any)?.originalMessage ?? (e as any)?.message ?? 'refresh token invalid').slice(0, 160)})`);
          (err as any).revoked = true;
          throw err;
        }
        throw e;
      }
    });
  })();
  inflight.set(connId, p);
  try {
    return await p;
  } catch (e) {
    // The failed transaction rolled back; record the dead connection outside it.
    if ((e as any)?.revoked) await markNeedsReconnect(db, schema, connId, (e as Error).message);
    throw e;
  } finally {
    inflight.delete(connId);
  }
}
