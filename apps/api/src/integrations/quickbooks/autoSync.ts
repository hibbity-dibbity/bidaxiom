import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getQboSyncQueue } from './queue.js';
import { db as publicDb, createTenantDb } from '../../db/client.js';
import { tenants } from '../../db/schema/public.js';

/**
 * Automatic project sync to QuickBooks. A company chooses one of:
 *   off        nothing is sent unless someone presses Sync Now (default)
 *   on_change  a project is sent when it is created, renamed, re-numbered or changes phase
 *   scheduled  every qboSyncIntervalMinutes, new and changed projects are sent
 * Nothing here can break saving a project: every failure is logged and swallowed.
 */

export const QBO_AUTO_SYNC_MODES = ['off', 'on_change', 'scheduled'] as const;
export type QboAutoSyncMode = (typeof QBO_AUTO_SYNC_MODES)[number];

type TenantLike = { tenantId: string; db: any; schema: any };

async function readSettings(t: { db: any; schema: any }) {
  const [p] = await t.db
    .select({
      mode: t.schema.companyProfiles.qboAutoSync,
      interval: t.schema.companyProfiles.qboSyncIntervalMinutes,
      lastRun: t.schema.companyProfiles.qboAutoSyncLastRunAt,
    })
    .from(t.schema.companyProfiles)
    .where(isNull(t.schema.companyProfiles.validTo))
    .limit(1);
  return p as { mode: QboAutoSyncMode; interval: number; lastRun: Date | null } | undefined;
}

async function hasActiveConnection(t: { db: any; schema: any }): Promise<boolean> {
  const rows = await t.db.select({ id: t.schema.qboConnections.id }).from(t.schema.qboConnections).where(eq(t.schema.qboConnections.status, 'active')).limit(1);
  return rows.length > 0;
}

/** Called after a project is created or changed. Sends it to QuickBooks when the company has "on change" turned on. */
export async function queueProjectSyncOnChange(tenant: TenantLike, projectId: string): Promise<void> {
  try {
    const s = await readSettings(tenant);
    if (!s || s.mode !== 'on_change') return;
    if (!(await hasActiveConnection(tenant))) return;
    // Short delay so a burst of edits (rename + phase change) is sent once the dust settles.
    await getQboSyncQueue().add('sync-to-qbo', { tenantId: tenant.tenantId, entityType: 'project', platformId: projectId, syncReason: 'auto' }, { delay: 5000 });
  } catch (e) {
    console.error('[qbo-auto-sync] could not queue project', projectId, e);
  }
}

/** Called when an invoice is sent. Creates it in QuickBooks when the company turned that on. */
export async function queueInvoiceSyncOnSend(tenant: TenantLike, invoiceId: string): Promise<void> {
  try {
    const [p] = await tenant.db
      .select({ on: tenant.schema.companyProfiles.qboInvoicePush })
      .from(tenant.schema.companyProfiles)
      .where(isNull(tenant.schema.companyProfiles.validTo))
      .limit(1);
    if (!p?.on) return;
    if (!(await hasActiveConnection(tenant))) return;
    await getQboSyncQueue().add('sync-to-qbo', { tenantId: tenant.tenantId, entityType: 'invoice', platformId: invoiceId, syncReason: 'auto' }, { delay: 3000 });
  } catch (e) {
    console.error('[qbo-auto-sync] could not queue invoice', invoiceId, e);
  }
}

/** One pass of the timed mode for one company. Returns how many projects were queued. */
export async function runScheduledSyncForTenant(tenant: TenantLike, now = new Date()): Promise<number> {
  const s = await readSettings(tenant);
  if (!s || s.mode !== 'scheduled') return 0;
  const dueAt = s.lastRun ? new Date(s.lastRun).getTime() + s.interval * 60_000 : 0;
  if (now.getTime() < dueAt) return 0;
  if (!(await hasActiveConnection(tenant))) return 0;

  const { db, schema } = tenant;
  const since = s.lastRun ? new Date(s.lastRun) : null;
  const rows: Array<{ id: string }> = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .leftJoin(schema.qboEntityMappings, and(eq(schema.qboEntityMappings.platformId, schema.projects.id), eq(schema.qboEntityMappings.entityType, 'project')))
    .where(
      and(
        isNull(schema.projects.deletedAt),
        // never sent, or changed since the last pass
        since ? or(sql`${schema.qboEntityMappings.id} IS NULL`, gt(schema.projects.updatedAt, since)) : sql`true`
      )
    );
  for (const r of rows) {
    await getQboSyncQueue().add('sync-to-qbo', { tenantId: tenant.tenantId, entityType: 'project', platformId: r.id, syncReason: 'auto' });
  }
  await db.update(schema.companyProfiles).set({ qboAutoSyncLastRunAt: now }).where(isNull(schema.companyProfiles.validTo));
  return rows.length;
}

let timer: NodeJS.Timeout | null = null;

/** Checks every 5 minutes which companies are due for a timed sync. Started once with the API server. */
export function startQboAutoSyncScheduler(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const all = await publicDb.select().from(tenants).where(eq(tenants.status, 'active'));
      for (const t of all) {
        try {
          const ctx = createTenantDb(t.schemaName);
          await runScheduledSyncForTenant({ tenantId: t.id, db: ctx.db, schema: ctx });
        } catch (e) {
          console.error('[qbo-auto-sync] tenant pass failed', t.id, e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.error('[qbo-auto-sync] scheduler pass failed', e instanceof Error ? e.message : e);
    }
  };
  timer = setInterval(tick, 5 * 60_000);
  timer.unref?.();
}
