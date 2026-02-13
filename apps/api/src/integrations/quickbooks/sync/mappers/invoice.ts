import type { TenantSchema } from '../../../../db/schema/tenant.js';

/**
 * Sync a platform invoice to QuickBooks Online.
 * Platform Invoice -> QBO Invoice mapping.
 *
 * TODO: Implement after Phase 6 (Payment Applications) is complete.
 * Phase 6 will define the invoice data model and business logic.
 *
 * @param params - Sync parameters (db and schema from tenant context)
 */
export async function syncInvoiceToQbo(params: {
  tenantId: string;
  invoiceId: string;
  db: ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  qboClient: any;
  accessToken: string;
  realmId: string;
}): Promise<void> {
  const { invoiceId } = params;
  console.log(`Invoice sync not yet implemented — requires Phase 6 Payment Applications. InvoiceId: ${invoiceId}`);
  // Placeholder - allows worker to route invoice jobs without crashing
  return;
}

/**
 * Sync a QuickBooks Online Invoice to platform.
 * QBO Invoice -> Platform Invoice mapping.
 *
 * TODO: Implement after Phase 6 (Payment Applications) is complete.
 *
 * @param params - Sync parameters (db and schema from tenant context)
 */
export async function syncInvoiceFromQbo(params: {
  tenantId: string;
  qboId: string;
  db: ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  qboClient: any;
  createdBy: string;
}): Promise<void> {
  const { qboId } = params;
  console.log(`Invoice sync not yet implemented — requires Phase 6 Payment Applications. QBO InvoiceId: ${qboId}`);
  // Placeholder - allows worker to route invoice jobs without crashing
  return;
}
