import type { TenantSchema } from '../../../../db/schema/tenant.js';
import { and, eq, isNull } from 'drizzle-orm';
import { promisifyQbo, qboQueryRows, qboQuote } from '../../client.js';
import { syncProjectToQbo } from './project.js';

type MapperDb = ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];

const isNotFound = (err: unknown) => {
  const f = (err as any)?.Fault?.Error?.[0];
  return f?.code === '610' || /not found/i.test(String(f?.Message ?? ''));
};
const cents = (n: number) => Math.round(n * 100);

/**
 * Create (or update) the QuickBooks invoice for a sent BidAxiom invoice.
 *
 * Only when the company turned "send invoices to QuickBooks" on, only for invoices sent on or after the chosen start
 * date, and never for drafts or credits. The invoice goes under the project's job (sub-customer), numbered with the
 * BidAxiom invoice number, one line on the company's chosen income item, non-taxable, and QuickBooks is not asked to
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
    .select({ on: schema.companyProfiles.qboInvoicePush, from: schema.companyProfiles.qboInvoicePushFrom, itemId: schema.companyProfiles.qboIncomeItemId })
    .from(schema.companyProfiles)
    .where(isNull(schema.companyProfiles.validTo))
    .limit(1);
  if (!settings?.on) return;

  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
  if (!inv) return;
  if (inv.status === 'draft' || !(Number(inv.amount) > 0) || !inv.sentOn) return; // drafts and credits stay in BidAxiom
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
      current = await promisifyQbo<any>(qboClient.getInvoice.bind(qboClient), mapping.qboId);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      await db.delete(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.id, mapping.id));
    }
  }
  if (!current) {
    // An invoice with this number may already be there (a retry after a crash): link it instead of duplicating.
    const same = await qboQueryRows<any>(accessToken, realmId, 'Invoice', `select * from Invoice where DocNumber = ${qboQuote(inv.number)}`);
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

  const amount = Number(inv.amount);
  // A combined invoice goes over with one line per original milestone, so QuickBooks shows what each amount was for.
  const parts = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, invoiceId));
  const lineItems =
    parts.length > 1
      ? parts.sort((a, b) => a.sortOrder - b.sortOrder).map((x) => ({ amount: Number(x.amount), description: [x.sourceLabel, x.label].filter(Boolean).join(': ') }))
      : [{ amount, description: inv.milestoneName }];
  const body = (withTaxCode: boolean) => ({
    CustomerRef: { value: job!.qboId },
    ...(billTo && billTo.Line1 ? { BillAddr: billTo } : {}),
    DocNumber: inv.number,
    TxnDate: inv.sentOn,
    DueDate: inv.dueOn ?? undefined,
    PrivateNote: `BidAxiom invoice ${inv.id}`,
    Line: lineItems.map((l) => ({
      Amount: l.amount,
      DetailType: 'SalesItemLineDetail',
      Description: l.description,
      SalesItemLineDetail: { ItemRef: { value: settings.itemId }, Qty: 1, UnitPrice: l.amount, ...(withTaxCode ? { TaxCodeRef: { value: 'NON' } } : {}) },
    })),
  });
  const attempt = async (fn: (b: any) => Promise<any>, make: (t: boolean) => any) => {
    try {
      return await fn(make(true));
    } catch (e) {
      if (/tax/i.test(JSON.stringify((e as any)?.Fault ?? e))) return fn(make(false)); // a company with sales tax switched off rejects the tax code
      throw e;
    }
  };

  if (!current) {
    const created = await attempt((b) => promisifyQbo<any>(qboClient.createInvoice.bind(qboClient), b), body);
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
    return;
  }

  // Already in QuickBooks. Change it only while nothing has been paid on it and something actually differs.
  const untouched = cents(Number(current.Balance ?? current.TotalAmt)) === cents(Number(current.TotalAmt));
  const differs = (billTo?.Line1 ? String(current.BillAddr?.Line1 ?? '') !== billTo.Line1 : false) || cents(Number(current.TotalAmt)) !== cents(amount) || (inv.dueOn ?? null) !== (current.DueDate ?? null) || inv.sentOn !== current.TxnDate;
  let syncToken = current.SyncToken;
  if (untouched && differs) {
    const updated = await attempt(
      (b) => promisifyQbo<any>(qboClient.updateInvoice.bind(qboClient), { Id: current.Id, SyncToken: current.SyncToken, sparse: true, ...b, CustomerRef: current.CustomerRef }),
      body
    );
    syncToken = updated.SyncToken;
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
