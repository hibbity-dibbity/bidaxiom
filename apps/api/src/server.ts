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
import { ensureBucket } from "./storage/client.js";
import { startQboSyncWorker } from "./integrations/quickbooks/sync/workers.js";
import { startScheduledReportsWorker, scheduleNextReports } from "./jobs/scheduled-reports.js";
import fs from "fs";
import path from "path";
import os from "os";
import { cleanupExpiredExports } from "./services/report-exporter.js";

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

// Ensure S3 bucket exists (auto-create in local dev)
try {
  await ensureBucket();
} catch (err) {
  console.warn("S3 bucket initialization failed (MinIO may not be running):", err);
}

// Seed report templates (idempotent)
try {
  const { seedReportTemplates } = await import('./db/seed/report-templates.js');
  const { db } = await import('./db/client.js');
  await seedReportTemplates(db);
} catch (error) {
  console.error('Failed to seed report templates:', error);
}

// Start QBO sync worker (processes background sync jobs)
try {
  startQboSyncWorker();
  console.log("QBO sync worker started");
} catch (err) {
  console.warn("QBO sync worker failed to start (Redis may not be running):", err);
}

// Start scheduled reports worker
try {
  startScheduledReportsWorker();
  console.log("Scheduled reports worker started");
} catch (err) {
  console.warn("Scheduled reports worker failed to start (Redis may not be running):", err);
}

// Schedule checker (every 5 minutes)
setInterval(async () => {
  try {
    await scheduleNextReports();
  } catch (error) {
    console.error('Error checking scheduled reports:', error);
  }
}, 5 * 60 * 1000);

// Report export download endpoint (non-tRPC for file streaming)
const REPORTS_TEMP_DIR = process.env.REPORTS_TEMP_DIR || path.join(os.tmpdir(), 'construction-reports');

fastify.get('/api/reports/download/:filename', async (request, reply) => {
  const { filename } = request.params as { filename: string };
  const filePath = path.join(REPORTS_TEMP_DIR, filename);

  // Security: prevent path traversal
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(REPORTS_TEMP_DIR)) {
    return reply.code(403).send({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath)) {
    return reply.code(404).send({ error: 'File not found or expired' });
  }

  const ext = path.extname(filename);
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
  };

  const stream = fs.createReadStream(filePath);
  reply.type(mimeTypes[ext] || 'application/octet-stream');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  return reply.send(stream);
});

// Cleanup expired exports every 6 hours
setInterval(async () => {
  try {
    const deleted = await cleanupExpiredExports();
    console.log(`Cleaned up ${deleted} expired report exports`);
  } catch (error) {
    console.error('Error during export cleanup:', error);
  }
}, 6 * 60 * 60 * 1000);

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
