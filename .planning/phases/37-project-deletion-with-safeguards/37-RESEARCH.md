# Phase 37: Project Deletion with Safeguards - Research

**Researched:** 2026-02-19
**Domain:** Soft-delete lifecycle, pre-flight validation, destructive action UI, auto-purge scheduling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Delete entry points:**
- Project table: delete action lives as a **separate danger zone** on the row (standalone red button visible on hover/row actions, separate from other actions like Edit/View)
- Project detail page: delete action lives in the **project header actions menu** (kebab/actions dropdown next to the lifecycle badge)
- Non-admin users: **completely hidden** — no delete options appear on any surface for non-admins
- Action label: **"Delete Project"** (clear, direct, standard CRUD language)

**Blocking feedback:**
- Check runs **before** the confirmation dialog — clicking "Delete Project" triggers a pre-flight check immediately
- If blocked: a **modal/dialog** appears explaining why (not a toast)
- Error specificity: **all blocking reasons listed at once** — e.g., "Cannot delete: project is in Active phase and has 3 change orders and 1 payment application"
- Both blocking triggers checked simultaneously: lifecycle phase AND financial records (change orders, payment apps, committed costs)

**Confirmation dialog:**
- **Replaces roadmap DEL-03 spec** (roadmap said "type exact project name" — user decision overrides this)
- Dialog shows:
  - Warning text explaining deletion
  - Reassuring note: "You can recover this project within 30 days via Company Settings → Deleted Projects"
  - Required **Reason for deletion** text field (free text, required — Delete button disabled until filled)
  - No "type project name" field — logged-in user identity is captured automatically from auth
- Delete button: **red/destructive variant**
- Reason is stored in the audit trail alongside actor identity and timestamp

**Recovery path:**
- Location: **Company Settings → Deleted Projects** section (tab or section within settings)
- Deleted projects list shows: project name, deleted date, deleted by, reason, days remaining until auto-purge
- Admin restores a project → project is **restored to exact prior state** but shows a **"This project was deleted and restored"** banner on the project header
- After 30 days: **auto-purge** (hard delete) — record is permanently removed from the database

### Claude's Discretion
- Auto-purge implementation (cron job, on-read lazy check, or scheduled task)
- Exact row danger zone UI pattern (how the red button appears/animates on hover)
- Exact wording of blocking error messages and confirmation dialog body text
- Recovery banner dismissal behavior (persistent vs. dismissible)
- Database column names for soft-delete fields (deleted_at, deleted_by, deletion_reason, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEL-01 | Admin-only "Delete Project" action on project detail page and projects table row menu. Non-admin users do not see this option. | `orgRole === "org:admin"` check via `useAuth()` hook client-side; `ctx.orgRole === "org:admin"` server-side in `protectedProcedure`. CASL `can("delete", "Project")` only for `org:admin`. |
| DEL-02 | Deletion blocked with clear error message if project is in Awarded/Active/Substantial Completion/Closed/Warranty phase OR has financial records (change orders, payment applications, committed costs). | Pre-flight `project.checkDeletable` tRPC query runs before dialog. Returns all blocking reasons simultaneously. `LIFECYCLE_ORDER` index comparison determines blocked phases. COUNT queries on `changeOrders`, `paymentApps`, `commitments` tables. |
| DEL-03 | When deletion permitted, confirmation dialog with reason field (user overrode: NOT typing project name — requires a reason for deletion). | `AlertDialog` from `@/components/ui/alert-dialog` (Radix UI). `Textarea` for reason field. Delete button disabled until reason non-empty. Same pattern as backward lifecycle transition dialog. |
| DEL-04 | Soft delete (deleted_at, deleted_by timestamps). 30-day recovery window in Company Settings. Hard delete fires automatically after 30 days. | New columns on `projects` table: `deleted_at`, `deleted_by`, `deletion_reason`. New `settings/deleted-projects/page.tsx`. Auto-purge: on-read lazy purge recommended. Migration script adds columns to all tenant schemas. |
| DEL-05 | All deletion actions logged to audit trail. | `createAuditLog(db, schema, {...})` with `AuditAction.DELETE`. Include `deletion_reason` in `changes` field. Same fire-and-forget pattern as all other audit log calls. |
</phase_requirements>

---

## Summary

This phase adds admin-only project deletion with a two-phase safety check: a pre-flight query that checks lifecycle phase and financial record existence simultaneously, followed by a reason-required confirmation dialog. Deleted projects are soft-deleted (three new columns on the `projects` table) with a 30-day recovery window surfaced in Company Settings. After 30 days, a lazy on-read purge permanently removes the record.

The codebase already has all the plumbing needed: `AlertDialog` component from Radix UI exists in `components/ui/alert-dialog.tsx`, the audit log pattern (`createAuditLog`) is established, role checking via `orgRole === "org:admin"` and `useAuth()` is standard, and the `projects` table schema is well understood. The project router (`apps/api/src/trpc/routers/project.ts`) will receive three new procedures: `checkDeletable`, `softDelete`, and `restore`. A new settings page at `settings/deleted-projects` completes the recovery surface.

The main implementation decisions left to Claude are: auto-purge strategy (recommend lazy on-read, no cron infrastructure needed), column naming (recommend `deleted_at`, `deleted_by`, `deletion_reason`), and the row-level danger zone UI pattern (recommend a hidden-until-hover destructive button separate from the row's main click target).

**Primary recommendation:** Add three columns to `projects`, add three tRPC procedures to `project` router, build a `DeleteProjectButton` compound component that handles the pre-flight + dialog flow, and add a Deleted Projects settings page. This is straightforward CRUD with a soft-delete twist — no new infrastructure required.

---

## Standard Stack

### Core (already in codebase — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | existing | Schema migrations, soft-delete queries with `isNotNull(schema.projects.deletedAt)` | Already the ORM for all DB operations |
| tRPC | existing | `checkDeletable`, `softDelete`, `restore` mutations | All API calls go through tRPC |
| Radix UI AlertDialog | existing | Blocking modal + confirmation dialog | Already in `components/ui/alert-dialog.tsx` |
| `@casl/ability` | existing | `can("delete", "Project")` ability check (org:admin only) | Existing RBAC system |
| Sonner | existing | Success/error toasts after delete/restore | Already used throughout |
| React Hook Form + zod | existing | Reason field validation | Already the form standard |

### No New Dependencies Needed
This phase is pure feature implementation on top of existing infrastructure. No npm installs required.

---

## Architecture Patterns

### Recommended Project Structure (new files only)
```
apps/api/src/
├── trpc/routers/project.ts          # Add: checkDeletable, softDelete, restore
├── db/migrations/migrate-phase37.ts # Add: deleted_at, deleted_by, deletion_reason columns

apps/web/app/(dashboard)/
├── projects/
│   ├── components/
│   │   ├── delete-project-button.tsx      # NEW: compound delete UI
│   │   └── columns.tsx                    # MODIFY: add danger zone column (admin only)
│   └── [projectSlug]/
│       └── components/
│           └── project-header.tsx         # MODIFY: add kebab menu with Delete Project
│
└── settings/
    └── deleted-projects/
        └── page.tsx                       # NEW: deleted projects list + restore

packages/shared/src/types/project.ts       # ADD: deletable check response type
```

### Pattern 1: Pre-Flight Check Before Dialog

**What:** A tRPC query runs when "Delete Project" is clicked. If blocked, show a blocking dialog. If allowed, show confirmation dialog.

**When to use:** Any time a destructive action has server-side validation that produces user-visible reasons.

**Example (client-side flow):**
```typescript
// Source: project-header pattern + lifecycle-phase-badge dialog pattern
const [deleteState, setDeleteState] = useState<
  | { status: "idle" }
  | { status: "checking" }
  | { status: "blocked"; reasons: string[] }
  | { status: "confirming" }
  | { status: "deleting" }
>({ status: "idle" });

const handleDeleteClick = async () => {
  setDeleteState({ status: "checking" });
  const result = await trpcUtils.project.checkDeletable.fetch({ id: project.id });
  if (!result.canDelete) {
    setDeleteState({ status: "blocked", reasons: result.reasons });
  } else {
    setDeleteState({ status: "confirming" });
  }
};
```

### Pattern 2: Soft Delete with isNull Filter

**What:** All active-project queries add `isNull(schema.projects.deletedAt)` to WHERE clause. Deleted projects are only visible in the recovery page.

**Critical:** The existing `project.list` query, `project.getBySlug`, and `project.getById` ALL need the `deletedAt IS NULL` filter added. Without this, deleted projects remain visible.

**Example (server-side):**
```typescript
// Source: Drizzle ORM docs — isNull operator already imported in project.ts
import { isNull } from "drizzle-orm";

// In project.list, add to conditions:
conditions.push(isNull(schema.projects.deletedAt));

// In project.getBySlug:
const [project] = await db
  .select()
  .from(schema.projects)
  .where(and(
    eq(schema.projects.slug, input.slug),
    isNull(schema.projects.deletedAt)
  ))
  .limit(1);
```

### Pattern 3: Lazy On-Read Auto-Purge

**What:** When the `deleted-projects` settings page calls `project.listDeleted`, the query first hard-deletes any rows where `deleted_at < NOW() - INTERVAL '30 days'`, then returns the remaining soft-deleted rows.

**Why this over cron:** No new infrastructure (no pg_cron, no Redis job queue, no Node cron library). Purge happens automatically as part of the normal read path. Side effect: a project that hits 30 days while nobody is viewing the settings page will be purged on first settings page visit after that point — which is acceptable.

**Example:**
```typescript
// In project.listDeleted procedure:
// Step 1: Purge expired soft-deletes
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
await db
  .delete(schema.projects)
  .where(
    and(
      isNotNull(schema.projects.deletedAt),
      lte(schema.projects.deletedAt, thirtyDaysAgo)
    )
  );

// Step 2: Return remaining soft-deleted
return await db
  .select()
  .from(schema.projects)
  .where(isNotNull(schema.projects.deletedAt))
  .orderBy(desc(schema.projects.deletedAt));
```

### Pattern 4: Kebab Menu in Project Header

**What:** A `DropdownMenu` (already in `components/ui/dropdown-menu.tsx`) wraps a three-dot or "Actions" trigger next to the Edit Project button. Only rendered when `orgRole === "org:admin"`.

**Example:**
```typescript
// Source: dropdown-menu.tsx already in components/ui
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

{isAdmin && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={handleDeleteClick}
      >
        Delete Project
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

### Pattern 5: Row Danger Zone in Projects Table

**What:** A hidden-on-default `Button variant="destructive"` that appears via CSS hover group on the `TableRow`. Uses a conditional column that's only added for admin users.

**Why separate from other actions:** User decision — it must be visually distinct from Edit/View. The column only renders when `orgRole === "org:admin"`.

**Note on columns:** The current `columns.tsx` is a static export (`export const columns: ColumnDef<Project>[]`). To pass admin status, change to a factory function `createColumns(isAdmin: boolean): ColumnDef<Project>[]`. This matches the factory pattern used in other TanStack Table codebases.

```typescript
// In columns.tsx
export function createColumns(isAdmin: boolean, onDelete: (id: string) => void): ColumnDef<Project>[] {
  const baseColumns: ColumnDef<Project>[] = [ /* ...existing cols */ ];

  if (!isAdmin) return baseColumns;

  return [
    ...baseColumns,
    {
      id: "actions",
      size: 60,
      cell: ({ row }) => (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete(row.original.id); }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];
}
```

### Anti-Patterns to Avoid
- **Checking deletable on the client only:** Always validate server-side in `checkDeletable`. Client check is display-only.
- **Using `AuditAction.DELETE` with reason in the message field:** Store reason in `changes` JSONB as `{ deletion_reason: "..." }`, not in a free-text override.
- **Hard-deleting immediately from the router:** The `softDelete` mutation ONLY sets `deleted_at` and fires a redirect — it never calls `db.delete()`.
- **Filtering deleted projects in every query ad-hoc:** Add `isNull(schema.projects.deletedAt)` to the base `list`, `getBySlug`, and `getById` queries at the router level so all callers inherit it automatically.
- **Using setTimeout/cron for auto-purge:** Use the lazy on-read pattern instead. No infrastructure to maintain.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation modal | Custom dialog from scratch | `AlertDialog` from `@/components/ui/alert-dialog` (Radix UI, already installed) | Already in codebase, accessible, focus-trapped |
| Role check in UI | Ad-hoc prop drilling | `useAuth()` from `@/lib/auth-context` → `orgRole === "org:admin"` | Standard pattern across the codebase |
| Audit trail entry | Custom INSERT | `createAuditLog(db, schema, {...})` from `audit/logger.ts` | Handles errors silently, is the established pattern |
| Dropdown menu | Custom dropdown | `DropdownMenu` from `@/components/ui/dropdown-menu` | Already used in user-menu.tsx |
| Date math for 30-day window | Manual timestamp arithmetic | `new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)` compared with Drizzle `lte()` | Simple enough to inline; no date library needed |

**Key insight:** This phase requires zero new UI primitives and zero new API infrastructure. Every primitive needed (AlertDialog, DropdownMenu, audit logger, CASL checks) is already installed and in use.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Filter Soft-Deleted Projects in Existing Queries
**What goes wrong:** After soft-delete lands, deleted projects still appear in the projects list, dashboard count, and getBySlug navigation.
**Why it happens:** The existing queries have no `deletedAt IS NULL` filter.
**How to avoid:** Modify `project.list`, `project.getById`, and `project.getBySlug` simultaneously with the soft-delete mutation. These are the three query entry points.
**Warning signs:** A just-deleted project still appears in the projects table during testing.

### Pitfall 2: Cascade Confusion — Child Records
**What goes wrong:** Restoring a soft-deleted project finds that its `projectTeamMembers`, `budgetLineItems`, `folders`, and other cascade-referenced children were NOT deleted (soft delete only marks the parent row).
**Why it happens:** The `projects` table has `onDelete: "cascade"` on most child tables — but only for hard deletes, not soft deletes. Soft delete just sets a flag on the parent; children remain intact.
**How to avoid:** This is actually correct behavior. Soft delete means children stay. Restore means set `deleted_at` back to NULL. All children are still there.
**Warning signs (false alarm):** Thinking children need to be re-created on restore — they don't.

### Pitfall 3: Blocking Check Not Comprehensive Enough
**What goes wrong:** The check only looks at `changeOrders` COUNT but misses `paymentApps` and `commitments`, so some blocked projects pass through.
**Why it happens:** Requirements say three financial record types: change orders, payment applications, committed costs (commitments table).
**How to avoid:** The `checkDeletable` procedure must run three COUNT queries in parallel (`Promise.all`) and collect all blocking reasons before returning.
**Warning signs:** A project with payment apps but no change orders can be deleted when it shouldn't be.

### Pitfall 4: columns.tsx Static Export Breaking the Factory Pattern
**What goes wrong:** The columns file exports `const columns` statically, but the table needs admin status to conditionally include the delete column.
**Why it happens:** Current `columns.tsx` has no way to accept runtime parameters.
**How to avoid:** Convert to `createColumns(isAdmin: boolean, onDelete: (projectId: string) => void): ColumnDef<Project>[]` factory. Update `projects-table.tsx` to call the factory and pass `isAdmin` + `onDelete` props. Also requires `ProjectsTable` to accept `isAdmin` and `onDeleteProject` props.
**Warning signs:** TypeScript errors when trying to pass admin state into the static export.

### Pitfall 5: Restored Project Not Showing Banner Persistently Enough
**What goes wrong:** The "deleted and restored" banner is dismissed on page navigation, so team members who didn't witness the deletion/restore never see it.
**Why it happens:** Banner state is local component state — it disappears on remount.
**How to avoid:** Store `restored_at` timestamp as a column on `projects`. Banner shows when `restored_at IS NOT NULL`. Dismissal writes `restored_at = NULL` back to the DB via a `acknowledgeRestore` mutation. Alternatively: a simpler approach is to show the banner whenever `restored_at` is present in the project data, and provide a dismiss button that calls the mutation. This way the banner survives page navigation.
**Warning signs:** QA can dismiss the banner by refreshing the page.

### Pitfall 6: Migration Must Handle Multiple Tenant Schemas
**What goes wrong:** Developer runs the migration on their local schema but forgets other tenants in staging/production.
**Why it happens:** The schema-per-tenant pattern means each company has its own tables. Migration must loop over all active tenants.
**How to avoid:** Follow the exact same migration pattern as `migrate-phase36.ts`: query `tenants WHERE status = 'active'`, loop, run `ALTER TABLE IF NOT EXISTS` inside a transaction per tenant. Use `ADD COLUMN IF NOT EXISTS` for idempotency.
**Warning signs:** Migration runs successfully on one schema but API errors on another tenant's data.

---

## Code Examples

### New Schema Columns (Drizzle + Migration)

```typescript
// Source: apps/api/src/db/schema/tenant.ts — add to projects table
deletedAt: timestamp("deleted_at", { withTimezone: true }), // NULL = not deleted
deletedBy: text("deleted_by"), // Clerk user ID of deleting admin
deletionReason: text("deletion_reason"), // Required reason from dialog
restoredAt: timestamp("restored_at", { withTimezone: true }), // NULL = not restored (or banner dismissed)
```

```sql
-- Source: migrate-phase36.ts pattern
ALTER TABLE "{schemaName}".projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON "{schemaName}".projects(deleted_at)
  WHERE deleted_at IS NOT NULL;
```

### checkDeletable tRPC Procedure

```typescript
// Source: project.ts router pattern
checkDeletable: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // RBAC: only org:admin
    if (ctx.orgRole !== "org:admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const { db, schema } = ctx.tenant!;
    const [project] = await db
      .select({ lifecyclePhase: schema.projects.lifecyclePhase })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, input.id), isNull(schema.projects.deletedAt)))
      .limit(1);

    if (!project) throw new TRPCError({ code: "NOT_FOUND" });

    const BLOCKED_PHASES = ["awarded", "active", "substantial_completion", "closed", "warranty"];
    const reasons: string[] = [];

    if (BLOCKED_PHASES.includes(project.lifecyclePhase)) {
      reasons.push(`Project is in "${LIFECYCLE_PHASE_LABELS[project.lifecyclePhase as LifecyclePhase]}" phase`);
    }

    // Parallel financial record counts
    const [coCount, payAppCount, commitmentCount] = await Promise.all([
      db.select({ count: count() }).from(schema.changeOrders)
        .where(eq(schema.changeOrders.projectId, input.id)),
      db.select({ count: count() }).from(schema.paymentApps)
        .where(eq(schema.paymentApps.projectId, input.id)),
      db.select({ count: count() }).from(schema.commitments)
        .where(eq(schema.commitments.projectId, input.id)),
    ]);

    const coNum = coCount[0]?.count ?? 0;
    const payNum = payAppCount[0]?.count ?? 0;
    const commitNum = commitmentCount[0]?.count ?? 0;

    if (coNum > 0) reasons.push(`${coNum} change order${coNum !== 1 ? "s" : ""}`);
    if (payNum > 0) reasons.push(`${payNum} payment application${payNum !== 1 ? "s" : ""}`);
    if (commitNum > 0) reasons.push(`${commitNum} commitment${commitNum !== 1 ? "s" : ""}`);

    return { canDelete: reasons.length === 0, reasons };
  }),
```

### softDelete tRPC Procedure

```typescript
// Source: project.archive pattern modified for soft-delete
softDelete: protectedProcedure
  .input(z.object({ id: z.string().uuid(), reason: z.string().min(1).max(2000) }))
  .mutation(async ({ ctx, input }) => {
    if (ctx.orgRole !== "org:admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const { db, schema } = ctx.tenant!;
    const now = new Date();

    await db
      .update(schema.projects)
      .set({
        deletedAt: now,
        deletedBy: ctx.userId!,
        deletionReason: input.reason,
        updatedAt: now,
      })
      .where(and(eq(schema.projects.id, input.id), isNull(schema.projects.deletedAt)));

    await createAuditLog(db, schema, {
      entityType: "Project",
      entityId: input.id,
      action: AuditAction.DELETE,
      actorId: ctx.userId!,
      changes: { deletion_reason: input.reason, deleted_at: now.toISOString() },
    });

    return { success: true };
  }),
```

### restore tRPC Procedure

```typescript
restore: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    if (ctx.orgRole !== "org:admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const { db, schema } = ctx.tenant!;
    const now = new Date();

    const [restored] = await db
      .update(schema.projects)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        updatedAt: now,
      })
      .where(isNotNull(schema.projects.deletedAt) && eq(schema.projects.id, input.id))
      .returning();

    await createAuditLog(db, schema, {
      entityType: "Project",
      entityId: input.id,
      action: AuditAction.UPDATE,
      actorId: ctx.userId!,
      changes: { restored_at: now.toISOString(), action: "restore" },
    });

    return restored;
  }),
```

### listDeleted with Lazy Purge

```typescript
listDeleted: protectedProcedure
  .query(async ({ ctx }) => {
    if (ctx.orgRole !== "org:admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const { db, schema } = ctx.tenant!;

    // Lazy purge: hard-delete anything older than 30 days
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db
      .delete(schema.projects)
      .where(and(isNotNull(schema.projects.deletedAt), lte(schema.projects.deletedAt, cutoff)));

    // Return remaining soft-deleted projects with deleting user name
    return db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        jobNumber: schema.projects.jobNumber,
        deletedAt: schema.projects.deletedAt,
        deletedBy: schema.projects.deletedBy,
        deletionReason: schema.projects.deletionReason,
        deleterFirstName: schema.userProfiles.firstName,
        deleterLastName: schema.userProfiles.lastName,
      })
      .from(schema.projects)
      .leftJoin(schema.userProfiles, eq(schema.projects.deletedBy, schema.userProfiles.clerkUserId))
      .where(isNotNull(schema.projects.deletedAt))
      .orderBy(desc(schema.projects.deletedAt));
  }),
```

### Blocking Dialog UI Pattern

The confirmation dialog pattern already exists in `lifecycle-phase-badge.tsx` using `AlertDialog`. The delete flow needs two dialogs: a blocking dialog (no user action required except "OK") and a confirmation dialog (with reason textarea).

```typescript
// Source: lifecycle-phase-badge.tsx pattern — adapt for delete
// Blocking modal (no dismiss target, just a close button):
<AlertDialog open={deleteState.status === "blocked"} onOpenChange={...}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cannot Delete Project</AlertDialogTitle>
      <AlertDialogDescription>
        This project cannot be deleted because:
      </AlertDialogDescription>
    </AlertDialogHeader>
    <ul className="text-sm space-y-1 my-2">
      {deleteState.reasons.map(r => <li key={r} className="flex gap-2"><span>•</span>{r}</li>)}
    </ul>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setDeleteState({ status: "idle" })}>Close</AlertDialogCancel>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

// Confirmation dialog:
<AlertDialog open={deleteState.status === "confirming"} onOpenChange={...}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Project?</AlertDialogTitle>
      <AlertDialogDescription>
        This will remove the project from your active projects.
        You can recover it within 30 days via Company Settings → Deleted Projects.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="my-2 space-y-2">
      <Label htmlFor="delete-reason">Reason for deletion <span className="text-destructive">*</span></Label>
      <Textarea
        id="delete-reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Why is this project being deleted?"
        rows={3}
      />
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        className={buttonVariants({ variant: "destructive" })}
        onClick={handleConfirmDelete}
        disabled={reason.trim() === "" || isDeleting}
      >
        {isDeleting ? "Deleting..." : "Delete Project"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hard delete immediately | Soft delete with 30-day window | Industry standard for SaaS — users expect undo |
| Cron job for purge | Lazy on-read purge | No infrastructure dependency; acceptable for low-frequency recovery pages |
| Alert dialog with project name re-entry | Reason-required text field | Faster UX, still captures intent; project name typing adds friction without security benefit |

---

## Open Questions

1. **acknowledgeRestore mutation — is it needed?**
   - What we know: The "restored and flagged with banner" requirement implies the banner persists across navigation.
   - What's unclear: Does the user need to explicitly dismiss it, or does it auto-clear after N days?
   - Recommendation: Store `restored_at` in the DB. Show banner when `restored_at IS NOT NULL`. Provide a dismiss button that calls a `acknowledgeRestore` mutation setting `restored_at = NULL`. This gives the team visibility and gives the admin control.

2. **Should the soft-delete filter be added to the `dashboard` router queries?**
   - What we know: The dashboard shows project counts and recent activity. If a project is soft-deleted, its metrics should not appear.
   - What's unclear: Which dashboard queries aggregate across projects.
   - Recommendation: During planning, review `apps/api/src/trpc/routers/dashboard.ts` and add `isNull(schema.projects.deletedAt)` to any project-joining query there.

3. **What happens to the project's slug after soft-delete?**
   - What we know: The project keeps its slug. The `getBySlug` query will have `isNull(deletedAt)` added, so navigating to the URL returns 404-like behavior.
   - What's unclear: Should the slug be freed for reuse (i.e., another project could take that slug)?
   - Recommendation: Do NOT free the slug. Keep it reserved on the soft-deleted row so the restore operation preserves the original URL. Hard-delete at 30 days releases it naturally.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `apps/api/src/db/schema/tenant.ts` — confirmed `projects` table structure, existing columns, FK relationships
- Direct codebase inspection: `apps/api/src/trpc/routers/project.ts` — confirmed existing procedure patterns, RBAC check pattern (`ctx.orgRole === "org:admin"`), audit log pattern
- Direct codebase inspection: `apps/api/src/audit/logger.ts` — confirmed `createAuditLog` signature and fire-and-forget semantics
- Direct codebase inspection: `apps/api/src/auth/abilities.ts` — confirmed `org:admin` has `can("manage", "all")` including `delete`
- Direct codebase inspection: `apps/web/components/ui/alert-dialog.tsx` — confirmed Radix UI AlertDialog is installed and available
- Direct codebase inspection: `apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx` — confirmed AlertDialog with Textarea + disabled-until-filled action button pattern
- Direct codebase inspection: `apps/web/lib/auth-context.tsx` — confirmed `useAuth()` returns `orgRole`
- Direct codebase inspection: `apps/web/lib/abilities.ts` — confirmed `useAbilities()` hook and `Can` component
- Direct codebase inspection: `apps/api/src/db/migrations/migrate-phase36.ts` — confirmed multi-tenant migration loop pattern

### Secondary (MEDIUM confidence)
- Pattern inference from `migrate-phase36.ts` for phase 37 migration structure — same SQL DDL pattern applies
- Pattern inference from `project.archive` mutation for `softDelete` mutation structure

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all tools confirmed in codebase
- Architecture: HIGH — patterns verified by direct code reading
- Schema changes: HIGH — `projects` table structure fully understood
- Migration pattern: HIGH — copied from phase 36 migration
- Auto-purge recommendation: MEDIUM — lazy on-read is a known pattern but not currently used in this codebase
- Pitfalls: HIGH — derived from actual code inspection, not speculation

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable stack, 30-day window is safe)
