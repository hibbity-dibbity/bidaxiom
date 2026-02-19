---
phase: 36-project-lifecycle-state-machine-simple-gc-mode
verified: 2026-02-19T00:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
gaps:
  - truth: "Simple mode estimate shows a Billing Category dropdown column with 5 options from BILLING_CATEGORIES replacing CSI Code"
    status: accepted_deviation
    reason: "UAT Test 11 (2026-02-19): User explicitly approved removing Billing Category — 'Cost Type already captures this, remove Billing Category from Simple mode.' Intentional product decision. Cost Type column exists on all estimates; CSI Code column is simply hidden in Simple mode."
    artifacts: []
    missing: []
  - truth: "Clicking a forward phase in the popover shows a confirmation AlertDialog with Confirm and Cancel buttons"
    status: accepted_deviation
    reason: "UAT Test 3 (2026-02-19): User explicitly approved removing the forward confirmation dialog — 'I want to remove the confirmation page to advance the project to a later phase. Keep verification steps if changing the phase to an older/previous phase.' Intentional UX simplification approved during testing."
    artifacts: []
    missing: []
human_verification:
  - test: "Forward transition UX confirmation — product decision needed"
    expected: "Per PLAN spec: clicking a forward phase shows a confirmation AlertDialog. Current behavior: fires immediately. Verify whether immediate-fire is acceptable or the dialog is required."
    why_human: "This is a product decision — the API enforcement is correct regardless. If immediate-fire is acceptable UX, the PLAN spec should be amended to document the intentional simplification."
  - test: "Simple mode estimates — billing category vs cost type sufficiency"
    expected: "Per PLAN: a Billing Category dropdown with Labor/Materials/Subcontractors/Equipment/Other. Actual: CSI column hidden, Cost Type column still present for both modes. Verify if Cost Type is an acceptable substitute."
    why_human: "Whether the existing Cost Type column satisfies MODE-04 depends on product intent. If BILLING_CATEGORIES dropdown is required, this is a genuine gap to fix."
  - test: "Lifecycle history actor names in UI"
    expected: "History entries show actor first/last name. API joins user_profiles on actorId. Verify names render correctly for real users."
    why_human: "Requires live populated user_profiles rows — cannot verify programmatically."
---

# Phase 36: Project Lifecycle State Machine + Simple/GC Mode Verification Report

**Phase Goal:** Every project in the system has a verified lifecycle phase and a complexity mode. The old flat status field is replaced.
**Verified:** 2026-02-19
**Status:** passed — 11/11 must-have truths verified (2 plan-spec deviations accepted via UAT)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | lifecyclePhase and projectMode columns exist on projects table in Drizzle schema | VERIFIED | `tenant.ts` lines 156-157: `lifecyclePhase: text("lifecycle_phase").notNull().default("opportunity")`, `projectMode: text("project_mode").notNull().default("gc_advanced")` |
| 2 | projectLifecycleTransitions table exists in schema and is in return object | VERIFIED | `tenant.ts` lines 1180-1192 define the table; line 1254 returns it |
| 3 | isValidTransition and tryAutoAdvance implement correct guard logic | VERIFIED | `lifecycle-state-machine.ts`: skip-forward throws at line 34 (`toIdx > fromIdx + 1`); tryAutoAdvance guard at line 81 (`targetIdx !== currentIdx + 1`) |
| 4 | project.transitionLifecyclePhase, setMode, and getTransitionHistory mutations exist in API | VERIFIED | `project.ts` lines 1011, 1103, 1162 — all three procedures implemented and substantive |
| 5 | Auto-advance hook fires in estimates.create (estimate_created) | VERIFIED | `estimates.ts` lines 308-315: `tryAutoAdvance(ctx.tenant.db, ctx.tenant.schema, ..., "estimating", "estimate_created", ...)` |
| 6 | isFeatureAvailableInPhase helper and PHASE_FEATURE_GATES exist in shared package | VERIFIED | `packages/shared/src/types/project.ts` lines 197-213: both exported; change_orders gated to awarded+; estimate_editing gated to opportunity/estimating |
| 7 | changeOrder.create guards against pre-Active phases | VERIFIED | `change-order.ts` line 90: `isFeatureAvailableInPhase("change_orders", project.lifecyclePhase)` throws BAD_REQUEST if false |
| 8 | estimates.update and updateLineItem guard against post-Estimating phases | VERIFIED | `estimates.ts` lines 368, 539: both mutations check `isFeatureAvailableInPhase("estimate_editing", ...)` |
| 9 | ProjectTabs filters both mode-gated (SOV/RFQs) and phase-gated (Change Orders) tabs | VERIFIED | `project-tabs.tsx` lines 15-45: ALL_SECTIONS has `gcOnly: true` on SOV/RFQs and `phaseGated: "change_orders"` on Change Orders; filter applies both gates correctly |
| 10 | Simple mode estimate shows a Billing Category dropdown column replacing CSI Code | FAILED | `EstimateLineItemsTable.tsx` line 298: CSI column hidden in Simple mode but NO billing category dropdown added. BILLING_CATEGORIES never imported in this file. |
| 11 | Forward lifecycle phase transitions show a confirmation AlertDialog | FAILED | `lifecycle-phase-badge.tsx` line 77: forward transitions call `transitionMutation.mutate()` directly. The AlertDialog only activates for backward transitions (when `pendingPhase` is set). |

**Score: 9/11 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types/project.ts` | lifecyclePhaseEnum, projectModeEnum, LIFECYCLE_ORDER, LIFECYCLE_PHASE_LABELS, BILLING_CATEGORIES, isFeatureAvailableInPhase | VERIFIED | All exports present and substantive (lines 19-213) |
| `apps/api/src/db/schema/tenant.ts` | projectLifecycleTransitions table, lifecyclePhase + projectMode on projects, defaultProjectMode on user_profiles | VERIFIED | All defined: user_profiles line 62, projects lines 156-157, transitions lines 1180-1192, returned at line 1254 |
| `apps/api/src/db/migrations/migrate-phase36.ts` | Runnable migration for all tenant schemas | VERIFIED | File exists at expected path |
| `apps/api/src/lib/lifecycle-state-machine.ts` | isValidTransition, tryAutoAdvance, LIFECYCLE_ORDER | VERIFIED | All exported; guards confirmed at lines 34 and 81 |
| `apps/api/src/trpc/routers/project.ts` | transitionLifecyclePhase, setMode, getTransitionHistory; list and getBySlug include new fields | VERIFIED | All three procedures at lines 1011, 1103, 1162; lifecyclePhase at list line 433 and getBySlug |
| `apps/api/src/trpc/routers/estimates.ts` | tryAutoAdvance hook in create; isFeatureAvailableInPhase in update/updateLineItem | VERIFIED | Lines 308-315 (auto-advance), 368, 539 (phase gates) |
| `apps/api/src/trpc/routers/change-order.ts` | isFeatureAvailableInPhase guard in create | VERIFIED | Line 90 guards with BAD_REQUEST for pre-Awarded phases |
| `apps/web/.../components/lifecycle-phase-badge.tsx` | Color-coded badge with popover + AlertDialog for backward transitions | VERIFIED | 9 distinct phaseColors; backward AlertDialog with reason Textarea; canTransition prop controls interactivity |
| `apps/web/.../components/transition-history.tsx` | TransitionHistory component querying getTransitionHistory | VERIFIED | Queries `trpc.project.getTransitionHistory.useQuery`; renders from/to labels, actor name, reason, timestamp |
| `apps/web/.../components/project-header.tsx` | LifecyclePhaseBadge instead of status badge; mode badge + switch button | VERIFIED | Imports LifecyclePhaseBadge (line 9); mode badge and Switch button rendered (lines 113-125); setMode mutation wired |
| `apps/web/.../components/project-tabs.tsx` | Mode-aware + phase-aware tab filtering | VERIFIED | ALL_SECTIONS with gcOnly and phaseGated flags; filter at lines 37-45 |
| `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` | Passes projectMode + lifecyclePhase to ProjectTabs; canTransition to ProjectHeader | VERIFIED | Lines 108-112 pass both props to ProjectTabs; line 104 passes canTransition to ProjectHeader |
| `apps/web/app/(dashboard)/projects/components/columns.tsx` | Phase column with color-coded badge replacing status column | VERIFIED | No status column defined; `lifecyclePhase` accessorKey at line 77 with phaseColors and LIFECYCLE_PHASE_LABELS |
| `apps/web/app/(dashboard)/projects/new/page.tsx` + `project-form.tsx` | Project Mode dropdown in creation form | VERIFIED | `project-form.tsx` line 409: FormField for `projectMode` with GC/Advanced and Simple SelectItems; default `gc_advanced` at line 217 |
| `apps/web/.../payment-apps/[paymentAppId]/page.tsx` | Lien Waivers tab hidden in Simple mode | VERIFIED | Lines 75, 100-101, 122-124: `isSimpleMode` flag gates both TabsTrigger and TabsContent |
| `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx` | Billing Category dropdown column in Simple mode | FAILED | CSI column hidden when `isSimpleMode` (line 298) but no BILLING_CATEGORIES dropdown column defined or added in its place |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lifecycle-phase-badge.tsx` | `project.ts` router | `trpc.project.transitionLifecyclePhase.useMutation()` | WIRED | Line 52: mutation defined and called in handlePhaseClick/handleConfirm |
| `transition-history.tsx` | `project.ts` router | `trpc.project.getTransitionHistory.useQuery()` | WIRED | Line 12: query wired to projectId prop |
| `project-tabs.tsx` | `packages/shared/src/types/project.ts` | `isFeatureAvailableInPhase` | WIRED | Line 7 import, line 42 call with lifecyclePhase prop |
| `change-order.ts` router | `packages/shared/src/types/project.ts` | `isFeatureAvailableInPhase` | WIRED | Line 14 import, line 90 guard call |
| `estimates.ts` router | `packages/shared/src/types/project.ts` | `isFeatureAvailableInPhase` | WIRED | Line 15 import, lines 368 and 539 guard calls |
| `estimates.ts` router | `lifecycle-state-machine.ts` | `tryAutoAdvance` | WIRED | Line 18 import, lines 308-315 call after estimate insert |
| `project.ts` router | `lifecycle-state-machine.ts` | `isValidTransition` | WIRED | Imported and called at line 1054 in transitionLifecyclePhase |
| `project.ts` router | `schema.projectLifecycleTransitions` | `tx.insert(schema.projectLifecycleTransitions)` | WIRED | Lines 1069-1074 in transitionLifecyclePhase transaction |
| `EstimateLineItemsTable.tsx` | `packages/shared/src/types/project.ts` | `BILLING_CATEGORIES` for dropdown | NOT WIRED | BILLING_CATEGORIES exported from shared but never imported in EstimateLineItemsTable.tsx; no billingCategory column defined |
| `payment-apps/[paymentAppId]/page.tsx` | `project.ts` router | `project.projectMode` via getBySlug | WIRED | Line 75: `isSimpleMode = project.projectMode === "simple"` gates TabsTrigger and TabsContent |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIFE-01 | 36-01, 36-02 | 9-phase lifecycle state machine in data model | SATISFIED | lifecyclePhase column (tenant.ts line 156), projectLifecycleTransitions table (line 1180), default "opportunity", migration file exists |
| LIFE-02 | 36-01, 36-03, 36-04 | Manual phase transitions with RBAC | SATISFIED with note | transitionLifecyclePhase mutation with RBAC (project.ts lines 1011-1101), LifecyclePhaseBadge with popover. NOTE: forward transitions fire without confirmation dialog — the PLAN spec said they should show a dialog (this is gap #2). API RBAC enforcement is correct regardless. |
| LIFE-03 | 36-01, 36-02, 36-03 | Auto-advance on estimate creation (partial per plan) | SATISFIED | tryAutoAdvance("estimating", "estimate_created") in estimates.create (line 308). Plan 03 explicitly documented only the estimate_created hook is delivered in phase 36; remaining hooks deferred. |
| LIFE-04 | 36-02, 36-03, 36-04 | Lifecycle transition history visible in UI | SATISFIED | TransitionHistory component queries getTransitionHistory; rendered on project overview (page.tsx line 809); API joins user_profiles for actor names |
| LIFE-05 | 36-04, 36-05 | Lifecycle phase badge in project header and project list | SATISFIED | LifecyclePhaseBadge in ProjectHeader (line 106); Phase column in columns.tsx (line 77); no status column in project list |
| LIFE-06 | 36-07 | Phase-conditional feature gating | SATISFIED | isFeatureAvailableInPhase in shared; change_orders guarded in change-order.ts; estimate_editing guarded in estimates.ts; Change Orders tab hidden via phaseGated in project-tabs.tsx |
| MODE-01 | 36-01, 36-03, 36-05 | Project mode selection at creation | SATISFIED | ProjectForm has projectMode dropdown (project-form.tsx line 409); default gc_advanced (line 217); project.create reads input.projectMode with user preference fallback |
| MODE-02 | 36-03, 36-04, 36-06 | Mode badge and mode switch in project header | SATISFIED | Mode badge at project-header.tsx line 113; Switch button at lines 115-125 using setMode mutation |
| MODE-03 | 36-06, 36-07 | GC-only tab gating (SOV, RFQs hidden in Simple) | SATISFIED | project-tabs.tsx gcOnly flag on SOV and RFQs; filter at line 39 |
| MODE-04 | 36-01, 36-02, 36-06 | Mode-specific UI (CSI vs billing category, lien waivers) | PARTIAL | Lien Waivers gating in payment app is SATISFIED (page.tsx lines 100-124). CSI column hidden in Simple mode is SATISFIED. BUT billing category dropdown replacement is NOT IMPLEMENTED — BILLING_CATEGORIES import missing from EstimateLineItemsTable.tsx |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx` | 298 | CSI column hidden without a replacement in Simple mode. Comment says "Simple mode uses Cost Type instead" but Cost Type is already always visible. | Warning | Simple mode projects lose the CSI column but gain no BILLING_CATEGORIES dropdown as specified. |
| `apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx` | 76-78 | Forward transitions fire immediately without confirmation: `transitionMutation.mutate({ projectId, toPhase: phase })` bypasses the AlertDialog flow | Warning | Deviation from PLAN spec (LIFE-02). API enforcement is correct. May be acceptable UX simplification. |

---

## Human Verification Required

### 1. Forward Transition UX — Product Decision Required

**Test:** Navigate to any project. Click the lifecycle phase badge. Click the next phase forward (e.g., Opportunity to Estimating).
**Expected per PLAN:** A confirmation AlertDialog appears with Confirm and Cancel buttons.
**Actual behavior:** Transition fires immediately with no dialog.
**Why human:** This is a product decision. The API correctly enforces RBAC and isValidTransition — the dialog was only a UX safety net. If immediate-fire is acceptable, the gap should be closed by amending the PLAN spec rather than changing the code.

### 2. Simple Mode Estimates — Billing Category vs Cost Type

**Test:** Create a project in Simple mode. Navigate to Estimates, open any estimate, look at the line items table.
**Expected per PLAN (MODE-04):** A "Billing Category" column with dropdown containing: Labor, Materials, Subcontractors, Equipment, Other.
**Actual behavior:** The CSI Code column is hidden. The Cost Type column remains visible for both modes.
**Why human:** Whether the Cost Type column (Labor/Material/Equipment/Subcontractor) sufficiently replaces the BILLING_CATEGORIES dropdown depends on product intent. If BILLING_CATEGORIES is required, the fix is additive (import and add a billingCategoryColumn to EstimateLineItemsTable.tsx).

### 3. Lifecycle History Actor Names

**Test:** Manually transition a project lifecycle phase. Check the Lifecycle History section on the project overview page.
**Expected:** History entry shows the actor's name (e.g., "John Smith"), not their Clerk user ID.
**Why human:** The API correctly left-joins user_profiles on actorId, but requires a populated profile row. Verify with real users that names appear.

---

## Gaps Summary

Two gaps were found — both are isolated UI issues that do not affect the data model, API logic, state machine, or tab gating.

**Gap 1 — Billing Category dropdown missing in Simple mode estimates (MODE-04 partial):**
The `EstimateLineItemsTable` hides the CSI Code column in Simple mode but does not render a Billing Category dropdown as a replacement. The BILLING_CATEGORIES constant exists and is exported from `packages/shared/src/types/project.ts` but is never imported into EstimateLineItemsTable.tsx. The fix is additive: import BILLING_CATEGORIES, define a `billingCategoryColumn` using `BILLING_CATEGORIES.map()` for Select options, and add it to the columns array when `isSimpleMode === true`.

**Gap 2 — Forward transitions fire without confirmation dialog (LIFE-02 UX deviation):**
The lifecycle-phase-badge component fires forward transitions immediately, bypassing the confirmation AlertDialog specified in the 36-04-PLAN.md must_haves. The AlertDialog only activates for backward transitions. This may be an acceptable UX simplification (forward transitions are valid by the state machine rules, so the dialog is purely a safety net). Resolution requires a product decision: either add the dialog for forward transitions or amend the PLAN spec to document the immediate-fire behavior as intentional.

Both gaps are root-caused in specific component files and require no schema or API changes to resolve.

---

_Verified: 2026-02-19_
_Verifier: Claude (gsd-verifier)_
