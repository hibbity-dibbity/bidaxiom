import { and, eq, isNull } from 'drizzle-orm';
import { AuditAction } from '@construction/shared';
import { createQboClient, promisifyQbo, qboQueryRows, qboQuote, qboFaultText } from './client.js';
import { getQboAccess } from './receipts.js';
import { qboName } from './sync/mappers/project.js';
import { createAuditLog } from '../../audit/logger.js';

/**
 * Sends the Subs & Vendors list to QuickBooks. One way only: BidAxiom's list is the master, and nothing here reads
 * vendors back, so gas stations and one-off vendors that only exist in QuickBooks never come into BidAxiom.
 * (What QuickBooks says was paid on a vendor's bills is read back separately, with the vendor bills.)
 *
 * - A vendor with no QuickBooks link is matched by name to one already in QuickBooks (linked, left as is) or created.
 * - A linked vendor is updated in QuickBooks only when it changed in BidAxiom since the last send.
 * - Inactive and blacklisted vendors are not created in QuickBooks. An inactive one that is already linked is made inactive there.
 */

type Tenant = { tenantId: string; db: any; schema: any };

export interface VendorPushPreview {
  /** Not in QuickBooks yet (will be created, or linked if the name already exists there). */
  toCreate: number;
  /** Linked, and changed in BidAxiom since the last send. */
  toUpdate: number;
  upToDate: number;
}

export interface VendorPushResult {
  created: number;
  linked: number;
  updated: number;
  failed: Array<{ name: string; error: string }>;
}

/** The QuickBooks operations used here, so tests can stand in for QuickBooks. */
export interface VendorQbo {
  findByName(name: string): Promise<any | null>;
  get(id: string): Promise<any | null>;
  create(body: Record<string, unknown>): Promise<any>;
  update(body: Record<string, unknown>): Promise<any>;
}

function liveQbo(accessToken: string, realmId: string): VendorQbo {
  const client = createQboClient(accessToken, realmId);
  return {
    findByName: async (name) => (await qboQueryRows<any>(accessToken, realmId, 'Vendor', `select * from Vendor where DisplayName = ${qboQuote(name)}`))[0] ?? null,
    get: async (id) => {
      try {
        return await promisifyQbo<any>(client.getVendor.bind(client), id);
      } catch {
        return null;
      }
    },
    create: (body) => promisifyQbo<any>(client.createVendor.bind(client), body),
    update: (body) => promisifyQbo<any>(client.updateVendor.bind(client), body),
  };
}

function bodyFor(v: any): Record<string, unknown> {
  const [given, ...rest] = String(v.contactName ?? '').trim().split(/\s+/).filter(Boolean);
  const lines = [v.street1, v.street2].filter(Boolean) as string[];
  return {
    CompanyName: String(v.companyName).slice(0, 100),
    GivenName: given || undefined,
    FamilyName: rest.length ? rest.join(' ').slice(0, 25) : undefined,
    PrimaryEmailAddr: v.contactEmail ? { Address: v.contactEmail } : undefined,
    PrimaryPhone: v.contactPhone ? { FreeFormNumber: v.contactPhone } : undefined,
    BillAddr: lines.length || v.city ? { Line1: lines[0], Line2: lines[1], City: v.city || undefined, CountrySubDivisionCode: v.state || undefined, PostalCode: v.zip || undefined } : undefined,
    Vendor1099: Boolean(v.is1099),
  };
}

async function loadState(t: Tenant) {
  const { db, schema } = t;
  const vendors: any[] = await db.select().from(schema.subcontractorDirectory);
  const maps: any[] = await db.select().from(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.entityType, 'vendor'));
  const byVendor = new Map<string, any>(maps.map((m) => [m.platformId, m]));
  return { vendors, byVendor };
}

/** The QuickBooks id and last-sent time for a vendor: its saved mapping, else the id an older version stored on the entry. */
function linkOf(v: any, byVendor: Map<string, any>): { qboId: string; syncedAt: Date | null; mapping: any | null } | null {
  const m = byVendor.get(v.id);
  if (m) return { qboId: m.qboId, syncedAt: m.lastSyncedAt ? new Date(m.lastSyncedAt) : null, mapping: m };
  if (v.qboVendorId) return { qboId: v.qboVendorId, syncedAt: v.qboSyncedAt ? new Date(v.qboSyncedAt) : null, mapping: null };
  return null;
}

const changedSince = (v: any, at: Date | null) => !at || new Date(v.updatedAt).getTime() > at.getTime() + 1000;

/** What a send would do, without contacting QuickBooks. */
export async function previewVendorPush(t: Tenant): Promise<VendorPushPreview> {
  const { vendors, byVendor } = await loadState(t);
  const out: VendorPushPreview = { toCreate: 0, toUpdate: 0, upToDate: 0 };
  for (const v of vendors) {
    const link = linkOf(v, byVendor);
    if (!link) {
      if (v.status === 'active') out.toCreate++;
    } else if (changedSince(v, link.syncedAt)) out.toUpdate++;
    else out.upToDate++;
  }
  return out;
}

/** Send new and changed vendors to QuickBooks. */
export async function pushVendors(t: Tenant, opts: { actorId?: string; qbo?: VendorQbo } = {}, now = new Date()): Promise<VendorPushResult | null> {
  const { db, schema } = t;
  let qbo = opts.qbo;
  if (!qbo) {
    const access = await getQboAccess(t);
    if (!access) return null;
    qbo = liveQbo(access.accessToken, access.realmId);
  }
  const { vendors, byVendor } = await loadState(t);
  const res: VendorPushResult = { created: 0, linked: 0, updated: 0, failed: [] };

  const saveLink = async (v: any, existing: any | null, q: any, matchedExisting: boolean) => {
    const vals = { qboId: String(q.Id), qboSyncToken: q.SyncToken ?? null, direction: 'platform_to_qbo', syncStatus: 'synced', lastSyncedAt: now, updatedAt: now };
    if (existing) await db.update(schema.qboEntityMappings).set(vals).where(eq(schema.qboEntityMappings.id, existing.id));
    else await db.insert(schema.qboEntityMappings).values({ entityType: 'vendor', platformId: v.id, ...vals, metadata: { matchedExisting } });
    await db.update(schema.subcontractorDirectory).set({ qboVendorId: String(q.Id), qboSyncedAt: now }).where(eq(schema.subcontractorDirectory.id, v.id));
  };

  for (const v of vendors) {
    try {
      const link = linkOf(v, byVendor);
      if (!link) {
        if (v.status !== 'active') continue;
        const name = qboName(v.companyName);
        const found = await qbo.findByName(name);
        if (found) {
          await saveLink(v, null, found, true);
          res.linked++;
        } else {
          const q = await qbo.create({ DisplayName: name, ...bodyFor(v), Notes: `BidAxiom vendor ${v.id}` });
          await saveLink(v, null, q, false);
          res.created++;
        }
        continue;
      }
      if (!changedSince(v, link.syncedAt)) continue;
      const current = await qbo.get(link.qboId);
      if (!current) {
        // Deleted in QuickBooks: forget the link; the next send recreates or re-matches it.
        if (link.mapping) await db.delete(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.id, link.mapping.id));
        await db.update(schema.subcontractorDirectory).set({ qboVendorId: null, qboSyncedAt: null }).where(eq(schema.subcontractorDirectory.id, v.id));
        continue;
      }
      const q = await qbo.update({ Id: current.Id, SyncToken: current.SyncToken, sparse: true, ...bodyFor(v), Active: v.status === 'active' });
      await saveLink(v, link.mapping, q, false);
      res.updated++;
    } catch (e) {
      res.failed.push({ name: v.companyName, error: qboFaultText(e) ?? (e instanceof Error ? e.message : 'Unknown error') });
    }
  }

  if (res.created || res.linked || res.updated) {
    await createAuditLog(db, schema, {
      entityType: 'SubcontractorDirectory',
      entityId: t.tenantId,
      action: AuditAction.UPDATE,
      actorId: opts.actorId ?? 'quickbooks-sync',
      changes: { after: { sentVendorsToQuickbooks: { created: res.created, linked: res.linked, updated: res.updated, failed: res.failed.length } } },
    });
  }
  return res;
}
