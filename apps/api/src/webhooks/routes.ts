import type { FastifyInstance } from "fastify";
import pg from "pg";
import { handleQboWebhook } from "../integrations/quickbooks/webhooks.js";
import { calendarSyncQueue } from "../integrations/calendar/shared/queue.js";

/**
 * Webhook routes Fastify plugin.
 *
 * Registered via fastify.register() so the custom content-type parser
 * is scoped to this plugin and doesn't interfere with tRPC.
 *
 * Note: Clerk webhook removed in Phase 12 (custom auth migration).
 * Organization lifecycle is now handled directly by the organization tRPC router.
 */
async function webhookRoutes(
  fastify: FastifyInstance,
  opts: { pool: pg.Pool }
): Promise<void> {
  const { pool } = opts;

  // Custom parser: keep raw string body for webhook signature verification.
  // Scoped to this plugin — does NOT affect tRPC or other routes.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      done(null, body);
    }
  );

  /**
   * POST /api/integrations/quickbooks/webhook
   *
   * Receives QuickBooks CloudEvents webhook notifications.
   * Body is raw string for HMAC signature verification.
   */
  fastify.post("/api/integrations/quickbooks/webhook", async (request, reply) => {
    try {
      const body =
        typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body);

      const signature = (request.headers["intuit-signature"] as string) || "";

      const result = await handleQboWebhook(body, signature);
      return reply.status(200).send(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown webhook error";

      if (message.includes("Invalid webhook signature")) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      console.error("QBO webhook error:", err);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/integrations/quickbooks/callback
   *
   * OAuth 2.0 callback endpoint. QBO redirects here after user authorizes.
   * Redirects to frontend with authorization code for tRPC token exchange.
   */
  fastify.get("/api/integrations/quickbooks/callback", async (request, reply) => {
    const { code, realmId, state } = request.query as {
      code: string;
      realmId: string;
      state: string;
    };

    // Redirect to frontend with params (frontend will call tRPC handleCallback)
    const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:3000";
    return reply.redirect(
      `${frontendUrl}/settings/integrations/quickbooks/callback?code=${code}&realmId=${realmId}&state=${state}`
    );
  });

  /**
   * POST /api/webhooks/calendar/google
   *
   * Google Calendar push notification handler.
   * Receives watch channel notifications when calendar events change.
   */
  fastify.post("/api/webhooks/calendar/google", async (request, reply) => {
    try {
      // Extract Google notification headers
      const channelId = request.headers["x-goog-channel-id"] as string;
      const resourceState = request.headers["x-goog-resource-state"] as string;
      const channelToken = request.headers["x-goog-channel-token"] as string;

      // If this is a sync message (channel setup confirmation), respond OK immediately
      if (resourceState === "sync") {
        return reply.status(200).send({ received: true });
      }

      // TODO: Once Plan 03 creates webhook handler, uncomment:
      // const { handleGoogleWebhookNotification } = await import("../integrations/calendar/google/webhooks.js");
      // const { shouldSync, connectionId, provider, tenantId } = await handleGoogleWebhookNotification({
      //   channelId,
      //   resourceState,
      //   channelToken,
      // });

      // For now, log the webhook (will be replaced when handler is implemented)
      console.log("Google Calendar webhook received:", {
        channelId,
        resourceState,
        channelToken,
      });

      // TODO: Queue incremental sync if shouldSync
      // if (shouldSync && connectionId && provider && tenantId) {
      //   await calendarSyncQueue.add("incremental-sync", {
      //     tenantId,
      //     provider,
      //     connectionId,
      //     operation: "incremental-sync",
      //     syncReason: "webhook",
      //   });
      // }

      return reply.status(200).send({ received: true });
    } catch (err) {
      console.error("Google Calendar webhook error:", err);
      return reply.status(500).send({ error: "Webhook processing failed" });
    }
  });

  /**
   * POST /api/webhooks/calendar/microsoft
   *
   * Microsoft Graph webhook handler.
   * Receives subscription notifications when calendar events change.
   */
  fastify.post("/api/webhooks/calendar/microsoft", async (request, reply) => {
    try {
      // Handle subscription validation (Microsoft sends validationToken on first setup)
      const validationToken = (request.query as { validationToken?: string }).validationToken;
      if (validationToken) {
        return reply.status(200).type("text/plain").send(validationToken);
      }

      // Parse notification body
      const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
      const notifications = (body as { value?: Array<any> }).value || [];

      // TODO: Once Plan 03 creates webhook handler, uncomment:
      // const { handleMicrosoftWebhookNotification } = await import("../integrations/calendar/microsoft/webhooks.js");
      // for (const notification of notifications) {
      //   const { shouldSync, connectionId, provider, tenantId } = await handleMicrosoftWebhookNotification(notification);
      //   if (shouldSync && connectionId && provider && tenantId) {
      //     await calendarSyncQueue.add("incremental-sync", {
      //       tenantId,
      //       provider,
      //       connectionId,
      //       operation: "incremental-sync",
      //       syncReason: "webhook",
      //     });
      //   }
      // }

      // For now, log the webhook (will be replaced when handler is implemented)
      console.log("Microsoft Calendar webhook received:", {
        notificationCount: notifications.length,
      });

      // Microsoft expects 202 Accepted
      return reply.status(202).send({ received: true });
    } catch (err) {
      console.error("Microsoft Calendar webhook error:", err);
      return reply.status(500).send({ error: "Webhook processing failed" });
    }
  });

  /**
   * GET /api/integrations/calendar/google/callback
   *
   * Google Calendar OAuth 2.0 callback endpoint.
   * Redirects to frontend with authorization code for tRPC token exchange.
   */
  fastify.get("/api/integrations/calendar/google/callback", async (request, reply) => {
    const { code, scope, state } = request.query as {
      code: string;
      scope: string;
      state: string;
    };

    // Redirect to frontend with params (frontend will call tRPC handleCallback)
    const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:3000";
    return reply.redirect(
      `${frontendUrl}/settings/integrations/calendar/callback?provider=google&code=${code}&state=${state}`
    );
  });

  /**
   * GET /api/integrations/calendar/microsoft/callback
   *
   * Microsoft Graph OAuth 2.0 callback endpoint.
   * Redirects to frontend with authorization code for tRPC token exchange.
   */
  fastify.get("/api/integrations/calendar/microsoft/callback", async (request, reply) => {
    const { code, state } = request.query as {
      code: string;
      state: string;
    };

    // Redirect to frontend with params (frontend will call tRPC handleCallback)
    const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:3000";
    return reply.redirect(
      `${frontendUrl}/settings/integrations/calendar/callback?provider=microsoft&code=${code}&state=${state}`
    );
  });
}

/**
 * Export as Fastify plugin. NOT using fp() so the content-type parser
 * stays encapsulated within this plugin scope.
 */
export { webhookRoutes };
