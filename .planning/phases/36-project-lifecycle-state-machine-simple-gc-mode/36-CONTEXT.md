# Phase 36: Project Lifecycle State Machine + Simple/GC Mode - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the flat project status field with a 9-state lifecycle state machine (Opportunity → Estimating → Submitted → Awarded → Active → Substantial Completion → Closed → Warranty → Archived). Add Simple vs GC/Advanced complexity mode selected at project creation. Auto-advance projects through phases based on system events. Migrate all existing projects. New capabilities (ERP billing category sync, billing category management) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Manual Phase Transition UX
- Lifecycle phase badge lives in the **project header** — always visible
- Clicking the badge opens a **dropdown** listing all 9 phases (both forward and backward)
- **Forward transitions**: simple confirmation, no reason required
- **Backward transitions**: a reason is required before confirming
- After any transition: badge updates instantly + transition is logged in a **visible transition history** (activity feed or timeline on the project)
- **Who can manually transition**: Estimator and Project Administrator roles only
- Any project member's actions can trigger **automatic phase advances** if the system event criteria is met (auto-advances are audited identically to manual ones)

### Project Member Roles (RBAC context)
- Roles: Estimator, Project Manager, Project Administrator, Accounting, Project Assistant
- Users can hold multiple roles
- Manual phase transitions: Estimator + Project Administrator only
- Auto-advance triggers: any member action that meets criteria

### Mode Selection at Creation
- Mode selection is a **dropdown** in the project creation form
- Defaults to the mode configured in the **user's account settings** (user-level preference, not company-wide)
- **Estimator and Project Administrator** can change mode at any time after creation (no lifecycle phase lock)
- When switching from GC/Advanced → Simple on a project with existing SOV or sub bid data: **allow the change, retain all data** in case the user switches back — data is preserved but features are hidden

### Feature Gating in Simple Mode
- Hidden features: **hidden entirely** — no tabs, no sections, no hint they exist
  - CSI trade breakdown section
  - SOV builder
  - Subcontractor bid management
  - Lien waivers
- Within sections that exist in both modes (e.g., Estimates line items): **hide CSI trade/division columns** and replace with a **billing category dropdown** (Simple-mode replacement for CSI classification)
- Default billing categories: Labor, Materials, Subcontractors, Equipment, Other (hardcoded defaults for Phase 36)

### Claude's Discretion
- Exact color palette for the 9 lifecycle phase badges
- Badge placement details within the project header
- Transition history UI (whether it's an inline timeline, a dedicated tab, or an activity feed section)
- Confirmation modal design for forward transitions
- Backward transition reason input UX (inline in dropdown vs modal)
- Exact billing category names in the default list

</decisions>

<specifics>
## Specific Ideas

- The dropdown on the lifecycle badge should feel lightweight — not a heavy modal just to advance a phase
- Backward transitions need friction (reason required) but should not require admin override — Estimator and Project Administrator should be able to revert freely with a reason
- Billing category in Simple mode is a direct replacement for CSI trade classification — same column slot, different input type

</specifics>

<deferred>
## Deferred Ideas

- **ERP billing category import** — Pull billing categories from QuickBooks chart of accounts when connected, override defaults. Noted for a future phase (likely alongside Phase 38/39 document work or a standalone enhancement).
- **Company-level default project mode** — Currently user-level preference only. Could add a company-level default that user preferences override. Future enhancement.

</deferred>

---

*Phase: 36-project-lifecycle-state-machine-simple-gc-mode*
*Context gathered: 2026-02-18*
