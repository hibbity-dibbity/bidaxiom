---
phase: 38-pdf-generation-and-document-naming
plan: 05
subsystem: pdf
tags: [pdf, payment-app, aia-g702, aia-g703, puppeteer, trpc, document-library]
dependency_graph:
  requires:
    - documentNamingCounters table (38-01)
    - documentNamingSettings JSONB column (38-01)
    - getNextDocumentSequence, resolveFileName, uploadPdfAndSave (38-02)
    - generatePdfBuffer (38-02)
    - pdfRouter shell (38-02)
    - payment_apps schema (Phase 5)
    - payment_app_line_items + sov_items schema (Phase 5)
    - customers table (Phase 3)
  provides:
    - buildPaymentAppHtml() — AIA G702/G703 2-page HTML template
    - pdf.generatePaymentApp tRPC procedure
    - "Generate AIA G702/G703 PDF" button on payment app detail page
  affects:
    - apps/api/src/pdf/templates/payment-app.ts (new)
    - apps/api/src/trpc/routers/pdf.ts (extended)
    - apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx (modified)
tech_stack:
  added: []
  patterns:
    - 2-page AIA document structure (G702 + G703) using CSS page-break-before
    - Column I conditional render (non-uniform retainage only)
    - previousWorkCompleted computed as previousPercentComplete/100 * scheduledValue
    - uniformRetainage flag checked before building G703 column I
key_files:
  created:
    - apps/api/src/pdf/templates/payment-app.ts
  modified:
    - apps/api/src/trpc/routers/pdf.ts
    - apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx
decisions:
  - G702 header retainagePercent derived from retainageAmount/totalCompletedAndStored at generation time (not stored per-app in DB) for display accuracy
  - applicationNumber uses the text value from DB (e.g. "PAY-2026-001") directly as the AIA document reference number
  - "Generate AIA G702/G703 PDF" button placed in page header alongside application title (no status gate — any payment app status can generate a PDF)
  - G703 totals row uses originalContractSum and paymentApp-level totals (not re-summed from line items) for consistency with G702
metrics:
  duration: ~6 min
  completed: 2026-02-19
  tasks_completed: 2
  files_created: 1
  files_modified: 2
---

# Phase 38 Plan 05: Payment Application PDF (AIA G702/G703) Summary

**One-liner:** AIA G702/G703-compliant 2-page HTML template with all 9 payment lines and SOV continuation sheet, tRPC generatePaymentApp procedure, and "Generate AIA G702/G703 PDF" button on the payment app detail page.

## What Was Built

1. **`apps/api/src/pdf/templates/payment-app.ts`** — `buildPaymentAppHtml(data: PaymentAppPdfData)` function implementing the AIA 2-page document structure:

   - **G702 (Page 1):** BIDAXIOM-branded header bar with application number + period dates, project/owner/architect info grid (2-column), all 9 AIA payment lines in a bordered table (Line 8 "CURRENT PAYMENT DUE" highlighted in slate-blue `#3B5BDB`), standard AIA contractor certification text, and 2-column signature block (Contractor + Architect Certificate of Payment).
   - **G703 (Page 2):** `page-break-before: always` ensures a new PDF page; compact 11px table with standard AIA column headers A (Item No.) through H (Balance to Finish C-G); Column I (Retainage %) rendered conditionally only when `uniformRetainage === false`; zebra-stripe rows; totals footer row in dark slate.

2. **`generatePaymentApp` tRPC procedure** added to `apps/api/src/trpc/routers/pdf.ts`:
   - Fetches project by slug, validates payment app ownership, joins `paymentAppLineItems` with `sovItems` for G703 data.
   - Fetches customer record to populate owner name and address.
   - Computes `previousWorkCompleted` per line item as `(previousPercentComplete/100) * scheduledValue`.
   - Checks uniform retainage by comparing all `retainagePercent` values.
   - Derives header `retainagePercent` display string from `retainageAmount / totalCompletedAndStored`.
   - Calls `getNextDocumentSequence`, `resolveFileName`, `buildPaymentAppHtml`, `generatePdfBuffer`, `uploadPdfAndSave` with category `"payment_app"`.
   - Returns `{ documentId, fileName, message }`.

3. **Payment app detail page** — "Generate AIA G702/G703 PDF" button added to page header alongside the application title. Uses `trpc.pdf.generatePaymentApp.useMutation` with `FileDown` icon, spinner while pending, `toast.success` on completion, and `toast.error` on failure. No status gate — all payment app statuses can generate a PDF.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build AIA G702/G703 HTML template and generatePaymentApp procedure | 31ae0d7 | apps/api/src/pdf/templates/payment-app.ts, apps/api/src/trpc/routers/pdf.ts |
| 2 | Add "Generate PDF" button to payment application detail page | 0305826 | apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx |

## Verification Results

- `apps/api npx tsc --noEmit`: Zero errors in new/modified PDF files (all remaining errors are pre-existing in bid.ts, quickbooks, bidGeneration.ts, etc.)
- `apps/web npx tsc --noEmit`: Zero errors in paymentAppId detail page (pre-existing errors in other payment-app components unchanged)
- `grep "generatePaymentApp" apps/api/src/trpc/routers/pdf.ts`: PASS
- `grep "buildPaymentAppHtml" apps/api/src/pdf/templates/payment-app.ts`: PASS
- `grep -E "G702|G703|APPLICATION AND CERTIFICATE|CONTINUATION SHEET"` in template: PASS (all AIA terminology present)
- `grep "page-break-before"` in template: PASS — G703 page break confirmed
- `grep -r "generatePaymentApp|Generate AIA|G702"` in payment app detail dir: PASS — mutation and button text found

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/api/src/pdf/templates/payment-app.ts | FOUND |
| apps/api/src/trpc/routers/pdf.ts (modified) | FOUND |
| apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx | FOUND |
| Commit 31ae0d7 (Task 1) | FOUND |
| Commit 0305826 (Task 2) | FOUND |
