import type { TenantSchema } from '../../../../db/schema/tenant.js';
import { eq, and } from 'drizzle-orm';
import { promisifyQbo, qboQueryRows, qboQuote, qboFaultText, QboUserError } from '../../client.js';
import { isSyncTokenConflict, handleSyncTokenConflict } from '../conflict.js';

/** QuickBooks display names cannot contain a colon (it separates parent from sub-customer) and have a length limit. */
export function qboName(raw: string): string {
  return raw.replace(/[:\t\r\n]+/g, ' - ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

/** "261001 - Riverside Office" (or just the name when there is no job number). */
export function qboProjectName(p: { jobNumber: string | null; name: string }): string {
  return qboName([p.jobNumber, p.name].filter(Boolean).join(' - '));
}

/** Closed, archived and lost jobs are inactive in QuickBooks; everything else (including warranty and on hold) stays active. */
export function qboActiveFor(phase: string | null | undefined): boolean {
  return !['closed', 'archived', 'lost'].includes(phase ?? '');
}

const isNotFound = (err: unknown) => {
  const f = (err as any)?.Fault?.Error?.[0];
  return f?.code === '610' || /not found/i.test(String(f?.Message ?? ''));
};

type Addr = { street1?: string | null; street2?: string | null; city?: string | null; state?: string | null; zip?: string | null };

/** A QuickBooks address from a street address, or undefined when there is nothing to send. */
function qboAddr(a: Addr, firstLine?: string | null) {
  const lines = [firstLine, a.street1, a.street2].filter((x): x is string => Boolean(x && x.trim()));
  if (!lines.length && !a.city && !a.zip) return undefined;
  return {
    Line1: lines[0],
    Line2: lines[1],
    Line3: lines[2],
    City: a.city || undefined,
    CountrySubDivisionCode: a.state || undefined,
    PostalCode: a.zip || undefined,
  };
}

const sameAddr = (cur: any, want: any) =>
  (cur?.Line1 ?? '') === (want?.Line1 ?? '') && (cur?.Line2 ?? '') === (want?.Line2 ?? '') && (cur?.City ?? '') === (want?.City ?? '') && (cur?.PostalCode ?? '') === (want?.PostalCode ?? '');

/** The QuickBooks payment term with this name ("Net 30"), or undefined; terms are a nicety, so a lookup problem never blocks a sync. */
async function qboTermRef(accessToken: string, realmId: string, name: string | null | undefined): Promise<{ value: string } | undefined> {
  if (!name) return undefined;
  try {
    const rows = await qboQueryRows<any>(accessToken, realmId, 'Term', `select * from Term where Name = ${qboQuote(name)}`);
    return rows[0] ? { value: rows[0].Id } : undefined;
  } catch {
    return undefined;
  }
}

/** Contact details for a customer record; only what BidAxiom has, so nothing already in QuickBooks is blanked. */
async function customerDetails(c: any, accessToken: string, realmId: string) {
  const d: Record<string, unknown> = {};
  if (c.email) d.PrimaryEmailAddr = { Address: c.email };
  if (c.phone) d.PrimaryPhone = { FreeFormNumber: c.phone };
  const bill = qboAddr(c);
  if (bill) d.BillAddr = bill;
  const term = await qboTermRef(accessToken, realmId, c.paymentTerms);
  if (term) d.SalesTermRef = term;
  return d;
}

/** What differs between the QuickBooks customer and the wanted details, as a sparse update. */
function detailChanges(cur: any, want: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (want.PrimaryEmailAddr && cur.PrimaryEmailAddr?.Address !== want.PrimaryEmailAddr.Address) out.PrimaryEmailAddr = want.PrimaryEmailAddr;
  if (want.PrimaryPhone && cur.PrimaryPhone?.FreeFormNumber !== want.PrimaryPhone.FreeFormNumber) out.PrimaryPhone = want.PrimaryPhone;
  if (want.BillAddr && !sameAddr(cur.BillAddr, want.BillAddr)) out.BillAddr = want.BillAddr;
  if (want.SalesTermRef && cur.SalesTermRef?.value !== want.SalesTermRef.value) out.SalesTermRef = want.SalesTermRef;
  return out;
}

type MapperDb = ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];

/** Bring an already-linked QuickBooks customer's email, phone, billing address and terms in line with BidAxiom. */
async function pushCustomerDetails(p: { db: MapperDb; schema: TenantSchema; qboClient: any; accessToken: string; realmId: string; customerId: string; existing: any; mappingId: string }): Promise<void> {
  const { db, schema, qboClient, accessToken, realmId, customerId, existing, mappingId } = p;
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1);
  if (!c) return;
  const changes = detailChanges(existing, await customerDetails(c, accessToken, realmId));
  if (!Object.keys(changes).length) return;
  const updated = await promisifyQbo<any>(qboClient.updateCustomer.bind(qboClient), { Id: existing.Id, SyncToken: existing.SyncToken, sparse: true, ...changes });
  await db.update(schema.qboEntityMappings).set({ qboSyncToken: updated.SyncToken, lastSyncedAt: new Date() }).where(eq(schema.qboEntityMappings.id, mappingId));
}

/**
 * The QuickBooks customer that represents one BidAxiom customer. Reuses the saved link, then a customer with the
 * same name already in QuickBooks (so nothing is duplicated), and only then creates one.
 */
async function ensureQboParentCustomer(p: { db: MapperDb; schema: TenantSchema; qboClient: any; accessToken: string; realmId: string; customerId: string }): Promise<string> {
  const { db, schema, qboClient, accessToken, realmId, customerId } = p;
  const [mapping] = await db
    .select()
    .from(schema.qboEntityMappings)
    .where(and(eq(schema.qboEntityMappings.entityType, 'customer'), eq(schema.qboEntityMappings.platformId, customerId)))
    .limit(1);
  if (mapping) {
    try {
      const existing = await promisifyQbo<any>(qboClient.getCustomer.bind(qboClient), mapping.qboId);
      await pushCustomerDetails({ db, schema, qboClient, accessToken, realmId, customerId, existing, mappingId: mapping.id });
      return mapping.qboId;
    } catch (e) {
      if (!isNotFound(e)) throw e;
      await db.delete(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.id, mapping.id)); // points at nothing: relink below
    }
  }

  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1);
  if (!c) throw new Error(`Customer not found: ${customerId}`);
  const name = qboName(c.companyName || c.contactName);

  // Top-level customers only (ParentRef is null), matched by name.
  const found = (await qboQueryRows<any>(accessToken, realmId, 'Customer', `select * from Customer where DisplayName = ${qboQuote(name)}`)).find((x) => !x.ParentRef);
  let q = found;
  const details = await customerDetails(c, accessToken, realmId);
  if (q) {
    const changes = detailChanges(q, details);
    if (Object.keys(changes).length) {
      q = await promisifyQbo<any>(qboClient.updateCustomer.bind(qboClient), { Id: q.Id, SyncToken: q.SyncToken, sparse: true, ...changes });
    }
  } else {
    q = await promisifyQbo<any>(qboClient.createCustomer.bind(qboClient), {
      DisplayName: name,
      CompanyName: c.companyName || undefined,
      GivenName: c.companyName ? undefined : c.contactName.split(' ')[0],
      FamilyName: c.companyName ? undefined : c.contactName.split(' ').slice(1).join(' ') || undefined,
      ...details,
      Notes: `BidAxiom customer ${customerId}`,
    });
  }
  await db.insert(schema.qboEntityMappings).values({
    entityType: 'customer',
    platformId: customerId,
    qboId: q.Id,
    qboSyncToken: q.SyncToken,
    direction: 'platform_to_qbo',
    syncStatus: 'synced',
    lastSyncedAt: new Date(),
    metadata: { matchedExisting: Boolean(found) },
  });
  return q.Id;
}

/** Sync one BidAxiom customer to QuickBooks as a top-level customer (linked if one with the same name exists). */
export async function syncCustomerToQbo(params: { tenantId: string; customerId: string; db: MapperDb; schema: TenantSchema; qboClient: any; accessToken: string; realmId: string }): Promise<void> {
  const { customerId, db, schema, qboClient, accessToken, realmId } = params;
  await ensureQboParentCustomer({ db, schema, qboClient, accessToken, realmId, customerId });
}

/**
 * Sync a BidAxiom project to QuickBooks Online as a sub-customer ("job") under its customer,
 * named "{job number} - {project name}". An existing QuickBooks job with that name is linked, not duplicated.
 * BidAxiom is the source of truth: name and active/inactive flow one way, from here to QuickBooks.
 *
 * @param params - Sync parameters (db and schema from tenant context)
 */
export async function syncProjectToQbo(params: {
  tenantId: string;
  projectId: string;
  db: MapperDb;
  schema: TenantSchema;
  qboClient: any;
  accessToken: string;
  realmId: string;
}): Promise<void> {
  const { projectId, db, schema, qboClient, accessToken, realmId } = params;

  try {
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return;
    }

    const parentId = await ensureQboParentCustomer({ db, schema, qboClient, accessToken, realmId, customerId: project.customerId });
    const displayName = qboProjectName(project);
    const active = qboActiveFor(project.lifecyclePhase);

    const [mapping] = await db
      .select()
      .from(schema.qboEntityMappings)
      .where(and(eq(schema.qboEntityMappings.entityType, 'project'), eq(schema.qboEntityMappings.platformId, projectId)))
      .limit(1);

    // The saved link, if it still points at something real. Reading it first also refreshes the lock token.
    let current: any = null;
    if (mapping) {
      try {
        current = await promisifyQbo<any>(qboClient.getCustomer.bind(qboClient), mapping.qboId);
      } catch (e) {
        if (!isNotFound(e)) throw e;
        await db.delete(schema.qboEntityMappings).where(eq(schema.qboEntityMappings.id, mapping.id));
      }
    }

    // No link: look for a job that is already there under this customer with this name.
    if (!current) {
      const matches = await qboQueryRows<any>(accessToken, realmId, 'Customer', `select * from Customer where DisplayName = ${qboQuote(displayName)}`);
      current = matches.find((m) => m.ParentRef?.value === parentId) ?? null;
    }

    if (!current) {
      const created = await promisifyQbo<any>(qboClient.createCustomer.bind(qboClient), {
        DisplayName: displayName,
        Job: true,
        ParentRef: { value: parentId },
        BillWithParent: true,
        Active: active,
        ShipAddr: qboAddr(project),
        Notes: `BidAxiom project ${projectId}`,
      });
      await db.insert(schema.qboEntityMappings).values({
        entityType: 'project',
        platformId: projectId,
        qboId: created.Id,
        qboSyncToken: created.SyncToken,
        direction: 'platform_to_qbo',
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        metadata: { name: displayName },
      });
      console.log(`Created QBO sub-customer ${created.Id} "${displayName}" for project ${projectId}`);
      return;
    }

    // Update only what changed.
    const changes: Record<string, unknown> = {};
    if (current.DisplayName !== displayName) changes.DisplayName = displayName;
    if (current.ParentRef?.value !== parentId) {
      changes.Job = true;
      changes.ParentRef = { value: parentId };
    }
    if ((current.Active ?? true) !== active) changes.Active = active;
    const ship = qboAddr(project);
    if (ship && !sameAddr(current.ShipAddr, ship)) changes.ShipAddr = ship;

    let syncToken = current.SyncToken;
    if (Object.keys(changes).length > 0) {
      try {
        const updated = await promisifyQbo<any>(qboClient.updateCustomer.bind(qboClient), { Id: current.Id, SyncToken: current.SyncToken, sparse: true, ...changes });
        syncToken = updated.SyncToken;
      } catch (error) {
        const fault = qboFaultText(error);
        if (changes.Active === false && !isSyncTokenConflict(error) && (error as any)?.statusCode !== 429 && (error as any)?.statusCode !== 401) {
          // QuickBooks refuses to deactivate a job that still has an open balance. Retrying will not change that.
          throw new QboUserError(`QuickBooks would not make "${displayName}" inactive (${fault ?? (error as Error).message}). Collect or write off its open balance in QuickBooks, then press Sync projects again.`);
        }
        if (isSyncTokenConflict(error)) {
          await handleSyncTokenConflict({ tenantId: params.tenantId, entityType: 'project', platformId: projectId, qboId: current.Id, db, schema, accessToken, realmId });
          return; // someone changed it in QuickBooks a moment ago; the next sync reads the fresh copy
        }
        throw error;
      }
    }

    if (mapping && mapping.qboId === current.Id) {
      await db
        .update(schema.qboEntityMappings)
        .set({ qboSyncToken: syncToken, lastSyncedAt: new Date(), syncStatus: 'synced', metadata: { name: displayName } })
        .where(eq(schema.qboEntityMappings.id, mapping.id));
    } else {
      await db.insert(schema.qboEntityMappings).values({
        entityType: 'project',
        platformId: projectId,
        qboId: current.Id,
        qboSyncToken: syncToken,
        direction: 'platform_to_qbo',
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        metadata: { name: displayName, matchedExisting: true },
      });
    }
    console.log(`Synced QBO sub-customer ${current.Id} "${displayName}" for project ${projectId}${Object.keys(changes).length ? ` (updated ${Object.keys(changes).join(', ')})` : ' (already up to date)'}`);
  } catch (error) {
    console.error(`Failed to sync project ${projectId} to QBO:`, error);
    throw error;
  }
}

/**
 * Sync a QuickBooks Online Customer to platform project.
 * QBO Customer -> Platform Project mapping.
 *
 * @param params - Sync parameters (db and schema from tenant context)
 */
export async function syncProjectFromQbo(params: {
  tenantId: string;
  qboId: string;
  db: ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  qboClient: any;
  createdBy: string; // User ID for audit trail
}): Promise<void> {
  // BidAxiom is the source of truth for projects: nothing in QuickBooks creates or renames one here.
  if (process.env.QBO_ALLOW_INBOUND_PROJECTS !== 'true') {
    console.log(`Ignoring QuickBooks Customer ${params.qboId}: projects sync from BidAxiom to QuickBooks only.`);
    return;
  }
  const { tenantId, qboId, db, schema, qboClient, createdBy } = params;

  try {
    // Fetch Customer from QBO
    const customer = await promisifyQbo<any>(
      qboClient.getCustomer.bind(qboClient),
      qboId
    );

    // Look up existing mapping
    const [mapping] = await db
      .select()
      .from(schema.qboEntityMappings)
      .where(
        and(
          eq(schema.qboEntityMappings.entityType, 'project'),
          eq(schema.qboEntityMappings.qboId, qboId)
        )
      )
      .limit(1);

    if (mapping) {
      // Update existing project
      await db
        .update(schema.projects)
        .set({
          name: customer.DisplayName,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, mapping.platformId));

      // Update mapping SyncToken
      await db
        .update(schema.qboEntityMappings)
        .set({
          qboSyncToken: customer.SyncToken,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        })
        .where(eq(schema.qboEntityMappings.id, mapping.id));

      console.log(`Updated platform project ${mapping.platformId} from QBO Customer ${qboId}`);
    } else {
      // Create new project from QBO Customer
      // We need a customer ID - use a placeholder system customer
      // In production, this would need to be handled with proper customer resolution
      const [systemCustomer] = await db
        .select()
        .from(schema.customers)
        .limit(1);

      if (!systemCustomer) {
        console.warn(`No customer available to create project from QBO Customer ${qboId}. Skipping.`);
        return;
      }

      const [newProject] = await db
        .insert(schema.projects)
        .values({
          name: customer.DisplayName,
          customerId: systemCustomer.id,
          projectType: 'commercial', // Default type
          status: 'active',
          costCodes: [],
          metadata: { importedFromQbo: true },
          createdBy,
        })
        .returning();

      // Create mapping
      await db.insert(schema.qboEntityMappings).values({
        entityType: 'project',
        platformId: newProject.id,
        qboId: customer.Id,
        qboSyncToken: customer.SyncToken,
        direction: 'bidirectional',
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        metadata: {},
      });

      console.log(`Created platform project ${newProject.id} from QBO Customer ${qboId}`);
    }

    // Handle inactive QBO entities
    if (customer.Active === false && mapping) {
      await db
        .update(schema.qboEntityMappings)
        .set({
          syncStatus: 'deleted',
          updatedAt: new Date(),
        })
        .where(eq(schema.qboEntityMappings.id, mapping.id));

      console.log(`Marked project mapping as deleted for inactive QBO Customer ${qboId}`);
    }
  } catch (error) {
    console.error(`Failed to sync project from QBO Customer ${qboId}:`, error);
    throw error;
  }
}
