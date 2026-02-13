import type { TenantSchema } from '../../../../db/schema/tenant.js';
import { eq, and } from 'drizzle-orm';
import { promisifyQbo } from '../../client.js';
import { isSyncTokenConflict, handleSyncTokenConflict } from '../conflict.js';

/**
 * Sync a platform commitment (subcontract/PO) to QuickBooks Online as a Bill.
 * Platform Commitment -> QBO Bill mapping.
 *
 * @param params - Sync parameters (db and schema from tenant context)
 */
export async function syncBillToQbo(params: {
  tenantId: string;
  commitmentId: string;
  db: ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  qboClient: any;
  accessToken: string;
  realmId: string;
}): Promise<void> {
  const { tenantId, commitmentId, db, schema, qboClient, accessToken, realmId } = params;

  try {
    // Fetch commitment from platform
    const [commitment] = await db
      .select()
      .from(schema.commitments)
      .where(eq(schema.commitments.id, commitmentId))
      .limit(1);

    if (!commitment) {
      console.error(`Commitment not found: ${commitmentId}`);
      return;
    }

    // Fetch commitment line items
    const lineItems = await db
      .select()
      .from(schema.commitmentLineItems)
      .where(eq(schema.commitmentLineItems.commitmentId, commitmentId));

    // Look up existing mapping
    const [mapping] = await db
      .select()
      .from(schema.qboEntityMappings)
      .where(
        and(
          eq(schema.qboEntityMappings.entityType, 'bill'),
          eq(schema.qboEntityMappings.platformId, commitmentId)
        )
      )
      .limit(1);

    // Find or create QBO Vendor for the commitment's vendor
    let vendorRef: any;
    try {
      // Query vendor by DisplayName
      const vendors = await promisifyQbo<any>(
        qboClient.findVendors.bind(qboClient),
        [{ field: 'DisplayName', value: commitment.vendorName }]
      );

      if (vendors && vendors.QueryResponse && vendors.QueryResponse.Vendor && vendors.QueryResponse.Vendor.length > 0) {
        vendorRef = { value: vendors.QueryResponse.Vendor[0].Id };
      } else {
        // Create vendor if not found
        const newVendor = await promisifyQbo<any>(
          qboClient.createVendor.bind(qboClient),
          { DisplayName: commitment.vendorName }
        );
        vendorRef = { value: newVendor.Id };
      }
    } catch (error) {
      console.error(`Failed to find/create vendor ${commitment.vendorName}:`, error);
      throw error;
    }

    if (!mapping) {
      // CREATE new QBO Bill
      const billData = {
        VendorRef: vendorRef,
        Line: lineItems.map((item: any) => ({
          Amount: parseFloat(item.amount),
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: item.description,
          AccountBasedExpenseLineDetail: {
            // Use a default expense account (would need to be configured per tenant)
            AccountRef: { value: '80' }, // Default "Cost of Goods Sold" account in QBO
          },
        })),
        DueDate: commitment.executedAt ? commitment.executedAt.toISOString().split('T')[0] : undefined,
      };

      const createdBill = await promisifyQbo<any>(
        qboClient.createBill.bind(qboClient),
        billData
      );

      // Store mapping
      await db.insert(schema.qboEntityMappings).values({
        entityType: 'bill',
        platformId: commitmentId,
        qboId: createdBill.Id,
        qboSyncToken: createdBill.SyncToken,
        direction: 'bidirectional',
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        metadata: {},
      });

      console.log(`Created QBO Bill ${createdBill.Id} for commitment ${commitmentId}`);
    } else {
      // UPDATE existing QBO Bill (sparse update)
      const updateData = {
        Id: mapping.qboId,
        SyncToken: mapping.qboSyncToken,
        VendorRef: vendorRef,
        Line: lineItems.map((item: any) => ({
          Amount: parseFloat(item.amount),
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: item.description,
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: '80' },
          },
        })),
        sparse: true,
      };

      try {
        const updatedBill = await promisifyQbo<any>(
          qboClient.updateBill.bind(qboClient),
          updateData
        );

        // Update mapping with new SyncToken
        await db
          .update(schema.qboEntityMappings)
          .set({
            qboSyncToken: updatedBill.SyncToken,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
          })
          .where(eq(schema.qboEntityMappings.id, mapping.id));

        console.log(`Updated QBO Bill ${mapping.qboId} for commitment ${commitmentId}`);
      } catch (error) {
        // Check for SyncToken conflict
        if (isSyncTokenConflict(error)) {
          await handleSyncTokenConflict({
            tenantId,
            entityType: 'bill',
            platformId: commitmentId,
            qboId: mapping.qboId,
            db,
            schema,
            accessToken,
            realmId,
          });
          return; // Do not retry - user must resolve conflict
        }
        throw error; // Re-throw for other errors
      }
    }
  } catch (error) {
    console.error(`Failed to sync commitment ${commitmentId} to QBO Bill:`, error);
    throw error;
  }
}

/**
 * Sync a QuickBooks Online Bill to platform commitment.
 * QBO Bill -> Platform Commitment mapping.
 *
 * NOTE: We don't auto-create commitments from QBO bills because
 * construction commitments require a user-driven workflow.
 * This function only updates existing mapped commitments.
 *
 * @param params - Sync parameters (db and schema from tenant context)
 */
export async function syncBillFromQbo(params: {
  tenantId: string;
  qboId: string;
  db: ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  qboClient: any;
  createdBy: string;
}): Promise<void> {
  const { qboId, db, schema, qboClient } = params;

  try {
    // Fetch Bill from QBO
    const bill = await promisifyQbo<any>(
      qboClient.getBill.bind(qboClient),
      qboId
    );

    // Look up existing mapping
    const [mapping] = await db
      .select()
      .from(schema.qboEntityMappings)
      .where(
        and(
          eq(schema.qboEntityMappings.entityType, 'bill'),
          eq(schema.qboEntityMappings.qboId, qboId)
        )
      )
      .limit(1);

    if (mapping) {
      // Update existing commitment's total amount from QBO
      await db
        .update(schema.commitments)
        .set({
          totalAmount: bill.TotalAmt.toString(),
          updatedAt: new Date(),
        })
        .where(eq(schema.commitments.id, mapping.platformId));

      // Update mapping SyncToken
      await db
        .update(schema.qboEntityMappings)
        .set({
          qboSyncToken: bill.SyncToken,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        })
        .where(eq(schema.qboEntityMappings.id, mapping.id));

      console.log(`Updated platform commitment ${mapping.platformId} from QBO Bill ${qboId}`);
    } else {
      // No mapping exists - log warning
      console.warn(`No mapping found for QBO Bill ${qboId}. Commitments are not auto-created from QBO bills (requires user workflow).`);
    }
  } catch (error) {
    console.error(`Failed to sync commitment from QBO Bill ${qboId}:`, error);
    throw error;
  }
}
