---
phase: 10-reporting-and-analytics
plan: 03
subsystem: reporting-export
tags: [pdf, excel, csv, export, puppeteer, exceljs, file-download]
dependency_graph:
  requires: [10-01-reporting-schema, report-engine]
  provides: [report-export-service, pdf-generator, excel-generator, csv-generator]
  affects: [report-execution, file-management]
tech_stack:
  added: [puppeteer, exceljs, papaparse]
  patterns: [export-orchestration, headless-browser-pdf, spreadsheet-generation, temp-file-cleanup]
key_files:
  created:
    - apps/api/src/services/report-exporter.ts
    - apps/api/src/services/pdf-generator.ts
    - apps/api/src/services/excel-generator.ts
    - apps/api/src/trpc/routers/report-export.ts
    - packages/shared/src/types/reporting.ts (ReportData type)
  modified:
    - apps/api/package.json
    - package-lock.json
    - apps/api/src/trpc/router.ts
    - apps/api/src/server.ts
    - packages/shared/src/index.ts
decisions:
  - id: D10-03-01
    summary: "Puppeteer for PDF generation with headless Chrome rendering"
    rationale: "Industry-standard HTML-to-PDF conversion with full CSS and chart support"
  - id: D10-03-02
    summary: "ExcelJS for Excel workbook generation with formatting"
    rationale: "Pure JavaScript Excel library with cell formatting, multiple sheets, and no native dependencies"
  - id: D10-03-03
    summary: "24-hour expiry for temporary export files"
    rationale: "Balances user convenience with disk space management; typical workflow requires download within hours"
  - id: D10-03-04
    summary: "6-hour cleanup interval for expired files"
    rationale: "Frequent enough to prevent disk bloat without excessive file system scanning"
  - id: D10-03-05
    summary: "Fastify download endpoint instead of tRPC for file streaming"
    rationale: "tRPC doesn't handle binary file streaming well; Fastify native streaming more efficient"
  - id: D10-03-06
    summary: "Path traversal security check in download endpoint"
    rationale: "Prevents ../../../etc/passwd attacks via path.normalize validation"
metrics:
  duration: 8 min
  tasks_completed: 2
  files_created: 4
  files_modified: 5
  commits: 2
  lines_added: ~650
completed_date: 2026-02-13
---

# Phase 10 Plan 03: Report Export with PDF, Excel, and CSV Generation

**One-liner:** Multi-format report export using puppeteer (PDF), exceljs (Excel), and papaparse (CSV) with temp file management and download endpoints.

## Overview

Built comprehensive report export functionality enabling users to generate PDF, Excel, and CSV files from report data. Implemented using industry-standard libraries (puppeteer for headless browser PDF rendering, exceljs for spreadsheet generation with formatting, papaparse for CSV conversion) with temporary file storage, download URLs, and automated cleanup of expired files.

## Implementation Details

### Task 1: Install Export Libraries and Create Export Services

**Commit:** `35d7fca`

Installed export dependencies and created three specialized generator services:

**Packages installed:**
- `puppeteer` (24.37.3): Headless Chrome for PDF generation
- `exceljs` (4.4.0): Excel workbook generation with formatting
- `papaparse` (5.5.3): CSV parser/unparser
- `@types/papaparse`: TypeScript definitions

**Services created:**

1. **report-exporter.ts** (Export orchestration):
   - `exportReport()`: Main orchestration function accepting reportData, reportDefinition, format, and options
   - Format switch: routes to PDF, Excel, or CSV generator based on format parameter
   - Temp directory management: uses `REPORTS_TEMP_DIR` env var or falls back to `os.tmpdir()/construction-reports`
   - Unique filename generation: `{sanitized-name}-{timestamp}.{extension}`
   - Returns export result with filePath, filename, mimeType, size
   - `generateReportCSV()`: Converts report rows to CSV using papaparse.unparse with column headers
   - `cleanupExpiredExports()`: Scans temp directory, deletes files older than 24 hours, returns deleted count

2. **pdf-generator.ts** (PDF generation with puppeteer):
   - `generateReportPDF()`: Launches headless Chrome, renders HTML template, generates PDF buffer
   - HTML template builder: report title, metadata (generated date, filters), styled data table, chart placeholder
   - Puppeteer configuration: headless mode, no-sandbox args for container compatibility
   - PDF options: format (letter/legal/a4), landscape/portrait, printBackground, margins
   - Cell value formatting: currency ($X.XX), date (locale), datetime, number (thousands separator), percentage
   - Chart rendering placeholder: documented future implementation with chart.js-node-canvas
   - HTML escaping: prevents XSS in report data

3. **excel-generator.ts** (Excel generation with exceljs):
   - `generateReportExcel()`: Creates workbook, adds data sheet, applies formatting, returns buffer
   - Header row styling: bold white text, blue background (FF0070C0), borders, 20px height
   - Data row formatting: number formats (currency $#,##0.00, date mm/dd/yyyy, percentage 0.0%), alternating row background
   - Column auto-fit: calculates max content length, sets width with 10-50 character limits
   - Summary worksheet: report metadata, row count, statistics for numeric columns (count, sum, avg, min, max)
   - Cell borders: thin borders on all cells for clean table appearance

**Type additions:**
- Added `ReportData` interface to `packages/shared/src/types/reporting.ts`
- Structure: `{ rows: Record<string, any>[], metadata?: { generatedAt, rowCount, executionTime, fromCache, filtersApplied } }`
- Exported from `packages/shared/src/index.ts` for cross-package access

**Key patterns:**
- Environment variable fallback: `process.env.REPORTS_TEMP_DIR || path.join(os.tmpdir(), 'construction-reports')`
- Async/await throughout: all file operations use `fs.promises` for non-blocking I/O
- Error handling in cleanup: catches individual file errors, continues processing, never throws

### Task 2: Create Report Export tRPC Router and Cleanup Scheduler

**Commit:** `0064a89`

Created tRPC router for export operations and integrated download endpoint with cleanup scheduler:

**report-export.ts router** (3 procedures):

1. **export** mutation (requires read Report permission):
   - Input: reportId (UUID), format (pdf|excel|csv), options (pageOrientation, paperSize, includeCharts)
   - Loads report definition from `reportDefinitions` table
   - Executes report via `executeReport()` from report-engine service
   - Transforms execution result to ReportData format (rows + metadata)
   - Calls `exportReport()` service with format and options
   - Calculates expiry: 24 hours from generation
   - Audit logs: action=CREATE, metadata includes action="export", format, filename, size
   - Returns: `{ downloadUrl: '/api/reports/download/{filename}', filename, expiresAt }`

2. **exportWithData** mutation (ad-hoc exports without saved report):
   - Input: reportData (rows + metadata), reportDefinition (name, columns, chartConfig), format, options
   - Bypasses report execution, uses provided data directly
   - Useful for custom/one-off exports without saving report definition
   - Audit logs with entityId="ad-hoc", includes reportName in metadata
   - Returns download URL and metadata

3. **getExportStatus** query:
   - Input: filename
   - Checks file existence in temp directory via `fs.stat()`
   - Calculates expiry based on file modification time + 24 hours
   - Returns: `{ exists: boolean, size: number, expiresAt: ISO string }`
   - Returns exists=false if file not found (already cleaned up or never existed)

**Download endpoint** (Fastify route at `/api/reports/download/:filename`):
- Path traversal security: validates normalized path starts with REPORTS_TEMP_DIR
- Returns 403 Access denied if path traversal detected
- Returns 404 File not found if file doesn't exist or expired
- MIME type mapping: .pdf → application/pdf, .xlsx → application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .csv → text/csv
- Content-Disposition header: `attachment; filename="{filename}"` triggers browser download
- Streams file using `fs.createReadStream()` for memory-efficient large file handling

**Cleanup scheduler** (server.ts):
- Runs every 6 hours: `setInterval(cleanupExpiredExports, 6 * 60 * 60 * 1000)`
- Calls `cleanupExpiredExports()` from report-exporter service
- Logs deleted count: "Cleaned up X expired report exports"
- Error handling: catches errors, logs to console, doesn't crash server

**Router registration:**
- Added `reportExportRouter` import to `apps/api/src/trpc/router.ts`
- Registered under `reportExport` key in appRouter
- Available at `/trpc/reportExport.export`, `/trpc/reportExport.exportWithData`, `/trpc/reportExport.getExportStatus`

## Verification

All verification criteria met:

1. ✅ puppeteer, exceljs, papaparse packages installed in apps/api
2. ✅ TypeScript compilation passes with no errors in new services
3. ✅ PDF generator uses puppeteer.launch headless mode
4. ✅ Excel generator creates workbook with formatted cells (headers, numbers, dates)
5. ✅ CSV generator uses papaparse.unparse function
6. ✅ Export router registered in tRPC app with 3 procedures
7. ✅ Download endpoint exists in server.ts at /api/reports/download/:filename
8. ✅ Cleanup scheduler runs every 6 hours via setInterval
9. ✅ Temporary files have 24-hour expiry (calculated from file mtime)
10. ✅ CASL permissions enforced on export procedures (read Report required via protectedProcedure)

## Success Criteria

All success criteria achieved:

- ✅ Reports can be exported to PDF with tables and formatted layout
- ✅ Reports can be exported to Excel with multiple sheets (Data + Summary) and cell formatting
- ✅ Reports can be exported to CSV for raw data analysis
- ✅ Download URLs expire after 24 hours
- ✅ Temporary files are cleaned up automatically every 6 hours
- ✅ Export procedures enforce read Report permission via CASL
- ✅ Download endpoint streams files with correct MIME types and Content-Disposition headers
- ✅ All exports are audit logged with filename, format, and size

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

Plan 10-03 complete. Ready for Plan 10-04 (Report Scheduling and Email Delivery).

**Recommended follow-ups:**
1. **Plan 10-04**: Report scheduling with cron-style triggers and email delivery
2. **Chart rendering**: Add chart.js-node-canvas dependency for actual chart rendering in PDFs/Excel
3. **S3 storage**: Move exports to S3 with pre-signed download URLs for scalability
4. **Rate limiting**: Add rate limits to export endpoints to prevent abuse
5. **Export history**: Track export history per user for audit trail and download history

## File Manifest

**Created:**
- `apps/api/src/services/report-exporter.ts` (150 lines)
- `apps/api/src/services/pdf-generator.ts` (230 lines)
- `apps/api/src/services/excel-generator.ts` (240 lines)
- `apps/api/src/trpc/routers/report-export.ts` (230 lines)

**Modified:**
- `apps/api/package.json` (+3 dependencies)
- `package-lock.json` (+177 packages)
- `apps/api/src/trpc/router.ts` (+2 lines: import and registration)
- `apps/api/src/server.ts` (+44 lines: download endpoint, cleanup scheduler)
- `packages/shared/src/types/reporting.ts` (+14 lines: ReportData interface)
- `packages/shared/src/index.ts` (+1 line: ReportData export)

**Total changes:** ~850 lines added, 9 files modified/created

## Self-Check: PASSED

### File Existence Verification

```
FOUND: report-exporter.ts
FOUND: pdf-generator.ts
FOUND: excel-generator.ts
FOUND: report-export.ts
```

### Commit Verification

```
35d7fca feat(10-03): install export libraries and create export services
0064a89 feat(10-03): create report export router and cleanup scheduler
```

All files created and commits recorded successfully.
