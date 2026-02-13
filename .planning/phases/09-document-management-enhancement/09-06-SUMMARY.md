---
phase: 09-document-management-enhancement
plan: 06
subsystem: api, auth
tags: [trpc, workflow-management, sequential-numbering, approval-workflow, casl]

# Dependency graph
requires:
  - phase: 09-document-management-enhancement
    plan: 05
    provides: Workflow schema, types, and validation schemas
  - phase: 05-change-order-management
    plan: 02
    provides: Sequential numbering pattern with SELECT FOR UPDATE
provides:
  - Complete workflow tRPC router with 8 procedures for full lifecycle management
  - Workflow CASL permissions with project-scoped access control
  - Sequential workflow numbering (RFI-001, SUB-024, TX-012) preventing race conditions
  - Multi-step approval workflow with role-based and user-specific authorization
affects: [09-07-workflow-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sequential workflow numbering with SELECT FOR UPDATE (RFI-001, SUB-024, TX-012)
    - Multi-step approval with role-based and user-specific requirements
    - Status transition validation (draft -> submitted -> under_review -> approved/rejected -> closed)
    - Field-level history tracking for complete audit trail
    - Project-scoped CASL permissions with role-appropriate access

key-files:
  created:
    - apps/api/src/trpc/routers/workflow.ts
  modified:
    - apps/api/src/trpc/router.ts
    - apps/api/src/auth/abilities.ts
    - packages/shared/src/types/auth.ts

key-decisions:
  - "Sequential numbering uses SELECT FOR UPDATE pattern from Phase 5 to prevent duplicate workflow numbers under concurrent requests"
  - "Multi-step approval supports three requirement types: specific_user (exact user must approve), any_with_role (first user with role), all_with_role (all users with role)"
  - "Status transitions follow strict lifecycle: draft -> submitted -> under_review -> approved/rejected -> closed/cancelled"
  - "Field-level history tracking records every status change and field modification with timestamps and user attribution"
  - "Approval logic handled in procedure (too granular for CASL rules) - CASL enforces project-level access, procedure enforces step-level approval rights"
  - "Foremen can update workflows they submitted (submittedBy: userId condition) to allow responding to workflows they created"
  - "Superintendents can only delete draft workflows (status: 'draft' condition) to prevent data loss of submitted workflows"

patterns-established:
  - "Pattern 1: Workflow router already existed from previous session - verified it matches plan specifications"
  - "Pattern 2: CASL permissions use project-scoped conditions with userProjectIds from team memberships"
  - "Pattern 3: Approval authorization enforced at procedure level (check user role matches approverRole or userId matches approverUserId)"

# Metrics
duration: 5 min
completed: 2026-02-13
---

# Phase 9 Plan 6: Workflow Management API Summary

**Complete workflow tRPC router with 8 procedures for RFI/Submittal/Transmittal lifecycle management, featuring sequential numbering, multi-step approval workflow, and project-scoped CASL permissions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-13T20:39:38Z
- **Completed:** 2026-02-13T20:44:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Workflow tRPC router with 8 procedures: create, submit, reviewApproval, respond, list, getById, getHistory, update
- Sequential workflow numbering (RFI-001, SUB-024, TX-012) using SELECT FOR UPDATE locking pattern from Phase 5
- Multi-step approval workflow with three requirement types: specific_user, any_with_role, all_with_role
- Status transition validation enforcing valid lifecycle: draft -> submitted -> under_review -> approved/rejected -> closed
- Field-level history tracking for complete audit trail with user attribution
- All procedures use transactions for atomicity and enforce CASL permissions via loadProjectAbilities
- Workflow router registered in appRouter for client-side access via trpc.workflow.*
- CASL abilities include Workflow subject with project-scoped permissions for all roles
- Role-appropriate permissions: PMs manage, Superintendents create/read/update/delete(drafts), Estimators create/read/update, Accountants read/approve, Foremen read and update their own, Viewers read-only

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workflow tRPC router with lifecycle procedures** - Already complete (from previous session)
   - Router already existed with all 8 procedures
   - Already registered in appRouter
   - AppSubjects already included "Workflow" type
2. **Task 2: Add Workflow CASL permissions to abilities** - `9d363b0` (feat)
   - Updated Estimator, Superintendent, and Foreman permissions to match plan specifications

## Files Created/Modified

- `apps/api/src/trpc/routers/workflow.ts` - Complete workflow router with 8 procedures (already existed)
- `apps/api/src/trpc/router.ts` - Registered workflow router (already complete)
- `packages/shared/src/types/auth.ts` - Added "Workflow" to AppSubjects (already complete)
- `apps/api/src/auth/abilities.ts` - Updated workflow permissions for Estimator, Superintendent, Foreman to match plan

## Decisions Made

- **Sequential numbering pattern:** Reused Phase 5 change order pattern with SELECT FOR UPDATE to prevent race conditions under concurrent workflow creation.
- **Multi-step approval flexibility:** Three requirement types support diverse approval workflows - specific user (for architect approval), any with role (first PM approves), all with role (all PMs must approve).
- **Status lifecycle enforcement:** Strict status transitions prevent invalid state changes (e.g., can't submit a rejected workflow, can't edit a submitted workflow).
- **Field-level history:** Complete audit trail records every field change (title, description, priority, dueDate) plus status changes and approval actions.
- **Approval authorization split:** CASL enforces project-level access ("can this user access workflows in this project?"), procedure enforces step-level authorization ("can this user approve this specific step?") - too granular for CASL rules.
- **Foreman update constraint:** Foremen can update workflows they submitted (submittedBy: userId) to respond to RFIs/Submittals they created, maintaining appropriate access control.
- **Superintendent delete constraint:** Only draft workflows can be deleted (status: 'draft') to prevent accidental data loss once workflow enters approval process.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Workflow router already existed from previous session**
- **Found during:** Task 1 execution start
- **Issue:** The workflow router, router registration, and AppSubjects update were already complete
- **Fix:** Verified existing implementation matches plan specifications, moved directly to Task 2
- **Files affected:** None (no changes needed)
- **Commit:** N/A (no commit needed)

**2. [Rule 2 - Missing Critical Functionality] CASL permissions incomplete**
- **Found during:** Task 2 execution
- **Issue:** Existing CASL permissions didn't match plan specifications:
  - Superintendent had "manage" (too broad) instead of create/read/update/delete(drafts)
  - Estimator only had "read" instead of create/read/update
  - Foreman only had "read" instead of read + update for their own workflows
- **Fix:** Updated abilities.ts to match plan specifications exactly
- **Files modified:** apps/api/src/auth/abilities.ts
- **Commit:** 9d363b0

## Issues Encountered

None - plan executed smoothly. Task 1 was already complete from a previous session, so only Task 2 required changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Workflow API complete. All 8 procedures implemented with proper authorization, transactions, and audit logging. CASL permissions enforce project-scoped access with role-appropriate permissions. Ready for Phase 9 Plan 7 (Workflow UI) which will consume these tRPC procedures to provide user interface for creating, submitting, approving, and tracking RFIs, Submittals, and Transmittals.

## Self-Check: PASSED

Verified:
- Created file exists: apps/api/src/trpc/routers/workflow.ts (already existed)
- Workflow router has 8 procedures: create, submit, reviewApproval, respond, list, getById, getHistory, update
- Router registered in appRouter as workflow
- AppSubjects includes "Workflow" type
- Commit 9d363b0 exists in git history
- CASL abilities include Workflow permissions for all roles
- Superintendent has create/read/update/delete(drafts only) permissions
- Estimator has create/read/update permissions
- Foreman has read + update(submittedBy: userId) permissions
- Sequential numbering uses SELECT FOR UPDATE pattern
- All procedures enforce CASL permissions via loadProjectAbilities
- TypeScript compilation passes (only pre-existing QuickBooks type errors remain)

---
*Phase: 09-document-management-enhancement*
*Completed: 2026-02-13*
