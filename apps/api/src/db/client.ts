import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as publicSchema from "./schema/public.js";
import { createTenantSchema, type TenantSchema } from "./schema/tenant.js";

const { Pool } = pg;

/**
 * Connection pool for the public schema.
 * Max 20 connections shared across all requests.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log connection errors (don't crash the process)
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

/**
 * Drizzle instance for public schema queries.
 * Use this for tenant registry, user mappings, and cross-tenant queries.
 */
export const db = drizzle(pool, { schema: publicSchema });

/**
 * Cache of tenant schema instances to avoid re-creating on every request.
 */
const tenantSchemaCache = new Map<string, TenantSchema>();

/**
 * Get a tenant schema definition (tables) for a specific schema name.
 * Cached to avoid re-creating schema objects repeatedly.
 */
export function getTenantSchema(schemaName: string): TenantSchema {
  let cached = tenantSchemaCache.get(schemaName);
  if (!cached) {
    cached = createTenantSchema(schemaName);
    tenantSchemaCache.set(schemaName, cached);
  }
  return cached;
}

/**
 * Create a Drizzle instance scoped to a specific tenant schema.
 * Used in tRPC context to scope all queries to the active tenant.
 *
 * @param schemaName - PostgreSQL schema name (e.g., "tenant_abc123")
 * @returns Drizzle client + tenant schema tables
 */
export function createTenantDb(schemaName: string) {
  const tenantSchema = getTenantSchema(schemaName);

  // Use same pool but queries will reference tenant-specific schema tables
  const tenantDb = drizzle(pool);

  return {
    db: tenantDb,
    ...tenantSchema,
  };
}

/**
 * Graceful pool shutdown for clean exits.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
