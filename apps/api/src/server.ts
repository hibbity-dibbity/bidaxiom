import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root (two levels up from apps/api)
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { appRouter, type AppRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";
import { webhookRoutes } from "./webhooks/routes.js";
import { pool } from "./db/client.js";

const fastify = Fastify({
  logger: {
    level: "info",
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
  },
  maxParamLength: 5000,
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  credentials: true,
});

await fastify.register(helmet, {
  contentSecurityPolicy: false,
});

// Register tRPC
await fastify.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext: ({ req }) => createContext({ req }),
    onError({ error, path }) {
      console.error(`tRPC error on "${path}":`, error.message);
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

// Register webhook routes (scoped plugin — custom parser won't affect tRPC)
await fastify.register(webhookRoutes, { pool });

// Health check (non-tRPC, for load balancers)
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
