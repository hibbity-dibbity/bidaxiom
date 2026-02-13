import type { TenantSchema } from '../../../db/schema/tenant.js';
import { eq, and } from 'drizzle-orm';
import { createQboClient, promisifyQbo } from '../client.js';

/**
 * Check if an error is a QuickBooks SyncToken conflict (stale object error).
 * QBO returns Fault.Error[0].code === '5010' for optimistic lock conflicts.
 *
 * @param err - Error object from QBO API call
 * @returns true if error is a SyncToken conflict
 */
export function isSyncTokenConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }

  const error = err as Record<string, unknown>;

  // QBO error structure: { Fault: { Error: [{ code: '5010', ... }] } }
  if (error.Fault && typeof error.Fault === 'object') {
    const fault = error.Fault as Record<string, unknown>;
    if (Array.isArray(fault.Error) && fault.Error.length > 0) {
      const firstError = fault.Error[0] as Record<string, unknown>;
      return firstError.code === '5010';
    }
  }

  return false;
}

/**
 * Handle a SyncToken conflict by fetching the latest entity from QBO
 * and updating the mapping with the new SyncToken.
 * Sets syncStatus to 'conflict' to indicate user review is needed.
 *
 * IMPORTANT: Does NOT auto-merge changes. Financial data conflicts
 * must be reviewed by users before resolution (per research guidance).
 *
 * @param params - Conflict resolution parameters
 */
export async function handleSyncTokenConflict(params: {
  tenantId: string;
  entityType: string;
  platformId: string;
  qboId: string;
  db: ReturnType<typeof import('../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  accessToken: string;
  realmId: string;
}): Promise<void> {
  const { tenantId, entityType, platformId, qboId, db, schema, accessToken, realmId } = params;

  try {
    // Create QBO client to fetch latest entity
    const qboClient = createQboClient(accessToken, realmId);

    // Map entity type to QBO entity name
    const qboEntityMap: Record<string, string> = {
      project: 'Customer',
      invoice: 'Invoice',
      bill: 'Bill',
      payment: 'Payment',
      vendor: 'Vendor',
      customer: 'Customer',
    };

    const qboEntityName = qboEntityMap[entityType];
    if (!qboEntityName) {
      console.error(`Unknown entity type for conflict resolution: ${entityType}`);
      return;
    }

    // Fetch latest entity from QBO to get current SyncToken
    const getMethod = (qboClient as any)[`get${qboEntityName}`];
    if (!getMethod) {
      console.error(`QBO client missing method: get${qboEntityName}`);
      return;
    }

    const latestEntity = await promisifyQbo<any>(
      getMethod.bind(qboClient),
      qboId
    );

    // Update entity mapping with new SyncToken and set status to 'conflict'
    await db
      .update(schema.qboEntityMappings)
      .set({
        qboSyncToken: latestEntity.SyncToken,
        syncStatus: 'conflict',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.qboEntityMappings.entityType, entityType),
          eq(schema.qboEntityMappings.platformId, platformId)
        )
      );

    console.log(`SyncToken conflict resolved for ${entityType}:${platformId}. Status set to 'conflict' for user review.`);
  } catch (error) {
    console.error(`Failed to handle SyncToken conflict for ${entityType}:${platformId}:`, error);
    throw error;
  }
}
