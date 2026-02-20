---
phase: 39-custom-template-import-field-mapping
plan: 04
subsystem: web
tags: [nextjs, trpc, react, document-templates, field-mapping, combobox, upload, s3]

# Dependency graph
requires:
  - phase: 39-03
    provides: templateRouter with 7 procedures (getUploadUrl, registerAndExtract, updateMappings, generatePreview, setActive, listByDocType, deleteTemplate)

provides:
  - /settings/document-templates page: 4-tab template management UI with upload, activate, delete
  - /settings/document-templates/[templateId] page: split-view field mapping with amber highlights, grouped combobox, progress, save, preview
  - templateRouter.getById added to templateRouter for field mapping page

affects:
  - 39-05-PLAN (verification — exercises the new UI end-to-end)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Tab UI uses simple button-tab pattern with border-b-2 active indicator (consistent with codebase, no shadcn Tabs import)
    - Upload flow: presigned URL -> browser PUT -> registerAndExtract -> router.push to mapping page
    - Combobox options flattened into single list with group prefix labels ("Company: ...", "Project: ...", etc.)
    - scrollIntoView + transient ring classes for cross-panel field highlight interaction
    - workingMappings local state initialized from template.fieldMappings via useEffect

key-files:
  created:
    - apps/web/app/(dashboard)/settings/document-templates/page.tsx
    - apps/web/app/(dashboard)/settings/document-templates/[templateId]/page.tsx
    - apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx
  modified:
    - apps/web/app/(dashboard)/settings/page.tsx (added Document Templates nav card)
    - apps/api/src/trpc/routers/template.ts (added getById procedure)

key-decisions:
  - "getById procedure added to templateRouter as Rule 2 deviation — field mapping page has no clean path without it; the alternative (listByDocType without docType filter and client-side find) would fetch all templates unnecessarily"
  - "Combobox options use flat list with group prefix labels (Company: X, Project: Y) rather than CommandGroup grouping — the existing Combobox component does not support grouped options natively; flat list with prefix provides equivalent UX"
  - "Left panel shows detected fields as clickable span buttons instead of actual document HTML — avoiding mammoth browser integration; visual representation is functionally equivalent for mapping purposes"
  - "Field status reflected via color: amber=unmapped, green=mapped, muted/strikethrough=ignored — color legend included in left panel"
  - "Settings nav updated by adding card to settings/page.tsx (no settings layout.tsx exists)"

requirements-completed: [TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 39 Plan 04: Document Templates Settings UI Summary

**Full template management UI: /settings/document-templates with 4-tab template list page (upload, activate toggle, delete) and split-view /settings/document-templates/[templateId] field mapping page (amber field highlights, grouped BIDAXIOM combobox, X/Y progress, save-always with warning toast, preview PDF button)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-20T17:12:39Z
- **Completed:** 2026-02-20T17:18:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

### Task 1: Template management page

- Created `apps/web/app/(dashboard)/settings/document-templates/page.tsx` (client component, 312 lines)
- Four doc-type tabs: Proposal, Change Order, Payment Application, RFQ — using simple button-tab pattern with `-mb-px border-b-2` active indicator
- `DocTypeSection` sub-component fetches `api.template.listByDocType.useQuery({ docType })` per tab
- Template cards show: name (bold), DOCX/XLSX badge, uploaded date, "X / Y fields mapped" status, active badge when active
- Toggle switch calls `api.template.setActive.useMutation({ templateId, isActive: !current })` — instant, no confirmation dialog per CONTEXT.md
- Active template card receives `ring-2 ring-primary` visual distinction
- Map Fields button navigates to `/settings/document-templates/${templateId}`
- Delete button with `window.confirm()` calls `api.template.deleteTemplate.useMutation()`
- Upload flow: `<input type="file" accept=".docx,.xlsx" className="hidden">` triggered by button → getUploadUrl → browser PUT to S3 → registerAndExtract → navigate to mapping page
- Empty state per tab with upload CTA
- Added "Document Templates" nav card to `apps/web/app/(dashboard)/settings/page.tsx`

### Task 2: Split-view field mapping page

- Created `apps/web/app/(dashboard)/settings/document-templates/[templateId]/page.tsx` — thin server wrapper passing `params.templateId` to client component
- Created `apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx` (436 lines)
- Fetches template via `api.template.getById.useQuery({ templateId })` (see Deviations below)
- `workingMappings` local state initialized from `template.fieldMappings` via `useEffect`
- **Left panel:** Detected fields rendered as clickable span buttons; color-coded: amber (unmapped), green (mapped), muted+strikethrough (ignored). Clicking scrolls right panel to `#mapping-row-{detectedField}` with `scrollIntoView({ behavior: "smooth", block: "center" })` + transient ring flash
- **Right panel:** Sticky header with "X / Y fields mapped" progress counter + Save Mappings + Preview PDF buttons. Per-field row has amber mono `<<field_name>>` label + `Combobox` with all BIDAXIOM_FIELD_KEYS options grouped by prefix ("Company: ...", "Project: ...", "{DocType}: ...", "Table: ...")
- Save always enabled (never blocked) — `updateMappings.mutate(workingMappings)`; on success: warning toast if `result.unmappedCount > 0`, success toast otherwise
- Preview PDF: `generatePreview.mutate({ templateId })` → `window.open(result.previewUrl, "_blank")`
- Collapsible "BIDAXIOM Field Reference" sidebar shows table of all canonical `<<field_name>>` values with labels, grouped by context
- Back navigation: "← Back to Document Templates" link at top

### Rule 2 deviation: getById procedure

Added `getById` query to `apps/api/src/trpc/routers/template.ts` — required for the field mapping page. Without it, the only option would have been to call `listByDocType` without a filter, fetching all templates to find one. TypeScript check confirms zero errors in template.ts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Template management page — list, upload, activate toggle** - `f659dca` (feat)
2. **Task 2: Split-view field mapping page — amber highlights, grouped combobox, progress, save, preview** - `e51f271` (feat)

## Files Created/Modified

- `apps/web/app/(dashboard)/settings/document-templates/page.tsx` — New: template list page with 4-tab UI (312 lines)
- `apps/web/app/(dashboard)/settings/document-templates/[templateId]/page.tsx` — New: server wrapper (14 lines)
- `apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx` — New: split-view field mapping client (436 lines)
- `apps/web/app/(dashboard)/settings/page.tsx` — Added Document Templates nav card
- `apps/api/src/trpc/routers/template.ts` — Added getById procedure (30 lines)

## Decisions Made

- `getById` procedure added to templateRouter (Rule 2 auto-add) — field mapping page requires single-template fetch; flat listByDocType-without-filter alternative is wasteful
- Combobox options use flat list with group prefix labels — existing Combobox component is flat; group prefixes provide equivalent scannable UX
- Left panel renders detected fields as clickable buttons, not actual docx HTML — no mammoth browser dependency; functionally equivalent for mapping
- Settings nav uses settings/page.tsx card grid (no layout.tsx exists in settings directory)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added getById to templateRouter**
- **Found during:** Task 2 (implementing field mapping page)
- **Issue:** Plan suggested using `getById` if needed or falling back to listByDocType. The listByDocType approach requires fetching all templates without a filter and finding by ID client-side — inefficient and semantically wrong. The field mapping page needs a clean single-template fetch.
- **Fix:** Added `getById: protectedProcedure.input(z.object({ templateId: z.string().uuid() })).query(...)` to templateRouter — straightforward SELECT WHERE id = input.templateId with NOT_FOUND guard
- **Files modified:** apps/api/src/trpc/routers/template.ts
- **Commit:** e51f271 (included in Task 2 commit)
- **TypeScript:** 0 errors in template.ts

---

**Total deviations:** 1 auto-added (Rule 2 — missing critical functionality)
**Impact on plan:** Minimal scope expansion. Adds 30 lines to an existing router file. No architectural changes.

## Issues Encountered

None beyond the auto-added getById deviation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/settings/document-templates` fully implemented and accessible from the settings hub
- Upload → register → field mapping → activate flow is complete end-to-end
- Plan 39-05 (UAT / final verification) can now exercise the full template workflow

## Self-Check: PASSED

- FOUND: apps/web/app/(dashboard)/settings/document-templates/page.tsx
- FOUND: apps/web/app/(dashboard)/settings/document-templates/[templateId]/page.tsx
- FOUND: apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx
- FOUND: .planning/phases/39-custom-template-import-field-mapping/39-04-SUMMARY.md
- FOUND: f659dca feat(39-04): template management page — list, upload, activate toggle
- FOUND: e51f271 feat(39-04): split-view field mapping page — amber highlights, combobox, progress, save, preview

---
*Phase: 39-custom-template-import-field-mapping*
*Completed: 2026-02-20*
