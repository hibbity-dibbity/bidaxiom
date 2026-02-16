import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as publicSchema from "./schema/public.js";
import { createTenantSchema, type TenantSchema } from "./schema/tenant.js";

const { Pool } = pg;

/**
 * Lazy-initialized connection pool for the public schema.
 * Deferred to avoid ESM import hoisting reading process.env.DATABASE_URL
 * before dotenv has loaded environment variables.
 */
let _pool: InstanceType<typeof Pool> | null = null;

export function getPool(): InstanceType<typeof Pool> {
  if (!_pool) {
    const dbUrl = process.env.DATABASE_URL;
    console.log("Initializing database pool with DATABASE_URL:", dbUrl);
    console.log("DATABASE_URL type:", typeof dbUrl);
    console.log("DATABASE_URL length:", dbUrl?.length);

    _pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    _pool.on("error", (err) => {
      console.error("Unexpected database pool error:", err);
    });
  }
  return _pool;
}

/** @deprecated Use getPool() for new code. Kept for backwards compat. */
export const pool = new Proxy({} as InstanceType<typeof Pool>, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool(), prop, receiver);
  },
});

/**
 * Drizzle instance for public schema queries.
 * Use this for tenant registry, user mappings, and cross-tenant queries.
 * Lazy-initialized via proxy to defer pool creation until first query.
 */
let _db: ReturnType<typeof drizzle<typeof publicSchema>> | null = null;

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema: publicSchema });
  }
  return _db;
}

/** @deprecated Use getDb() for new code. Kept for backwards compat. */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof publicSchema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

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
  // Pass schema to enable Drizzle query API (db.query.tableName.findFirst())
  const tenantDb = drizzle(getPool(), { schema: tenantSchema });

  return {
    db: tenantDb,
    ...tenantSchema,
  };
}

/**
 * Graceful pool shutdown for clean exits.
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
  }
}
