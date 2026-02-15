---
phase: 14-form-standardization-and-validation
plan: 02
subsystem: database-schema-validation
tags: [database, migration, validation, schemas, structured-data]
dependencies:
  requires: ["14-01"]
  provides:
    - structured address columns in database
    - centralized phone/address validation in shared schemas
    - migration script for Phase 14 address changes
  affects:
    - customers table
    - subcontractor_directory table
    - projects table
    - customer.ts schemas
    - bidding.ts schemas
    - project.ts schemas
tech_stack:
  added: []
  patterns:
    - "Idempotent migration with column existence checks"
    - "Legacy column preservation with NULL clearing"
    - "Zod schema composition via imported phoneSchema/addressSchema"
    - "Structured address fields (street1, street2, city, state, zip)"
key_files:
  created:
    - apps/api/src/migrate-phase14-addresses.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - packages/shared/src/types/customer.ts
    - packages/shared/src/types/bidding.ts
    - packages/shared/src/types/project.ts
decisions:
  - "Keep legacy columns (address, location, phone, contactPhone) in schema to avoid breaking existing code - migration NULLs them out, Plan 03-04 will update router/form code"
  - "User chose to DELETE existing freeform phone/address/location data instead of attempting migration to structured format"
  - "Add both legacy address field and new structured fields to schemas during transition period"
metrics:
  duration: 4 min
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  commits: 2
  completed_at: 2026-02-15
---

# Phase 14 Plan 02: Database Schema and Validation Updates Summary

**One-liner:** Structured address columns added to database with migration script; shared schemas updated to use centralized phoneSchema and addressSchema validation.

## What Was Built

Updated database schema and shared validation schemas to support structured addresses:

**1. Database Schema Changes** (apps/api/src/db/schema/tenant.ts):
   - **Customers table**: Added street1, street2, city, state, zip columns; marked legacy phone/address for clearing
   - **Subcontractor directory table**: Added street1, street2, city, state, zip columns; marked legacy contactPhone/address for clearing
   - **Projects table**: Added street1, street2, city, state, zip columns; marked legacy location for clearing
   - All new columns are TEXT type, nullable (optional fields)

**2. Migration Script** (apps/api/src/migrate-phase14-addresses.ts):
   - Idempotent column addition with `IF NOT EXISTS` checks
   - Queries `information_schema.columns` to verify columns don't exist before adding
   - Updates existing data to NULL for legacy columns (phone, address, contactPhone, location)
   - Handles errors gracefully per tenant (continues on failure)
   - Follows Phase 13 migration pattern (dotenv config, pool.query, active tenant iteration)
   - Successfully executed: 1 active tenant migrated

**3. Shared Zod Schema Updates**:

   **Customer schemas** (packages/shared/src/types/customer.ts):
   - Import phoneSchema and addressSchema from ../schemas/common
   - `createCustomerSchema`: phone uses phoneSchema, address uses addressSchema.optional()
   - `updateCustomerSchema`: phone uses phoneSchema, address uses addressSchema.optional()
   - Added structured fields: street1, street2, city, state, zip
   - Updated Customer type: added street1, street2, city, state, zip as string | null

   **Subcontractor schemas** (packages/shared/src/types/bidding.ts):
   - Import phoneSchema and addressSchema from ../schemas/common
   - `createSubcontractorSchema`: contactPhone uses phoneSchema, address uses addressSchema.optional()
   - `updateSubcontractorSchema`: contactPhone uses phoneSchema, address uses addressSchema.optional()
   - Added structured fields: street1, street2, city, state, zip

   **Project schemas** (packages/shared/src/types/project.ts):
   - Import addressSchema from ../schemas/common
   - `createProjectSchema`: location uses addressSchema.optional()
   - `updateProjectSchema`: location uses addressSchema.optional()
   - Added structured fields: street1, street2, city, state, zip

**4. Exports**:
   - Address type already exported via packages/shared/src/index.ts → schemas/index → common.ts

## Technical Decisions

**Legacy Column Preservation:**
- Kept old columns (address, location, phone, contactPhone) in Drizzle schema
- Rationale: Avoid breaking existing router/form code that references these columns
- Migration NULLs them out; Plans 03-04 will update router/form code to use new columns
- Comments added to schema: "Legacy field - will be cleared by migration"

**Data Deletion Strategy:**
- User decision: DELETE existing freeform phone/address/location data
- Alternative considered: Attempt parsing/migration to structured format (rejected as too complex/error-prone)
- Migration sets all legacy fields to NULL via UPDATE statements

**Dual Schema Fields:**
- Schemas include BOTH legacy address field AND new structured fields during transition
- Example: createCustomerSchema has `address: addressSchema.optional()` AND `street1`, `street2`, etc.
- Enables gradual migration: old forms can still submit legacy field, new forms use structured fields
- Router updates in Plan 03 will remove legacy field handling

**Idempotent Migration:**
- Column existence checks before ALTER TABLE
- Prevents errors if migration run multiple times
- Safe to run on existing production databases

**State Field Validation:**
- Uses `z.string().length(2)` instead of enum
- Follows Phase 2 companyType pattern: TEXT column + Zod validation for flexibility
- Allows for future expansion (Canadian provinces, international addresses)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

**Migration Execution:**
- Ran `cd apps/api && npx tsx src/migrate-phase14-addresses.ts`
- Output: Found 1 active tenant(s)
- Successfully added columns to customers, subcontractor_directory, projects tables
- Cleared freeform data from all three tables
- All operations completed without errors

**Expected TypeScript Errors:**
- Ran `cd apps/api && npx tsc --noEmit 2>&1 | grep -E "(customer|subcontractor|project)"`
- Confirmed type errors in:
  - src/trpc/routers/customer.ts (line 132)
  - src/trpc/routers/project.ts (line 104)
  - src/trpc/routers/subcontractor.ts (line 46)
- These errors are EXPECTED and indicate which files need updating in Plans 03-04
- Errors occur because schemas now include structured fields but routers haven't been updated yet

**Database Verification:**
- Migration log confirmed column additions
- All three tables now have street1, street2, city, state, zip columns
- Legacy phone/address/location data set to NULL

## Impact

**Immediate:**
- Database has new structured address columns
- Shared schemas use centralized phone/address validation
- TypeScript errors in routers indicate needed updates (addressed in Plans 03-04)
- Existing code continues to compile (with expected errors showing work needed)

**Breaks:**
- TypeScript compilation has errors in customer, project, and subcontractor routers
- Forms still reference legacy columns and will need updates
- No runtime breaks (legacy columns still exist in schema)

**Next Plans:**
- Plan 03: Update customer/subcontractor/project routers to use structured address columns
- Plan 04: Update customer/subcontractor/project forms to use AddressInput component
- Plan 05: Deprecate and remove legacy column references from schema

## Self-Check

Verifying created files exist:

**Created files:**
- apps/api/src/migrate-phase14-addresses.ts: EXISTS

**Modified files:**
- apps/api/src/db/schema/tenant.ts: MODIFIED (added 15 new address columns across 3 tables)
- packages/shared/src/types/customer.ts: MODIFIED (imports, schemas, Customer type)
- packages/shared/src/types/bidding.ts: MODIFIED (imports, subcontractor schemas)
- packages/shared/src/types/project.ts: MODIFIED (import, project schemas)

**Commits:**
- bad96c2: feat(14-02): add structured address columns to customers, subcontractors, and projects tables
- f7316b1: feat(14-02): create address migration and update shared schemas

**Migration execution:**
- Script ran successfully
- 1 tenant migrated
- All three tables updated with new columns
- Legacy data cleared

## Self-Check: PASSED

All files created/modified, all commits exist, migration executed successfully, expected type errors confirmed.
