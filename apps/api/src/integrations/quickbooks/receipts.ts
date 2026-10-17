import { and, eq, inArray, isNull } from 'drizzle-orm';
import { AuditAction, invoiceStatusAfterReceipts } from '@construction/shared';
import { TRPCError } from '@trpc/server';
import { qboQueryRows } from './client.js';
import { refreshQboToken } from './oauth.js';
import { encryptToken } from './crypto.js';
import { createAuditLog } from '../../audit/logger.js';
import { onInvoicesChanged, resolvePrompts } from '../../services/projectAutomation.js';
import { db as publicDb, createTenantDb } from '../../db/client.js';
import { tenants } from '../../db/schema/public.js';

/**
 * Reads the money QuickBooks says was received (deposits, customer payments, sales receipts) and applies it to
 * BidAxiom invoices. QuickBooks stays the book of record: nothing here writes to QuickBooks.
 *
 * - An exact, unambiguous match (one invoice whose balance equals the amount, for that customer or job, and no other
 *   identical deposit competing for it) is applied automatically as a payment, with an audit entry, and can be undone.
 * - Everything else stays "open": the people who can allocate see it on the Outstanding page and in the bell.
 */

type Tenant = { tenantId: string; db: any; schema: any };

const r2 = (n: number) => Math.round(n * 100) / 100;
const cents = (n: number) => Math.round(n * 100);
const FIRST_LOOKBACK_DAYS = 90;
const OVERLAP_DAYS = 2;
export const RECEIPT_ACTOR = 'quickbooks-sync';

// ---------------------------------------------------------------------------------------------------------------
// Access token
// ---------------------------------------------------------------------------------------------------------------

async function getAccess(t: Tenant): Promise<{ accessToken: string; realmId: string } | null> {
  const { db, schema } = t;
  const [conn] = await db.select().from(schema.qboConnections).where(eq(schema.qboConnections.status, 'active')).limit(1);
  if (!conn) return null;
  let token: string | null = conn.accessToken;
  if (!token || new Date(conn.tokenExpiresAt) <= new Date(Date.now() + 60_000)) {
    const fresh = await refreshQboToken(conn.encryptedRefreshToken);
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
    token = fresh.accessToken;
  }
  return { accessToken: token!, realmId: conn.realmId as string };
}

// ---------------------------------------------------------------------------------------------------------------
// Reading from QuickBooks
// ---------------------------------------------------------------------------------------------------------------

export interface ReceiptLine {
  qboType: 'Deposit' | 'Payment' | 'SalesReceipt';
  qboId: string;
  lineNo: number;
  txnDate: string;
  amount: number;
  qboCustomerId: string | null;
  qboCustomerName: string | null;
  memo: string | null;
  reference: string | null;
}

/** Turn QuickBooks records into one row per receipt line. Lines that only repeat another record are dropped. */
export function receiptLinesFrom(type: ReceiptLine['qboType'], rec: any): ReceiptLine[] {
  const date: string = rec.TxnDate ?? new Date().toISOString().slice(0, 10);
  if (type === 'Deposit') {
    const out: ReceiptLine[] = [];
    (rec.Line ?? []).forEach((ln: any, i: number) => {
      const d = ln.DepositLineDetail;
      if (!d) return;
      // A line that only moves an existing customer payment or sales receipt out of Undeposited Funds is counted
      // through that payment itself.
      if ((ln.LinkedTxn ?? []).some((x: any) => x.TxnType === 'Payment' || x.TxnType === 'SalesReceipt')) return;
      const amount = Number(ln.Amount ?? 0);
      if (!(amount > 0)) return;
      out.push({
        qboType: 'Deposit',
        qboId: String(rec.Id),
        lineNo: i,
        txnDate: date,
        amount: r2(amount),
        qboCustomerId: d.Entity?.value && (!d.Entity.type || d.Entity.type === 'Customer') ? String(d.Entity.value) : null,
        qboCustomerName: d.Entity?.name ?? null,
        memo: ln.Description ?? rec.PrivateNote ?? null,
        reference: d.CheckNum ?? null,
      });
    });
    return out;
  }
  const amount = Number(rec.TotalAmt ?? 0);
  if (!(amount > 0) || !rec.CustomerRef?.value) return [];
  return [
    {
      qboType: type,
      qboId: String(rec.Id),
      lineNo: 0,
      txnDate: date,
      amount: r2(amount),
      qboCustomerId: String(rec.CustomerRef.value),
      qboCustomerName: rec.CustomerRef.name ?? null,
      memo: rec.PrivateNote ?? null,
      reference: rec.PaymentRefNum ?? null,
    },
  ];
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

/** Bring new and changed QuickBooks receipts into BidAxiom. Returns how many receipt lines were added or updated. */
export async function pullReceipts(t: Tenant, now = new Date()): Promise<number> {
  const { db, schema } = t;
  const access = await getAccess(t);
  if (!access) return 0;

  const [p] = await db.select({ last: schema.companyProfiles.qboReceiptsLastCheckAt }).from(schema.companyProfiles).where(isNull(schema.companyProfiles.validTo)).limit(1);
  const from = p?.last ? new Date(new Date(p.last).getTime() - OVERLAP_DAYS * 86400000) : new Date(now.getTime() - FIRST_LOOKBACK_DAYS * 86400000);
  const where = p?.last ? `MetaData.LastUpdatedTime >= '${from.toISOString()}'` : `TxnDate >= '${from.toISOString().slice(0, 10)}'`;

  let changed = 0;
  for (const type of ['Deposit', 'Payment', 'SalesReceipt'] as const) {
    const recs = await queryAll(access.accessToken, access.realmId, type, where);
    for (const rec of recs) {
      for (const ln of receiptLinesFrom(type, rec)) {
        const [existing] = await db
          .select()
          .from(schema.qboReceipts)
          .where(and(eq(schema.qboReceipts.qboType, ln.qboType), eq(schema.qboReceipts.qboId, ln.qboId), eq(schema.qboReceipts.lineNo, ln.lineNo)))
          .limit(1);
        if (!existing) {
          await db.insert(schema.qboReceipts).values({ ...ln, amount: String(ln.amount) });
          changed++;
        } else if (existing.status === 'open' && (cents(Number(existing.amount)) !== cents(ln.amount) || existing.qboCustomerId !== ln.qboCustomerId || existing.txnDate !== ln.txnDate)) {
          await db
            .update(schema.qboReceipts)
            .set({ amount: String(ln.amount), qboCustomerId: ln.qboCustomerId, qboCustomerName: ln.qboCustomerName, txnDate: ln.txnDate, memo: ln.memo, reference: ln.reference, updatedAt: new Date() })
            .where(eq(schema.qboReceipts.id, existing.id));
          changed++;
        }
      }
    }
  }
  await db.update(schema.companyProfiles).set({ qboReceiptsLastCheckAt: now }).where(isNull(schema.companyProfiles.validTo));
  return changed;
}

// ---------------------------------------------------------------------------------------------------------------
// Applying a receipt to invoices
// ---------------------------------------------------------------------------------------------------------------

/** Pay (part of) one invoice from one receipt. Shared by automatic matching and manual allocation. */
export async function applyReceiptToInvoice(
  t: Tenant,
  p: { receiptId: string; invoiceId: string; amount: number; source: 'auto' | 'manual'; actorId: string }
): Promise<void> {
  const { db, schema } = t;
  const amount = r2(p.amount);
  if (!(amount > 0)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter an amount greater than zero.' });
  let projectId = '';
  await db.transaction(async (tx: any) => {
    const [rc] = await tx.select().from(schema.qboReceipts).where(eq(schema.qboReceipts.id, p.receiptId)).limit(1);
    if (!rc) throw new TRPCError({ code: 'NOT_FOUND', message: 'That QuickBooks deposit is gone.' });
    if (rc.status === 'ignored') throw new TRPCError({ code: 'BAD_REQUEST', message: 'That deposit was set aside. Restore it first.' });
    const used = (await tx.select({ a: schema.qboReceiptAllocations.amount }).from(schema.qboReceiptAllocations).where(eq(schema.qboReceiptAllocations.receiptId, rc.id))).reduce((a: number, r: any) => a + Number(r.a), 0);
    if (cents(used + amount) > cents(Number(rc.amount))) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Only ${r2(Number(rc.amount) - used).toFixed(2)} of that deposit is left to apply.` });
    }
    const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, p.invoiceId)).limit(1);
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
    if (inv.status !== 'sent' && inv.status !== 'partially_paid') throw new TRPCError({ code: 'BAD_REQUEST', message: `Invoice ${inv.number} is not waiting for payment.` });
    projectId = inv.projectId;
    const prior = (await tx.select({ a: schema.invoicePayments.amount }).from(schema.invoicePayments).where(eq(schema.invoicePayments.invoiceId, inv.id))).reduce((a: number, r: any) => a + Number(r.a), 0);
    const total = Number(inv.amount);
    if (cents(prior + amount) > cents(total)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Invoice ${inv.number} only has ${r2(total - prior).toFixed(2)} outstanding.` });
    }
    const [pay] = await tx
      .insert(schema.invoicePayments)
      .values({ invoiceId: inv.id, amount: String(amount), receivedAt: rc.txnDate, reference: rc.reference || `QuickBooks ${rc.qboType} ${rc.txnDate}`, createdBy: p.actorId })
      .returning({ id: schema.invoicePayments.id });
    await tx.update(schema.invoices).set({ status: invoiceStatusAfterReceipts(prior + amount, total), updatedAt: new Date() }).where(eq(schema.invoices.id, inv.id));
    await tx.insert(schema.qboReceiptAllocations).values({ receiptId: rc.id, invoiceId: inv.id, invoicePaymentId: pay.id, amount: String(amount), source: p.source, createdBy: p.actorId });
    await tx
      .update(schema.qboReceipts)
      .set({ status: cents(used + amount) === cents(Number(rc.amount)) ? 'applied' : 'open', updatedAt: new Date() })
      .where(eq(schema.qboReceipts.id, rc.id));
    await createAuditLog(tx, schema, {
      entityType: 'Invoice',
      entityId: inv.id,
      action: AuditAction.UPDATE,
      actorId: p.actorId,
      changes: { after: { payment: amount, receivedAt: rc.txnDate, from: `QuickBooks ${rc.qboType} ${rc.qboId}`, applied: p.source } },
    });
  });
  await onInvoicesChanged(t as any, projectId, p.invoiceId).catch((e) => console.error('[qbo-receipts] invoices changed failed', e));
  await syncReceiptPrompt(t, p.receiptId).catch(() => undefined);
}

/** Take back everything applied from a receipt. The receipt goes back to open and is never auto-applied again. */
export async function undoReceipt(t: Tenant, receiptId: string, actorId: string): Promise<void> {
  const { db, schema } = t;
  const touched: Array<{ projectId: string; invoiceId: string }> = [];
  await db.transaction(async (tx: any) => {
    const allocs = await tx.select().from(schema.qboReceiptAllocations).where(eq(schema.qboReceiptAllocations.receiptId, receiptId));
    for (const a of allocs) {
      if (a.invoicePaymentId) await tx.delete(schema.invoicePayments).where(eq(schema.invoicePayments.id, a.invoicePaymentId));
      const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, a.invoiceId)).limit(1);
      if (inv && (inv.status === 'sent' || inv.status === 'partially_paid' || inv.status === 'paid')) {
        const rest = (await tx.select({ x: schema.invoicePayments.amount }).from(schema.invoicePayments).where(eq(schema.invoicePayments.invoiceId, inv.id))).reduce((s: number, r: any) => s + Number(r.x), 0);
        await tx.update(schema.invoices).set({ status: invoiceStatusAfterReceipts(rest, Number(inv.amount)), updatedAt: new Date() }).where(eq(schema.invoices.id, inv.id));
        touched.push({ projectId: inv.projectId, invoiceId: inv.id });
        await createAuditLog(tx, schema, { entityType: 'Invoice', entityId: inv.id, action: AuditAction.UPDATE, actorId, changes: { before: { payment: Number(a.amount), from: `QuickBooks receipt ${receiptId}` }, after: { undone: true } } });
      }
    }
    await tx.delete(schema.qboReceiptAllocations).where(eq(schema.qboReceiptAllocations.receiptId, receiptId));
    await tx.update(schema.qboReceipts).set({ status: 'open', noAuto: true, updatedAt: new Date() }).where(eq(schema.qboReceipts.id, receiptId));
  });
  for (const x of touched) await resolvePrompts(t as any, { projectId: x.projectId, kinds: ['close_project'] }, 'A payment was taken back').catch(() => undefined);
  await syncReceiptPrompt(t, receiptId).catch(() => undefined);
}

export async function setReceiptIgnored(t: Tenant, receiptId: string, ignored: boolean): Promise<void> {
  const { db, schema } = t;
  const [rc] = await db.select().from(schema.qboReceipts).where(eq(schema.qboReceipts.id, receiptId)).limit(1);
  if (!rc) throw new TRPCError({ code: 'NOT_FOUND', message: 'That QuickBooks deposit is gone.' });
  if (ignored && rc.status === 'applied') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Undo it first.' });
  await db.update(schema.qboReceipts).set({ status: ignored ? 'ignored' : 'open', noAuto: true, updatedAt: new Date() }).where(eq(schema.qboReceipts.id, receiptId));
  await syncReceiptPrompt(t, receiptId).catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------------------------

export interface ReceiptScope {
  projectId: string | null;
  customerId: string | null;
}

/** Which BidAxiom customer or project a QuickBooks customer/job stands for, from the saved links. */
export async function resolveScopes(t: Tenant, qboCustomerIds: string[]): Promise<Map<string, ReceiptScope>> {
  const { db, schema } = t;
  const out = new Map<string, ReceiptScope>();
  if (qboCustomerIds.length === 0) return out;
  const maps = await db
    .select({ type: schema.qboEntityMappings.entityType, platformId: schema.qboEntityMappings.platformId, qboId: schema.qboEntityMappings.qboId })
    .from(schema.qboEntityMappings)
    .where(and(inArray(schema.qboEntityMappings.entityType, ['project', 'customer']), inArray(schema.qboEntityMappings.qboId, qboCustomerIds)));
  const projectIds = maps.filter((m: any) => m.type === 'project').map((m: any) => m.platformId);
  const projRows = projectIds.length ? await db.select({ id: schema.projects.id, customerId: schema.projects.customerId }).from(schema.projects).where(and(inArray(schema.projects.id, projectIds), isNull(schema.projects.deletedAt))) : [];
  const custOfProject = new Map(projRows.map((r: any) => [r.id, r.customerId]));
  for (const m of maps) {
    if (m.type === 'project') {
      if (custOfProject.has(m.platformId)) out.set(m.qboId, { projectId: m.platformId, customerId: custOfProject.get(m.platformId) as string });
    } else if (!out.has(m.qboId)) {
      out.set(m.qboId, { projectId: null, customerId: m.platformId });
    }
  }
  return out;
}

export interface CandidateInvoice {
  id: string;
  number: string;
  milestoneName: string;
  projectId: string;
  sentOn: string | null;
  amount: number;
  outstanding: number;
}

/** Sent invoices still owing money, within a scope, that this deposit could plausibly be paying. */
export async function candidateInvoices(t: Tenant, scope: ReceiptScope, txnDate: string): Promise<CandidateInvoice[]> {
  const { db, schema } = t;
  let projectIds: string[] = [];
  if (scope.projectId) projectIds = [scope.projectId];
  else if (scope.customerId) {
    projectIds = (await db.select({ id: schema.projects.id }).from(schema.projects).where(and(eq(schema.projects.customerId, scope.customerId), isNull(schema.projects.deletedAt)))).map((r: any) => r.id);
  }
  if (projectIds.length === 0) return [];
  const invs = await db.select().from(schema.invoices).where(and(inArray(schema.invoices.projectId, projectIds), inArray(schema.invoices.status, ['sent', 'partially_paid'])));
  if (invs.length === 0) return [];
  const pays = await db.select({ i: schema.invoicePayments.invoiceId, a: schema.invoicePayments.amount }).from(schema.invoicePayments).where(inArray(schema.invoicePayments.invoiceId, invs.map((i: any) => i.id)));
  const paid = new Map<string, number>();
  for (const x of pays) paid.set(x.i, (paid.get(x.i) ?? 0) + Number(x.a));
  const earliest = new Date(`${txnDate}T00:00:00Z`).getTime() + 7 * 86400000; // an invoice sent more than a week after the deposit is not what it paid
  return invs
    .filter((i: any) => !i.sentOn || new Date(`${i.sentOn}T00:00:00Z`).getTime() <= earliest)
    .map((i: any) => ({ id: i.id, number: i.number, milestoneName: i.milestoneName, projectId: i.projectId, sentOn: i.sentOn, amount: Number(i.amount), outstanding: r2(Number(i.amount) - (paid.get(i.id) ?? 0)) }))
    .filter((i: CandidateInvoice) => i.outstanding > 0.004);
}

/** Auto-apply the unambiguous matches. Returns how many deposits were applied. */
export async function autoApplyReceipts(t: Tenant): Promise<number> {
  const { db, schema } = t;
  const open = await db.select().from(schema.qboReceipts).where(eq(schema.qboReceipts.status, 'open')).orderBy(schema.qboReceipts.txnDate);
  const fresh = open.filter((r: any) => !r.noAuto && r.qboCustomerId);
  if (fresh.length === 0) return 0;
  const scopes = await resolveScopes(t, [...new Set(fresh.map((r: any) => r.qboCustomerId as string))] as string[]);
  const allOpen = open.filter((r: any) => r.qboCustomerId);
  const allScopes = await resolveScopes(t, [...new Set(allOpen.map((r: any) => r.qboCustomerId as string))] as string[]);

  let applied = 0;
  for (const r of fresh) {
    const scope = scopes.get(r.qboCustomerId);
    if (!scope) continue;
    const amt = cents(Number(r.amount));
    // Other open deposits for the same BidAxiom customer and amount compete for the same invoice.
    const rivals = allOpen.filter((o: any) => cents(Number(o.amount)) === amt && allScopes.get(o.qboCustomerId)?.customerId === scope.customerId);
    if (rivals.length !== 1) continue;
    const exact = (await candidateInvoices(t, scope, r.txnDate)).filter((i) => cents(i.outstanding) === amt);
    if (exact.length !== 1) continue;
    try {
      await applyReceiptToInvoice(t, { receiptId: r.id, invoiceId: exact[0]!.id, amount: Number(r.amount), source: 'auto', actorId: RECEIPT_ACTOR });
      applied++;
    } catch (e) {
      console.error('[qbo-receipts] auto-apply failed', r.id, e instanceof Error ? e.message : e);
    }
  }
  return applied;
}

// ---------------------------------------------------------------------------------------------------------------
// Bell notifications
// ---------------------------------------------------------------------------------------------------------------

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Keep the bell item for one receipt in step with its state: present while it needs a person, gone once handled. */
export async function syncReceiptPrompt(t: Tenant, receiptId: string): Promise<void> {
  const { db, schema } = t;
  const key = `qbo-receipt:${receiptId}`;
  const [rc] = await db.select().from(schema.qboReceipts).where(eq(schema.qboReceipts.id, receiptId)).limit(1);
  const [existing] = await db.select().from(schema.actionPrompts).where(eq(schema.actionPrompts.dedupeKey, key)).limit(1);
  const needs = rc && rc.status === 'open' && rc.qboCustomerId;
  if (!needs) {
    if (existing && existing.status === 'open') {
      await db.update(schema.actionPrompts).set({ status: 'done', resolution: rc?.status === 'applied' ? 'Applied to invoices' : 'No longer needs attention', resolvedAt: new Date() }).where(eq(schema.actionPrompts.id, existing.id));
    }
    return;
  }
  if (existing) return; // already raised (answered ones are not raised again)
  const scopes = await resolveScopes(t, [rc.qboCustomerId]);
  if (!scopes.has(rc.qboCustomerId)) return; // not a customer or job BidAxiom knows about
  await db
    .insert(schema.actionPrompts)
    .values({
      projectId: null,
      kind: 'qbo_deposit',
      dedupeKey: key,
      title: `${money(Number(rc.amount))} received${rc.qboCustomerName ? ` from ${rc.qboCustomerName}` : ''}`,
      body: `QuickBooks shows this on ${rc.txnDate}. It did not match one invoice exactly. Choose which invoices it pays.`,
      actions: [
        { kind: 'link', label: 'Allocate', href: '/outstanding' },
        { kind: 'dismiss', label: 'Not now' },
      ],
    })
    .onConflictDoNothing();
}

async function syncAllPrompts(t: Tenant): Promise<void> {
  const { db, schema } = t;
  const rows = await db.select({ id: schema.qboReceipts.id }).from(schema.qboReceipts).where(inArray(schema.qboReceipts.status, ['open']));
  for (const r of rows) await syncReceiptPrompt(t, r.id);
}

// ---------------------------------------------------------------------------------------------------------------
// One full pass, and the timer
// ---------------------------------------------------------------------------------------------------------------

export interface ReceiptPassResult {
  read: number;
  applied: number;
}

export async function runReceiptPass(t: Tenant): Promise<ReceiptPassResult> {
  const read = await pullReceipts(t);
  const applied = await autoApplyReceipts(t);
  await syncAllPrompts(t);
  return { read, applied };
}

const CHECK_EVERY_MINUTES = 15;
let timer: NodeJS.Timeout | null = null;

/** Every 5 minutes, companies with "read payments" turned on that are due get a pass. */
export function startQboReceiptsScheduler(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const all = await publicDb.select().from(tenants).where(eq(tenants.status, 'active'));
      for (const row of all) {
        try {
          const ctx = createTenantDb(row.schemaName);
          const t: Tenant = { tenantId: row.id, db: ctx.db, schema: ctx };
          const [s] = await t.db
            .select({ on: t.schema.companyProfiles.qboReadPayments, last: t.schema.companyProfiles.qboReceiptsLastCheckAt })
            .from(t.schema.companyProfiles)
            .where(isNull(t.schema.companyProfiles.validTo))
            .limit(1);
          if (!s?.on) continue;
          if (s.last && Date.now() - new Date(s.last).getTime() < CHECK_EVERY_MINUTES * 60_000) continue;
          await runReceiptPass(t);
        } catch (e) {
          console.error('[qbo-receipts] pass failed', row.id, e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.error('[qbo-receipts] scheduler failed', e instanceof Error ? e.message : e);
    }
  };
  timer = setInterval(tick, 5 * 60_000);
  timer.unref?.();
}

