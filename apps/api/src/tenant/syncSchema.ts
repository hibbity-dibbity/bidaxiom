import type pg from "pg";
import { getTableConfig, PgDialect, type AnyPgColumn } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import { createTenantSchema } from "../db/schema/tenant.js";

/**
 * Bring a tenant schema up to date with the table definitions in db/schema/tenant.ts:
 * create missing tables (columns, defaults, keys, foreign keys, indexes) and add missing columns.
 *
 * Provisioning runs this after its base DDL so a new company never starts behind the app.
 * It only adds things, and every statement is idempotent. It is meant for a freshly provisioned
 * (empty) schema: a NOT NULL column without a default would fail on a table that already has rows.
 * Existing companies are updated by the numbered migration scripts.
 */
const dialect = new PgDialect();

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

function defaultSql(col: AnyPgColumn): string | null {
  const d = (col as unknown as { default: unknown }).default;
  if (d === undefined || d === null) return null;
  if (d instanceof SQL) return dialect.sqlToQuery(d).sql;
  if (typeof d === "string") return `'${d.replace(/'/g, "''")}'`;
  if (typeof d === "number" || typeof d === "boolean") return String(d);
  if (d instanceof Date) return `'${d.toISOString()}'`;
  if (typeof d === "object") return `'${JSON.stringify(d).replace(/'/g, "''")}'::jsonb`;
  return null;
}

function columnDdl(col: AnyPgColumn, inlineKey: boolean): string {
  const c = col as unknown as { name: string; notNull: boolean; primary: boolean; isUnique: boolean; getSQLType(): string };
  const parts = [q(c.name), c.getSQLType()];
  if (inlineKey && c.primary) parts.push("PRIMARY KEY");
  const def = defaultSql(col);
  if (def !== null) parts.push(`DEFAULT ${def}`);
  if (c.notNull && !(inlineKey && c.primary)) parts.push("NOT NULL");
  return parts.join(" ");
}

export async function syncTenantSchema(client: pg.PoolClient, schemaName: string): Promise<{ tables: number; columns: number }> {
  const tenantSchema = createTenantSchema(schemaName) as unknown as Record<string, unknown>;
  const configs: Array<ReturnType<typeof getTableConfig>> = [];
  for (const value of Object.values(tenantSchema)) {
    try {
      const cfg = getTableConfig(value as never);
      if (cfg && cfg.name) configs.push(cfg);
    } catch {
      /* not a table */
    }
  }

  const existing = await client.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1",
    [schemaName]
  );
  const have = new Map<string, Set<string>>();
  for (const r of existing.rows) {
    if (!have.has(r.table_name)) have.set(r.table_name, new Set());
    have.get(r.table_name)!.add(r.column_name);
  }

  let tables = 0;
  let columns = 0;
  const created: typeof configs = [];
  const added = new Map<string, Set<string>>(); // columns added to tables that already existed

  // 0. Columns the app treats as optional but old DDL made NOT NULL (for example bids.rfq_id).
  const strict = await client.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 AND is_nullable = 'NO'",
    [schemaName]
  );
  const strictSet = new Set(strict.rows.map((r) => `${r.table_name}.${r.column_name}`));
  for (const cfg of configs) {
    for (const c of cfg.columns) {
      const col = c as unknown as { name: string; notNull: boolean; primary: boolean };
      if (!col.notNull && !col.primary && strictSet.has(`${cfg.name}.${col.name}`)) {
        await client.query(`ALTER TABLE ${q(schemaName)}.${q(cfg.name)} ALTER COLUMN ${q(col.name)} DROP NOT NULL`);
      }
    }
  }

  // 1. tables and columns
  for (const cfg of configs) {
    const cols = have.get(cfg.name);
    const t = `${q(schemaName)}.${q(cfg.name)}`;
    if (!cols) {
      const defs = cfg.columns.map((c) => columnDdl(c as AnyPgColumn, true));
      const pk = cfg.primaryKeys.map((p) => `PRIMARY KEY (${p.columns.map((c) => q(c.name)).join(", ")})`);
      await client.query(`CREATE TABLE ${t} (${[...defs, ...pk].join(", ")})`);
      created.push(cfg);
      tables++;
      continue;
    }
    for (const c of cfg.columns) {
      if (cols.has(c.name)) continue;
      await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${columnDdl(c as AnyPgColumn, false)}`);
      if ((c as unknown as { isUnique: boolean }).isUnique) {
        await client.query(`ALTER TABLE ${t} ADD CONSTRAINT ${q(`${cfg.name}_${c.name}_key`)} UNIQUE (${q(c.name)})`);
      }
      if (!added.has(cfg.name)) added.set(cfg.name, new Set());
      added.get(cfg.name)!.add(c.name);
      columns++;
    }
  }

  // 2. unique columns of new tables, then foreign keys, unique constraints and indexes
  for (const cfg of configs) {
    const t = `${q(schemaName)}.${q(cfg.name)}`;
    const isNew = created.includes(cfg);
    if (isNew) {
      for (const c of cfg.columns) {
        if ((c as unknown as { isUnique: boolean }).isUnique) {
          await client.query(`ALTER TABLE ${t} ADD CONSTRAINT ${q(`${cfg.name}_${c.name}_key`)} UNIQUE (${q(c.name)})`);
        }
      }
      for (const u of cfg.uniqueConstraints) {
        const cols = u.columns.map((c) => q(c.name)).join(", ");
        const name = u.name ?? `${cfg.name}_${u.columns.map((c) => c.name).join("_")}_key`;
        await client.query(`ALTER TABLE ${t} ADD CONSTRAINT ${q(name)} UNIQUE ${u.nullsNotDistinct ? "NULLS NOT DISTINCT " : ""}(${cols})`);
      }
    }
    // Keys and indexes are only added where the table or the column is new, so tables that already
    // have them under another name do not get duplicates.
    const fresh = (cols: string[]) => isNew || cols.every((c) => added.get(cfg.name)?.has(c));
    {
      for (const fk of cfg.foreignKeys) {
        const ref = fk.reference();
        const local = ref.columns.map((c) => c.name);
        if (!fresh(local)) continue;
        const name = fk.getName?.() ?? `${cfg.name}_${local.join("_")}_fkey`;
        const exists = await client.query(
          "SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = $1 AND c.conname = $2",
          [schemaName, name]
        );
        if (exists.rowCount) continue;
        const foreign = getTableConfig(ref.foreignTable);
        const action = (a: string | undefined) => (a && a !== "no action" ? ` ON DELETE ${a.toUpperCase()}` : "");
        await client.query(
          `ALTER TABLE ${t} ADD CONSTRAINT ${q(name)} FOREIGN KEY (${local.map(q).join(", ")}) REFERENCES ${q(schemaName)}.${q(foreign.name)} (${ref.foreignColumns.map((c) => q(c.name)).join(", ")})${action(fk.onDelete)}`
        );
      }
    }
    for (const idx of cfg.indexes) {
      const cols = idx.config.columns.map((c) => (c as { name?: string }).name).filter((n): n is string => Boolean(n));
      if (cols.length === 0 || !fresh(cols)) continue;
      const name = idx.config.name ?? `idx_${cfg.name}_${cols.join("_")}`;
      await client.query(`CREATE ${idx.config.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${q(name)} ON ${t} (${cols.map(q).join(", ")})`);
    }
  }
  return { tables, columns };
}
