import type { TenantSchema } from '../../../../db/schema/tenant.js';
import { eq, and } from 'drizzle-orm';
import { promisifyQbo } from '../../client.js';
import { isSyncTokenConflict, handleSyncTokenConflict } from '../conflict.js';

/**
 * Sync a platform project to QuickBooks Online as a Customer.
 * Platform Project -> QBO Customer mapping.
 *
 * @param params - Sync parameters (db and schema from tenant context)
 */
export async function syncProjectToQbo(params: {
  tenantId: string;
  projectId: string;
  db: ReturnType<typeof import('../../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  qboClient: any;
  accessToken: string;
  realmId: string;
}): Promise<void> {
  const { tenantId, projectId, db, schema, qboClient, accessToken, realmId } = params;

  try {
    // Fetch project from platform
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1);

    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return;
    }

    // Look up existing mapping
    const [mapping] = await db
      .select()
      .from(schema.qboEntityMappings)
      .where(
        and(
          eq(schema.qboEntityMappings.entityType, 'project'),
          eq(schema.qboEntityMappings.platformId, projectId)
        )
      )
      .limit(1);

    if (!mapping) {
      // CREATE new QBO Customer
      const customerData = {
        DisplayName: project.name,
        CompanyName: project.name,
        Notes: `Platform Project ID: ${projectId}`,
      };

      const createdCustomer = await promisifyQbo<any>(
        qboClient.createCustomer.bind(qboClient),
        customerData
      );

      // Store mapping
      await db.insert(schema.qboEntityMappings).values({
        entityType: 'project',
        platformId: projectId,
        qboId: createdCustomer.Id,
        qboSyncToken: createdCustomer.SyncToken,
        direction: 'bidirectional',
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        metadata: {},
      });

      console.log(`Created QBO Customer ${createdCustomer.Id} for project ${projectId}`);
    } else {
      // UPDATE existing QBO Customer (sparse update)
      const updateData = {
        Id: mapping.qboId,
        SyncToken: mapping.qboSyncToken,
        DisplayName: project.name,
        sparse: true, // Only update provided fields
      };

      try {
        const updatedCustomer = await promisifyQbo<any>(
          qboClient.updateCustomer.bind(qboClient),
          updateData
        );

        // Update mapping with new SyncToken
        await db
          .update(schema.qboEntityMappings)
          .set({
            qboSyncToken: updatedCustomer.SyncToken,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
          })
          .where(eq(schema.qboEntityMappings.id, mapping.id));

        console.log(`Updated QBO Customer ${mapping.qboId} for project ${projectId}`);
      } catch (error) {
        // Check for SyncToken conflict
        if (isSyncTokenConflict(error)) {
          await handleSyncTokenConflict({
            tenantId,
            entityType: 'project',
            platformId: projectId,
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
