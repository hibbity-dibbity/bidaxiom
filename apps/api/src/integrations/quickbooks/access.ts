import { eq, sql } from 'drizzle-orm';
import { refreshQboToken } from './oauth.js';
import { encryptToken } from './crypto.js';
import { QboUserError } from './client.js';

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

export const RECONNECT_MESSAGE = 'QuickBooks needs to be reconnected. Open Settings > Integrations and press Connect to QuickBooks.';

const looksRevoked = (e: unknown) => /refresh token is invalid|invalid_grant|authorize again|token.*(revoked|expired)/i.test(String((e as any)?.message ?? e) + JSON.stringify((e as any)?.intuit_tid ?? ''));

async function markNeedsReconnect(db: Db, schema: Schema, connId: string): Promise<void> {
  const changed = await db.update(schema.qboConnections).set({ status: 'expired', updatedAt: new Date() }).where(eq(schema.qboConnections.id, connId)).returning({ id: schema.qboConnections.id });
  if (changed.length > 0) {
    await db
      .insert(schema.qboSyncNotifications)
      .values({ entityType: 'connection', entityId: connId, message: RECONNECT_MESSAGE, severity: 'error', dismissed: false })
      .catch(() => undefined);
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
        await tx
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
        if (looksRevoked(e)) {
          const err = new QboUserError(RECONNECT_MESSAGE);
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
    if ((e as any)?.revoked) await markNeedsReconnect(db, schema, connId);
    throw e;
  } finally {
    inflight.delete(connId);
  }
}
