# Phase 36 Verification Checklist

**Phase:** 36-project-lifecycle-state-machine-simple-gc-mode
**Generated:** 2026-02-19 (after plan 07 completion)
**Plans completed:** 36-01 through 36-07

This checklist covers all requirements LIFE-01 through LIFE-06 and MODE-01 through MODE-04.

---

## Lifecycle Requirements (LIFE-01 through LIFE-06)

### LIFE-01: 9-phase lifecycle state machine in data model
- [ ] `lifecyclePhase` column exists on the `projects` table with values from the 9-phase enum
- [ ] `project_lifecycle_transitions` table exists and records all phase changes
- [ ] Default lifecycle phase is `opportunity` for new projects

### LIFE-02: Manual phase transitions with RBAC
- [ ] Clicking the lifecycle phase badge in the project header (as an org:admin) opens a popover listing all 9 phases
- [ ] Clicking a phase ahead of the current one advances the project immediately (no confirmation dialog)
- [ ] Clicking a phase behind the current one shows an AlertDialog requiring a reason text before confirming
- [ ] A user with no org or project role cannot see the interactive badge (reads as static)
- [ ] org:admin can transition any project
- [ ] Project-level `estimator` or `project_administrator` role can transition their own projects
- [ ] Project Manager role can transition lifecycle phases (same permissions as Estimator)

### LIFE-03: Auto-advance on estimate creation
- [ ] Creating the first estimate on an `opportunity` project automatically advances it to `estimating`
- [ ] The auto-advance is recorded in `project_lifecycle_transitions` with `trigger: 'estimate_created'`
- [ ] Creating subsequent estimates on an `estimating` project does NOT re-trigger the advance

### LIFE-04: Lifecycle transition history visible in UI
- [ ] The project overview page (main tab) shows a "Lifecycle History" section
- [ ] History entries show the from/to phase, timestamp, and actor name
- [ ] Backward transitions show the reason text in the history entry

### LIFE-05: Lifecycle phase badge in project header and project list
- [ ] The project header shows a color-coded badge for the current lifecycle phase
- [ ] Each of the 9 phases has a distinct color (no two phases share the same color)
- [ ] The `/projects` list table has a "Phase" column with lifecycle phase badges for each row
- [ ] The old "Status" field is no longer visible in the project header or list

### LIFE-06: Phase-conditional feature gating
- [ ] `isFeatureAvailableInPhase('change_orders', 'opportunity')` returns `false`
- [ ] `isFeatureAvailableInPhase('change_orders', 'estimating')` returns `false`
- [ ] `isFeatureAvailableInPhase('change_orders', 'submitted')` returns `false`
- [ ] `isFeatureAvailableInPhase('change_orders', 'awarded')` returns `true`
- [ ] `isFeatureAvailableInPhase('change_orders', 'active')` returns `true`
- [ ] `isFeatureAvailableInPhase('estimate_editing', 'opportunity')` returns `true`
- [ ] `isFeatureAvailableInPhase('estimate_editing', 'estimating')` returns `true`
- [ ] `isFeatureAvailableInPhase('estimate_editing', 'active')` returns `false`
- [ ] `changeOrder.create` on an `opportunity` project returns 400 BAD_REQUEST with lifecycle phase message
- [ ] `changeOrder.create` on an `active` project succeeds
- [ ] `estimates.update` on an `active` project returns 400 BAD_REQUEST with lifecycle phase message
- [ ] `estimates.updateLineItem` on an `active` project returns 400 BAD_REQUEST
- [ ] `estimates.update` on an `estimating` project succeeds
- [ ] `estimates.create` on an `active` project succeeds (not blocked by estimate_editing gate)
- [ ] Change Orders tab is absent from project navigation for `opportunity` phase projects
- [ ] Change Orders tab is absent from project navigation for `estimating` phase projects
- [ ] Change Orders tab is absent from project navigation for `submitted` phase projects
- [ ] Change Orders tab is present in project navigation for `awarded` phase projects
- [ ] Change Orders tab is present in project navigation for `active` phase projects
- [ ] Change Orders tab is present in project navigation for `substantial_completion` phase projects

---

## Mode Requirements (MODE-01 through MODE-04)

### MODE-01: Project mode selection at creation
- [ ] The new project creation form includes a "Project Mode" dropdown
- [ ] Dropdown options are "GC / Advanced" and "Simple"
- [ ] The dropdown defaults to "GC / Advanced"
- [ ] The created project's `projectMode` field in the DB matches the selection

### MODE-02: Mode badge and mode switch in project header
- [ ] A mode badge is visible in the project header next to the lifecycle phase badge
- [ ] Badge reads "Simple" or "GC/Advanced" depending on the project's mode
- [ ] A "Switch to Simple" or "Switch to GC/Advanced" button is visible for authorized users (estimator/project_administrator/org:admin)
- [ ] Clicking the mode switch button updates the project mode immediately (optimistic update or refetch)
- [ ] The tab bar updates immediately after mode switch (SOV/RFQs appear or disappear)

### MODE-03: GC-only tab gating
- [ ] Simple mode project: SOV tab is absent from project navigation
- [ ] Simple mode project: RFQs tab is absent from project navigation
- [ ] GC/Advanced mode project: SOV tab is present in project navigation
- [ ] GC/Advanced mode project: RFQs tab is present in project navigation
- [ ] Simple mode project shows 8 tabs total (after also accounting for phase-gated tabs)
- [ ] GC/Advanced mode project shows up to 10 tabs (minus any phase-gated tabs)

### MODE-04: Mode-specific UI elements in estimates and payment apps
- [ ] GC/Advanced mode estimate: line items table shows CSI Code column
- [ ] Simple mode estimate: Cost Type column is present (no redundant Billing Category column)
- [ ] Simple mode payment app: Lien Waivers tab is NOT visible
- [ ] GC/Advanced mode payment app: Lien Waivers tab IS visible (requires a payment app to exist)

---

## Shared Helper Sanity Check

Run this in the API or a test file to verify shared helper behavior:

```typescript
import { isFeatureAvailableInPhase } from "@construction/shared";

// change_orders gate
console.assert(isFeatureAvailableInPhase("change_orders", "opportunity") === false);
console.assert(isFeatureAvailableInPhase("change_orders", "estimating") === false);
console.assert(isFeatureAvailableInPhase("change_orders", "submitted") === false);
console.assert(isFeatureAvailableInPhase("change_orders", "awarded") === true);
console.assert(isFeatureAvailableInPhase("change_orders", "active") === true);
console.assert(isFeatureAvailableInPhase("change_orders", "substantial_completion") === true);
console.assert(isFeatureAvailableInPhase("change_orders", "closed") === true);
console.assert(isFeatureAvailableInPhase("change_orders", "warranty") === true);
console.assert(isFeatureAvailableInPhase("change_orders", "archived") === true);

// estimate_editing gate
console.assert(isFeatureAvailableInPhase("estimate_editing", "opportunity") === true);
console.assert(isFeatureAvailableInPhase("estimate_editing", "estimating") === true);
console.assert(isFeatureAvailableInPhase("estimate_editing", "submitted") === false);
console.assert(isFeatureAvailableInPhase("estimate_editing", "active") === false);

// unknown feature key is permissive
console.assert(isFeatureAvailableInPhase("unknown_feature", "opportunity") === true);
```

---

## Files Implementing Phase 36

| Requirement | File | What it does |
|-------------|------|-------------|
| LIFE-01 | `apps/api/src/db/schema/tenant.ts` | lifecyclePhase + projectMode columns; project_lifecycle_transitions table |
| LIFE-02 | `apps/api/src/trpc/routers/project.ts` | transitionLifecyclePhase mutation with RBAC |
| LIFE-02 | `apps/api/src/lib/lifecycle-state-machine.ts` | isValidTransition(), tryAutoAdvance() |
| LIFE-02 | `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` | Interactive phase badge + popover |
| LIFE-03 | `apps/api/src/trpc/routers/estimates.ts` | tryAutoAdvance call in estimates.create |
| LIFE-04 | `apps/web/app/(dashboard)/projects/[projectSlug]/components/transition-history.tsx` | Lifecycle history timeline |
| LIFE-05 | `apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx` | Color-coded badge component |
| LIFE-05 | `apps/web/app/(dashboard)/projects/components/columns.tsx` | Phase column in project list |
| LIFE-06 | `packages/shared/src/types/project.ts` | PHASE_FEATURE_GATES + isFeatureAvailableInPhase |
| LIFE-06 | `apps/api/src/trpc/routers/change-order.ts` | Phase gate in changeOrder.create |
| LIFE-06 | `apps/api/src/trpc/routers/estimates.ts` | Phase gates in estimates.update + updateLineItem |
| LIFE-06 | `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` | Change Orders tab hidden pre-Awarded |
| MODE-01 | `apps/web/app/(dashboard)/projects/new/page.tsx` | Project Mode dropdown in create form |
| MODE-01 | `apps/api/src/trpc/routers/project.ts` | project.create resolves projectMode from input/preference |
| MODE-02 | `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` | Mode badge + switch button |
| MODE-02 | `apps/api/src/trpc/routers/project.ts` | project.setMode mutation |
| MODE-03 | `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` | gcOnly flag + mode filter |
| MODE-03 | `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` | Passes projectMode + lifecyclePhase to ProjectTabs |
| MODE-04 | `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx` | Lien Waivers conditional render |

---

*Generated: 2026-02-19*
*Phase 36 plans completed: 01, 02, 03, 04, 05, 06, 07*
