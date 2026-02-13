---
phase: 08-quickbooks-integration
plan: 01
subsystem: quickbooks-foundation
tags: [database, types, casl, qbo]
dependency_graph:
  requires: []
  provides:
    - qbo_connections table
    - qbo_sync_state table
    - qbo_entity_mappings table
    - qbo_sync_notifications table
    - QuickBooks CASL subject
    - QBO Zod schemas and TypeScript types
  affects:
    - tenant schema
    - tenant provisioning
    - shared types package
    - CASL abilities
tech_stack:
  added:
    - QuickBooks Online types with Zod validation
  patterns:
    - Encrypted refresh tokens (AES-256-GCM)
    - Bidirectional entity mappings
    - Polymorphic entity type tracking
    - User-facing sync failure notifications
key_files:
  created:
    - packages/shared/src/types/quickbooks.ts
  modified:
    - packages/shared/src/types/auth.ts
    - packages/shared/src/types/index.ts
    - apps/api/src/auth/abilities.ts
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/src/tenant/context.ts
decisions:
  - "Admin-only QBO management: Only org:admin can connect/disconnect QBO. Accountants get read-only access to view sync status."
  - "Encrypted refresh tokens: Access tokens (1 hour TTL) stored unencrypted, refresh tokens (180 days) encrypted with AES-256-GCM"
  - "Polymorphic entity mappings: No FK from qbo_entity_mappings to projects/invoices etc - entity type is polymorphic, validated at application level"
  - "Sync notifications for user visibility: When BullMQ worker exhausts retries, insert notification record for UI to display"
  - "String-based QBO IDs: QBO entity IDs are strings (not integers), stored as TEXT in mappings"
  - "Bidirectional sync direction tracking: Each mapping tracks direction (platform_to_qbo, qbo_to_platform, bidirectional) for sync logic"
metrics:
  duration: 3 min
  tasks_completed: 2
  files_modified: 7
  commits: 2
  completed_at: "2026-02-13T17:05:24Z"
---

# Phase 08 Plan 01: QuickBooks Integration Foundation

**One-liner:** QuickBooks database foundation with encrypted token storage, bidirectional entity mappings, sync state tracking, and admin-only CASL permissions

## Summary

Created the complete database and type foundation for QuickBooks Online integration. Added four new tables to the tenant schema: `qbo_connections` (OAuth tokens and connection metadata), `qbo_sync_state` (per-entity-type sync tracking), `qbo_entity_mappings` (bidirectional platform↔QBO ID mappings), and `qbo_sync_notifications` (user-facing sync failure alerts). All tables are included in both Drizzle ORM schema and raw SQL provisioning for new tenants.

Shared TypeScript types created with full Zod validation for all QBO entities. CASL permissions grant QuickBooks management to org:admin only, with read access for org:accountant to view sync status.

## Tasks Completed

### Task 1: Create shared QuickBooks types and update CASL subjects
- **Commit:** `b1ed9a7`
- **Files:** `packages/shared/src/types/quickbooks.ts` (created), `packages/shared/src/types/auth.ts`, `packages/shared/src/types/index.ts`, `apps/api/src/auth/abilities.ts`
- **Changes:**
  - Created comprehensive QuickBooks types with Zod schemas (qboConnectionSchema, qboSyncStateSchema, qboEntityMappingSchema, qboSyncNotificationSchema)
  - Defined enums for connection status, environment, entity type, sync direction, sync status
  - Added "QuickBooks" to CASL AppSubjects union type
  - Granted manage permission to org:admin (via existing "manage all")
  - Granted read permission to org:accountant
  - Explicitly denied manage permission to org:project_manager and org:accountant

### Task 2: Add QBO tables to Drizzle tenant schema and provision script
- **Commit:** `5c43e29`
- **Files:** `apps/api/src/db/schema/tenant.ts`, `apps/api/src/tenant/provision.ts`, `apps/api/src/tenant/context.ts`
- **Changes:**
  - Added qboConnections table with OAuth tokens (access token unencrypted, refresh token encrypted), connection metadata, status tracking
  - Added qboSyncState table with entity type sync tracking, CDC timestamp, synced/error counts
  - Added qboEntityMappings table with polymorphic entity mappings (platform_id ↔ qbo_id), sync tokens, direction, metadata
  - Added qboSyncNotifications table for user-facing sync failure alerts (created after BullMQ retry exhaustion)
  - Added indexes: idx_qbo_connections_realm (webhook lookup), idx_qbo_entity_mappings_platform (forward mapping), idx_qbo_entity_mappings_qbo (reverse mapping)
  - Added UNIQUE constraints on (entity_type, platform_id) and (entity_type, qbo_id) to prevent duplicate mappings
  - Updated tenant context to expose all four QBO tables

## Verification Results

- TypeScript compilation passes in packages/shared ✓
- TypeScript compilation passes in apps/api (no QBO-related errors) ✓
- TenantSchema type includes qboConnections, qboSyncState, qboEntityMappings, qboSyncNotifications ✓
- CASL AppSubjects includes "QuickBooks" ✓
- Abilities: admin can manage QuickBooks, accountant can read, others cannot ✓
- Provision script includes CREATE TABLE statements for all four QBO tables with indexes ✓

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Admin-only QBO management**: Only org:admin can connect/disconnect QuickBooks. Accountants get read-only access to view sync status. Other roles (project_manager, estimator, superintendent, foreman, member) have no QuickBooks permissions.

2. **Encrypted refresh tokens**: Access tokens have 1-hour TTL and are OK to store unencrypted (short-lived). Refresh tokens have 180-day TTL and MUST be encrypted with AES-256-GCM before storage.

3. **Polymorphic entity mappings**: No foreign key from qbo_entity_mappings.platformId to projects/commitments/invoices etc. The entity type is polymorphic (could be project, invoice, bill, payment, vendor, customer), so we use application-level validation instead of DB constraints.

4. **Sync notifications for user visibility**: When BullMQ worker exhausts all retry attempts for a sync job, it inserts a notification record. The UI polls these to show user-facing alerts about sync failures that need attention.

5. **String-based QBO IDs**: QuickBooks entity IDs are strings (not integers), stored as TEXT in the qbo_entity_mappings table.

6. **Bidirectional sync direction tracking**: Each mapping tracks direction (platform_to_qbo, qbo_to_platform, bidirectional) to support flexible sync strategies in future plans.

## Dependencies

**Requires:** None (foundation plan)

**Provides for future plans:**
- 08-02 (OAuth flow): Uses qbo_connections table
- 08-03 (Sync engine): Uses qbo_sync_state and qbo_entity_mappings tables
- 08-04 (Sync UI): Displays qbo_sync_notifications for user alerts
- 08-05 (Webhook handlers): Updates qbo_connections and qbo_sync_state

**Affects:**
- New tenants will automatically get QBO tables via provision.ts
- Existing tenants need migration script (migrate-tenant.ts pattern from prior phases)

## Self-Check: PASSED

**Created files verified:**
```
FOUND: packages/shared/src/types/quickbooks.ts
```

**Commits verified:**
```
FOUND: b1ed9a7
FOUND: 5c43e29
```

**Database schema verification:**
- TenantSchema return type includes qboConnections ✓
- TenantSchema return type includes qboSyncState ✓
- TenantSchema return type includes qboEntityMappings ✓
- TenantSchema return type includes qboSyncNotifications ✓

**Provisioning verification:**
- SQL CREATE TABLE for qbo_connections ✓
- SQL CREATE TABLE for qbo_sync_state ✓
- SQL CREATE TABLE for qbo_entity_mappings ✓
- SQL CREATE TABLE for qbo_sync_notifications ✓
- Indexes: idx_qbo_connections_realm ✓
- Indexes: idx_qbo_entity_mappings_platform ✓
- Indexes: idx_qbo_entity_mappings_qbo ✓
- UNIQUE constraints on qbo_entity_mappings ✓

## Notes

- **Existing tenant migration:** Tenants created before this plan will need a migration script to add QBO tables. Follow the migrate-tenant.ts pattern from Phase 3 (add tables retroactively).
- **Encryption implementation:** The actual AES-256-GCM encryption/decryption logic for refresh tokens will be implemented in 08-02 OAuth flow plan.
- **No foreign keys:** Intentionally no FK from qbo_entity_mappings to projects/invoices etc. because entity type is polymorphic. Application code validates references.
- **BullMQ integration:** Notification creation logic (when retries exhausted) will be implemented in 08-03 sync engine plan.

---

**Plan execution time:** 3 minutes
**Commits:** `b1ed9a7`, `5c43e29`
**Next plan:** 08-02 (QuickBooks OAuth 2.0 flow)
