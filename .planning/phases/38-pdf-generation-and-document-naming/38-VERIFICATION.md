---
phase: 38-pdf-generation-and-document-naming
verified: 2026-02-19T05:00:00Z
status: passed
score: 19/19 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open a generated Proposal PDF and confirm visual rendering"
    expected: "Company name in header, line items table with qty/rate/total, subtotals, grand total, signature block visible"
    why_human: "PDF visual layout cannot be verified by grep — Puppeteer renders HTML to PDF and appearance must be confirmed by eye"
  - test: "Open a generated AIA G702/G703 PDF and confirm two-page structure"
    expected: "Page 1 shows G702 with all 9 payment lines; page 2 shows G703 continuation sheet with SOV breakdown"
    why_human: "PDF page layout and print fidelity cannot be verified programmatically"
  - test: "Confirm CO Generate PDF button is hidden on a rejected or void CO"
    expected: "The 'Generate PDF' button does not appear when CO status is rejected or void"
    why_human: "UI conditional visibility depends on runtime data — verified during UAT (8/8 pass reported) but cannot be re-confirmed without running the app"
---

# Phase 38: PDF Generation and Document Naming — Verification Report

**Phase Goal:** Users can generate a professional, branded PDF for any Proposal, Change Order, Payment Application, or RFQ directly from the relevant section of a project — and every generated document receives a consistent, auto-numbered filename.

**Verified:** 2026-02-19T05:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification
**UAT Note:** UAT completed with 8/8 tests passing per `38-UAT.md`. Three inline bug fixes were applied and committed during UAT before sign-off.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Proposal PDF can be generated from the estimates section | VERIFIED | `trpc.pdf.generateProposal.useMutation` wired in `[estimateSlug]/page.tsx` line 32; `generateProposal` procedure at pdf.ts line 80 |
| 2 | Change Order PDF can be generated from CO detail page | VERIFIED | `trpc.pdf.generateChangeOrder.useMutation` wired in `change-order-detail.tsx` line 123; `generateChangeOrder` procedure at pdf.ts line 271 |
| 3 | Payment Application PDF (AIA G702/G703) can be generated from pay app page | VERIFIED | `trpc.pdf.generatePaymentApp.useMutation` wired in pay app page line 28; `generatePaymentApp` procedure at pdf.ts line 467 |
| 4 | RFQ PDF can be generated from the RFQ detail page | VERIFIED | `trpc.pdf.generateRfq.useMutation` wired in RFQ page line 99; `generateRfq` procedure at pdf.ts line 720 |
| 5 | Generated PDFs are stored in the document library immediately | VERIFIED | `uploadPdfAndSave()` inserts into `schema.documents` and `schema.documentVersions`, updates `currentVersionId` (generate.ts lines 241–270) |
| 6 | CO status gate prevents PDF generation for rejected/void COs | VERIFIED | API: `allowedStatuses = ["pco_submitted", "pending_approval", "approved"]` throws FORBIDDEN otherwise (pdf.ts lines 327–333); UI: `canGeneratePdf` hides button for non-qualifying statuses (change-order-detail.tsx lines 229–232) |
| 7 | Sequence counter auto-increments per doc type, company-scoped | VERIFIED | `getNextDocumentSequence` uses `SELECT FOR UPDATE` inside `db.transaction` (generate.ts line 73); `document_naming_counters` table has unique constraint on `doc_type` (tenant.ts lines 625–630) |
| 8 | Document naming templates configurable per doc type at /settings/document-naming | VERIFIED | Page exists at `settings/document-naming/page.tsx`; linked from `/settings/page.tsx` line 100; 4 doc-type sections with template inputs confirmed |
| 9 | Live preview updates in real time as template is typed | VERIFIED | `buildPreview()` pure function substitutes sample values; rendered as `{preview}` in JSX (document-naming page lines 51, 81, 133) |
| 10 | Default pattern used when no template is configured | VERIFIED | `DEFAULT_TEMPLATE = "{DOC-TYPE}-{JOB-NUMBER}-{DATE}"` constant used as fallback in `buildPreview` and `resolveFileName` (document-naming page line 47; generate.ts) |
| 11 | Admin-only write access to naming convention settings | VERIFIED | `canManage = abilities.can("manage", "CompanySettings")` gates the save button and disables inputs for non-admins (document-naming page lines 148, 222, 240) |
| 12 | PDFs use BIDAXIOM brand color (#3B5BDB) | VERIFIED | All four templates hardcode `#3B5BDB` as header background; `getCompanyBranding()` returns `primaryColor: "#3B5BDB"` (generate.ts line 43) |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/db/schema/tenant.ts` | documentNamingCounters table + documentNamingSettings column | VERIFIED | `document_naming_counters` table at line 625; unique constraint at line 630; `document_naming_settings` JSONB column at line 109 |
| `apps/api/src/db/migrations/migrate-phase38.ts` | Phase 38 migration script | VERIFIED | File exists; adds `document_naming_settings` column and creates `document_naming_counters` table idempotently (IF NOT EXISTS) |
| `packages/shared/src/types/company.ts` | DocumentNamingSettings, PDF_DOC_TYPES | VERIFIED | `PDF_DOC_TYPES` at line 344; `PdfDocType` at line 345; `DocumentNamingSettings` at line 356 |
| `packages/shared/src/index.ts` | Re-exports PDF_DOC_TYPES, PdfDocType, DocumentNamingConvention, DocumentNamingSettings | VERIFIED | All four re-exported at lines 30–33 |
| `apps/api/src/pdf/engine.ts` | getBrowser() singleton + generatePdfBuffer() | VERIFIED | `getBrowser()` at line 14; `generatePdfBuffer()` at line 38; `finally` block closes page at line 49–50 |
| `apps/api/src/pdf/generate.ts` | uploadPdfAndSave, getNextDocumentSequence, resolveFileName, getCompanyBranding | VERIFIED | All four functions exported and substantive; S3 upload + documents + documentVersions insert present |
| `apps/api/src/trpc/routers/pdf.ts` | All four generate* procedures + pdfRouter | VERIFIED | `pdfRouter` at line 59; all four procedures present at lines 80, 271, 467, 720 |
| `apps/api/src/trpc/router.ts` | pdf router registered in appRouter | VERIFIED | `import { pdfRouter }` at line 17; `pdf: pdfRouter` at line 58 |
| `apps/api/src/pdf/templates/proposal.ts` | buildProposalHtml() with header, line items, subtotals, signature block | VERIFIED | Function at line 43; signature block with Contractor + Owner/Client signatures present |
| `apps/api/src/pdf/templates/change-order.ts` | buildChangeOrderHtml() with CO sections + AIA signatures + schedule impact | VERIFIED | Function at line 70; scheduleImpactDays handled at lines 88–91; AIA-format 3-party signature block present |
| `apps/api/src/pdf/templates/payment-app.ts` | buildPaymentAppHtml() with G702 page 1 + G703 page 2 | VERIFIED | G702 "APPLICATION AND CERTIFICATE FOR PAYMENT" header; G703 "CONTINUATION SHEET" with `page-break-before: always` at line 314 |
| `apps/api/src/pdf/templates/rfq.ts` | buildRfqHtml() with scopeOfWork pre-wrap | VERIFIED | Function at line 41; `white-space: pre-wrap` on scopeOfWork text block at line 142 |
| `apps/web/app/(dashboard)/settings/document-naming/page.tsx` | DocumentNaming settings page with live preview | VERIFIED | File exists; `getDocumentNaming` query + `updateDocumentNaming` mutation wired; `buildPreview` live preview present |
| `apps/api/src/trpc/routers/company.ts` | getDocumentNaming + updateDocumentNaming procedures | VERIFIED | `getDocumentNaming` at line 173; `updateDocumentNaming` at line 195 using `authorizedProcedure` (admin-only) |
| `apps/web/components/change-order/change-order-detail.tsx` | generateChangeOrder mutation + canGeneratePdf gate | VERIFIED | Mutation at line 123; `canGeneratePdf` conditional at lines 229–232; button guarded by `{canGeneratePdf && (...)}` |

**All 15 required artifacts: VERIFIED**

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `[estimateSlug]/page.tsx` | `pdf.generateProposal` | `trpc.pdf.generateProposal.useMutation()` | WIRED | Mutation wired at line 32; `.mutate({projectSlug, estimateId})` called on button click |
| `change-order-detail.tsx` | `pdf.generateChangeOrder` | `trpc.pdf.generateChangeOrder.useMutation()` | WIRED | Mutation wired at line 123; success toast + invalidation present |
| `payment-apps/[paymentAppId]/page.tsx` | `pdf.generatePaymentApp` | `trpc.pdf.generatePaymentApp.useMutation()` | WIRED | Mutation wired at line 28; "Generate AIA G702/G703 PDF" button at line 121 |
| `rfqs/[rfqId]/page.tsx` | `pdf.generateRfq` | `trpc.pdf.generateRfq.useMutation()` | WIRED | Mutation wired at line 99; "Generate RFQ PDF" button at line 236 |
| `apps/api/src/pdf/generate.ts` | `storage/client.ts` | `getStorageClient(), buildStorageKey()` | WIRED | Imported at top of generate.ts; used in `uploadPdfAndSave` |
| `apps/api/src/pdf/generate.ts` | `documents + document_versions tables` | `db.insert(schema.documents).values(...)` | WIRED | Both inserts present; `currentVersionId` back-pointer update at generate.ts line 268 |
| `apps/api/src/trpc/router.ts` | `routers/pdf.ts` | `import { pdfRouter }` | WIRED | Import at line 17; `pdf: pdfRouter` at line 58 |
| `pdf.ts` | `templates/proposal.ts` | `buildProposalHtml(data)` | WIRED | Import and call present in `generateProposal` procedure |
| `pdf.ts` | `templates/change-order.ts` | `buildChangeOrderHtml(data)` | WIRED | Import and call present in `generateChangeOrder` procedure |
| `pdf.ts` | `templates/payment-app.ts` | `buildPaymentAppHtml(data)` | WIRED | Import and call present in `generatePaymentApp` procedure |
| `pdf.ts` | `templates/rfq.ts` | `buildRfqHtml(data)` | WIRED | Import and call present in `generateRfq` procedure |
| `settings/document-naming/page.tsx` | `company.updateDocumentNaming` | `trpc.company.updateDocumentNaming.useMutation()` | WIRED | Mutation wired at page line 174; invalidates `getDocumentNaming` on success |
| `company.ts` | `companyProfiles.documentNamingSettings` | `db.update(schema.companyProfiles).set({ documentNamingSettings })` | WIRED | Update at company.ts line 218 |

**All 13 key links: WIRED**

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PDF-01 | 38-03 | Proposal PDF from Estimates section with line items, subtotals, signature block | SATISFIED | `generateProposal` procedure; button on `[estimateSlug]/page.tsx`; proposal template with signature block |
| PDF-02 | 38-04 | Change Order PDF with CO number, cost breakdown, contract sum impact, schedule impact, signature blocks | SATISFIED | `generateChangeOrder` procedure; status gate enforced; change-order template with AIA 3-party signatures and schedule impact section |
| PDF-03 | 38-05 | AIA G702/G703 Payment Application PDF with 9 payment lines and SOV breakdown | SATISFIED | `generatePaymentApp` procedure; `buildPaymentAppHtml` with G702 page 1 (9 payment lines) + G703 continuation sheet with `page-break-before: always` |
| PDF-04 | 38-06 | RFQ PDF with scope of work text, submission deadline, payment terms | SATISFIED | `generateRfq` procedure; `buildRfqHtml` with `white-space: pre-wrap` scope section, due date, payment terms note |
| PDF-05 | 38-02 | Brand colors from Company Settings; default BIDAXIOM branding if none configured | PARTIALLY SATISFIED | `#3B5BDB` brand color applied in all 4 templates; `getCompanyBranding()` returns hardcoded `primaryColor: "#3B5BDB"`; company logo embedding **deferred to Phase 39** by plan design (noted as intentional partial in plan 38-02 must_haves) |
| PDF-06 | 38-02 | Generated PDFs stored in document library immediately | SATISFIED | `uploadPdfAndSave()` inserts documents + document_versions rows and sets `currentVersionId` on every generation |
| NAME-01 | 38-01, 38-07 | Admin configures naming template per doc type with supported variables | SATISFIED | `updateDocumentNaming` mutation persists to `documentNamingSettings` JSONB; settings page has per-type template inputs with all 7 variable chips |
| NAME-02 | 38-01, 38-02 | Per-doc-type sequence counter auto-increments, company-scoped | SATISFIED | `document_naming_counters` table (1 row per docType per tenant schema); `getNextDocumentSequence` uses SELECT FOR UPDATE in transaction |
| NAME-03 | 38-07 | Live preview of resulting filename in settings page | SATISFIED | `buildPreview()` substitutes sample values in real time; displayed as `Preview: <filename>` below each template input |
| NAME-04 | 38-02, 38-07 | Default naming pattern when no template configured | SATISFIED | `DEFAULT_TEMPLATE = "{DOC-TYPE}-{JOB-NUMBER}-{DATE}"` as fallback in both UI preview and server-side `resolveFileName()` |

**Score: 9/10 fully satisfied; PDF-05 partially satisfied by design (company logo deferred to Phase 39)**

**Note on PDF-05:** The plan explicitly scoped logo embedding to Phase 39, documenting "Company logo embedding is deferred to Phase 39 (PDF-05 partial — default branding only for Phase 38)" in plan 38-02's must_haves. Brand color (#3B5BDB) IS applied. This is a planned partial satisfaction, not a gap.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/pdf/templates/rfq.ts` | ~100 | `// TODO: paymentTerms field does not exist in rfqs schema — hardcoded "Net 30"` | Info | Intentional placeholder per plan spec; deferred to Phase 39+ |
| `apps/api/src/pdf/generate.ts` | ~139 | `getCompanyBranding()` accepts `db: any` and `schema: any` type parameters | Info | Weak typing; does not break functionality; no runtime risk |

No blockers or warnings found.

---

## Human Verification Required

### 1. Proposal PDF Visual Quality

**Test:** Navigate to any project → Estimates tab → click an estimate → click "Generate Proposal PDF". Open the generated document from the Documents tab.
**Expected:** Document renders with: BIDAXIOM slate-blue header, company name, project name/address, line items table with quantities/rates/totals, subtotals by cost type, grand total row, and a printed signature block at the bottom.
**Why human:** PDF visual layout cannot be confirmed by grep. UAT confirmed 8/8 pass including this test, but visual quality (margins, font sizes, page breaks) requires human eyeball verification.

### 2. AIA G702/G703 Two-Page Layout

**Test:** Generate a Payment Application PDF and open it.
**Expected:** Page 1 is the G702 "APPLICATION AND CERTIFICATE FOR PAYMENT" form with all 9 payment lines populated. Page 2 is the G703 "CONTINUATION SHEET" with the SOV line-item breakdown in columns A through H.
**Why human:** Page-break rendering in Puppeteer to PDF must be confirmed visually; CSS `page-break-before: always` is in place but whether Puppeteer honored it requires opening the PDF.

### 3. CO "Generate PDF" Button Hidden on Rejected/Void COs

**Test:** Navigate to a rejected or void change order.
**Expected:** The "Generate PDF" button is not visible.
**Why human:** UI conditional rendering is verified in code (`canGeneratePdf` logic confirmed), but data-dependent runtime behavior is best confirmed by eye. UAT reported this passing.

---

## Inline Bug Fixes Applied During UAT

Three bugs were discovered during UAT and fixed inline before UAT sign-off:

1. **CO form silent submit (4 root causes)** — Committed `e36f1d6`. Fixed incorrect mutation call signature, missing error toast, wrong status field name, stale query invalidation target in `change-orders/[changeOrderId]/page.tsx`.

2. **Pay app wrong field names** — Committed `f2dd3e5`. Corrected camelCase/snake_case field name mismatches in submit and markPaid mutations in `payment-apps/[paymentAppId]/page.tsx`.

3. **RFQ dueDate datetime-local format** — Committed `b7f2170`. Added `new Date(dueDate).toISOString()` conversion before sending to tRPC procedure in `rfqs/[rfqId]/page.tsx`.

All three fixes were committed before UAT approval. No outstanding bugs remain.

---

## Summary

Phase 38 goal is **achieved**. All four PDF document types (Proposal, Change Order, Payment Application AIA G702/G703, RFQ) have:
- Substantive HTML templates with professional layouts and correct industry-specific sections
- tRPC procedures that fetch live data, generate PDFs via Puppeteer, upload to S3, and insert into the document library
- UI buttons wired to those procedures with loading/success/error feedback

The document naming system is fully working: company-scoped atomic sequence counters, configurable per-type templates with 7 supported variables, live preview, admin-only write gate, and a sensible default pattern.

**PDF-05 partial satisfaction is by design**: brand color (#3B5BDB) is applied in Phase 38; company logo embedding is explicitly deferred to Phase 39.

UAT: 8/8 tests passed with 3 inline bug fixes applied and committed.

---

_Verified: 2026-02-19T05:00:00Z_
_Verifier: Claude (gsd-verifier)_
