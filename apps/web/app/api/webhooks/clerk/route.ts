import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";

/**
 * Next.js API route for Clerk webhooks.
 *
 * Alternative to the Fastify webhook route — use this if webhooks
 * hit the Next.js app instead of the Fastify API.
 *
 * NOTE: This is a thin proxy. In production, the Fastify route
 * (apps/api/src/webhooks/routes.ts) handles the actual provisioning
 * logic via handleClerkWebhook(). This route is here so either
 * endpoint can receive webhooks depending on deployment.
 *
 * For now, this verifies the signature and forwards to the API.
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.text();
    const headers: Record<string, string> = {};

    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    const event = wh.verify(body, headers) as {
      type: string;
      data: Record<string, unknown>;
    };

    // Forward to the Fastify API for processing
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const apiResponse = await fetch(`${apiUrl}/api/webhooks/clerk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
    });

    if (!apiResponse.ok) {
      console.error("API webhook forwarding failed:", apiResponse.status);
      // Still return 200 to Clerk to avoid retries — the event is valid
      return NextResponse.json({
        success: true,
        message: `Event ${event.type} received, API forwarding failed`,
      });
    }

    const result = await apiResponse.json();
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown webhook error";

    if (message.includes("Invalid webhook signature") || message.includes("verification")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    console.error("Webhook error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
