---
plan: 40-04
phase: 40-document-system-redesign
status: complete
completed: 2026-02-21
---

# Summary: 40-04 — Prefetch Update + Human UAT

## What Was Built

Updated the documents tab prefetch to `document.listUnified` and completed human end-to-end UAT for Phase 40. Three UAT issues discovered and resolved inline.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Update project-tabs.tsx prefetch to `utils.document.listUnified.prefetch` | ✓ Complete |
| 2 | Human end-to-end UAT — all 5 DOC requirements + 7 test scenarios | ✓ Approved |

## Key Files Modified

- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` — prefetch updated
- `apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx` — added Upload button + DocumentUploader
- `apps/web/components/project/documents/document-filters.tsx` — removed empty-string SelectItem values (Radix UI constraint)
- `apps/web/components/project/documents/bulk-action-bar.tsx` — simplified to same-origin proxy fetch
- `apps/web/app/api/documents/bulk-download/route.ts` — new Next.js proxy route (eliminates CORS)
- `apps/api/src/server.ts` — S3 GetObject wrapped in try-catch for graceful skip

## UAT Issues Found and Fixed

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Filter panel error | Radix UI disallows `<SelectItem value="">` — was used for "All X" options | Removed empty-string SelectItems; placeholder handles no-selection display |
| Missing upload button | DocumentUploader component existed but was never added to the documents page | Added Upload toggle button + inline DocumentUploader in page.tsx |
| Bulk download "Failed to fetch" | Browser CORS blocks direct cross-origin POST to port 3001 | Created Next.js API proxy route at `/api/documents/bulk-download`; auth handled server-side |

## Deviations from Plan

- Three UAT fixes applied inline per Rule 1 (fix blocking issues during UAT rather than deferring)
- Bulk download previously called Fastify directly from browser; now proxied through Next.js (consistent with tRPC pattern)

## Self-Check: PASSED

- ✓ TypeScript: zero errors in all Phase 40 files
- ✓ `project-tabs.tsx` uses `utils.document.listUnified.prefetch`
- ✓ Human UAT approved all 7 checks (DOC-01 through DOC-05 + overflow menu + bulk ops)
