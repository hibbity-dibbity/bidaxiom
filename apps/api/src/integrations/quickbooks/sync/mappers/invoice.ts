import type { TenantSchema } from '../../../../db/schema/tenant.js';
import { and, eq, isNull } from 'drizzle-orm';
import { promisifyQbo, qboQueryRows, qboQuote, qboIsNotFound, qboFaultText, QboUserError } from '../../client.js';
import { syncProjectToQbo, qboTermRef } from './project.js';
import { splitInvoiceAmount, qboTaxCodeRate } from '../invoiceTax.js';

type MapperDb = ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];

const isNotFound = qboIsNotFound;
const cents = (n: number) => Math.round(n * 100);

/**
 * Create (or update) the QuickBooks invoice for a sent BidAxiom invoice.
 *
 * Only when the company turned "send invoices to QuickBooks" on, only for invoices sent on or after the chosen start
 * date, and never for drafts or credits. The invoice goes under the project's job (sub-customer), numbered with the
 * BidAxiom invoice number, lines on the company's chosen income item (sales tax, when the invoice has any, on the company's chosen tax code; otherwise non-taxable), and QuickBooks is not asked to
 * email it. A QuickBooks invoice that already has a payment on it is left alone.
 */
export async function syncInvoiceToQbo(params: {
  tenantId: string;
  invoiceId: string;
  db: MapperDb;
  schema: TenantSchema;
  qboClient: any;
  accessToken: string;
  realmId: string;
}): Promise<void> {
  const { invoiceId, db, schema, qboClient, accessToken, realmId, tenantId } = params;

  const [settings] = await db
    .select({ on: schema.companyProfiles.qboInvoicePush, from: schema.companyProfiles.qboInvoicePushFrom, itemId: schema.companyProfiles.qboIncomeItemId, taxCodeId: schema.companyProfiles.qboSalesTaxCodeId })
    .from(schema.companyProfiles)
    .where(isNull(schema.companyProfiles.validTo))
    .limit(1);
  if (!settings?.on) return;

  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
  if (!inv) return;
  if (inv.status === 'draft' || Number(inv.amount) === 0 || !inv.sentOn) return; // drafts stay in BidAxiom
  const credit = Number(inv.amount) < 0; // a credit goes over as a QuickBooks credit memo
  const api = credit ? { get: 'getCreditMemo', create: 'createCreditMemo', update: 'updateCreditMemo', entity: 'CreditMemo' } : { get: 'getInvoice', create: 'createInvoice', update: 'updateInvoice', entity: 'Invoice' };
  if (settings.from && inv.sentOn < settings.from) return; // sent before the start date: handled the old way
  if (!settings.itemId) throw new Error('Choose the QuickBooks income item for invoices in Settings > Integrations first.');

  // The project's job in QuickBooks (created now if it is not there yet).
  const jobMapping = async () =>
    (await db.select().from(schema.qboEntityMappings).where(and(eq(schema.qboEntityMappings.entityType, 'project'), eq(schema.qboEntityMappings.platformId, inv.projectId))).limit(1))[0];
  let job = await jobMapping();
  if (!job) {
    await syncProjectToQbo({ tenantId, projectId: inv.projectId, db, schema, qboClient, accessToken, realmId });
    job = await jobMapping();
  }
  if (!job) throw new Error('The project is not in QuickBooks yet, so its invoice cannot be sent.');

  const [mapping] = await db.select().from(schema.qboEntityMappings).where(and(eq(schema.qboEntityMappings.entityType, 'invoice'), eq(schema.qboEntityMappings.platformId, invoiceId))).limit(1);

  let current: any = null;
  if (mapping) {
    try {
      current = await promisifyQbo<any>(qboClient[api.get].bind(qboClient), mapping.qboId);
      if (current?.status === 'Deleted') throw { Fault: { Error: [{ code: '610', Message: 'Object Not Found' }] } };
    } catch (e) {
      if (!isNotFound(e)) throw e;
      // The bookkeeper deleted it in QuickBooks. BidAxiom is where invoices are made, so it is sent again, and the bell says so.
      await db.delete(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.id, mapping.id));
      await db
        .insert(schema.qboSyncNotifications)
        .values({ entityType: 'invoice', entityId: invoiceId, message: `${inv.number} was deleted in QuickBooks, so it was created there again. If it was removed on purpose, void it in BidAxiom instead.`, severity: 'warning', dismissed: false })
        .catch(() => undefined);
    }
  }
  if (!current) {
    // An invoice with this number may already be there (a retry after a crash): link it instead of duplicating.
    const same = await qboQueryRows<any>(accessToken, realmId, api.entity, `select * from ${api.entity} where DocNumber = ${qboQuote(inv.number)}`);
    current = same.find((x) => x.CustomerRef?.value === job!.qboId) ?? null;
  }

  // Bill-to is the customer (name and address), never the job's name: QuickBooks copies the job's name onto an invoice when it
  // is created, so a later project rename would leave the old name on the invoice.
  const [proj] = await db.select({ customerId: schema.projects.customerId }).from(schema.projects).where(eq(schema.projects.id, inv.projectId)).limit(1);
  const [cust] = proj ? await db.select().from(schema.customers).where(eq(schema.customers.id, proj.customerId)).limit(1) : [];
  const billTo = cust
    ? {
        Line1: (cust.companyName || cust.contactName || '').trim(),
        ...(cust.street1 ? { Line2: cust.street1 } : {}),
        ...(cust.street2 ? { Line3: cust.street2 } : {}),
        ...(cust.city ? { City: cust.city } : {}),
        ...(cust.state ? { CountrySubDivisionCode: cust.state } : {}),
        ...(cust.zip ? { PostalCode: cust.zip } : {}),
      }
    : null;

  const amount = Math.abs(Number(inv.amount));
  // A combined invoice goes over with one line per original milestone, so QuickBooks shows what each amount was for.
  const parts = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, invoiceId));
  const pieces =
    parts.length > 1
      ? parts.sort((a, b) => a.sortOrder - b.sortOrder).map((x) => ({ estimateId: x.estimateId, amount: Math.abs(Number(x.amount)), description: [x.sourceLabel, x.label].filter(Boolean).join(': ') }))
      : [{ estimateId: inv.estimateId, amount, description: inv.milestoneName }];
  // Sales tax: the taxable part of each piece is sent on the company's QuickBooks tax code, the rest as non-taxable.
  const tenantLike: any = { tenantId, db, schema };
  const lineItems: Array<{ amount: number; description: string; taxable: boolean }> = [];
  let totalTax = 0;
  let proposalRate = 0;
  for (const piece of pieces) {
    const sp = await splitInvoiceAmount(tenantLike, piece.estimateId, piece.amount);
    if (sp.tax > 0) {
      totalTax += sp.tax;
      proposalRate = Math.max(proposalRate, sp.ratePct);
      if (sp.taxable > 0) lineItems.push({ amount: sp.taxable, description: `${piece.description} (taxable)`, taxable: true });
      if (sp.rest > 0) lineItems.push({ amount: sp.rest, description: `${piece.description} (not taxed)`, taxable: false });
    } else {
      lineItems.push({ amount: piece.amount, description: piece.description, taxable: false });
    }
  }
  totalTax = Math.round(totalTax * 100) / 100;
  if (totalTax > 0 && !settings.taxCodeId) {
    throw new QboUserError(`${inv.number} includes ${totalTax.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} of sales tax. Choose the QuickBooks sales tax code in Settings > Integrations, then press Sync again.`);
  }
  const term = credit ? undefined : await qboTermRef(accessToken, realmId, inv.paymentTerms);
  const body = (withTaxCode: boolean) => ({
    CustomerRef: { value: job!.qboId },
    ...(billTo && billTo.Line1 ? { BillAddr: billTo } : {}),
    DocNumber: inv.number,
    TxnDate: inv.sentOn,
    ...(credit ? {} : { DueDate: inv.dueOn ?? undefined, ...(term ? { SalesTermRef: term } : {}) }),
    PrivateNote: `BidAxiom invoice ${inv.id}`,
    ...(totalTax > 0 ? { TxnTaxDetail: { TxnTaxCodeRef: { value: settings.taxCodeId! }, TotalTax: totalTax } } : {}),
    Line: lineItems.map((l) => ({
      Amount: l.amount,
      DetailType: 'SalesItemLineDetail',
      Description: l.description,
      SalesItemLineDetail: { ItemRef: { value: settings.itemId }, Qty: 1, UnitPrice: l.amount, ...(l.taxable ? { TaxCodeRef: { value: 'TAX' } } : withTaxCode ? { TaxCodeRef: { value: 'NON' } } : {}) },
    })),
  });
  const attempt = async (fn: (b: any) => Promise<any>, make: (t: boolean) => any) => {
    try {
      return await fn(make(true));
    } catch (e) {
      if (totalTax > 0 && /tax/i.test(JSON.stringify((e as any)?.Fault ?? e))) throw new QboUserError(`QuickBooks would not accept the sales tax on ${inv.number} (${qboFaultText(e) ?? 'tax code rejected'}). Check the sales tax code chosen in Settings > Integrations.`);
      if (/tax/i.test(JSON.stringify((e as any)?.Fault ?? e))) return fn(make(false)); // a company with sales tax switched off rejects the tax code
      const fault = qboFaultText(e);
      if (fault && (e as any)?.statusCode !== 429 && (e as any)?.statusCode !== 401) throw new QboUserError(`QuickBooks would not accept ${inv.number} (${fault}).`);
      throw e;
    }
  };

  // QuickBooks works the tax out itself from the code's rate. If that is not BidAxiom's total, say so: the books would be off.
  const checkTotal = async (qbo: any) => {
    if (totalTax > 0 && settings.taxCodeId) {
      // The tax code's rate in QuickBooks against the proposal's rate: QuickBooks accepted our tax amount, but its books show the code's rate.
      const qboRate = await qboTaxCodeRate(accessToken, realmId, settings.taxCodeId);
      if (qboRate != null && Math.abs(qboRate - proposalRate) > 0.005) {
        const msg = `${inv.number}: the proposal charges ${proposalRate}% sales tax but the QuickBooks tax code you chose is ${qboRate}%. The tax amount was sent as BidAxiom worked it out, so QuickBooks shows a rate that does not match the tax. Choose a code with ${proposalRate}% in Settings > Integrations (or add one in QuickBooks).`;
        const dup = await db.select({ id: schema.qboSyncNotifications.id }).from(schema.qboSyncNotifications).where(and(eq(schema.qboSyncNotifications.entityId, invoiceId), eq(schema.qboSyncNotifications.message, msg), eq(schema.qboSyncNotifications.dismissed, false))).limit(1);
        if (dup.length === 0) await db.insert(schema.qboSyncNotifications).values({ entityType: 'invoice', entityId: invoiceId, message: msg, severity: 'warning', dismissed: false }).catch(() => undefined);
      }
    }
    if (totalTax <= 0 || qbo?.TotalAmt == null || cents(Number(qbo.TotalAmt)) === cents(amount)) return;
    await db
      .insert(schema.qboSyncNotifications)
      .values({ entityType: 'invoice', entityId: invoiceId, message: `${inv.number} is ${Number(qbo.TotalAmt).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in QuickBooks but ${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in BidAxiom. QuickBooks worked out the sales tax from the rate on the tax code you chose. Make sure that tax code's rate matches the proposal's.`, severity: 'warning', dismissed: false })
      .catch(() => undefined);
  };

  if (!current) {
    const created = await attempt((b) => promisifyQbo<any>(qboClient[api.create].bind(qboClient), b), body);
    await db.insert(schema.qboEntityMappings).values({
      entityType: 'invoice',
      platformId: invoiceId,
      qboId: created.Id,
      qboSyncToken: created.SyncToken,
      direction: 'platform_to_qbo',
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      metadata: { number: inv.number },
    });
    console.log(`Created QBO invoice ${created.Id} ${inv.number}`);
    await checkTotal(created);
    return;
  }

  // Already in QuickBooks. Change it only while nothing has been paid on it and something actually differs.
  const untouched = cents(Number(current.Balance ?? current.TotalAmt)) === cents(Number(current.TotalAmt));
  const differs = (billTo?.Line1 ? String(current.BillAddr?.Line1 ?? '') !== billTo.Line1 : false) || cents(Number(current.TotalAmt)) !== cents(amount) || (!credit && (inv.dueOn ?? null) !== (current.DueDate ?? null)) || inv.sentOn !== current.TxnDate;
  let syncToken = current.SyncToken;
  if (untouched && differs) {
    const updated = await attempt(
      (b) => promisifyQbo<any>(qboClient[api.update].bind(qboClient), { Id: current.Id, SyncToken: current.SyncToken, sparse: true, ...b, CustomerRef: current.CustomerRef }),
      body
    );
    syncToken = updated.SyncToken;
    await checkTotal(updated);
  } else {
    await checkTotal(current);
  }
  if (mapping && mapping.qboId === current.Id) {
    await db.update(schema.qboEntityMappings).set({ qboSyncToken: syncToken, lastSyncedAt: new Date(), syncStatus: 'synced' }).where(eq(schema.qboEntityMappings.id, mapping.id));
  } else {
    await db.insert(schema.qboEntityMappings).values({ entityType: 'invoice', platformId: invoiceId, qboId: current.Id, qboSyncToken: syncToken, direction: 'platform_to_qbo', syncStatus: 'synced', lastSyncedAt: new Date(), metadata: { number: inv.number, matchedExisting: true } });
  }
}

/**
 * Sync a QuickBooks Online Invoice to platform.
 * BidAxiom is the source of truth for invoices, so nothing is imported.
 */
export async function syncInvoiceFromQbo(params: {
  tenantId: string;
  qboId: string;
  db: MapperDb;
  schema: TenantSchema;
  qboClient: any;
  createdBy: string;
}): Promise<void> {
  console.log(`Ignoring inbound QuickBooks invoice ${params.qboId}: invoices are created in BidAxiom.`);
}
