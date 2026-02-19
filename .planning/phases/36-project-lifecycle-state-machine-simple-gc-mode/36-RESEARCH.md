# Phase 36: Project Lifecycle State Machine + Simple/GC Mode - Research

**Researched:** 2026-02-18
**Domain:** State machine design, PostgreSQL schema migration, React tRPC UI patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Manual Phase Transition UX
- Lifecycle phase badge lives in the **project header** — always visible
- Clicking the badge opens a **dropdown** listing all 9 phases (both forward and backward)
- **Forward transitions**: simple confirmation, no reason required
- **Backward transitions**: a reason is required before confirming
- After any transition: badge updates instantly + transition is logged in a **visible transition history** (activity feed or timeline on the project)
- **Who can manually transition**: Estimator and Project Administrator roles only
- Any project member's actions can trigger **automatic phase advances** if the system event criteria is met (auto-advances are audited identically to manual ones)

#### Project Member Roles (RBAC context)
- Roles: Estimator, Project Manager, Project Administrator, Accounting, Project Assistant
- Users can hold multiple roles
- Manual phase transitions: Estimator + Project Administrator only
- Auto-advance triggers: any member action that meets criteria

#### Mode Selection at Creation
- Mode selection is a **dropdown** in the project creation form
- Defaults to the mode configured in the **user's account settings** (user-level preference, not company-wide)
- **Estimator and Project Administrator** can change mode at any time after creation (no lifecycle phase lock)
- When switching from GC/Advanced to Simple on a project with existing SOV or sub bid data: **allow the change, retain all data** in case the user switches back — data is preserved but features are hidden

#### Feature Gating in Simple Mode
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

### Deferred Ideas (OUT OF SCOPE)
- **ERP billing category import** — pull from QuickBooks, chart of accounts, override defaults — future phase
- **Company-level default project mode** — future enhancement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIFE-01 | Replace old status field with 9-phase lifecycle state machine (Opportunity → Estimating → Submitted → Awarded → Active → Substantial Completion → Closed → Warranty → Archived). Migrate all existing projects. | Schema migration pattern documented. Old `status` column: `active/on_hold/completed/archived/bidding`. Migration mapping strategy provided. |
| LIFE-02 | Valid lifecycle transitions enforced — forward-adjacent only unless backward with reason | Transition adjacency table documented. Guard logic in tRPC mutation. Backward requires `reason` field. |
| LIFE-03 | Auto-advance based on system events (first estimate created, estimate submitted, award recorded, construction start date, final pay app approved, closeout, warranty period, archive action) | Event hook pattern documented. Each system action (estimate create, pay app approve, etc.) must call `tryAutoAdvance()`. |
| LIFE-04 | Every transition logged: user_id, old_phase, new_phase, triggered_by (system/user), timestamp, reason | Dedicated `project_lifecycle_transitions` table. Uses existing `createAuditLog` pattern plus new specialized table. |
| LIFE-05 | Project list and project header display lifecycle phase badge (StatusBadge component). Color-coded. | Replaces existing `statusColors`/`ProjectStatus` badge in `project-header.tsx` and `columns.tsx`. Phased color palette recommended. |
| LIFE-06 | Phase-specific feature visibility (Change Orders only Active+; Estimates editable only in Opportunity/Estimating) | Feature gate helper function. Checked in tRPC mutations and React tabs component. |
| MODE-01 | Mode selected at creation: Simple or GC/Advanced. Default from user account settings. | New `project_mode` column on projects table. New `defaultProjectMode` preference on `user_profiles` table. |
| MODE-02 | Mode is locked after Active phase. Read-only badge on project detail page. | Mode lock check in `setProjectMode` mutation: reject if `lifecyclePhase >= 'active'`. Note: CONTEXT.md overrides this — Estimator and Project Administrator can change mode at any time (not locked at Active). |
| MODE-03 | Simple mode hides: CSI division, SOV builder, sub bid management, lien waivers. GC/Advanced shows all. | Mode-aware `ProjectTabs` component. Mode flag passed down from project context. |
| MODE-04 | Existing projects default to GC/Advanced on migration. | Migration sets `project_mode = 'gc_advanced'` for all existing rows. |
</phase_requirements>

---

## Summary

Phase 36 is a backend-heavy schema migration phase combined with two new frontend interaction patterns (the lifecycle badge dropdown and the mode switch). The core technical work is: (1) adding new columns to the projects table, (2) creating a dedicated transition history table, (3) writing a migration script for all tenants, and (4) plumbing new tRPC mutations through to updated UI components.

The existing codebase is well-structured for this work. The `projects` table in `tenant.ts` has a flat `status text` column (`active, on_hold, completed, archived, bidding`) that needs to be replaced by `lifecycle_phase text` and `project_mode text`. The migration pattern is already established: `apps/api/src/tenant/migrate-tenant.ts` shows the exact raw SQL migration approach across all active tenant schemas. The audit logger (`createAuditLog`) and `audit_logs` table are already in place — transitions will use both the existing audit table (for general audit trail) and a new specialized `project_lifecycle_transitions` table (for the visible transition history feed).

The role model needs clarification: CONTEXT.md defines 5 project-level roles (Estimator, Project Manager, Project Administrator, Accounting, Project Assistant), but the current `projectRoleEnum` in shared types defines different roles (project_manager, superintendent, foreman, estimator, accountant, viewer). Phase 36 must add "project_administrator" to the project role enum, add "project_assistant" if needed, and wire the CASL ability check for `lifecyclePhase` transitions to specifically require `estimator` or `project_administrator` project role.

**Primary recommendation:** Add `lifecycle_phase` and `project_mode` columns to the projects table via a raw SQL migration script, add `project_lifecycle_transitions` table to the tenant schema, update the shared type enums, write a single `transitionLifecyclePhase` tRPC mutation that handles all guard logic, and update the project header badge as a client component with a Popover-based dropdown UI.

---

## Standard Stack

### Core (No new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | existing | Schema types + query building | Already used for all DB operations |
| Zod | existing | Input validation for phase transitions | Already used for all API schemas |
| tRPC | existing | API procedures for transition + mode mutations | Already used for all API endpoints |
| @casl/ability | existing | RBAC enforcement for who can transition | Already used for all permission checks |
| shadcn/ui Popover | existing | Lifecycle badge click-to-open dropdown | `apps/web/components/ui/popover.tsx` already exists |
| shadcn/ui DropdownMenu | existing | Alternative for phase list | `apps/web/components/ui/dropdown-menu.tsx` already exists |
| shadcn/ui AlertDialog | existing | Backward transition reason modal | `apps/web/components/ui/alert-dialog.tsx` already exists |
| shadcn/ui Badge | existing | Lifecycle phase color badge | `apps/web/components/ui/badge.tsx` already exists |
| React Hook Form | existing | Backward transition reason input | Already used in project-form.tsx |
| sonner | existing | Success/error toast after transition | Already used throughout |

### No New Dependencies Required
This phase uses zero new npm packages. All UI primitives (Popover, DropdownMenu, AlertDialog, Badge) and all backend infrastructure (Drizzle, Zod, tRPC, CASL) are already installed.

**Installation:** None required.

---

## Architecture Patterns

### Database Schema Changes

#### New columns on `projects` table (migration)
```sql
-- Add lifecycle_phase replacing status
ALTER TABLE "{schema}".projects
  ADD COLUMN IF NOT EXISTS lifecycle_phase TEXT NOT NULL DEFAULT 'opportunity';

-- Add project_mode
ALTER TABLE "{schema}".projects
  ADD COLUMN IF NOT EXISTS project_mode TEXT NOT NULL DEFAULT 'gc_advanced';

-- Migrate existing status values to nearest lifecycle_phase
UPDATE "{schema}".projects SET lifecycle_phase = CASE
  WHEN status = 'bidding'   THEN 'estimating'
  WHEN status = 'active'    THEN 'active'
  WHEN status = 'on_hold'   THEN 'active'
  WHEN status = 'completed' THEN 'closed'
  WHEN status = 'archived'  THEN 'archived'
  ELSE 'opportunity'
END;

-- Keep status column for backward compat during transition, or drop after migration
-- Recommendation: keep but stop writing to it; remove in Phase 37+
```

#### New table: `project_lifecycle_transitions`
Add to `createTenantSchema()` in `apps/api/src/db/schema/tenant.ts`:
```typescript
const projectLifecycleTransitions = schema.table("project_lifecycle_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fromPhase: text("from_phase").notNull(),
  toPhase: text("to_phase").notNull(),
  triggeredBy: text("triggered_by").notNull(), // 'user' | 'system'
  actorId: text("actor_id").notNull(),         // user UUID or 'system'
  reason: text("reason"),                       // Required for backward transitions
  eventSource: text("event_source"),            // e.g., 'estimate_submitted', 'pay_app_approved'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

#### New column on `user_profiles` table (migration)
```sql
ALTER TABLE "{schema}".user_profiles
  ADD COLUMN IF NOT EXISTS default_project_mode TEXT DEFAULT 'gc_advanced';
```

### Lifecycle Phase State Machine

The 9 phases in order:
```
opportunity → estimating → submitted → awarded → active → substantial_completion → closed → warranty → archived
     0              1           2          3        4              5                   6        7          8
```

**Valid forward adjacency** (only one step at a time, automatically):
- Each phase can only forward to the immediately next phase in the sequence above.

**Backward transitions**: Any phase can go back to any earlier phase, but requires a reason string.

**Transition guard function:**
```typescript
// Source: project logic (no external library needed)
const LIFECYCLE_ORDER = [
  'opportunity', 'estimating', 'submitted', 'awarded', 'active',
  'substantial_completion', 'closed', 'warranty', 'archived'
] as const;

type LifecyclePhase = typeof LIFECYCLE_ORDER[number];

function isValidTransition(from: LifecyclePhase, to: LifecyclePhase, reason?: string): void {
  const fromIdx = LIFECYCLE_ORDER.indexOf(from);
  const toIdx   = LIFECYCLE_ORDER.indexOf(to);

  if (fromIdx === toIdx) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already in this phase' });

  const isForward  = toIdx === fromIdx + 1;
  const isBackward = toIdx < fromIdx;

  if (!isForward && !isBackward) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot skip phases forward' });
  }
  if (isBackward && !reason?.trim()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'A reason is required for backward transitions' });
  }
}
```

### Auto-Advance Event Hooks

Auto-advances are triggered inside existing tRPC mutations when system events occur. Each auto-advance call `tryAutoAdvance()` which checks if conditions are met and fires the transition:

| System Event | Target Phase | Where to Hook |
|---|---|---|
| First estimate created on project | `estimating` | `estimates.create` mutation |
| Estimate status set to `submitted` | `submitted` | `estimates.update` status mutation |
| Award recorded (estimate `under_contract`) | `awarded` | `estimates.update` accepted/under_contract mutation |
| Construction start date reached | `active` | Background job OR manual only (date-based; see Open Questions) |
| Final payment app approved | `substantial_completion` | `paymentApp.approve` mutation |
| Project closeout action | `closed` | New `project.closeout` mutation |
| Warranty period passed | `warranty` | Background job OR manual only (see Open Questions) |
| Archive action | `archived` | Existing `project.archive` mutation |

```typescript
// tryAutoAdvance helper — called inside existing mutations
async function tryAutoAdvance(
  db: TenantDb,
  schema: TenantSchema,
  projectId: string,
  targetPhase: LifecyclePhase,
  eventSource: string,
  actorId: string
): Promise<void> {
  const [project] = await db.select({ lifecyclePhase: schema.projects.lifecyclePhase })
    .from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);

  if (!project) return;

  const currentIdx = LIFECYCLE_ORDER.indexOf(project.lifecyclePhase as LifecyclePhase);
  const targetIdx  = LIFECYCLE_ORDER.indexOf(targetPhase);

  // Only auto-advance if target is the NEXT phase
  if (targetIdx !== currentIdx + 1) return;

  await db.transaction(async (tx) => {
    await tx.update(schema.projects)
      .set({ lifecyclePhase: targetPhase, updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId));

    await tx.insert(schema.projectLifecycleTransitions).values({
      projectId,
      fromPhase: project.lifecyclePhase,
      toPhase: targetPhase,
      triggeredBy: 'system',
      actorId,
      eventSource,
    });
  });

  await createAuditLog(db, schema, {
    entityType: 'Project',
    entityId: projectId,
    action: AuditAction.UPDATE,
    actorId,
    changes: { before: { lifecyclePhase: project.lifecyclePhase }, after: { lifecyclePhase: targetPhase } },
    metadata: { triggeredBy: 'system', eventSource },
  });
}
```

### tRPC Mutations to Add

**`project.transitionLifecyclePhase`** — manual transitions:
```typescript
transitionLifecyclePhase: protectedProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    toPhase: lifecyclePhaseEnum,
    reason: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Load project
    // 2. Check CASL: user must have 'transition' on 'LifecyclePhase' OR be org:admin
    //    Specifically: org role must be org:estimator or org:admin,
    //    OR project team role must be 'estimator' or 'project_administrator'
    // 3. Call isValidTransition() guard
    // 4. DB transaction: update projects.lifecycle_phase + insert into project_lifecycle_transitions
    // 5. createAuditLog()
    // 6. Return updated project
  })
```

**`project.setMode`** — change Simple vs GC:
```typescript
setMode: protectedProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    mode: projectModeEnum,  // 'simple' | 'gc_advanced'
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Check CASL: estimator or project_administrator
    // 2. No phase lock (CONTEXT.md decision: mode can always change)
    // 3. Update project_mode column
    // 4. Audit log
    // 5. Return updated project
  })
```

**`user.setDefaultProjectMode`** — user preference:
```typescript
setDefaultProjectMode: protectedProcedure
  .input(z.object({ mode: projectModeEnum }))
  .mutation(async ({ ctx, input }) => {
    // Update user_profiles.default_project_mode for ctx.userId
  })
```

**`project.getTransitionHistory`** — for the transition history feed:
```typescript
getTransitionHistory: protectedProcedure
  .input(z.object({ projectId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // Select from project_lifecycle_transitions ordered by created_at desc
    // Join with user lookup for actor display name
  })
```

### Frontend Component Architecture

#### LifecyclePhaseBadge (replaces status badge in project-header.tsx)
```typescript
// apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx
// "use client"
//
// Props: { projectId, currentPhase, projectSlug, canTransition: boolean }
//
// Renders: Badge with phase color
// On click (if canTransition): opens Popover with list of all 9 phases
// Forward phase click → AlertDialog "Confirm advance to X?" → confirm → mutation
// Backward phase click → AlertDialog with required reason textarea → confirm → mutation
// Uses: trpc.project.transitionLifecyclePhase.useMutation()
// On success: trpc.project.getBySlug.invalidate() + toast
```

#### Phase color palette (Claude's Discretion — recommended):
| Phase | Color | Rationale |
|---|---|---|
| Opportunity | `bg-purple-500/10 text-purple-700 border-purple-200` | Pre-sales, potential |
| Estimating | `bg-blue-500/10 text-blue-700 border-blue-200` | Active estimation work |
| Submitted | `bg-cyan-500/10 text-cyan-700 border-cyan-200` | Awaiting decision |
| Awarded | `bg-emerald-500/10 text-emerald-700 border-emerald-200` | Won — positive signal |
| Active | `bg-green-500/10 text-green-700 border-green-200` | Construction in progress |
| Substantial Completion | `bg-teal-500/10 text-teal-700 border-teal-200` | Nearing end |
| Closed | `bg-gray-500/10 text-gray-700 border-gray-200` | Done |
| Warranty | `bg-orange-500/10 text-orange-700 border-orange-200` | Obligation period |
| Archived | `bg-slate-500/10 text-slate-400 border-slate-200` | Inactive |

#### Transition History Feed (Claude's Discretion — recommended)
Place as a section on the project Overview tab (not a separate tab). A timeline-style feed showing each transition in reverse-chronological order. Each row: phase from → to, actor name, timestamp, reason (if backward). Fetched via `trpc.project.getTransitionHistory`. Simple table or vertical list with left-border timeline indicator.

#### Mode Switch (in project header or Overview tab)
A small badge-style element with "Simple" or "GC/Advanced" label. For users with permission (estimator or project_administrator), render as a button that opens a Select or confirm dialog. Locked to read-only otherwise.

#### Mode-Aware ProjectTabs
```typescript
// Modify existing project-tabs.tsx to accept project mode
// Hide tabs based on mode:
const gcOnlyTabs = ['/sov', '/rfqs']; // hidden in Simple mode
// Lien waivers are inside payment-apps, not a tab — hide at component level

// In Simple mode estimates view: hide costCodeId column, show billingCategory dropdown instead
```

### Recommended Project Structure (New Files)

```
apps/api/src/
├── db/schema/tenant.ts          # Add projectLifecycleTransitions table
├── trpc/routers/project.ts      # Add transitionLifecyclePhase, setMode, getTransitionHistory procedures
├── lib/lifecycle-state-machine.ts  # LIFECYCLE_ORDER const, isValidTransition(), tryAutoAdvance()
└── db/migrations/migrate-phase36.ts  # Raw SQL migration for all tenant schemas

packages/shared/src/types/project.ts
├── Add: lifecyclePhaseEnum + LifecyclePhase type
├── Add: projectModeEnum + ProjectMode type
└── Add: LIFECYCLE_ORDER, LIFECYCLE_PHASE_LABELS, BILLING_CATEGORIES constants

apps/web/app/(dashboard)/projects/[projectSlug]/components/
├── lifecycle-phase-badge.tsx    # New: badge + popover + transition UX
├── transition-history.tsx       # New: transition log timeline
└── project-tabs.tsx             # Modify: mode-aware tab rendering

apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx
└── Pass mode to ProjectTabs

apps/web/app/(dashboard)/projects/components/columns.tsx
└── Replace status badge with lifecyclePhase badge
```

### Anti-Patterns to Avoid
- **Do not use XState or a state machine library**: The transitions are simple enough to implement as a plain ordered array + index comparison. XState is deferred to v2 per REQUIREMENTS.md.
- **Do not drop the `status` column in Phase 36**: Drop it in a later phase after verifying nothing reads it. Keep writing to it as deprecated backup during Phase 36.
- **Do not make the phase transition UI a full page**: It must be lightweight (badge click → Popover/DropdownMenu → confirm).
- **Do not gate mode change by lifecycle phase**: CONTEXT.md locked: mode can change at any time (Estimator and Project Administrator).
- **Do not add "project_administrator" as an org-level role**: It is a PROJECT-level role (stored in `project_team_members.role`), not an org role.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase dropdown UI | Custom HTML select | shadcn Popover + DropdownMenu | Already exists in codebase |
| Confirm modal | Custom modal | shadcn AlertDialog | `alert-dialog.tsx` already present |
| Backward reason input | Custom dialog from scratch | shadcn AlertDialog with Textarea inside | Pattern used elsewhere |
| Audit logging | Custom table writes | `createAuditLog()` from `apps/api/src/audit/logger.ts` | Fire-and-forget safe, already wired |
| Permission checks | Custom role checking | CASL `ForbiddenError.from(abilities).throwUnlessCan()` | Already used in project router |
| Toast notifications | Custom notifications | `sonner` toast | Already used throughout |

**Key insight:** This codebase already has every primitive needed. The work is wiring them together with new columns and new tRPC procedures, not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Role Mismatch Between CONTEXT.md and Existing Code
**What goes wrong:** CONTEXT.md defines project roles as "Estimator, Project Manager, Project Administrator, Accounting, Project Assistant" but the current `projectRoleEnum` has: `project_manager, superintendent, foreman, estimator, accountant, viewer`. The roles "project_administrator" and "project_assistant" do not exist in the schema yet.
**Why it happens:** CONTEXT.md was written with a future role model in mind.
**How to avoid:** Add `project_administrator` to `projectRoleEnum`. Also add `project_assistant` if needed. The `transitionLifecyclePhase` RBAC check must look for EITHER org-level role (`org:estimator`, `org:admin`) OR project-level team role (`estimator`, `project_administrator`).
**Warning signs:** If phase transitions only work for org:admin but not for estimators, this is why.

### Pitfall 2: Status Column vs. Lifecycle Phase Column Confusion
**What goes wrong:** After migration, some queries still filter on the old `status` column (e.g., the `list` procedure uses `eq(schema.projects.status, input.status)`), causing stale data to appear.
**Why it happens:** The old `listProjectsSchema` has a `status: projectStatusEnum.optional()` filter field. After Phase 36, this must change to `lifecyclePhase: lifecyclePhaseEnum.optional()`.
**How to avoid:** Search all uses of `schema.projects.status` and `input.status` in the project router and update. The `listProjectsSchema` needs a new `lifecyclePhase` filter field.
**Warning signs:** Project list filter shows no results for lifecycle phase, but old status filter still works.

### Pitfall 3: Drizzle Schema vs. Runtime Schema (Tenant Factory Function)
**What goes wrong:** Adding `projectLifecycleTransitions` to `createTenantSchema()` in `tenant.ts` updates the TypeScript types but does NOT create the table in existing databases. The SQL migration script must create the table manually.
**Why it happens:** This codebase uses the schema-per-tenant pattern where tables are created by provision scripts, not by Drizzle migrations.
**How to avoid:** Always write a raw SQL migration script (follow `migrate-tenant.ts` pattern) AND update `createTenantSchema()`. The migration runs across all active tenants.
**Warning signs:** `relation does not exist` errors in production; works locally only because dev DB was re-provisioned.

### Pitfall 4: Auto-Advance Logic Running When Phase Is Already Ahead
**What goes wrong:** `tryAutoAdvance('active', estimate.submitted)` is called but the project is already in `'awarded'` phase. Without a guard, it would try to regress the phase.
**Why it happens:** Events can fire in non-sequential order (e.g., user manually advances before auto-advance trigger fires).
**How to avoid:** The `tryAutoAdvance()` function MUST check `targetIdx === currentIdx + 1`. If target is not the next phase, silently return without changing anything.
**Warning signs:** Project phase jumps backward automatically when an estimate is submitted on an already-active project.

### Pitfall 5: Multi-Role Users and CASL Project Team Check
**What goes wrong:** A user has org-level role `org:member` and a project team role of `project_administrator`. The `loadProjectAbilities()` function only uses `ctx.orgRole` for the CASL role, not the project-team role.
**Why it happens:** `defineAbilitiesFor()` takes one org role string. Project team membership provides project scoping, but doesn't elevate the role.
**How to avoid:** For lifecycle transition permission, do NOT rely solely on CASL. Instead: fetch the project team membership for this user and this project, check if their team role is `estimator` or `project_administrator` directly in the mutation. Alternatively, add a new CASL rule pattern for project-level elevated actions.
**Warning signs:** Users with `project_administrator` team role cannot transition phases; only org:admin can.

### Pitfall 6: Migration NULL Values for DEFAULT
**What goes wrong:** `ADD COLUMN lifecycle_phase TEXT NOT NULL DEFAULT 'opportunity'` fails if `NOT NULL` is specified without a default, or succeeds but leaves existing rows with the wrong default before the UPDATE runs.
**Why it happens:** PostgreSQL applies NOT NULL after adding default, but if rows exist with NULL during a multi-step transaction, constraint can fail.
**How to avoid:** In the migration, add column with `DEFAULT 'opportunity'` first (no NOT NULL yet), run the UPDATE mapping, then add NOT NULL constraint. Or add with DEFAULT and NOT NULL — PostgreSQL backfills all existing rows immediately before returning.
**Warning signs:** `ERROR: column contains null values` on `ALTER TABLE ... SET NOT NULL`.

### Pitfall 7: User Preference Storage — No Existing Table
**What goes wrong:** User-level `defaultProjectMode` preference needs to be stored, but `user_profiles` is a tenant-scoped table. The preference must be accessible when creating a project (which happens in a tenant context), so it fits there.
**Why it happens:** There is no global user preferences table in the current schema.
**How to avoid:** Add `default_project_mode TEXT DEFAULT 'gc_advanced'` column to `user_profiles` in the tenant schema migration. The user profile is already the right scope (tenant-scoped user preferences).
**Warning signs:** If storing preference in `public.users` instead — that table has no tenant context and `user_profiles` is the correct location for tenant-scoped user settings.

---

## Code Examples

### Migration Script Pattern (from `migrate-tenant.ts`)
```typescript
// Source: apps/api/src/tenant/migrate-tenant.ts (established pattern)
import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

for (const row of tenants.rows) {
  const schemaName = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Add lifecycle_phase column
    await client.query(`
      ALTER TABLE "${schemaName}".projects
      ADD COLUMN IF NOT EXISTS lifecycle_phase TEXT NOT NULL DEFAULT 'opportunity'
    `);

    // Map existing status values
    await client.query(`
      UPDATE "${schemaName}".projects SET lifecycle_phase = CASE
        WHEN status = 'bidding'   THEN 'estimating'
        WHEN status = 'active'    THEN 'active'
        WHEN status = 'on_hold'   THEN 'active'
        WHEN status = 'completed' THEN 'closed'
        WHEN status = 'archived'  THEN 'archived'
        ELSE 'opportunity'
      END
    `);

    // Add project_mode column
    await client.query(`
      ALTER TABLE "${schemaName}".projects
      ADD COLUMN IF NOT EXISTS project_mode TEXT NOT NULL DEFAULT 'gc_advanced'
    `);

    // Add project_lifecycle_transitions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".project_lifecycle_transitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
        from_phase TEXT NOT NULL,
        to_phase TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        reason TEXT,
        event_source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Add index for project history lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plt_project_id
        ON "${schemaName}".project_lifecycle_transitions(project_id)
    `);

    // Add default_project_mode to user_profiles
    await client.query(`
      ALTER TABLE "${schemaName}".user_profiles
      ADD COLUMN IF NOT EXISTS default_project_mode TEXT DEFAULT 'gc_advanced'
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
```

### Lifecycle Phase Badge Component Pattern
```typescript
// Source: adapted from existing project-header.tsx + dialog.tsx patterns
// apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel,
         AlertDialogContent, AlertDialogFooter, AlertDialogHeader,
         AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { LifecyclePhase } from "@construction/shared";

const PHASE_LABELS: Record<LifecyclePhase, string> = {
  opportunity: "Opportunity",
  estimating: "Estimating",
  submitted: "Submitted",
  awarded: "Awarded",
  active: "Active",
  substantial_completion: "Substantial Completion",
  closed: "Closed",
  warranty: "Warranty",
  archived: "Archived",
};

interface LifecyclePhaseBadgeProps {
  projectId: string;
  projectSlug: string;
  currentPhase: LifecyclePhase;
  canTransition: boolean;
}

export function LifecyclePhaseBadge({ projectId, projectSlug, currentPhase, canTransition }: LifecyclePhaseBadgeProps) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<LifecyclePhase | null>(null);
  const [isBackward, setIsBackward] = useState(false);
  const [reason, setReason] = useState("");

  const LIFECYCLE_ORDER: LifecyclePhase[] = [
    'opportunity', 'estimating', 'submitted', 'awarded', 'active',
    'substantial_completion', 'closed', 'warranty', 'archived'
  ];

  const transitionMutation = trpc.project.transitionLifecyclePhase.useMutation({
    onSuccess: () => {
      utils.project.getBySlug.invalidate({ slug: projectSlug });
      utils.project.list.invalidate();
      toast.success(`Project advanced to ${PHASE_LABELS[pendingPhase!]}`);
      setPendingPhase(null);
      setReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePhaseClick = (phase: LifecyclePhase) => {
    const currentIdx = LIFECYCLE_ORDER.indexOf(currentPhase);
    const targetIdx  = LIFECYCLE_ORDER.indexOf(phase);
    setIsBackward(targetIdx < currentIdx);
    setPendingPhase(phase);
    setOpen(false);
  };

  const handleConfirm = () => {
    if (!pendingPhase) return;
    transitionMutation.mutate({
      projectId,
      toPhase: pendingPhase,
      reason: isBackward ? reason : undefined,
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={canTransition ? setOpen : undefined}>
        <PopoverTrigger asChild>
          <Badge
            className={phaseColors[currentPhase]}
            variant="outline"
            style={{ cursor: canTransition ? 'pointer' : 'default' }}
          >
            {PHASE_LABELS[currentPhase]}
          </Badge>
        </PopoverTrigger>
        {canTransition && (
          <PopoverContent className="w-48 p-1">
            {LIFECYCLE_ORDER.map((phase) => (
              <button
                key={phase}
                disabled={phase === currentPhase}
                onClick={() => handlePhaseClick(phase)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent disabled:opacity-40"
              >
                {PHASE_LABELS[phase]}
              </button>
            ))}
          </PopoverContent>
        )}
      </Popover>

      <AlertDialog open={!!pendingPhase} onOpenChange={(o) => { if (!o) { setPendingPhase(null); setReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBackward ? `Revert to ${PHASE_LABELS[pendingPhase!]}?` : `Advance to ${PHASE_LABELS[pendingPhase!]}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBackward
                ? "This is a backward transition. Please provide a reason."
                : "This will move the project forward to the next phase."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isBackward && (
            <Textarea
              placeholder="Reason for reverting..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isBackward && !reason.trim() || transitionMutation.isPending}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Mode-Aware Tab Filtering Pattern
```typescript
// Source: adapted from existing project-tabs.tsx
// Add project mode awareness to section list

const ALL_SECTIONS = [
  { name: "Overview", href: "" },
  { name: "Documents", href: "/documents" },
  { name: "Budget", href: "/budget" },
  { name: "Commitments", href: "/commitments" },
  { name: "Change Orders", href: "/change-orders" },
  { name: "SOV", href: "/sov", gcOnly: true },         // hidden in Simple
  { name: "Payment Apps", href: "/payment-apps" },
  { name: "Invoices", href: "/invoices" },
  { name: "RFQs", href: "/rfqs", gcOnly: true },       // hidden in Simple
  { name: "Estimates", href: "/estimates" },
];

// In ProjectTabs component:
const sections = ALL_SECTIONS.filter(s => !s.gcOnly || projectMode === 'gc_advanced');
```

### Feature Gate for Phase-Specific Actions
```typescript
// Source: project logic (no external library)
// packages/shared/src/types/project.ts (add utility)

const PHASE_FEATURE_GATES: Record<string, LifecyclePhase[]> = {
  // Feature: allowed in these phases or later
  'change_orders': ['active', 'substantial_completion', 'closed', 'warranty'],
  'estimates_editable': ['opportunity', 'estimating'],
};

export function isFeatureAllowedInPhase(feature: string, currentPhase: LifecyclePhase): boolean {
  const allowed = PHASE_FEATURE_GATES[feature];
  if (!allowed) return true; // default: allowed everywhere
  const currentIdx = LIFECYCLE_ORDER.indexOf(currentPhase);
  return allowed.some(p => LIFECYCLE_ORDER.indexOf(p) <= currentIdx);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| XState for state machines | Plain ordered array + index comparison | v1.5 decision | Simpler, no dependency, easier to debug |
| Drizzle push migrations | Raw SQL migration scripts per phase | Phase 6 established | Multi-tenant schema-per-tenant requires raw SQL |
| Flat status field (active/inactive) | 9-phase lifecycle enum | Phase 36 | Full project lifecycle tracking |

**Deprecated/outdated after Phase 36:**
- `projectStatusEnum` (`active, on_hold, completed, archived`): Keep type in shared for backward compat but stop using in new code. All new code uses `lifecyclePhaseEnum`.
- `statusColors` record in `project-header.tsx` and `columns.tsx`: Replace with `phaseColors`.

---

## Open Questions

1. **Date-triggered auto-advances (LIFE-03: construction start date reached; warranty period passed)**
   - What we know: These require either a scheduled job or manual-only advancement. The codebase has no background job scheduler currently.
   - What's unclear: Does "construction start date reached" mean auto-advance fires on a cron, or is it only checked when someone visits the project?
   - Recommendation: For Phase 36, implement these two as **manual-only** transitions (the user advances them). The auto-advance logic for date-based events requires a scheduler (not in scope for Phase 36). Document this as a known limitation.

2. **"Project Administrator" as a new project team role**
   - What we know: CONTEXT.md defines "Project Administrator" as a distinct project role. The current `projectRoleEnum` has `project_manager, superintendent, foreman, estimator, accountant, viewer`. "Project Administrator" does not exist.
   - What's unclear: Is "Project Administrator" a new name for "project_manager", or a separate higher role?
   - Recommendation: Add `project_administrator` to `projectRoleEnum` as a distinct role. Treat it as a project-level super-manager role. The existing org-level `org:admin` already has full access; `project_administrator` is a project-scoped role that grants lifecycle transition permission within a specific project.

3. **Backward transition RBAC: who can go backward?**
   - What we know: CONTEXT.md says "Backward transitions need friction (reason required) but should NOT require admin override — Estimator and Project Administrator should be able to revert freely with a reason."
   - What's unclear: Does the same set of roles (Estimator + Project Administrator) have backward AND forward transition rights? Or are backward transitions more restricted?
   - Recommendation: Same roles for both forward and backward — Estimator or Project Administrator at project level, or org:admin. The friction for backward is the required reason string, not a different permission level.

4. **Transition history feed: read access for all team members?**
   - What we know: Any team member can see the transition history (it is an activity feed, not private data).
   - What's unclear: Should the `getTransitionHistory` procedure be accessible to all project team members or only those with transition rights?
   - Recommendation: Readable by all project team members (read access to Project → read access to transition history). Writing/triggering transitions remains restricted.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `apps/api/src/db/schema/tenant.ts` — projects table schema, confirmed `status text` column
- Direct codebase inspection: `apps/api/src/tenant/migrate-tenant.ts` — established raw SQL migration pattern
- Direct codebase inspection: `apps/api/src/trpc/routers/project.ts` — existing project router structure
- Direct codebase inspection: `apps/api/src/audit/logger.ts` — `createAuditLog()` pattern
- Direct codebase inspection: `apps/api/src/auth/abilities.ts` — CASL role definitions
- Direct codebase inspection: `packages/shared/src/types/project.ts` — `projectStatusEnum`, `projectRoleEnum`
- Direct codebase inspection: `packages/shared/src/types/auth.ts` — `AppSubjects`, `AppActions`
- Direct codebase inspection: `apps/web/components/project/project-form.tsx` — project creation form structure
- Direct codebase inspection: `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — badge location
- Direct codebase inspection: `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` — tab list

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md LIFE-01 through LIFE-06, MODE-01 through MODE-04 — requirements in this project repository
- Phase 36 CONTEXT.md — locked decisions from user discussion

### Tertiary (LOW confidence — needs validation)
- Recommendation on "project_administrator" as a new project role — inferred from CONTEXT.md but requires user confirmation on whether it's a rename or a new role

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in codebase; no new dependencies
- Architecture: HIGH — migration pattern confirmed from existing migrate-tenant.ts; DB schema confirmed from tenant.ts
- Pitfalls: HIGH — all pitfalls derived from direct codebase analysis
- Role model: MEDIUM — "project_administrator" role name is new and needs confirmation vs. existing roles
- Date-based auto-advances: MEDIUM — scheduler requirement is a known gap, recommendation is manual-only for Phase 36

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable codebase, 30-day validity)
