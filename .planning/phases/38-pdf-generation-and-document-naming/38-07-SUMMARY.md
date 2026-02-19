---
phase: 38-pdf-generation-and-document-naming
plan: 07
subsystem: document-naming-ui
tags: [trpc, settings, pdf, document-naming, live-preview, admin]
dependency_graph:
  requires:
    - documentNamingSettings JSONB column on companyProfiles (38-01)
    - DocumentNamingSettings, PdfDocType, PDF_DOC_TYPES shared types (38-01)
    - requirePermission, withAuditLog middleware (existing)
  provides:
    - company.getDocumentNaming tRPC query
    - company.updateDocumentNaming tRPC mutation (admin-gated)
    - /settings/document-naming page with per-type inputs and live preview
    - Document Naming card on /settings landing page
  affects:
    - apps/api/src/trpc/routers/company.ts
    - apps/web/app/(dashboard)/settings/document-naming/page.tsx
    - apps/web/app/(dashboard)/settings/page.tsx
tech_stack:
  added: []
  patterns:
    - Simple UPDATE on current companyProfile row for JSONB-only config (no effective-dating needed)
    - useAbilities() canManage guard for admin-only mutation with read-only fallback
    - buildPreview() pure function for real-time filename preview with sample value substitution
    - Badge chips as click-to-insert variable pickers appending to input value
key_files:
  created:
    - apps/web/app/(dashboard)/settings/document-naming/page.tsx
  modified:
    - apps/api/src/trpc/routers/company.ts
    - apps/web/app/(dashboard)/settings/page.tsx
decisions:
  - updateDocumentNaming uses simple UPDATE on current companyProfile row (not effective-dating) because documentNamingSettings is a config-only JSONB column with no historical audit requirement
  - Only doc types with non-empty templates are sent in the settings payload — empty template = use platform default
  - buildPreview() appends ".pdf" suffix to every preview string unconditionally
  - Live preview falls back to default pattern ({DOC-TYPE}-{JOB-NUMBER}-{DATE}) when template input is empty
metrics:
  duration: ~4 min
  completed: 2026-02-19
  tasks_completed: 2
  files_created: 1
  files_modified: 2
---

# Phase 38 Plan 07: Document Naming Settings UI Summary

**One-liner:** Admin settings page at /settings/document-naming with per-doc-type naming template inputs, variable chip pickers, real-time filename preview, and company.getDocumentNaming/updateDocumentNaming tRPC procedures persisting to companyProfiles.documentNamingSettings JSONB.

## What Was Built

Two-task implementation of the Document Naming settings feature (NAME-01 through NAME-04):

1. **`company.getDocumentNaming` query** — returns `{ documentNamingSettings }` from the active companyProfile (null → `{}`). Used by the settings page to hydrate template inputs on load.

2. **`company.updateDocumentNaming` mutation** — admin-gated via `requirePermission("manage", "CompanySettings")` + `withAuditLog`. Accepts a `z.record(z.enum(PDF_DOC_TYPES), z.object({ template: z.string().max(200) }))` payload. Performs a simple `UPDATE ... SET { documentNamingSettings }` on the current active row (validTo IS NULL) — no new row insertion because this is a config-only JSONB field with no historical tracking requirement.

3. **`/settings/document-naming` page** — "use client" page with:
   - Load state: skeleton cards while `getDocumentNaming` query loads
   - 4 `DocTypeCard` components (Proposal, Change Order, Payment Application, RFQ), each with:
     - Text input for the naming template (placeholder: `{DOC-TYPE}-{JOB-NUMBER}-{DATE}`)
     - 7 variable chip badges: `{JOB-NUMBER}`, `{PROJECT-NAME}`, `{DOC-TYPE}`, `{SEQ}`, `{YEAR}`, `{MONTH}`, `{DATE}` — clicking appends the variable to the current input value
     - Live preview via `buildPreview()` — substitutes sample values in real time; empty template shows default pattern
   - Admin-only save button; non-admins see amber read-only banner with inputs disabled
   - `toast.success` / `toast.error` feedback on save

4. **Settings landing page** — added "Document Naming" card (FileText icon) pointing to `/settings/document-naming`, consistent with existing card grid layout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add company.getDocumentNaming and company.updateDocumentNaming | ee155cc | apps/api/src/trpc/routers/company.ts |
| 2 | Document naming settings page with live preview and settings nav link | 9f04178 | apps/web/app/(dashboard)/settings/document-naming/page.tsx, apps/web/app/(dashboard)/settings/page.tsx |

## Verification Results

- `apps/api npx tsc --noEmit`: Zero errors in modified files (all listed errors are pre-existing in bid.ts, customer.ts, quickbooks, bidGeneration.ts, etc.)
- `apps/web npx tsc --noEmit`: Zero errors in new/modified files (pre-existing errors in api/quickbooks, bidGeneration.ts, estimateLifecycle.ts)
- `grep "updateDocumentNaming|getDocumentNaming" company.ts`: Both procedures found (lines 173, 195)
- `grep "documentNamingSettings" company.ts`: Used in query return and mutation SET clause
- `/settings/document-naming/page.tsx` exists and confirmed
- `grep "updateDocumentNaming|getDocumentNaming" document-naming/page.tsx`: Both tRPC calls present (lines 151, 174)
- `grep "Preview|preview" document-naming/page.tsx`: Preview section present (lines 28, 51, 81, 132, 133)
- `grep "document-naming" settings/page.tsx`: Link present (line 100)
- Next.js build: pre-existing failure in `quickbooks/oauth.ts` (intuit-oauth type declaration missing) — unrelated to Plan 38-07 changes, present in prior plans

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/api/src/trpc/routers/company.ts | FOUND |
| apps/web/app/(dashboard)/settings/document-naming/page.tsx | FOUND |
| apps/web/app/(dashboard)/settings/page.tsx (modified) | FOUND |
| Commit ee155cc (Task 1) | FOUND |
| Commit 9f04178 (Task 2) | FOUND |
