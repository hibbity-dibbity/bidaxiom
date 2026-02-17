import dotenv from 'dotenv';
import { resolve } from 'path';
import pg from 'pg';

dotenv.config({ path: resolve(process.cwd(), '../../.env.local') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const result = await pool.query(`
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_schema = 'tenant_vpa_g9edvkmrj3ao2oebusov'
  AND table_name = 'company_profiles'
  AND column_name IN ('allow_personal_templates', 'sov_grouping_method')
  ORDER BY column_name
`);

console.log('Columns found:', result.rows.length);
result.rows.forEach(row => {
  console.log(`  - ${row.column_name}: ${row.data_type} DEFAULT ${row.column_default}`);
});

await pool.end();
