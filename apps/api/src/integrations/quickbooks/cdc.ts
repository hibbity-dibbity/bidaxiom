import { eq } from 'drizzle-orm';
import { db as publicDb } from '../../db/client.js';
import { tenants } from '../../db/schema/public.js';
import { createTenantDb } from '../../db/client.js';
import { createQboClient, promisifyQbo } from './client.js';
import { qboSyncQueue } from './queue.js';

/**
 * Run Change Data Capture (CDC) for a specific tenant.
 * Queries QuickBooks for entities changed since last CDC sync.
 * Queues sync jobs for changed entities.
 *
 * CDC is a fallback mechanism for daily reconciliation to catch
 * any changes missed by webhooks (e.g., changes made directly in QBO).
 *
 * @param tenantId - Tenant ID to run CDC for
 */
export async function runCdcForTenant(tenantId: string): Promise<void> {
  console.log(`Starting CDC for tenant ${tenantId}`);

  try {
    // 1. Resolve tenant
    const [tenant] = await publicDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      console.error(`Tenant not found: ${tenantId}`);
      return;
    }

    // 2. Build tenant context
    const tenantDbContext = createTenantDb(tenant.schemaName);
    const db = tenantDbContext.db;
    const schema = tenantDbContext;

    // 3. Get active QBO connection
    const [connection] = await db
      .select()
      .from(schema.qboConnections)
      .where(eq(schema.qboConnections.status, 'active'))
      .limit(1);

    if (!connection) {
      console.log(`No active QBO connection for tenant ${tenantId}. Skipping CDC.`);
      return;
    }

    // 4. Get last CDC sync time
    const [projectSyncState] = await db
      .select()
      .from(schema.qboSyncState)
      .where(eq(schema.qboSyncState.entityType, 'project'))
      .limit(1);

    // Determine changedSince timestamp
    let changedSince: Date;
    if (projectSyncState?.lastCdcSync) {
      changedSince = new Date(projectSyncState.lastCdcSync);
    } else {
      // Default to 24 hours ago for first CDC run
      changedSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // QBO CDC has a 30-day lookback limit
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (changedSince < thirtyDaysAgo) {
      console.log(`CDC changedSince ${changedSince.toISOString()} exceeds 30-day limit. Using 30 days ago.`);
      changedSince = thirtyDaysAgo;
    }

    console.log(`CDC querying changes since ${changedSince.toISOString()}`);

    // 5. Create QBO client
    const qboClient = createQboClient(connection.accessToken!, connection.realmId);

    // 6. Query CDC for each entity type
    const entityTypes = ['Customer', 'Invoice', 'Bill', 'Payment'];
    const cdcTimestamp = changedSince.toISOString();

    for (const qboEntityType of entityTypes) {
      try {
        console.log(`Querying CDC for ${qboEntityType}...`);

        // Build CDC query URL
        // QBO CDC endpoint: /company/{realmId}/cdc?entities={entityType}&changedSince={ISO_timestamp}
        const cdcUrl = `/company/${connection.realmId}/cdc?entities=${qboEntityType}&changedSince=${cdcTimestamp}`;

        // node-quickbooks doesn't have a CDC helper, so we use makeApiCall
        const cdcResponse = await promisifyQbo<any>(
          (qboClient as any).makeApiCall.bind(qboClient),
          {
            url: cdcUrl,
            method: 'GET',
          }
        );

        // Parse CDC response
        // Response structure: { CDCResponse: [{ QueryResponse: [{ [EntityType]: [...entities] }] }] }
        if (!cdcResponse.CDCResponse || !Array.isArray(cdcResponse.CDCResponse)) {
          console.log(`No CDC response for ${qboEntityType}`);
          continue;
        }

        const queryResponse = cdcResponse.CDCResponse[0]?.QueryResponse?.[0];
        if (!queryResponse) {
          console.log(`No QueryResponse for ${qboEntityType}`);
          continue;
        }

        const changedEntities = queryResponse[qboEntityType];
        if (!Array.isArray(changedEntities) || changedEntities.length === 0) {
          console.log(`No changed ${qboEntityType} entities found`);
          continue;
        }

        // Map QBO entity type to platform entity type
        const entityTypeMap: Record<string, string> = {
          Customer: 'project',
          Invoice: 'invoice',
          Bill: 'bill',
          Payment: 'payment',
        };

        const platformEntityType = entityTypeMap[qboEntityType] as 'project' | 'invoice' | 'bill' | 'payment';

        // Queue sync jobs for each changed entity
        for (const entity of changedEntities) {
          await qboSyncQueue.add('sync-from-qbo', {
            tenantId,
            entityType: platformEntityType,
            qboId: entity.Id,
            syncReason: 'cdc',
          });
        }

        console.log(`CDC: Found ${changedEntities.length} changed ${qboEntityType} for tenant ${tenantId}`);
      } catch (error) {
        console.error(`CDC query failed for ${qboEntityType}:`, error);
        // Continue with other entity types even if one fails
      }
    }

    // 7. Update CDC sync timestamp for all entity types
    const now = new Date();
    for (const entityType of ['project', 'invoice', 'bill', 'payment']) {
      const [syncState] = await db
        .select()
        .from(schema.qboSyncState)
        .where(eq(schema.qboSyncState.entityType, entityType))
        .limit(1);

      if (syncState) {
        await db
          .update(schema.qboSyncState)
          .set({
            lastCdcSync: now,
            updatedAt: now,
          })
          .where(eq(schema.qboSyncState.id, syncState.id));
      } else {
        // Create sync state if doesn't exist
        await db.insert(schema.qboSyncState).values({
          entityType,
          lastCdcSync: now,
          syncStatus: 'pending',
          syncedCount: 0,
          errorCount: 0,
        });
      }
    }

    console.log(`CDC completed for tenant ${tenantId}`);
  } catch (error) {
    console.error(`CDC failed for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Run CDC for all tenants with active QuickBooks connections.
 * Designed to be called from a daily cron/scheduler.
 */
export async function runCdcForAllTenants(): Promise<void> {
  console.log('Starting CDC for all tenants with active QBO connections');

  try {
    // Get all active tenants
    const allTenants = await publicDb
      .select()
      .from(tenants)
      .where(eq(tenants.status, 'active'));

    console.log(`Found ${allTenants.length} active tenants`);

    // Check each tenant for active QBO connection
    for (const tenant of allTenants) {
      try {
        const tenantDbContext = createTenantDb(tenant.schemaName);
    const db = tenantDbContext.db;
    const schema = tenantDbContext;

        // Check if tenant has active QBO connection
        const [connection] = await db
          .select()
          .from(schema.qboConnections)
          .where(eq(schema.qboConnections.status, 'active'))
          .limit(1);

        if (connection) {
          console.log(`Running CDC for tenant ${tenant.id} (${tenant.name})`);
          await runCdcForTenant(tenant.id);
        } else {
          console.log(`Tenant ${tenant.id} has no active QBO connection. Skipping CDC.`);
        }
      } catch (error) {
        console.error(`CDC failed for tenant ${tenant.id}:`, error);
        // Continue with other tenants even if one fails
      }
    }

    console.log('CDC completed for all tenants');
  } catch (error) {
    console.error('Failed to run CDC for all tenants:', error);
    throw error;
  }
}
