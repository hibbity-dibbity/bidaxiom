import { config } from "dotenv";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";
import { spawnSync } from "child_process";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

/**
 * Runs every numbered migration script (migrate-phaseNN.ts) that has not been run yet, in order,
 * and remembers which ones ran in public.applied_migrations. Used by the auto-update.
 *
 * The first time it runs it records everything up to BASELINE as already applied without running
 * it (those predate the idempotent scripts and were run by hand). Later scripts are idempotent.
 * Stops at the first failure so nothing after it runs on a half-migrated database.
 */
const BASELINE = 62;
const dir = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`CREATE TABLE IF NOT EXISTS public.applied_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
const files = readdirSync(dir)
  .map((f) => ({ f, n: Number(/^migrate-phase(\d+)\.ts$/.exec(f)?.[1] ?? NaN) }))
  .filter((x) => Number.isFinite(x.n))
  .sort((a, b) => a.n - b.n);

const done = new Set((await pool.query("SELECT name FROM public.applied_migrations")).rows.map((r) => r.name as string));
if (done.size === 0) {
  for (const x of files.filter((x) => x.n <= BASELINE)) {
    await pool.query("INSERT INTO public.applied_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [x.f]);
    done.add(x.f);
  }
  console.log(`First run: recorded migrations up to phase ${BASELINE} as already applied.`);
}

let ran = 0;
for (const x of files) {
  if (done.has(x.f)) continue;
  console.log(`Running ${x.f}...`);
  const r = spawnSync("npx", ["tsx", join(dir, x.f)], { stdio: "inherit", shell: process.platform === "win32", env: process.env });
  if (r.status !== 0) {
    console.error(`${x.f} failed (exit ${r.status}). Stopping; later migrations were not run.`);
    await pool.end();
    process.exit(1);
  }
  await pool.query("INSERT INTO public.applied_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [x.f]);
  ran++;
}
console.log(ran === 0 ? "No pending migrations." : `Applied ${ran} migration(s).`);
await pool.end();
process.exit(0);
