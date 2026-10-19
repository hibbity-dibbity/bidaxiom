import { and, eq, isNull } from 'drizzle-orm';
import { AuditAction, buildVendorRows, VENDOR_ROW_MAPPING } from '@construction/shared';
import { qboQueryRows } from './client.js';
import { getQboAccess } from './receipts.js';
import { vendorKey } from './vendorBills.js';
import { createAuditLog } from '../../audit/logger.js';
import { generateNameSlug } from '../../utils/slug.js';
import { db as publicDb, createTenantDb } from '../../db/client.js';
import { tenants } from '../../db/schema/public.js';

/**
 * Reads the QuickBooks Vendor list into Subs & Vendors. QuickBooks stays the book of record: nothing here writes to QuickBooks.
 *
 * - A vendor is matched by its QuickBooks id. The first time, an entry with the same name (ignoring Inc, LLC, punctuation)
 *   is linked instead of duplicated; if two entries could match, neither is touched.
 * - QuickBooks wins on name, contact, email, phone, address, terms, 1099 and active/inactive. A blank in QuickBooks never
 *   erases something BidAxiom has. Subcontractor/supplier, trade, category, credit limit, insurance, W-9 and notes are BidAxiom's.
 * - A vendor that is blacklisted in BidAxiom stays blacklisted.
 */

type Tenant = { tenantId: string; db: any; schema: any };
export const VENDOR_ACTOR = 'quickbooks-sync';
const OVERLAP_MINUTES = 30;

export interface VendorSyncResult {
  read: number;
  added: number;
  updated: number;
  linked: number;
  ambiguous: number;
}

/** A QuickBooks Vendor as a normalized BidAxiom row. */
export function qboVendorToRow(v: any): string[] {
  const addr = v.BillAddr ?? {};
  const street = [addr.Line1, addr.Line2, addr.Line3].filter(Boolean);
  const name = String(v.DisplayName ?? v.CompanyName ?? '').trim();
  const contact = [v.GivenName, v.FamilyName].filter(Boolean).join(' ');
  return [
    name,
    contact,
    v.PrimaryEmailAddr?.Address ?? '',
    v.PrimaryPhone?.FreeFormNumber ?? v.Mobile?.FreeFormNumber ?? v.AlternatePhone?.FreeFormNumber ?? '',
    street[0] ?? '',
    street.slice(1).join(', '),
    addr.City ?? '',
    addr.CountrySubDivisionCode ?? '',
    addr.PostalCode ?? '',
    v.Vendor1099 ? 'subcontractor' : 'supplier', // only used for vendors BidAxiom has not seen before
    '',
    v.TermRef?.name ?? '',
    '',
    v.TaxIdentifier ?? '',
    v.Vendor1099 ? 'Yes' : 'No',
    v.Active === false ? 'inactive' : 'active',
    '',
  ];
}

async function queryAllVendors(accessToken: string, realmId: string, since: Date | null): Promise<any[]> {
  const where = since ? `Active in (true, false) AND MetaData.LastUpdatedTime >= '${since.toISOString()}'` : `Active in (true, false)`;
  const rows: any[] = [];
  for (let start = 1; start < 20_001; start += 500) {
    const page = await qboQueryRows<any>(accessToken, realmId, 'Vendor', `select * from Vendor where ${where} STARTPOSITION ${start} MAXRESULTS 500`);
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}

/** Bring new and changed QuickBooks vendors into Subs & Vendors. `full` ignores the last-check time. */
export async function pullVendors(t: Tenant, opts: { full?: boolean; actorId?: string; records?: any[] } = {}, now = new Date()): Promise<VendorSyncResult | null> {
  const { db, schema } = t;
  const access = opts.records ? { accessToken: '', realmId: '' } : await getQboAccess(t);
  if (!access) return null;
  const dir = schema.subcontractorDirectory;
  const [p] = await db.select({ last: schema.companyProfiles.qboVendorsLastCheckAt }).from(schema.companyProfiles).where(isNull(schema.companyProfiles.validTo)).limit(1);
  const since = !opts.full && p?.last ? new Date(new Date(p.last).getTime() - OVERLAP_MINUTES * 60_000) : null;
  const recs = opts.records ?? await queryAllVendors(access.accessToken, access.realmId, since);

  const existing: any[] = await db.select().from(dir);
  const byQbo = new Map<string, any>();
  const unlinked = new Map<string, any[]>();
  const taken = new Set<string>();
  for (const e of existing) {
    if (e.slug) taken.add(e.slug);
    if (e.qboVendorId) byQbo.set(e.qboVendorId, e);
    else {
      const k = vendorKey(e.companyName);
      if (k) unlinked.set(k, [...(unlinked.get(k) ?? []), e]);
    }
  }

  const res: VendorSyncResult = { read: recs.length, added: 0, updated: 0, linked: 0, ambiguous: 0 };
  for (const rec of recs) {
    const qboId = String(rec.Id);
    const built = buildVendorRows([qboVendorToRow(rec)], VENDOR_ROW_MAPPING, { defaultKind: 'supplier' }, [])[0];
    const v = built?.vendor;
    if (!v) continue;

    let match = byQbo.get(qboId);
    let linking = false;
    if (!match) {
      const cands = unlinked.get(vendorKey(v.companyName)) ?? [];
      if (cands.length > 1) {
        res.ambiguous++;
        continue;
      }
      if (cands.length === 1) {
        match = cands[0];
        linking = true;
      }
    }

    if (!match) {
      const base = generateNameSlug(v.companyName) || 'vendor';
      let slug = base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
      taken.add(slug);
      await db.insert(dir).values({
        companyName: v.companyName,
        contactName: v.contactName,
        contactEmail: v.email,
        contactPhone: v.phone,
        street1: v.street1,
        street2: v.street2,
        city: v.city,
        state: v.state,
        zip: v.zip,
        trades: [],
        trade: v.kind === 'subcontractor' ? ['Other'] : [],
        kind: v.kind,
        paymentTerms: v.paymentTerms,
        taxIdLast4: v.taxIdLast4,
        is1099: v.is1099,
        status: v.status,
        slug,
        qboVendorId: qboId,
        qboSyncedAt: now,
        createdBy: opts.actorId ?? VENDOR_ACTOR,
      });
      res.added++;
      continue;
    }

    // QuickBooks wins on these, but a blank never erases a value.
    const patch: Record<string, unknown> = {};
    const set = (col: string, next: unknown) => {
      if (next !== null && next !== undefined && next !== '' && match[col] !== next) patch[col] = next;
    };
    set('companyName', v.companyName);
    set('contactName', v.contactName);
    set('contactEmail', v.email);
    set('contactPhone', v.phone);
    set('street1', v.street1);
    set('street2', v.street2);
    set('city', v.city);
    set('state', v.state);
    set('zip', v.zip);
    set('paymentTerms', v.paymentTerms);
    set('taxIdLast4', v.taxIdLast4);
    if (match.is1099 !== v.is1099) patch.is1099 = v.is1099;
    if (match.status !== 'blacklisted' && match.status !== v.status) patch.status = v.status;
    if (linking) patch.qboVendorId = qboId;
    if (Object.keys(patch).length > 0 || linking) {
      await db.update(dir).set({ ...patch, qboSyncedAt: now, updatedAt: now }).where(eq(dir.id, match.id));
      if (linking) {
        res.linked++;
        const k = vendorKey(match.companyName);
        unlinked.set(k, (unlinked.get(k) ?? []).filter((x) => x.id !== match.id));
      }
      if (Object.keys(patch).filter((k) => k !== 'qboVendorId').length > 0) res.updated++;
    }
  }

  await db.update(schema.companyProfiles).set({ qboVendorsLastCheckAt: now }).where(isNull(schema.companyProfiles.validTo));
  if (res.added || res.updated || res.linked) {
    await createAuditLog(db, schema, {
      entityType: 'SubcontractorDirectory',
      entityId: t.tenantId,
      action: AuditAction.UPDATE,
      actorId: opts.actorId ?? VENDOR_ACTOR,
      changes: { after: { quickbooksVendorSync: res } },
    });
  }
  return res;
}

const EVERY_HOURS = 4;
let timer: NodeJS.Timeout | null = null;
let busy = false;

/** Hourly check; companies with vendor sync turned on that have not been read for a few hours get a pass. */
export function startQboVendorScheduler(): void {
  if (timer) return;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const all = await publicDb.select().from(tenants).where(eq(tenants.status, 'active'));
      for (const row of all) {
        try {
          const ctx = createTenantDb(row.schemaName);
          const t: Tenant = { tenantId: row.id, db: ctx.db, schema: ctx };
          const [s] = await t.db
            .select({ on: ctx.companyProfiles.qboReadVendors, last: ctx.companyProfiles.qboVendorsLastCheckAt })
            .from(ctx.companyProfiles)
            .where(and(isNull(ctx.companyProfiles.validTo)))
            .limit(1);
          if (!s?.on) continue;
          if (s.last && Date.now() - new Date(s.last).getTime() < EVERY_HOURS * 3_600_000) continue;
          await pullVendors(t);
        } catch (e) {
          console.error('[qbo-vendors] pass failed', row.id, e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.error('[qbo-vendors] scheduler failed', e instanceof Error ? e.message : e);
    } finally {
      busy = false;
    }
  };
  timer = setInterval(tick, 3_600_000);
  timer.unref?.();
  setTimeout(tick, 90_000).unref?.();
}
