import { createHmac } from 'crypto';
import { z } from 'zod';
import { getQboSyncQueue } from './queue.js';
import { pool } from '../../db/client.js';

/**
 * QuickBooks CloudEvents webhook payload schema.
 * MANDATORY format as of May 15, 2026 (old format deprecated).
 */
const cloudEventSchema = z.object({
  specversion: z.literal('1.0'),
  type: z.string(),
  source: z.string(),
  id: z.string(),
  time: z.string(),
  datacontenttype: z.literal('application/json'),
  data: z.object({
    realmId: z.string(),
    entities: z.array(
      z.object({
        name: z.string(),
        id: z.string(),
        operation: z.enum(['Create', 'Update', 'Delete', 'Void']),
        lastUpdated: z.string(),
      })
    ),
  }),
});

/**
 * Map QBO entity name to our platform entity type.
 * Returns null for entity types we don't sync.
 */
function mapQboEntityToOurType(qboEntityName: string): string | null {
  const mapping: Record<string, string> = {
    Customer: 'project',
    Invoice: 'invoice',
    Bill: 'bill',
    Payment: 'payment',
    Vendor: 'vendor',
  };

  return mapping[qboEntityName] || null;
}

/**
 * Handle incoming QuickBooks CloudEvents webhook.
 * Verifies signature, parses payload, queues sync jobs.
 *
 * @param rawBody - Raw request body string (for signature verification)
 * @param signature - Intuit-Signature header value
 * @returns Number of entities processed
 */
export async function handleQboWebhook(
  rawBody: string,
  signature: string
): Promise<{ processed: number }> {
  // Verify webhook signature using HMAC-SHA256
  const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
  if (!verifierToken) {
    throw new Error('QBO_WEBHOOK_VERIFIER_TOKEN environment variable not set');
  }

  const hmac = createHmac('sha256', verifierToken);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest('base64');

  if (signature !== expectedSignature) {
    throw new Error('Invalid webhook signature');
  }

  // Parse CloudEvents payload
  const payload = JSON.parse(rawBody);
  const event = cloudEventSchema.parse(payload);

  // Find tenant by realmId
  // Query public.tenants table, then check each tenant's qbo_connections for matching realmId
  const tenantsResult = await pool.query<{ id: string; schema_name: string }>(
    'SELECT id, schema_name FROM tenants ORDER BY created_at DESC'
  );

  let tenantId: string | null = null;
  let schemaName: string | null = null;

  for (const tenant of tenantsResult.rows) {
    const connectionResult = await pool.query(
      `SELECT id FROM "${tenant.schema_name}".qbo_connections WHERE realm_id = $1 AND status = 'active' LIMIT 1`,
      [event.data.realmId]
    );

    if (connectionResult.rows.length > 0) {
      tenantId = tenant.id;
      schemaName = tenant.schema_name;
      break;
    }
  }

  if (!tenantId) {
    console.warn(`Webhook received for unknown realmId: ${event.data.realmId}`);
    return { processed: 0 };
  }

  // Queue sync jobs for each entity in the webhook
  let processed = 0;

  for (const entity of event.data.entities) {
    const entityType = mapQboEntityToOurType(entity.name);

    if (!entityType) {
      // Skip unknown entity types (e.g., Estimate, PurchaseOrder)
      continue;
    }

    // Queue sync-from-qbo job
    await getQboSyncQueue().add('sync-from-qbo', {
      tenantId,
      entityType: entityType as any, // Type is validated by queue schema
      qboId: entity.id,
      operation: entity.operation,
      syncReason: 'webhook',
    });

    processed++;
  }

  return { processed };
}
