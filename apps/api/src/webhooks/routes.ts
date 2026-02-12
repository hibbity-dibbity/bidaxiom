import type { FastifyInstance } from "fastify";
import pg from "pg";
import { handleClerkWebhook } from "./clerk.js";

/**
 * Register webhook routes on the Fastify instance.
 *
 * IMPORTANT: Webhook routes need raw body access for signature verification.
 * Svix requires the exact raw body string to verify the HMAC signature.
 */
export async function registerWebhookRoutes(
  fastify: FastifyInstance,
  pool: pg.Pool
): Promise<void> {
  // Add raw body content type parser for webhook routes
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      // For webhook routes, keep the raw string body
      if (typeof req.url === "string" && req.url.includes("/webhooks/")) {
        done(null, body);
      } else {
        // For other routes, parse normally
        try {
          done(null, JSON.parse(body as string));
        } catch (err) {
          done(err as Error);
        }
      }
    }
  );

  /**
   * POST /api/webhooks/clerk
   *
   * Receives Clerk webhook events for organization lifecycle.
   * Body must be raw string for svix signature verification.
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
