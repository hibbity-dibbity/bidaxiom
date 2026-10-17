import { and, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import { AuditAction, countsAsIssued, statusAfterPayments } from '@construction/shared';
import { TRPCError } from '@trpc/server';
import { qboQueryRows } from './client.js';
import { getQboAccess, resolveScopes } from './receipts.js';
import { createAuditLog } from '../../audit/logger.js';

/**
 * Reads vendor bills and bill payments from QuickBooks and ties them to BidAxiom purchase and work orders.
 * QuickBooks stays the book of record: nothing here writes to QuickBooks.
 *
 * - A bill is linked to an order automatically when its Ref no. is the order number (PO2026-001-01), or when the bill
 *   names one BidAxiom job and a vendor that has exactly one order on that job. Everything else waits for a person.
 * - Payments QuickBooks recorded against a linked bill appear on the order as payments, and follow QuickBooks
 *   if they change. Unlinking a bill takes them off again.
 */

type Tenant = { tenantId: string; db: any; schema: any };

const r2 = (n: number) => Math.round(n * 100) / 100;
const cents = (n: number) => Math.round(n * 100);
const FIRST_LOOKBACK_DAYS = 90;
const OVERLAP_DAYS = 2;
export const BILL_ACTOR = 'quickbooks-sync';

/** "Acme Concrete, LLC" and "ACME CONCRETE" are the same vendor. */
export function vendorKey(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['inc', 'llc', 'co', 'corp', 'corporation', 'company', 'ltd', 'the'].includes(w))
    .join('');
}

const docKey = (s: string | null | undefined) => (s ?? '').trim().toUpperCase().replace(/\s+/g, '');

export interface BillRow {
  qboId: string;
  docNumber: string | null;
  txnDate: string;
  dueDate: string | null;
  qboVendorId: string | null;
  vendorName: string | null;
  total: number;
  balance: number;
  qboCustomerIds: string[];
  qboPoIds: string[];
  lines: Array<{ job: string | null; amount: number; account: string | null }>;
  memo: string | null;
}

/** What each expense line cost, which job it names and which account it posts to. */
export function expenseLines(rec: any): Array<{ job: string | null; amount: number; account: string | null }> {
  const out: Array<{ job: string | null; amount: number; account: string | null }> = [];
  for (const ln of rec.Line ?? []) {
    const d = ln.AccountBasedExpenseLineDetail ?? ln.ItemBasedExpenseLineDetail;
    if (!d) continue;
    out.push({ job: d.CustomerRef?.value ? String(d.CustomerRef.value) : null, amount: r2(Number(ln.Amount ?? 0)), account: d.AccountRef?.name ?? d.ItemRef?.name ?? null });
  }
  return out;
}

export function billFrom(rec: any): BillRow {
  const jobs = new Set<string>();
  // "Copy to bill" in QuickBooks leaves a link to the purchase order on the bill (and on its lines).
  const pos = new Set<string>();
  for (const x of [...(rec.LinkedTxn ?? []), ...(rec.Line ?? []).flatMap((l: any) => l.LinkedTxn ?? [])]) {
    if (x.TxnType === 'PurchaseOrder' && x.TxnId) pos.add(String(x.TxnId));
  }
  for (const ln of rec.Line ?? []) {
    const d = ln.AccountBasedExpenseLineDetail ?? ln.ItemBasedExpenseLineDetail;
    if (d?.CustomerRef?.value) jobs.add(String(d.CustomerRef.value));
  }
  return {
    qboId: String(rec.Id),
    docNumber: rec.DocNumber ?? null,
    txnDate: rec.TxnDate ?? new Date().toISOString().slice(0, 10),
    dueDate: rec.DueDate ?? null,
    qboVendorId: rec.VendorRef?.value ? String(rec.VendorRef.value) : null,
    vendorName: rec.VendorRef?.name ?? null,
    total: r2(Number(rec.TotalAmt ?? 0)),
    balance: r2(Number(rec.Balance ?? 0)),
    qboCustomerIds: [...jobs],
    qboPoIds: [...pos],
    lines: expenseLines(rec),
    memo: rec.PrivateNote ?? null,
  };
}

export function billPaymentFrom(rec: any) {
  const links: Array<{ qboBillId: string; amount: number }> = [];
  for (const ln of rec.Line ?? []) {
    for (const x of ln.LinkedTxn ?? []) {
      if (x.TxnType === 'Bill') links.push({ qboBillId: String(x.TxnId), amount: r2(Number(ln.Amount ?? 0)) });
    }
  }
  return {
    qboId: String(rec.Id),
    txnDate: rec.TxnDate ?? new Date().toISOString().slice(0, 10),
    reference: rec.DocNumber ?? rec.CheckPayment?.CheckNum ?? null,
    total: r2(Number(rec.TotalAmt ?? 0)),
    links,
  };
}

async function queryAll(accessToken: string, realmId: string, entity: string, where: string): Promise<any[]> {
  const rows: any[] = [];
  for (let start = 1; start < 20_001; start += 500) {
    const page = await qboQueryRows<any>(accessToken, realmId, entity, `select * from ${entity} where ${where} STARTPOSITION ${start} MAXRESULTS 500`);
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}

/** Bring new and changed bills and bill payments into BidAxiom. Returns how many were added or changed. */
export async function pullVendorBills(t: Tenant, now = new Date()): Promise<number> {
  const { db, schema } = t;
  const access = await getQboAccess(t);
  if (!access) return 0;
  const [p] = await db.select({ last: schema.companyProfiles.qboBillsLastCheckAt }).from(schema.companyProfiles).where(isNull(schema.companyProfiles.validTo)).limit(1);
  const from = p?.last ? new Date(new Date(p.last).getTime() - OVERLAP_DAYS * 86400000) : new Date(now.getTime() - FIRST_LOOKBACK_DAYS * 86400000);
  // Bills read before lines were kept have none yet: look back the full first-time window once to fill them in.
  const [missing] = await db.select({ n: sql<number>`count(*)` }).from(schema.qboBills).where(isNull(schema.qboBills.lines));
  const backfill = Number(missing?.n ?? 0) > 0;
  const where = p?.last && !backfill ? `MetaData.LastUpdatedTime >= '${from.toISOString()}'` : `TxnDate >= '${from.toISOString().slice(0, 10)}'`;

  let changed = 0;
  for (const rec of await queryAll(access.accessToken, access.realmId, 'Bill', where)) {
    const b = billFrom(rec);
    if (!(b.total > 0)) continue;
    const [existing] = await db.select().from(schema.qboBills).where(eq(schema.qboBills.qboId, b.qboId)).limit(1);
    const vals = { docNumber: b.docNumber, txnDate: b.txnDate, dueDate: b.dueDate, qboVendorId: b.qboVendorId, vendorName: b.vendorName, total: String(b.total), balance: String(b.balance), qboCustomerIds: b.qboCustomerIds, qboPoIds: b.qboPoIds, lines: b.lines, memo: b.memo };
    if (!existing) {
      await db.insert(schema.qboBills).values({ qboId: b.qboId, ...vals });
      changed++;
    } else if (cents(Number(existing.total)) !== cents(b.total) || cents(Number(existing.balance)) !== cents(b.balance) || existing.docNumber !== b.docNumber || existing.vendorName !== b.vendorName || JSON.stringify(existing.qboCustomerIds) !== JSON.stringify(b.qboCustomerIds) || JSON.stringify(existing.qboPoIds ?? []) !== JSON.stringify(b.qboPoIds) || JSON.stringify(existing.lines ?? null) !== JSON.stringify(b.lines)) {
      await db.update(schema.qboBills).set({ ...vals, updatedAt: new Date() }).where(eq(schema.qboBills.id, existing.id));
      changed++;
    }
  }
  if (backfill) await db.update(schema.qboBills).set({ lines: [] }).where(isNull(schema.qboBills.lines)); // gone from QuickBooks: stop looking
  // Checks, card and cash purchases: money already spent. Only the ones that name a job matter to a project.
  for (const rec of await queryAll(access.accessToken, access.realmId, 'Purchase', where)) {
    const lines = expenseLines(rec);
    if (!lines.some((l) => l.job)) continue;
    const total = r2(Number(rec.TotalAmt ?? 0));
    if (!(total > 0)) continue;
    const vals = { paymentType: rec.PaymentType ?? null, docNumber: rec.DocNumber ?? null, txnDate: rec.TxnDate ?? new Date().toISOString().slice(0, 10), vendorName: rec.EntityRef?.name ?? null, total: String(total), lines, memo: rec.PrivateNote ?? null };
    const [existing] = await db.select().from(schema.qboExpenses).where(eq(schema.qboExpenses.qboId, String(rec.Id))).limit(1);
    if (!existing) {
      await db.insert(schema.qboExpenses).values({ qboId: String(rec.Id), ...vals });
      changed++;
    } else if (cents(Number(existing.total)) !== cents(total) || JSON.stringify(existing.lines) !== JSON.stringify(lines) || existing.vendorName !== vals.vendorName) {
      await db.update(schema.qboExpenses).set({ ...vals, updatedAt: new Date() }).where(eq(schema.qboExpenses.id, existing.id));
      changed++;
    }
  }
  for (const rec of await queryAll(access.accessToken, access.realmId, 'BillPayment', where)) {
    const bp = billPaymentFrom(rec);
    const [existing] = await db.select().from(schema.qboBillPayments).where(eq(schema.qboBillPayments.qboId, bp.qboId)).limit(1);
    const vals = { txnDate: bp.txnDate, reference: bp.reference, total: String(bp.total), links: bp.links };
    if (!existing) {
      await db.insert(schema.qboBillPayments).values({ qboId: bp.qboId, ...vals });
      changed++;
    } else if (cents(Number(existing.total)) !== cents(bp.total) || JSON.stringify(existing.links) !== JSON.stringify(bp.links) || existing.txnDate !== bp.txnDate) {
      await db.update(schema.qboBillPayments).set({ ...vals, updatedAt: new Date() }).where(eq(schema.qboBillPayments.id, existing.id));
      changed++;
    }
  }
  await db.update(schema.companyProfiles).set({ qboBillsLastCheckAt: now }).where(isNull(schema.companyProfiles.validTo));
  return changed;
}

// ---------------------------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------------------------

/** The BidAxiom vendor (directory id) a QuickBooks vendor name stands for, by name. */
async function vendorIdsByKey(t: Tenant): Promise<Map<string, string>> {
  const { db, schema } = t;
  const rows = await db.select({ id: schema.subcontractorDirectory.id, name: schema.subcontractorDirectory.companyName }).from(schema.subcontractorDirectory);
  const out = new Map<string, string>();
  for (const r of rows) {
    const k = vendorKey(r.name);
    if (k && !out.has(k)) out.set(k, r.id);
  }
  return out;
}

export interface BillContext {
  vendorId: string | null;
  projectIds: string[];
  orderByNumber: any | null;
}

/** What BidAxiom knows about one bill: its vendor, the jobs it names and the order its Ref no. points at. */
export async function billContext(t: Tenant, bill: any, vendors?: Map<string, string>, orderNumbers?: Map<string, any>): Promise<BillContext> {
  const { db, schema } = t;
  const v = vendors ?? (await vendorIdsByKey(t));
  const vendorId = v.get(vendorKey(bill.vendorName)) ?? null;
  const ids: string[] = bill.qboCustomerIds ?? [];
  const scopes = ids.length ? await resolveScopes(t, ids) : new Map();
  const projectIds = [...new Set([...scopes.values()].map((s: any) => s.projectId).filter(Boolean) as string[])];
  let orderByNumber: any = null;
  // The purchase order BidAxiom sent to QuickBooks and the bookkeeper turned into this bill: an exact link.
  const poIds: string[] = bill.qboPoIds ?? [];
  if (poIds.length) {
    const maps = await db
      .select({ platformId: schema.qboEntityMappings.platformId })
      .from(schema.qboEntityMappings)
      .where(and(eq(schema.qboEntityMappings.entityType, 'order'), inArray(schema.qboEntityMappings.qboId, poIds)));
    const ids = [...new Set(maps.map((m: any) => m.platformId))];
    if (ids.length === 1) {
      const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, ids[0] as string)).limit(1);
      orderByNumber = o ?? null;
    }
  }
  const dk = docKey(bill.docNumber);
  if (dk && !orderByNumber) {
    if (orderNumbers) orderByNumber = orderNumbers.get(dk) ?? null;
    else {
      const all = await db.select().from(schema.orders);
      orderByNumber = all.find((o: any) => docKey(o.number) === dk) ?? null;
    }
  }
  return { vendorId, projectIds, orderByNumber };
}

/** Issued orders a bill could be paying: the vendor's (if known) on the bill's job (if known). */
export async function candidateOrders(t: Tenant, ctx: BillContext) {
  const { db, schema } = t;
  const rows = await db
    .select({ id: schema.orders.id, number: schema.orders.number, kind: schema.orders.kind, status: schema.orders.status, projectId: schema.orders.projectId, vendorId: schema.orders.vendorId })
    .from(schema.orders);
  return rows.filter((o: any) => countsAsIssued(o.status) && (!ctx.vendorId || o.vendorId === ctx.vendorId) && (ctx.projectIds.length === 0 || ctx.projectIds.includes(o.projectId)));
}

async function orderTotals(tx: any, schema: any, orderId: string): Promise<{ projected: number; paid: number }> {
  const lines = await tx.select({ p: schema.orderLines.projectedCost }).from(schema.orderLines).where(eq(schema.orderLines.orderId, orderId));
  const pays = await tx.select({ a: schema.orderPayments.amount }).from(schema.orderPayments).where(eq(schema.orderPayments.orderId, orderId));
  return { projected: lines.reduce((a: number, l: any) => a + Number(l.p), 0), paid: pays.reduce((a: number, r: any) => a + Number(r.a), 0) };
}

async function refreshOrderStatus(tx: any, schema: any, orderId: string): Promise<void> {
  const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!o || !countsAsIssued(o.status)) return;
  const { projected, paid } = await orderTotals(tx, schema, orderId);
  const next = statusAfterPayments(paid, projected);
  if (next !== o.status) await tx.update(schema.orders).set({ status: next, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
}

/** Make the payments on every linked bill's order match what QuickBooks says was paid. */
export async function syncBillPayments(t: Tenant): Promise<number> {
  const { db, schema } = t;
  const bills = await db.select().from(schema.qboBills).where(and(eq(schema.qboBills.status, 'linked'), sql`${schema.qboBills.orderId} IS NOT NULL`));
  if (bills.length === 0) return 0;
  const bps = await db.select().from(schema.qboBillPayments);
  let changed = 0;
  for (const bill of bills) {
    const want = new Map<string, { amount: number; date: string; ref: string }>();
    for (const bp of bps) {
      for (const l of bp.links ?? []) {
        if (l.qboBillId === bill.qboId && l.amount > 0) want.set(`${bp.qboId}:${bill.qboId}`, { amount: l.amount, date: bp.txnDate, ref: bp.reference ? `QuickBooks bill payment ${bp.reference}` : `QuickBooks bill payment ${bp.txnDate}` });
      }
    }
    const have = await db.select().from(schema.orderPayments).where(like(schema.orderPayments.qboKey, `%:${bill.qboId}`));
    await db.transaction(async (tx: any) => {
      for (const h of have) {
        const w = want.get(h.qboKey);
        if (!w) {
          await tx.delete(schema.orderPayments).where(eq(schema.orderPayments.id, h.id));
          changed++;
        } else if (cents(Number(h.amount)) !== cents(w.amount) || h.paidAt !== w.date) {
          await tx.update(schema.orderPayments).set({ amount: String(w.amount), paidAt: w.date }).where(eq(schema.orderPayments.id, h.id));
          changed++;
        }
      }
      const haveKeys = new Set(have.map((h: any) => h.qboKey));
      for (const [key, w] of want) {
        if (haveKeys.has(key)) continue;
        await tx.insert(schema.orderPayments).values({ orderId: bill.orderId, amount: String(w.amount), paidAt: w.date, reference: w.ref, qboKey: key, createdBy: BILL_ACTOR });
        changed++;
      }
      await refreshOrderStatus(tx, schema, bill.orderId);
    });
  }
  return changed;
}

/** Link a bill to an order (automatic or by a person) and bring in its payments. */
export async function linkBill(t: Tenant, p: { billId: string; orderId: string; source: 'auto' | 'manual'; actorId: string }): Promise<void> {
  const { db, schema } = t;
  const [bill] = await db.select().from(schema.qboBills).where(eq(schema.qboBills.id, p.billId)).limit(1);
  if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'That QuickBooks bill is gone.' });
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, p.orderId)).limit(1);
  if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
  if (!countsAsIssued(order.status)) throw new TRPCError({ code: 'BAD_REQUEST', message: `Issue ${order.number} before linking a bill to it.` });
  if (bill.orderId && bill.orderId !== order.id) await unlinkBill(t, bill.id, p.actorId, false);
  await db.update(schema.qboBills).set({ orderId: order.id, status: 'linked', linkSource: p.source, updatedAt: new Date() }).where(eq(schema.qboBills.id, bill.id));
  await createAuditLog(db, schema, { entityType: 'Order', entityId: order.id, action: AuditAction.UPDATE, actorId: p.actorId, changes: { after: { linkedQuickBooksBill: bill.docNumber ?? bill.qboId, amount: Number(bill.total), linked: p.source } } });
  await syncBillPayments(t);
  await syncBillPrompt(t, bill.id).catch(() => undefined);
}

/** Take a bill off its order, with the payments it brought. It is not linked again automatically. */
export async function unlinkBill(t: Tenant, billId: string, actorId: string, lock = true): Promise<void> {
  const { db, schema } = t;
  const [bill] = await db.select().from(schema.qboBills).where(eq(schema.qboBills.id, billId)).limit(1);
  if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'That QuickBooks bill is gone.' });
  const orderId = bill.orderId as string | null;
  await db.transaction(async (tx: any) => {
    await tx.delete(schema.orderPayments).where(like(schema.orderPayments.qboKey, `%:${bill.qboId}`));
    await tx.update(schema.qboBills).set({ orderId: null, status: 'open', linkSource: null, noAuto: lock ? true : bill.noAuto, updatedAt: new Date() }).where(eq(schema.qboBills.id, bill.id));
    if (orderId) await refreshOrderStatus(tx, schema, orderId);
  });
  if (orderId) await createAuditLog(db, schema, { entityType: 'Order', entityId: orderId, action: AuditAction.UPDATE, actorId, changes: { before: { linkedQuickBooksBill: bill.docNumber ?? bill.qboId }, after: { unlinked: true } } });
  await syncBillPrompt(t, billId).catch(() => undefined);
}

export async function setBillIgnored(t: Tenant, billId: string, ignored: boolean, actorId: string): Promise<void> {
  const { db, schema } = t;
  const [bill] = await db.select().from(schema.qboBills).where(eq(schema.qboBills.id, billId)).limit(1);
  if (!bill) throw new TRPCError({ code: 'NOT_FOUND', message: 'That QuickBooks bill is gone.' });
  if (ignored && bill.status === 'linked') await unlinkBill(t, billId, actorId);
  await db.update(schema.qboBills).set({ status: ignored ? 'ignored' : 'open', noAuto: true, updatedAt: new Date() }).where(eq(schema.qboBills.id, billId));
  await syncBillPrompt(t, billId).catch(() => undefined);
}

/** Mark which bills concern BidAxiom, then link the unambiguous ones. Returns how many were linked. */
export async function autoLinkBills(t: Tenant): Promise<number> {
  const { db, schema } = t;
  const open = await db.select().from(schema.qboBills).where(eq(schema.qboBills.status, 'open'));
  if (open.length === 0) return 0;
  const vendors = await vendorIdsByKey(t);
  const allOrders = await db.select().from(schema.orders);
  const orderNumbers = new Map<string, any>();
  for (const o of allOrders) orderNumbers.set(docKey(o.number), o);
  let linked = 0;
  for (const bill of open) {
    const ctx = await billContext(t, bill, vendors, orderNumbers);
    const relevant = Boolean(ctx.orderByNumber || ctx.projectIds.length || ctx.vendorId || (bill.qboPoIds ?? []).length > 0);
    if (relevant !== bill.relevant) await db.update(schema.qboBills).set({ relevant }).where(eq(schema.qboBills.id, bill.id));
    if (bill.noAuto) continue;
    let target: string | null = null;
    if (ctx.orderByNumber && countsAsIssued(ctx.orderByNumber.status)) target = ctx.orderByNumber.id;
    else if (ctx.projectIds.length === 1 && ctx.vendorId) {
      const mine = allOrders.filter((o: any) => o.projectId === ctx.projectIds[0] && o.vendorId === ctx.vendorId && countsAsIssued(o.status));
      if (mine.length === 1) target = mine[0].id;
    }
    if (!target) continue;
    try {
      await linkBill(t, { billId: bill.id, orderId: target, source: 'auto', actorId: BILL_ACTOR });
      linked++;
    } catch (e) {
      console.error('[qbo-bills] auto-link failed', bill.id, e instanceof Error ? e.message : e);
    }
  }
  return linked;
}

// ---------------------------------------------------------------------------------------------------------------
// Bell notifications
// ---------------------------------------------------------------------------------------------------------------

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export async function syncBillPrompt(t: Tenant, billId: string): Promise<void> {
  const { db, schema } = t;
  const key = `qbo-bill:${billId}`;
  const [b] = await db.select().from(schema.qboBills).where(eq(schema.qboBills.id, billId)).limit(1);
  const [existing] = await db.select().from(schema.actionPrompts).where(eq(schema.actionPrompts.dedupeKey, key)).limit(1);
  const needs = b && b.status === 'open' && b.relevant;
  if (!needs) {
    if (existing && existing.status === 'open') {
      await db.update(schema.actionPrompts).set({ status: 'done', resolution: b?.status === 'linked' ? 'Linked to an order' : 'No longer needs attention', resolvedAt: new Date() }).where(eq(schema.actionPrompts.id, existing.id));
    }
    return;
  }
  if (existing) return;
  await db
    .insert(schema.actionPrompts)
    .values({
      projectId: null,
      kind: 'qbo_bill',
      dedupeKey: key,
      title: `${money(Number(b.total))} bill${b.vendorName ? ` from ${b.vendorName}` : ''}`,
      body: `QuickBooks shows this bill dated ${b.txnDate}. Choose the purchase or work order it is for, so its payments show on that order.`,
      actions: [
        { kind: 'link', label: 'Link to an order', href: '/outstanding' },
        { kind: 'dismiss', label: 'Not now' },
      ],
    })
    .onConflictDoNothing();
}

export async function syncAllBillPrompts(t: Tenant): Promise<void> {
  const { db, schema } = t;
  const rows = await db.select({ id: schema.qboBills.id }).from(schema.qboBills).where(and(eq(schema.qboBills.status, 'open'), eq(schema.qboBills.relevant, true)));
  for (const r of rows) await syncBillPrompt(t, r.id);
}

/** One pass: read, link what is clear, mirror payments. */
export async function runVendorBillPass(t: Tenant): Promise<{ read: number; linked: number }> {
  const read = await pullVendorBills(t);
  const linked = await autoLinkBills(t);
  await syncBillPayments(t); // payments on already-linked bills may have changed
  await syncAllBillPrompts(t);
  return { read, linked };
}
