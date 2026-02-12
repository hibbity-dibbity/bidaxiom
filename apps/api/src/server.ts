import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { UserRole } from "@construction/shared";

const fastify = Fastify({
  logger: {
    level: "info",
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
  },
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  credentials: true,
});

await fastify.register(helmet, {
  contentSecurityPolicy: false, // Managed by Next.js in production
});

// Health check endpoint
fastify.get("/health", async () => {
  return {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    version: "0.0.1",
  };
});

// Start server
const port = Number(process.env.API_PORT) || 3001;
const host = process.env.HOST ?? "0.0.0.0";

try {
  await fastify.listen({ port, host });
  console.log(`API server running at http://localhost:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// Graceful shutdown
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of signals) {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down...`);
    await fastify.close();
    process.exit(0);
  });
}

// Type check: ensure shared types are importable
const _typeCheck: UserRole | undefined = undefined;
void _typeCheck;
