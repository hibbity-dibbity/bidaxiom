import type { TenantSchema } from '../../../../db/schema/tenant.js';
import { eq, and } from 'drizzle-orm';
import { promisifyQbo, qboQueryRows, qboQuote } from '../../client.js';
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

type MapperDb = ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];

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
      await promisifyQbo<any>(qboClient.getCustomer.bind(qboClient), mapping.qboId);
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
  if (!q) {
    q = await promisifyQbo<any>(qboClient.createCustomer.bind(qboClient), {
      DisplayName: name,
      CompanyName: c.companyName || undefined,
      GivenName: c.companyName ? undefined : c.contactName.split(' ')[0],
      FamilyName: c.companyName ? undefined : c.contactName.split(' ').slice(1).join(' ') || undefined,
      PrimaryEmailAddr: c.email ? { Address: c.email } : undefined,
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

    let syncToken = current.SyncToken;
    if (Object.keys(changes).length > 0) {
      try {
        const updated = await promisifyQbo<any>(qboClient.updateCustomer.bind(qboClient), { Id: current.Id, SyncToken: current.SyncToken, sparse: true, ...changes });
        syncToken = updated.SyncToken;
      } catch (error) {
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
