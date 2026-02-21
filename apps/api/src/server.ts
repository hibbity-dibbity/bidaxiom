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
import { ensureBucket, getStorageClient, getBucketName } from "./storage/client.js";
import { provisionAuthTables } from "./tenant/provision.js";
import { startQboSyncWorker } from "./integrations/quickbooks/sync/workers.js";
import { startScheduledReportsWorker, scheduleNextReports } from "./jobs/scheduled-reports.js";
// TODO: Uncomment when Plan 03 creates workers.ts
// import { startCalendarSyncWorker, queueDailyCalendarSync } from "./integrations/calendar/shared/workers.js";
import fs from "fs";
import path from "path";
import os from "os";
import { cleanupExpiredExports } from "./services/report-exporter.js";
import { verifyAccessToken } from "./auth/jwt.js";
import { buildTenantContext } from "./tenant/context.js";
import { eq, inArray } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import archiver from "archiver";
import { Readable } from "stream";

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

// Ensure auth tables exist in public schema (idempotent - uses CREATE IF NOT EXISTS)
try {
  await provisionAuthTables(pool);
} catch (err) {
  // Non-fatal: tables already exist in production, or Postgres is temporarily unavailable.
  // Auth endpoints will fail at request time if DB is unreachable, not at startup.
  console.warn("Auth table provisioning failed (PostgreSQL may not be running):", (err as Error).message);
}

// TODO: Seed report templates - requires public.report_templates table
// Currently commented out as templates are in tenant schemas, not public
// try {
//   const { seedReportTemplates } = await import('./db/seed/report-templates.js');
//   const { db } = await import('./db/client.js');
//   await seedReportTemplates(db);
// } catch (error) {
//   console.error('Failed to seed report templates:', error);
// }

// Start QBO sync worker (processes background sync jobs)
try {
  startQboSyncWorker();
  console.log("QBO sync worker started");
} catch (err) {
  console.warn("QBO sync worker failed to start (Redis may not be running):", err);
}

// Start calendar sync worker (processes background calendar sync jobs)
// TODO: Uncomment when Plan 03 creates workers.ts
// try {
//   startCalendarSyncWorker();
//   console.log("Calendar sync worker started");
// } catch (err) {
//   console.warn("Calendar sync worker failed to start (Redis may not be running):", err);
// }

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

// Daily calendar sync fallback (ensures eventual consistency when webhooks miss)
// TODO: Uncomment when Plan 03 creates workers.ts
// setInterval(async () => {
//   try {
//     await queueDailyCalendarSync();
//   } catch (error) {
//     console.error('Error queuing daily calendar sync:', error);
//   }
// }, 24 * 60 * 60 * 1000); // Every 24 hours

// Bulk document zip download endpoint
// Accepts: POST /api/documents/bulk-download { documentIds: string[] }
// Auth: Bearer token in Authorization header (same as tRPC)
fastify.post("/api/documents/bulk-download", async (request, reply) => {
  // Verify auth token
  const rawAuth = request.headers["authorization"];
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  let userId: string;
  let orgId: string;

  try {
    const payload = await verifyAccessToken(token);
    if (!payload.userId || !payload.orgId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    userId = payload.userId;
    orgId = payload.orgId;
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
  }

  // Resolve tenant context from JWT orgId
  let tenantCtx: Awaited<ReturnType<typeof buildTenantContext>>;
  try {
    tenantCtx = await buildTenantContext(orgId, userId);
  } catch {
    return reply.code(403).send({ error: "Tenant not found" });
  }

  const body = request.body as { documentIds?: unknown };
  const documentIds = body?.documentIds;

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return reply.code(400).send({ error: "documentIds required" });
  }

  if (documentIds.length > 50) {
    return reply.code(400).send({ error: "Maximum 50 documents per bulk download" });
  }

  const { db, schema } = tenantCtx;

  // Fetch document records for requested IDs
  const docs = await db
    .select({
      id: schema.documents.id,
      name: schema.documents.name,
      currentVersionId: schema.documents.currentVersionId,
    })
    .from(schema.documents)
    .where(inArray(schema.documents.id, documentIds as string[]));

  if (docs.length === 0) {
    return reply.code(404).send({ error: "No documents found" });
  }

  // Fetch S3 keys from document_versions
  const versionIds = docs
    .map((d) => d.currentVersionId)
    .filter((v): v is string => v !== null && v !== undefined);

  const versions =
    versionIds.length > 0
      ? await db
          .select({
            id: schema.documentVersions.id,
            storageKey: schema.documentVersions.storageKey,
          })
          .from(schema.documentVersions)
          .where(inArray(schema.documentVersions.id, versionIds))
      : [];

  const keyMap = new Map(versions.map((v) => [v.id, v.storageKey]));

  reply.raw.setHeader("Content-Type", "application/zip");
  reply.raw.setHeader(
    "Content-Disposition",
    'attachment; filename="documents.zip"'
  );

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(reply.raw);

  const s3 = getStorageClient();
  const bucket = getBucketName();

  for (const doc of docs) {
    const storageKey = doc.currentVersionId ? keyMap.get(doc.currentVersionId) : null;
    if (!storageKey) continue;

    try {
      const s3Response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: storageKey })
      );

      if (s3Response.Body) {
        archive.append(Readable.from(s3Response.Body as AsyncIterable<Uint8Array>), {
          name: doc.name,
        });
      }
    } catch (err) {
      console.error(`[bulk-download] Skipping document ${doc.id} — S3 fetch failed for key ${storageKey}:`, err);
    }
  }

  await archive.finalize();
});

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
