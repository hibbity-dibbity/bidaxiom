import type { TenantSchema } from '../../../../db/schema/tenant.js';
import { eq, and, isNull } from 'drizzle-orm';
import { promisifyQbo, qboQueryRows, qboQuote, QboUserError, qboFaultText, qboIsNotFound } from '../../client.js';
import { qboName, syncProjectToQbo } from './project.js';

type MapperDb = ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];

const cents = (n: number) => Math.round(n * 100);

/** Which expense account a line posts to, from the category its proposal line type fixed. */
export function accountKeyFor(category: string | null | undefined): 'material' | 'equipment' | 'labor' {
  if (/rental|equipment/i.test(category ?? '')) return 'equipment';
  if (/subcontract|labor/i.test(category ?? '')) return 'labor';
  return 'material';
}

const isNotFound = qboIsNotFound;

/** The QuickBooks vendor for a BidAxiom vendor: the saved link, else one with the same name, else a new one. */
async function ensureQboVendor(p: { db: MapperDb; schema: TenantSchema; qboClient: any; accessToken: string; realmId: string; vendorId: string }): Promise<string> {
  const { db, schema, qboClient, accessToken, realmId, vendorId } = p;
  const [mapping] = await db
    .select()
    .from(schema.qboEntityMappings)
    .where(and(eq(schema.qboEntityMappings.entityType, 'vendor'), eq(schema.qboEntityMappings.platformId, vendorId)))
    .limit(1);
  if (mapping) {
    try {
      await promisifyQbo<any>(qboClient.getVendor.bind(qboClient), mapping.qboId);
      return mapping.qboId;
    } catch (e) {
      if (!isNotFound(e)) throw e;
      await db.delete(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.id, mapping.id));
    }
  }
  const [v] = await db.select().from(schema.subcontractorDirectory).where(eq(schema.subcontractorDirectory.id, vendorId)).limit(1);
  if (!v) throw new Error(`Vendor not found: ${vendorId}`);
  const name = qboName(v.companyName);
  const found = (await qboQueryRows<any>(accessToken, realmId, 'Vendor', `select * from Vendor where DisplayName = ${qboQuote(name)}`))[0];
  let q = found;
  if (!q) {
    const lines = [v.street1, v.street2].filter(Boolean) as string[];
    q = await promisifyQbo<any>(qboClient.createVendor.bind(qboClient), {
      DisplayName: name,
      CompanyName: v.companyName,
      PrimaryEmailAddr: v.contactEmail ? { Address: v.contactEmail } : undefined,
      PrimaryPhone: v.contactPhone ? { FreeFormNumber: v.contactPhone } : undefined,
      BillAddr: lines.length || v.city ? { Line1: lines[0], Line2: lines[1], City: v.city || undefined, CountrySubDivisionCode: v.state || undefined, PostalCode: v.zip || undefined } : undefined,
      Notes: `BidAxiom vendor ${vendorId}`,
    });
  }
  await db.insert(schema.qboEntityMappings).values({
    entityType: 'vendor',
    platformId: vendorId,
    qboId: q.Id,
    qboSyncToken: q.SyncToken,
    direction: 'platform_to_qbo',
    syncStatus: 'synced',
    lastSyncedAt: new Date(),
    metadata: { matchedExisting: Boolean(found) },
  });
  return q.Id;
}

/**
 * Create or update the QuickBooks Purchase Order for an issued purchase order or work order. A work order goes over as a
 * Purchase Order too (QuickBooks has no work order). A Purchase Order does not post to the books; the expense appears when
 * the bookkeeper turns it into a bill, which then points back at it so BidAxiom can match the bill and its payments.
 */
export async function syncOrderToQbo(params: {
  tenantId: string;
  orderId: string;
  db: MapperDb;
  schema: TenantSchema;
  qboClient: any;
  accessToken: string;
  realmId: string;
}): Promise<void> {
  const { orderId, db, schema, qboClient, accessToken, realmId, tenantId } = params;

  const [settings] = await db
    .select({ on: schema.companyProfiles.qboOrderPush, from: schema.companyProfiles.qboOrderPushFrom, accounts: schema.companyProfiles.qboOrderAccounts })
    .from(schema.companyProfiles)
    .where(isNull(schema.companyProfiles.validTo))
    .limit(1);
  if (!settings?.on) return;

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!order || order.status === 'draft' || !order.vendorId || !order.issuedAt) return;
  const issuedOn = order.issuedAt.toISOString().slice(0, 10);
  if (settings.from && issuedOn < settings.from) return; // issued before the start date: handled the old way

  const accounts = (settings.accounts ?? {}) as Record<string, { id: string; name: string }>;
  const lines = (await db.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, orderId))).sort((a, b) => a.sortOrder - b.sortOrder).filter((l) => Number(l.projectedCost) > 0);
  if (lines.length === 0) return;
  for (const l of lines) {
    if (!accounts[accountKeyFor(l.category)]?.id) {
      throw new QboUserError('Choose the QuickBooks expense accounts for purchase and work orders in Settings > Integrations first.');
    }
  }

  // The project's job (created now if it is not there yet).
  const jobMapping = async () =>
    (await db.select().from(schema.qboEntityMappings).where(and(eq(schema.qboEntityMappings.entityType, 'project'), eq(schema.qboEntityMappings.platformId, order.projectId))).limit(1))[0];
  let job = await jobMapping();
  if (!job) {
    await syncProjectToQbo({ tenantId, projectId: order.projectId, db, schema, qboClient, accessToken, realmId });
    job = await jobMapping();
  }
  if (!job) throw new Error('The project is not in QuickBooks yet, so its order cannot be sent.');

  const vendorQboId = await ensureQboVendor({ db, schema, qboClient, accessToken, realmId, vendorId: order.vendorId });

  // QuickBooks wants the accounts payable account on a purchase order.
  const ap = (await qboQueryRows<any>(accessToken, realmId, 'Account', "select * from Account where AccountType = 'Accounts Payable' and Active = true MAXRESULTS 1"))[0];

  const [project] = await db.select({ name: schema.projects.name, jobNumber: schema.projects.jobNumber }).from(schema.projects).where(eq(schema.projects.id, order.projectId)).limit(1);
  const total = lines.reduce((a, l) => a + Number(l.projectedCost), 0);
  const body = {
    VendorRef: { value: vendorQboId },
    ...(ap ? { APAccountRef: { value: ap.Id } } : {}),
    DocNumber: order.number,
    TxnDate: order.orderDate ?? issuedOn,
    POStatus: 'Open',
    PrivateNote: `BidAxiom ${order.kind === 'work' ? 'work' : 'purchase'} order ${order.id}`,
    Memo: `${order.kind === 'work' ? 'Work order' : 'Purchase order'} ${order.number}${order.revision ? ` rev ${order.revision}` : ''} - ${[project?.jobNumber, project?.name].filter(Boolean).join(' ')}`,
    Line: lines.map((l) => ({
      Amount: Number(l.projectedCost),
      DetailType: 'AccountBasedExpenseLineDetail',
      Description: l.description,
      AccountBasedExpenseLineDetail: { AccountRef: { value: accounts[accountKeyFor(l.category)]!.id }, CustomerRef: { value: job!.qboId }, BillableStatus: 'NotBillable' },
    })),
  };

  const [mapping] = await db.select().from(schema.qboEntityMappings).where(and(eq(schema.qboEntityMappings.entityType, 'order'), eq(schema.qboEntityMappings.platformId, orderId))).limit(1);
  let current: any = null;
  if (mapping) {
    try {
      current = await promisifyQbo<any>(qboClient.getPurchaseOrder.bind(qboClient), mapping.qboId);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      await db.delete(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.id, mapping.id)); // deleted in QuickBooks: send it again
    }
  }

  const fail = (e: unknown) => {
    const fault = qboFaultText(e);
    if (fault) throw new QboUserError(`QuickBooks would not accept ${order.number} (${fault}). Check that Purchase Orders are turned on in QuickBooks (Settings > Account and settings > Expenses).`);
    throw e;
  };

  if (!current) {
    const dup = (await qboQueryRows<any>(accessToken, realmId, 'PurchaseOrder', `select * from PurchaseOrder where DocNumber = ${qboQuote(order.number)}`))[0];
    if (dup && dup.VendorRef?.value === vendorQboId) current = dup; // already there from an earlier try
  }
  if (!current) {
    const created = await promisifyQbo<any>(qboClient.createPurchaseOrder.bind(qboClient), body).catch(fail);
    await db.insert(schema.qboEntityMappings).values({
      entityType: 'order',
      platformId: orderId,
      qboId: created.Id,
      qboSyncToken: created.SyncToken,
      direction: 'platform_to_qbo',
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      metadata: { number: order.number, revision: order.revision },
    });
    console.log(`Created QBO purchase order ${created.Id} ${order.number}`);
    return;
  }

  let syncToken = current.SyncToken;
  const differs = cents(Number(current.TotalAmt ?? 0)) !== cents(total) || (current.Line ?? []).length !== lines.length || current.VendorRef?.value !== vendorQboId;
  if (differs && (current.POStatus ?? 'Open') === 'Open') {
    const updated = await promisifyQbo<any>(qboClient.updatePurchaseOrder.bind(qboClient), { Id: current.Id, SyncToken: current.SyncToken, sparse: true, ...body }).catch(fail);
    syncToken = updated.SyncToken;
  }
  if (mapping && mapping.qboId === current.Id) {
    await db.update(schema.qboEntityMappings).set({ qboSyncToken: syncToken, lastSyncedAt: new Date(), syncStatus: 'synced', metadata: { number: order.number, revision: order.revision } }).where(eq(schema.qboEntityMappings.id, mapping.id));
  } else {
    await db.insert(schema.qboEntityMappings).values({ entityType: 'order', platformId: orderId, qboId: current.Id, qboSyncToken: syncToken, direction: 'platform_to_qbo', syncStatus: 'synced', lastSyncedAt: new Date(), metadata: { number: order.number, matchedExisting: true } });
  }
}
