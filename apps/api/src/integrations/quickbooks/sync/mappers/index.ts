import type { TenantSchema } from '../../../../db/schema/tenant.js';
import { syncProjectToQbo, syncProjectFromQbo, syncCustomerToQbo } from './project.js';
import { syncInvoiceToQbo, syncInvoiceFromQbo } from './invoice.js';
import { syncBillToQbo, syncBillFromQbo } from './bill.js';

/**
 * Shared parameters for sync operations.
 * Passed from worker to mapper functions.
 */
export interface SyncParams {
  tenantId: string;
  db: ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  qboClient: any;
  accessToken: string;
  realmId: string;
  platformId?: string;    // For platform-to-QBO sync
  qboId?: string;         // For QBO-to-platform sync
  createdBy?: string;     // User ID for audit trail (from-QBO operations)
}

/**
 * Dispatch sync operation to the appropriate mapper function.
 * Routes based on direction and entity type.
 *
 * @param direction - Sync direction ('to-qbo' or 'from-qbo')
 * @param entityType - Entity type ('project', 'invoice', 'bill', etc.)
 * @param params - Sync parameters from worker
 * @throws Error if entity type is unknown
 */
export async function dispatchSync(
  direction: 'to-qbo' | 'from-qbo',
  entityType: string,
  params: SyncParams
): Promise<void> {
  if (direction === 'to-qbo') {
    // Platform -> QBO sync
    switch (entityType) {
      case 'project':
        if (!params.platformId) {
          throw new Error('platformId required for to-qbo project sync');
        }
        return syncProjectToQbo({
          ...params,
          projectId: params.platformId,
        });

      case 'customer':
        if (!params.platformId) {
          throw new Error('platformId required for to-qbo customer sync');
        }
        return syncCustomerToQbo({ ...params, customerId: params.platformId });

      case 'invoice':
        if (!params.platformId) {
          throw new Error('platformId required for to-qbo invoice sync');
        }
        return syncInvoiceToQbo({
          ...params,
          invoiceId: params.platformId,
        });

      case 'bill':
        if (!params.platformId) {
          throw new Error('platformId required for to-qbo bill sync');
        }
        return syncBillToQbo({
          ...params,
          commitmentId: params.platformId,
        });

      default:
        throw new Error(`Unknown entity type for to-qbo sync: ${entityType}`);
    }
  } else {
    // QBO -> Platform sync
    switch (entityType) {
      case 'project':
      case 'customer':
        if (!params.qboId) {
          throw new Error('qboId required for from-qbo project sync');
        }
        return syncProjectFromQbo({
          ...params,
          qboId: params.qboId,
          createdBy: params.createdBy || 'system',
        });

      case 'invoice':
        if (!params.qboId) {
          throw new Error('qboId required for from-qbo invoice sync');
        }
        return syncInvoiceFromQbo({
          ...params,
          qboId: params.qboId,
          createdBy: params.createdBy || 'system',
        });

      case 'bill':
        if (!params.qboId) {
          throw new Error('qboId required for from-qbo bill sync');
        }
        return syncBillFromQbo({
          ...params,
          qboId: params.qboId,
          createdBy: params.createdBy || 'system',
        });

      default:
        throw new Error(`Unknown entity type for from-qbo sync: ${entityType}`);
    }
  }
}
