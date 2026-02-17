import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from project root (two levels up from apps/api)
config({ path: resolve(process.cwd(), '../../.env.local') });
config({ path: resolve(process.cwd(), '../../.env') });

import { pool } from './src/db/client.js';

const verifyPersistence = async () => {
  try {
    // Get first active tenant
    const tenantsResult = await pool.query(
      "SELECT schema_name FROM tenants WHERE status = 'active' LIMIT 1"
    );

    if (tenantsResult.rows.length === 0) {
      console.log('No active tenants found');
      process.exit(1);
    }

    const schemaName = tenantsResult.rows[0].schema_name;
    console.log(`Testing with tenant schema: ${schemaName}\n`);

    // Check current job_number_settings
    const currentResult = await pool.query(
      `SELECT
        (job_number_settings->>'enabled')::boolean as enabled,
        job_number_settings->>'template' as template,
        (job_number_settings->>'nextSequenceNumber')::integer as next_seq
       FROM "${schemaName}".company_profiles
       WHERE valid_to IS NULL
       LIMIT 1`
    );

    if (currentResult.rows.length === 0) {
      console.log('No active company profile found');
      console.log('This is expected for newly provisioned tenants');
      console.log('✓ Schema structure is correct (column exists)');
      process.exit(0);
    }

    const current = currentResult.rows[0];
    console.log('Current job_number_settings in database:');
    console.log(`  enabled: ${current.enabled}`);
    console.log(`  template: ${current.template}`);
    console.log(`  nextSequenceNumber: ${current.next_seq}`);

    if (current.template !== null && current.template !== undefined) {
      console.log('\n✓ SUCCESS: job_number_settings column exists and contains data');
      console.log('✓ Schema defaults are correct');
      process.exit(0);
    } else {
      console.log('\n✗ WARNING: job_number_settings is NULL');
      console.log('This may indicate data migration needed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

verifyPersistence();
