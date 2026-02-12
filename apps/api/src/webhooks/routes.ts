import type { FastifyInstance } from "fastify";
import pg from "pg";
import { handleClerkWebhook } from "./clerk.js";

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
}

/**
 * Export as Fastify plugin. NOT using fp() so the content-type parser
 * stays encapsulated within this plugin scope.
 */
export { webhookRoutes };
