import type { FastifyInstance } from "fastify";
import pg from "pg";
import { handleClerkWebhook } from "./clerk.js";
import { handleQboWebhook } from "../integrations/quickbooks/webhooks.js";

/**
 * Webhook routes Fastify plugin.
 *
 * Registered via fastify.register() so the custom content-type parser
 * is scoped to this plugin and doesn't interfere with tRPC.
 */
async function webhookRoutes(
  fastify: FastifyInstance,
  opts: { pool: pg.Pool }
): Promise<void> {
  const { pool } = opts;

  // Custom parser: keep raw string body for svix signature verification.
  // Scoped to this plugin — does NOT affect tRPC or other routes.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      done(null, body);
    }
  );

  /**
   * POST /api/webhooks/clerk
   *
   * Receives Clerk webhook events for organization lifecycle.
   * Body is raw string for svix signature verification.
   */
  fastify.post("/api/webhooks/clerk", async (request, reply) => {
    try {
      const body =
        typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body);

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === "string") {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value[0];
        }
      }

      const result = await handleClerkWebhook({ body, headers }, pool);
      return reply.status(200).send(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown webhook error";

      if (message.includes("Invalid webhook signature")) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      console.error("Webhook processing error:", err);
      return reply.status(500).send({ error: message });
    }
  });

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
}

/**
 * Export as Fastify plugin. NOT using fp() so the content-type parser
 * stays encapsulated within this plugin scope.
 */
export { webhookRoutes };
