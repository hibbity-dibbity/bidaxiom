---
phase: 03-project-management-core
plan: 01
subsystem: database
tags: [drizzle-orm, postgresql, zod, casl, tenant-schema, project-management]

# Dependency graph
requires:
  - phase: 02-company-setup-configuration
    provides: Tenant schema foundation with audit logs, user profiles, company profiles
provides:
  - Project management database schema with 6 tables (projects, team members, phases, folders, documents, versions)
  - Shared Zod validation schemas for project creation, document management, folder organization
  - CASL project-level permissions based on team membership
  - Raw SQL provisioning for all project tables with indexes
affects: [04-budget-cost-tracking, 05-document-management, 06-project-workflow, 07-subcontractor-bidding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Project-level RBAC via team membership conditions in CASL
    - Self-referential folder hierarchy without FK constraints
    - Document versioning with denormalized current version
    - CSI cost code tracking via JSONB arrays

key-files:
  created:
    - packages/shared/src/types/project.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/src/tenant/context.ts
    - apps/api/src/auth/abilities.ts
    - packages/shared/src/types/auth.ts
    - packages/shared/src/index.ts

key-decisions:
  - "Self-referential folder parentId without FK constraint to avoid circular reference complexity - application-level validation instead"
  - "Denormalized fileSize and contentType on documents table for list performance"
  - "Project team membership array passed to defineAbilitiesFor for project-level scoping"
  - "Empty userProjectIds array when projectTeamMemberships undefined prevents unintended access"

patterns-established:
  - "CASL conditions using $in operator for project-level scoping"
  - "Numeric(15,2) for budget amounts to handle proper decimal precision"
  - "JSONB arrays for costCodes with CSI division numbers (0-49)"
  - "Unique constraint on (projectId, userId) in team members to enforce one role per user per project"

# Metrics
duration: 3min
completed: 2026-02-12
---

# Phase 03 Plan 01: Project Management Schema Summary

**Extended tenant schema with 6 project tables, shared Zod validation schemas, and CASL project-level permissions via team membership**

## Performance

- **Duration:** 3 minutes
- **Started:** 2026-02-12T17:56:57Z
- **Completed:** 2026-02-12T18:00:17Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created 6 new tenant-scoped tables for project management: projects, project_team_members, project_phases, folders, documents, document_versions
- Implemented raw SQL provisioning with proper indexes (status, team userId, document project/folder composite)
- Established shared Zod schemas for project creation, updates, document management, and folder organization
- Updated CASL abilities to support project-level permissions based on team membership with $in conditions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add project tables to tenant schema and update provisioning** - `b83a19d` (feat)
   - Extended createTenantSchema() with 6 new tables
   - Added raw SQL CREATE TABLE statements in provisionTenantSchema()
   - Updated buildTenantContext() to include all new tables

2. **Task 2: Create shared project types and update CASL abilities** - `b506864` (feat)
   - Created packages/shared/src/types/project.ts with all Zod schemas
   - Added Document, Folder, ProjectTeam to AppSubjects
   - Updated defineAbilitiesFor() to accept optional projectTeamMemberships parameter
   - Implemented project-level scoping via $in conditions on project IDs

## Files Created/Modified

- `packages/shared/src/types/project.ts` - Zod schemas for project creation, updates, team assignment, documents, folders, presigned URLs; default folder and phase templates
- `apps/api/src/db/schema/tenant.ts` - Added 6 project tables to tenant schema with proper types and references
- `apps/api/src/tenant/provision.ts` - Raw SQL CREATE TABLE statements for all project tables with indexes
- `apps/api/src/tenant/context.ts` - Extended RequestTenantContext.schema to include all 6 new tables
- `apps/api/src/auth/abilities.ts` - Added projectTeamMemberships parameter, project-level conditions with $in operator
- `packages/shared/src/types/auth.ts` - Added Document, Folder, ProjectTeam subjects
- `packages/shared/src/index.ts` - Exported all new project types and schemas

## Decisions Made

1. **Self-referential folder structure without FK constraint**: Used parentId without foreign key constraint to avoid circular reference complexity. Application-level validation will enforce hierarchy integrity.

2. **Denormalized document metadata**: Stored fileSize and contentType on documents table (in addition to document_versions) for fast list queries without joins.

3. **Project team membership scoping pattern**: CASL abilities accept optional `projectTeamMemberships` array, extract project IDs, use `$in` operator for conditions. When undefined, empty array prevents access (safe default).

4. **Numeric precision for budget**: Used `NUMERIC(15,2)` for budget column to properly handle decimal amounts up to 999 trillion with 2 decimal places.

5. **CSI cost codes as JSONB array**: Stored enabled CSI division numbers (0-49) as JSONB array for flexibility and easy expansion to custom codes later.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully with clean TypeScript compilation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 03 Plan 02 (Project CRUD Operations):**
- Database schema complete with all project tables
- Shared validation schemas ready for tRPC procedures
- CASL abilities ready to enforce project-level permissions
- Tenant provisioning will create all tables automatically

**Blockers:**
None

**Notes:**
- Project team membership loading will be needed in tRPC context to populate projectTeamMemberships parameter for CASL
- Document storage implementation will need S3/MinIO configuration (deferred to document management phase)

## Self-Check: PASSED

All claimed files and commits verified:
- All 7 key files exist
- Commit b83a19d (Task 1) exists
- Commit b506864 (Task 2) exists

---
*Phase: 03-project-management-core*
*Completed: 2026-02-12*
