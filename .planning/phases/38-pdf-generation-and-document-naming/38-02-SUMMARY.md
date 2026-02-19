---
phase: 38-pdf-generation-and-document-naming
plan: 02
subsystem: pdf-infrastructure
tags: [pdf, puppeteer, s3, trpc, document-library, singleton]
dependency_graph:
  requires:
    - documentNamingCounters table (38-01)
    - documentNamingSettings JSONB column (38-01)
    - PdfDocType, DocumentNamingSettings shared types (38-01)
    - apps/api/src/storage/client.ts (getStorageClient, getBucketName, buildStorageKey)
  provides:
    - getBrowser() singleton (apps/api/src/pdf/engine.ts)
    - generatePdfBuffer(html) (apps/api/src/pdf/engine.ts)
    - getCompanyBranding(db, tenantId) (apps/api/src/pdf/generate.ts)
    - getNextDocumentSequence(db, schema, docType) (apps/api/src/pdf/generate.ts)
    - resolveFileName(settings, docType, jobNumber, projectName, seq) (apps/api/src/pdf/generate.ts)
    - uploadPdfAndSave(params) (apps/api/src/pdf/generate.ts)
    - pdfRouter shell (apps/api/src/trpc/routers/pdf.ts)
    - pdf: pdfRouter registered in appRouter (apps/api/src/trpc/router.ts)
  affects:
    - apps/api/src/trpc/router.ts
    - plans 38-03 through 38-06 (call all utilities from this plan)
tech_stack:
  added:
    - puppeteer (already in package.json — no new install needed)
    - @aws-sdk/client-s3 PutObjectCommand (already in package.json)
  patterns:
    - Singleton browser pattern (module-level _browser variable, re-checked on connected)
    - SELECT FOR UPDATE inside db.transaction for atomic counter increment
    - documents + document_versions two-table insert with currentVersionId back-pointer
    - Pure function template variable substitution for file naming
key_files:
  created:
    - apps/api/src/pdf/engine.ts
    - apps/api/src/pdf/generate.ts
    - apps/api/src/trpc/routers/pdf.ts
  modified:
    - apps/api/src/trpc/router.ts
decisions:
  - getCompanyBranding returns primaryColor "#3B5BDB" hardcoded in Phase 38; company logo embedding deferred to Phase 39 (PDF-05 partial satisfaction)
  - getNextDocumentSequence uses docType-only counter (no projectId) matching the company-scoped documentNamingCounters table design from 38-01
  - resolveFileName is a pure function (no I/O) — sequence is obtained by the caller via getNextDocumentSequence before calling resolveFileName
  - pdfRouter shell exports getStatus smoke-test procedure; real procedures added by plans 38-03 through 38-06
metrics:
  duration: ~3 min
  completed: 2026-02-19
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 38 Plan 02: PDF Engine and Shared Utilities Summary

**One-liner:** Puppeteer singleton browser, generatePdfBuffer, S3 upload + document library insert helper, atomic sequence counter with SELECT FOR UPDATE, company branding helper, and an empty pdf tRPC router shell registered in the app router.

## What Was Built

Implemented the reusable PDF generation infrastructure that all four document-type plans (38-03 through 38-06) will call:

1. **`apps/api/src/pdf/engine.ts`** — Puppeteer singleton browser management:
   - `getBrowser()` — lazily launches one Puppeteer browser and reuses it across requests; relaunches automatically if the browser crashes (`!browser.connected`)
   - `generatePdfBuffer(html)` — sets page content, generates Letter-format PDF with 0.75in margins, returns Buffer; **always closes the page in a `finally` block** to prevent orphaned Chrome tabs accumulating memory

2. **`apps/api/src/pdf/generate.ts`** — Four shared utilities:
   - `getCompanyBranding(db, tenantId)` — queries `public.tenants` for company name, returns `{ companyName, primaryColor: "#3B5BDB" }`. BIDAXIOM brand color hardcoded for Phase 38; logo embedding deferred to Phase 39 (PDF-05 partial)
   - `getNextDocumentSequence(db, schema, docType)` — uses `db.transaction` with `.for("update")` on `schema.documentNamingCounters` for race-free atomic increments; inserts counter row on first use, otherwise increments and returns new number
   - `resolveFileName(settings, docType, jobNumber, projectName, seq)` — pure function; looks up template from `DocumentNamingSettings` (null → default `"{DOC-TYPE}-{JOB-NUMBER}-{DATE}"`); replaces `{JOB-NUMBER}`, `{PROJECT-NAME}`, `{DOC-TYPE}`, `{SEQ}`, `{YEAR}`, `{MONTH}`, `{DATE}`; appends `.pdf` if missing
   - `uploadPdfAndSave(params)` — uploads PDF buffer via `PutObjectCommand` to S3, inserts into `schema.documents`, inserts version 1 into `schema.documentVersions`, back-fills `currentVersionId`, returns `{ documentId, storageKey, fileName }`

3. **`apps/api/src/trpc/routers/pdf.ts`** — Shell router with a `getStatus` smoke-test procedure returning `{ ok: true }`. Real procedures added in plans 38-03 through 38-06.

4. **`apps/api/src/trpc/router.ts`** — Import and registration of `pdfRouter` as `pdf: pdfRouter` in `appRouter`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create PDF engine and shared generation utilities | 24a4705 | apps/api/src/pdf/engine.ts, apps/api/src/pdf/generate.ts |
| 2 | Create pdf tRPC router shell and register in app router | 73d5515 | apps/api/src/trpc/routers/pdf.ts, apps/api/src/trpc/router.ts |

## Verification Results

- `apps/api npx tsc --noEmit`: Zero errors in new files (all existing errors are pre-existing in bid.ts, customer.ts, quickbooks, etc.)
- `apps/api/src/pdf/engine.ts` exists
- `apps/api/src/pdf/generate.ts` exists
- `apps/api/src/trpc/routers/pdf.ts` exists
- `grep "finally"` in engine.ts: PASS — finally block with page.close() confirmed
- `grep ".for("` in generate.ts: PASS — SELECT FOR UPDATE pattern confirmed
- `grep "getCompanyBranding"` in generate.ts: PASS
- `grep "#3B5BDB"` in generate.ts: PASS — brand color confirmed
- `grep "pdfRouter"` in router.ts: PASS — import and registration confirmed
- `grep "pdf:"` in router.ts: PASS — `pdf: pdfRouter,` confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/api/src/pdf/engine.ts | FOUND |
| apps/api/src/pdf/generate.ts | FOUND |
| apps/api/src/trpc/routers/pdf.ts | FOUND |
| apps/api/src/trpc/router.ts (modified) | FOUND |
| Commit 24a4705 (Task 1) | FOUND |
| Commit 73d5515 (Task 2) | FOUND |
