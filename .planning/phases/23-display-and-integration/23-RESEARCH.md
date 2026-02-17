# Phase 23: Display & Integration - Research

**Researched:** 2026-02-16
**Domain:** Frontend React/Next.js UI — job number display across project touchpoints
**Confidence:** HIGH

---

## Summary

Phase 23 requires job numbers to appear prominently at four touchpoints: project list/table, project detail header, project card view, and estimate-to-project conversion. After a thorough codebase audit, **two of the four requirements are already fully implemented** and the third is technically N/A in the current UI.

JOBDISP-01 (table column) and JOBDISP-02 (detail header) were implemented in an earlier phase. The `columns.tsx` file already has `jobNumber` as its first column, the `project.list` API already returns `jobNumber`, and `project-header.tsx` already renders `{jobNumber}-{name}` in the heading. No code changes are needed for these two requirements.

JOBDISP-03 (card view) is N/A — the project list page has no card view, only a table view. If the requirement is interpreted as requiring a card view to be built and populated with job number, that is out of scope for Phase 23 per the requirement wording ("if card view exists").

JOBDISP-04 (estimates-to-projects carry-through) requires verification. The conversion service does not clear `jobNumber`, so the project retains its number. What is missing is **visible confirmation** in the estimate UI: the estimate detail page and workflow page do not show the project's job number, so users cannot confirm the number carried through. Displaying job number in the estimate detail context closes this gap.

**Primary recommendation:** Phase 23 is a verification and light-fill phase. Confirm JOBDISP-01/02 are working in the live app; add job number display to the estimate detail page header for JOBDISP-04; document JOBDISP-03 as N/A.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| JOBDISP-01 | Job numbers appear as a visible column in the project list/table view | Already implemented in `columns.tsx`; `project.list` API returns `jobNumber`; column renders as `font-mono text-sm` with `"--"` fallback |
| JOBDISP-02 | Job number displays prominently in project detail page header (alongside or near project name) | Already implemented in `project-header.tsx` as `{jobNumber}-{name}` format; passed via `layout.tsx` |
| JOBDISP-03 | Job numbers display on project cards in card view (if card view exists) | Card view does not exist; project list is table-only; requirement is gated "if card view exists" — N/A |
| JOBDISP-04 | Job numbers carry through from estimates to converted projects | Conversion service preserves `jobNumber` on project; estimate slug uses project `jobNumber`; visible confirmation needed in estimate UI |
</phase_requirements>

---

## Standard Stack

### Core (existing — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Table v8 | `@tanstack/react-table` | Project list table with column definitions | Already in use for `projects-table.tsx` |
| Next.js 14 | `next` | App router, layouts, pages | Project framework |
| shadcn/ui | `@/components/ui/*` | Badge, Card, Table primitives | Already installed |
| tRPC React Query | `@trpc/react-query` | `trpc.project.getBySlug.useQuery()`, `trpc.estimates.getBySlug.useQuery()` | Already in use |
| Tailwind CSS | - | Styling utility classes | Already in use |

No new packages required. All needed libraries are already installed.

---

## Architecture Patterns

### Existing Project Structure (already working)
```
apps/web/app/(dashboard)/projects/
├── page.tsx                          # Uses ProjectsTable
├── components/
│   ├── columns.tsx                   # ColumnDef[] — jobNumber column ALREADY HERE
│   └── projects-table.tsx            # Renders TanStack table with columns
└── [projectSlug]/
    ├── layout.tsx                    # Fetches project, renders ProjectHeader + ProjectTabs
    ├── components/
    │   └── project-header.tsx        # jobNumber ALREADY rendered here
    └── estimates/
        └── [estimateSlug]/
            ├── page.tsx              # Estimate detail — no job number shown
            └── workflow/page.tsx     # Estimate workflow — no job number shown
```

### Pattern 1: Layout-Level Data Fetching
**What:** The `[projectSlug]/layout.tsx` fetches the project via `trpc.project.getBySlug` once and passes data to `ProjectHeader`. All sub-pages re-use this cached query.
**When to use:** Any project-level data (including `jobNumber`) should come from this single cached query.
**Example:**
```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
// project.jobNumber is available to all sub-components
```

### Pattern 2: Already-Done Column Definition
**What:** `columns.tsx` already defines `jobNumber` as the first `ColumnDef`.
**Example:**
```typescript
// Source: apps/web/app/(dashboard)/projects/components/columns.tsx line 28-40
{
  accessorKey: "jobNumber",
  header: "Job #",
  size: 100,
  cell: ({ row }) => {
    const jobNumber = row.getValue("jobNumber") as string | null;
    return (
      <div className="font-mono text-sm">
        {jobNumber || "--"}
      </div>
    );
  },
},
```

### Pattern 3: Header Already Renders Job Number
**What:** `project-header.tsx` already formats the heading as `{jobNumber}-{name}`.
**Example:**
```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx line 87-89
<h1 className="text-xl font-semibold">
  {project.jobNumber ? `${project.jobNumber}-${project.name}` : project.name}
</h1>
```

### Pattern 4: Estimate Detail Context (gap for JOBDISP-04)
**What:** The estimate detail page (`/projects/[slug]/estimates/[estimateSlug]/page.tsx`) loads the estimate via `trpc.estimates.getBySlug` and the project via `trpc.project.getBySlug`. The project header is in the layout above. Job number is already visible in the parent layout — the estimate detail is rendered *inside* the project layout, so the project header (with job number) is always visible above estimate content.
**Implication:** JOBDISP-04 may already be satisfied by the project layout header. Verification task needed to confirm.

### Anti-Patterns to Avoid
- **Fetching project data again in sub-pages for job number**: The project is already fetched in `layout.tsx` and cached by React Query. Sub-pages should use `trpc.project.getBySlug.useQuery()` (React Query deduplication serves the cache) rather than making a separate API call.
- **Hard-coding job number format in multiple places**: The format `{jobNumber}-{name}` is defined in `project-header.tsx`. If displayed elsewhere, use the same conditional pattern.
- **Adding a card view in Phase 23**: JOBDISP-03 is explicitly gated "if card view exists" — do not build a card view to satisfy this requirement.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column display | Custom table component | Existing `@tanstack/react-table` + `columns.tsx` | Already fully implemented |
| Job number fallback | Custom null-check logic | The existing `{jobNumber \|\| "--"}` pattern | Consistent with all existing columns |
| Project data in estimate pages | Separate API fetch | `trpc.project.getBySlug.useQuery({ slug: projectSlug })` (React Query cache hit) | Already in use on estimate list page |

---

## Common Pitfalls

### Pitfall 1: ProjectStatus Type Missing "bidding"
**What goes wrong:** The DB schema has `status` values including `bidding` (added by the estimate lifecycle flow via `submitEstimate` mutation). The shared `ProjectStatus` type only covers `active | on_hold | completed | archived`. The `statusColors` map in `project-header.tsx` uses `Record<ProjectStatus, string>` — a project in `bidding` status would cause a TypeScript error or runtime undefined color.
**Why it happens:** `bidding` was added to the DB schema but not synchronized to the shared type definition.
**How to avoid:** Before assuming status rendering works, check if `bidding` status projects crash the header. The fix is adding `bidding` to `projectStatusEnum` in `packages/shared/src/types/project.ts` and a corresponding color entry — but this is out of scope for Phase 23 unless encountered.
**Warning signs:** `statusColors[project.status]` returns `undefined` for bidding projects.

### Pitfall 2: Columns Interface Out of Sync
**What goes wrong:** `projects-table.tsx` has its own local `interface Project` (lines 26-33) that must include `jobNumber`. It does (already). If anyone changes this interface and removes `jobNumber`, the column would not render.
**Why it happens:** The column type interface is duplicated between `columns.tsx` and `projects-table.tsx`.
**How to avoid:** Verify both interfaces match before declaring JOBDISP-01 done.

### Pitfall 3: Search Does Not Cover Job Number
**What goes wrong:** The `project.list` search filter (router lines 284-292) only searches `name`, `street1`, `city`, and `state` — not `job_number`. Users cannot find a project by typing its job number in the search box.
**Why it happens:** Job number was added to the column display but not to the search filter.
**How to avoid:** This is not a requirement in Phase 23 (JOBDISP-01 only says "visible column"), but it is a likely follow-on bug report. Flag as a known gap.

### Pitfall 4: Estimate Conversion Clears Nothing — But Verify
**What goes wrong:** The `convertEstimateToProject` service updates `project.status` to `active` and `project.budget` to the total cost — it does NOT touch `jobNumber`. So the job number persists after conversion. However if a project was created without a job number (auto-generation disabled, manual entry skipped), it will have `null` job number before and after conversion.
**Why it happens:** Job numbers are optional on project creation.
**How to avoid:** JOBDISP-04 is satisfied as long as the job number display in the project header reflects the pre-conversion value. No code change needed in the conversion service. Display verification sufficient.

---

## Code Examples

Verified patterns from codebase:

### How jobNumber is already displayed in list (JOBDISP-01 — complete)
```typescript
// Source: apps/web/app/(dashboard)/projects/components/columns.tsx
{
  accessorKey: "jobNumber",
  header: "Job #",
  size: 100,
  cell: ({ row }) => {
    const jobNumber = row.getValue("jobNumber") as string | null;
    return <div className="font-mono text-sm">{jobNumber || "--"}</div>;
  },
},
```

### How jobNumber is already displayed in detail header (JOBDISP-02 — complete)
```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
<h1 className="text-xl font-semibold">
  {project.jobNumber ? `${project.jobNumber}-${project.name}` : project.name}
</h1>
```

### How layout passes jobNumber to header (already working)
```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
<ProjectHeader
  project={{
    id: project.id,
    jobNumber: project.jobNumber,   // passed through from getBySlug
    name: project.name,
    // ...
  }}
/>
```

### How API returns jobNumber in list query (already working)
```typescript
// Source: apps/api/src/trpc/routers/project.ts — list procedure
db.select({
  id: schema.projects.id,
  name: schema.projects.name,
  jobNumber: schema.projects.jobNumber,  // included
  // ...
})
```

### How estimate detail page loads project context (JOBDISP-04 verification)
```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx
// The page is rendered inside [projectSlug]/layout.tsx
// That layout renders ProjectHeader which already shows jobNumber
// So job number IS visible on estimate detail pages via the layout header
```

### How estimate slug uses project job number
```typescript
// Source: apps/api/src/trpc/routers/estimates.ts — create procedure
const identifier = project.jobNumber
  ? `est-${project.jobNumber}`
  : `est-${estimate.id.slice(0, 8)}`;
const finalSlug = generateSlug(identifier, input.name);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No job number in UI | `jobNumber` in DB, list column, and header | Phase 21/22 | Infrastructure complete |
| No auto-generation | Auto-generation on project.create from company settings | Phase 21 | Job numbers now assigned automatically |
| No estimate slug | Estimate slug prefixed with project job number | Phase 17-18 | Estimates traceable to projects |

**No deprecated patterns for Phase 23.** All existing patterns are current.

---

## Open Questions

1. **Is JOBDISP-04 already satisfied?**
   - What we know: The estimate detail and workflow pages render inside `[projectSlug]/layout.tsx`, which always shows `ProjectHeader` with job number at the top.
   - What's unclear: Whether the requirement means "job number visible on estimate pages" (already true via layout header) or "job number explicitly shown in the estimate card/section itself."
   - Recommendation: Treat as satisfied (layout header provides the display). Verification task should screenshot the estimate detail page and confirm job number is visible.

2. **Does JOBDISP-03 need any work?**
   - What we know: No card view exists. The requirement says "if card view exists."
   - What's unclear: Whether Phase 23 is expected to build a card view.
   - Recommendation: Mark JOBDISP-03 as N/A; document this decision in the plan. No card view exists, requirement is conditionally gated, no work needed.

3. **Is job number search needed?**
   - What we know: The search filter in `project.list` does not include `job_number` in the `LIKE` conditions.
   - What's unclear: Whether this is a blocking gap for Phase 23.
   - Recommendation: Out of scope for Phase 23 (no requirement for search). Flag as a follow-on improvement.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `apps/web/app/(dashboard)/projects/components/columns.tsx` — JOBDISP-01 status
- Direct codebase inspection — `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — JOBDISP-02 status
- Direct codebase inspection — `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` — how header receives data
- Direct codebase inspection — `apps/api/src/trpc/routers/project.ts` — list/getBySlug return shapes
- Direct codebase inspection — `apps/api/src/services/projectConversion.ts` — conversion does not touch jobNumber
- Direct codebase inspection — `apps/api/src/trpc/routers/estimates.ts` — estimate create uses project jobNumber for slug
- Direct codebase inspection — `packages/shared/src/types/project.ts` — `listProjectsSchema`, `ProjectStatus` type

### Secondary (MEDIUM confidence)
- N/A — all findings from direct code inspection

---

## Metadata

**Confidence breakdown:**
- JOBDISP-01 status (already done): HIGH — read the actual column definition file
- JOBDISP-02 status (already done): HIGH — read the actual header component
- JOBDISP-03 status (N/A): HIGH — confirmed no card view exists anywhere in the project list UI
- JOBDISP-04 status (verify + minor gap): MEDIUM — layout header provides display; need human verification that it renders correctly in the live app
- Pitfall: bidding status type gap: HIGH — confirmed by reading both DB schema and shared type

**Research date:** 2026-02-16
**Valid until:** 2026-03-18 (30 days; codebase is stable)
