import type { TenantSchema } from '../../../db/schema/tenant.js';
import { createMicrosoftGraphClient } from './client.js';
import { calendarSyncQueue } from '../shared/queue.js';
import { eq } from 'drizzle-orm';

export interface MicrosoftWebhookSetupParams {
  connection: {
    id: string;
    accessToken: string;
    calendarId: string;
    webhookSubscriptionId?: string | null;
  };
  db: ReturnType<typeof import('../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  tenantId: string;
}

export interface MicrosoftWebhookNotification {
  connectionId: string;
  shouldSync: boolean;
}

/**
 * Setup Microsoft Graph webhook subscription.
 *
 * Creates a subscription that receives notifications when calendar events change.
 * Subscription expires after 3 days (Microsoft max is ~4230 minutes), so we queue renewal for 2 days.
 *
 * @param params - Setup parameters
 * @returns Subscription information
 */
export async function setupMicrosoftWebhook(params: MicrosoftWebhookSetupParams): Promise<void> {
  const { connection, db, schema, tenantId } = params;
  const client = createMicrosoftGraphClient(connection.accessToken);

  // Expiration: 3 days from now (Microsoft max is ~4230 minutes = ~71 hours)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  // Create subscription
  const subscription = await client.api('/subscriptions').post({
    changeType: 'created,updated,deleted',
    notificationUrl: `${process.env.API_URL}/api/webhooks/calendar/microsoft`,
    resource: `/me/calendars/${connection.calendarId}/events`,
    expirationDateTime: expiresAt.toISOString(),
    clientState: connection.id, // Use connection ID for validation
  });

  // Store subscription info on connection
  await db
    .update(schema.calendarConnections)
    .set({
      webhookSubscriptionId: subscription.id,
      webhookExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.calendarConnections.id, connection.id));

  // Queue renewal job for 2 days from now
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  await calendarSyncQueue.add(
    'renew-webhook',
    {
      tenantId,
      provider: 'microsoft',
      connectionId: connection.id,
      operation: 'renew-webhook',
      syncReason: 'scheduled',
    },
    { delay: twoDays }
  );

  console.log(`Microsoft webhook subscription created for connection ${connection.id}, expires ${expiresAt.toISOString()}`);
}

/**
 * Handle incoming Microsoft Graph webhook notification.
 *
 * Microsoft sends two types of requests:
 * 1. Validation request (GET with validationToken query param)
 * 2. Notification request (POST with notification payload)
 *
 * @param body - Request body (for notifications)
 * @param query - Request query parameters (for validation)
 * @returns Notification result or validation token
 */
export function handleMicrosoftWebhookNotification(
  body?: any,
  query?: Record<string, string | undefined>
): MicrosoftWebhookNotification | { validationToken: string } {
  // Handle validation request
  if (query?.validationToken) {
    console.log('Microsoft webhook validation request received');
    return { validationToken: query.validationToken };
  }

  // Handle notification request
  if (body && body.value && Array.isArray(body.value)) {
    const notifications = body.value;

    // Process first notification (typically only one)
    const notification = notifications[0];

    if (notification) {
      const subscriptionId = notification.subscriptionId;
      const clientState = notification.clientState; // Our connection ID

      console.log(`Microsoft webhook notification for subscription ${subscriptionId}`);

      return {
        connectionId: clientState,
        shouldSync: true,
      };
    }
  }

  console.warn('Microsoft webhook notification missing expected data');
  return { connectionId: '', shouldSync: false };
}

/**
 * Renew Microsoft Graph webhook subscription.
 *
 * Updates the subscription expiration time and queues the next renewal.
 *
 * @param params - Setup parameters
 */
export async function renewMicrosoftSubscription(params: MicrosoftWebhookSetupParams): Promise<void> {
  const { connection, db, schema, tenantId } = params;
  const client = createMicrosoftGraphClient(connection.accessToken);

  if (!connection.webhookSubscriptionId) {
    console.warn(`No subscription ID found for connection ${connection.id}. Creating new subscription.`);
    await setupMicrosoftWebhook(params);
    return;
  }

  // New expiration: 3 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  try {
    // Update subscription expiration
    await client.api(`/subscriptions/${connection.webhookSubscriptionId}`).patch({
      expirationDateTime: expiresAt.toISOString(),
    });

    // Update stored expiration
    await db
      .update(schema.calendarConnections)
      .set({
        webhookExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.calendarConnections.id, connection.id));

    // Queue next renewal for 2 days from now
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    await calendarSyncQueue.add(
      'renew-webhook',
      {
        tenantId,
        provider: 'microsoft',
        connectionId: connection.id,
        operation: 'renew-webhook',
        syncReason: 'scheduled',
      },
      { delay: twoDays }
    );

    console.log(`Renewed Microsoft webhook subscription for connection ${connection.id}, expires ${expiresAt.toISOString()}`);
  } catch (error: any) {
    // If subscription not found (404), create a new one
    if (error.statusCode === 404 || error.code === 'itemNotFound') {
      console.log(`Microsoft subscription ${connection.webhookSubscriptionId} not found. Creating new subscription.`);
      await setupMicrosoftWebhook(params);
    } else {
      throw error;
    }
  }
}
