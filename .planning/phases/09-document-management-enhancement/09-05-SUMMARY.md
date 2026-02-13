---
phase: 09-document-management-enhancement
plan: 05
subsystem: database, api, shared-types
tags: [drizzle, zod, workflows, schema, validation]

# Dependency graph
requires:
  - phase: 03-project-management-core
    provides: documents table and project infrastructure
  - phase: 05-change-order-management
    provides: approval workflow pattern and sequential counter pattern
provides:
  - 4 new tenant-scoped tables for document workflow management
  - 5 workflow enums and 6 workflow management schemas
  - Foundation for RFI, Submittal, and Transmittal workflows
affects: [09-06-workflow-api, 09-07-workflow-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - One workflow per document (unique constraint on documentId)
    - Multi-step approval with flexible requirements (specific user, any role, all with role)
    - Sequential numbering per project per workflow type using SELECT FOR UPDATE pattern
    - Complete audit trail via workflow_history table

key-files:
  created:
    - packages/shared/src/types/document.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - packages/shared/src/index.ts

key-decisions:
  - "Workflow tables follow Phase 5 approval patterns with stepNumber and requirementType"
  - "Sequential numbering uses SELECT FOR UPDATE pattern for race-free workflow number generation"
  - "Workflow enums cover full lifecycle from draft to closed/cancelled"
  - "Approval steps support three requirement types: specific user, any with role, all with role"
  - "Workflow history tracks both status transitions and field-level changes for complete audit trail"

patterns-established:
  - "Pattern 1: Unique constraint on documentId ensures one workflow per document"
  - "Pattern 2: Denormalized projectId in workflows enables efficient project-level queries"
  - "Pattern 3: Response documents link back via responseDocumentId for formal workflow responses"

# Metrics
duration: 3 min
completed: 2026-02-13
---

# Phase 9 Plan 5: Document Workflow Schema and Types Summary

**4 tenant-scoped tables for structured document workflows (RFI, Submittal, Transmittal) with 5 enums and 6 management schemas for multi-step approval processes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T20:33:11Z
- **Completed:** 2026-02-13T20:36:34Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- 4 new workflow tables with proper relationships to documents and projects
- 5 workflow enums covering types, statuses, priorities, requirement types, and approval statuses
- 6 workflow management schemas for complete CRUD operations
- Sequential numbering system ready via workflowCounters table
- Multi-step approval workflow infrastructure following Phase 5 patterns
- Complete audit trail via workflowHistory table

## Task Commits

Each task was committed atomically:

1. **Task 1: Create document workflow database schema** - Already complete (09-01)
2. **Task 2: Create workflow validation schemas and enums** - `ab25451` (feat)

## Files Created/Modified

- `packages/shared/src/types/document.ts` - Created with workflow enums and validation schemas
- `apps/api/src/db/schema/tenant.ts` - Already contained workflow tables from Plan 09-01
- `packages/shared/src/index.ts` - Added document.ts exports, removed duplicates from project.ts

## Decisions Made

- **Workflow tables follow Phase 5 approval patterns:** stepNumber, requirementType (specific_user, any_with_role, all_with_role), and status tracking mirror change order approval workflow patterns for consistency.
- **Sequential numbering uses SELECT FOR UPDATE pattern:** Prevents duplicate workflow numbers (RFI-001, SUB-024, TX-012) under concurrent requests by locking counter row during transaction.
- **Workflow enums cover full lifecycle:** 7 statuses (draft → submitted → under_review → approved/rejected → closed/cancelled) support complete workflow state management.
- **Approval steps support three requirement types:** Flexibility to require specific user approval, any user with role, or all users with role for multi-party workflows.
- **Workflow history tracks both status and field changes:** Complete audit trail records status transitions plus field-level changes (title, description, priority, dueDate) for compliance and accountability.

## Deviations from Plan

None - plan executed exactly as written. Workflow tables were already added to tenant schema in Plan 09-01, so Task 1 was already complete. Task 2 created the validation schemas as specified.

## Issues Encountered

None - plan executed smoothly. The workflow tables in tenant.ts were already present from a previous plan (09-01), demonstrating good coordination between plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Foundation complete for workflow API (Plan 06) and UI (Plan 07). All tables, types, and validation schemas in place. Sequential numbering system ready for implementation. Approval workflow patterns align with Phase 5 change orders for consistent developer experience.

## Self-Check: PASSED

Verified:
- Created file exists: packages/shared/src/types/document.ts
- Workflow tables exist in tenant.ts: documentWorkflows, workflowApprovals, workflowCounters, workflowHistory
- Commit ab25451 exists in git history
- TypeScript compilation passes in packages/shared
- All workflow enums export correctly (documentWorkflowTypeEnum, workflowStatusEnum, workflowPriorityEnum, approvalRequirementTypeEnum, approvalStatusEnum)
- All 6 workflow management schemas export correctly

---
*Phase: 09-document-management-enhancement*
*Completed: 2026-02-13*
