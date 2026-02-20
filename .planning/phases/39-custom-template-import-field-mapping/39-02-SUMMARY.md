---
phase: 39-custom-template-import-field-mapping
plan: 02
subsystem: api
tags: [docxtemplater, pizzip, mammoth, exceljs, typescript, pdf, templates]

# Dependency graph
requires:
  - phase: 39-01
    provides: document_templates Drizzle table, FieldMapping/DetectedField shared types, BIDAXIOM_FIELD_KEYS

provides:
  - parseDocxFields(buffer) field extraction from .docx via InspectModule with original-case preservation
  - parseXlsxFields(buffer) async field extraction from .xlsx via exceljs with RichText cell handling
  - buildCustomTemplateHtml(mappings, data, lineItems?, isPreview?) HTML builder for custom template PDFs
  - PREVIEW_SAMPLE_DATA fixture data covering all 4 doc types + company + project contexts
  - PREVIEW_LINE_ITEMS (3 fixture rows) for table field rendering
  - buildPreviewData() merger function for real company branding overrides

affects:
  - 39-03-PLAN (templateRouter — calls extract.ts on upload, fixtures.ts for preview, render.ts for PDF)
  - 39-04-PLAN (pdfRouter — calls render.ts for production PDF when active custom template exists)

# Tech tracking
tech-stack:
  added:
    - docxtemplater@3.68.2 (InspectModule-based .docx tag extraction with custom delimiters <<>>)
    - pizzip@3.2.0 (required peer of docxtemplater — unzips .docx ZIP archives)
    - mammoth@1.11.0 (optional: .docx to HTML conversion for future left-panel text preview)
  patterns:
    - InspectModule with nullGetter suppresses undefined tag errors during extraction-only render
    - Raw XML regex scan on word/document.xml captures original-case field names before InspectModule lowercases them
    - ExcelJS Buffer cast via Parameters<typeof workbook.xlsx.load>[0] resolves ExcelJS-vs-Node Buffer type conflict
    - table.* mapped fields are separated from scalar fields; rendered as HTML table rows iterating lineItems
    - escapeHtml() applied to all user-supplied strings before HTML embedding (XSS prevention, same as Phase 38)

key-files:
  created:
    - apps/api/src/templates/extract.ts
    - apps/api/src/templates/fixtures.ts
    - apps/api/src/templates/render.ts
  modified:
    - apps/api/package.json (added docxtemplater, pizzip, mammoth)
    - package-lock.json

key-decisions:
  - "createRequire(import.meta.url) used to CJS-require InspectModule — it has no ESM named export"
  - "Original-case field display form captured via raw XML regex BEFORE InspectModule processes the docx (InspectModule lowercases all keys)"
  - "ExcelJS declares its own Buffer type (extends ArrayBuffer) conflicting with Node Buffer<ArrayBufferLike> — resolved with Parameters<> cast"
  - "buildPreviewData() filters undefined values from companyOverrides before spread to satisfy Record<string,string> return type"
  - "tableMappings detected by mappedTo.startsWith('table.') — these generate an HTML table loop rather than scalar dl/dt/dd rows"
  - "isPreview flag on buildCustomTemplateHtml defaults to true — unmapped fields render as [UNMAPPED] for preview, empty string for production"

patterns-established:
  - "Pattern: Extract original-case display forms via raw XML regex before InspectModule normalizes them to lowercase"
  - "Pattern: FIELD_REGEX.lastIndex = 0 reset before each string in parseXlsxFields to prevent stateful regex misses"
  - "Pattern: table.* field separation — render.ts detects table-context fields by mappedTo prefix and generates HTML table rows"

requirements-completed: [TMPL-02, TMPL-04]

# Metrics
duration: 6min
completed: 2026-02-20
---

# Phase 39 Plan 02: Template Utilities Summary

**docxtemplater InspectModule field extraction (extract.ts), Puppeteer HTML builder driven by FieldMapping[] (render.ts), and fixture sample data for preview generation (fixtures.ts) — all 3 modules in apps/api/src/templates/**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-20T16:55:10Z
- **Completed:** 2026-02-20T17:01:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Installed docxtemplater + pizzip + mammoth in apps/api via package.json edit + root npm install (workspace install had an arborist bug with npm 11)
- Implemented parseDocxFields() using InspectModule with custom `<<`/`>>` delimiters, nullGetter, and raw XML pre-scan for case preservation
- Implemented parseXlsxFields() with exceljs cell iteration handling string and RichText cell types
- Implemented buildCustomTemplateHtml() with scalar field dl/dt/dd rendering, table.* field HTML table loop, escapeHtml() XSS protection, isPreview flag, and preview watermark banner
- Implemented PREVIEW_SAMPLE_DATA + PREVIEW_LINE_ITEMS + buildPreviewData() fixtures
- Zero TypeScript errors across all 3 new files

## Task Commits

Each task was committed atomically:

1. **Task 1: Install npm packages and implement extract.ts** - `ccb77b7` (feat)
2. **Task 2: Implement render.ts and fixtures.ts** - `43a43b9` (feat)

**Plan metadata:** (created below)

## Files Created/Modified

- `apps/api/src/templates/extract.ts` - New: parseDocxFields(buffer) + parseXlsxFields(buffer) field extraction functions
- `apps/api/src/templates/fixtures.ts` - New: PREVIEW_SAMPLE_DATA, PREVIEW_LINE_ITEMS, buildPreviewData()
- `apps/api/src/templates/render.ts` - New: buildCustomTemplateHtml(mappings, data, lineItems?, isPreview?) HTML builder
- `apps/api/package.json` - Added docxtemplater ^3.68.2, pizzip ^3.2.0, mammoth ^1.11.0
- `package-lock.json` - Updated with 17 new packages

## Decisions Made

- `createRequire(import.meta.url)` used to load InspectModule via CJS require — the module ships inside docxtemplater with no ESM export path
- Raw XML regex on `word/document.xml` captures the original-case form of field names before InspectModule lowercases them during parsing — both are stored (detectedField=lowercase, displayField=original)
- ExcelJS declares its own `Buffer` interface (extends `ArrayBuffer`) that conflicts with Node's `Buffer<ArrayBufferLike>` generic — cast via `Parameters<typeof workbook.xlsx.load>[0]` avoids the TS2345 error without losing type safety
- `buildPreviewData()` filters `undefined` out of `companyOverrides` before spreading to maintain `Record<string, string>` return type — TypeScript correctly flags the spread otherwise
- `isPreview` parameter defaults to `true` on `buildCustomTemplateHtml()` — callers must explicitly pass `false` for production PDF generation (safe default for preview use cases)
- Table-context detection uses `mappedTo.startsWith("table.")` — clean and matches BIDAXIOM_FIELD_KEYS group naming

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm workspace install failed with arborist null.location error**
- **Found during:** Task 1 (package installation)
- **Issue:** `npm install docxtemplater pizzip mammoth --workspace=apps/api` threw `TypeError: Cannot read properties of null (reading 'location')` — a known npm 11 arborist bug when `.package-lock.json` is out of date
- **Fix:** Added packages directly to `apps/api/package.json` dependencies, then ran `npm install` from the monorepo root (no --workspace flag) which succeeded
- **Files modified:** apps/api/package.json, package-lock.json
- **Verification:** `npm ls docxtemplater pizzip mammoth` shows all 3 at expected versions
- **Committed in:** ccb77b7 (Task 1 commit)

**2. [Rule 1 - Bug] ExcelJS Buffer type conflict with Node.js Buffer**
- **Found during:** Task 1 (TypeScript check after extract.ts creation)
- **Issue:** `workbook.xlsx.load(buffer)` produced TS2345 — ExcelJS declares `interface Buffer extends ArrayBuffer {}` which conflicts with Node's `Buffer<ArrayBufferLike>` generic form
- **Fix:** Cast via `buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]` — preserves the correct type intent without unsafe `any`
- **Files modified:** apps/api/src/templates/extract.ts
- **Verification:** `tsc --noEmit` passes with 0 errors in templates/
- **Committed in:** ccb77b7 (Task 1 commit)

**3. [Rule 1 - Bug] buildPreviewData() return type narrowing failure**
- **Found during:** Task 2 (TypeScript check after fixtures.ts creation)
- **Issue:** `{ ...PREVIEW_SAMPLE_DATA, ...companyOverrides }` produced `Record<string, string | undefined>` since `companyOverrides` is `Partial<Record<string, string>>` — not assignable to `Record<string, string>`
- **Fix:** Filter undefined entries from `companyOverrides` before spreading using `Object.entries().filter()` with a type predicate
- **Files modified:** apps/api/src/templates/fixtures.ts
- **Verification:** `tsc --noEmit` passes with 0 errors in templates/
- **Committed in:** 43a43b9 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All auto-fixes necessary for TypeScript correctness and successful package installation. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `apps/api/src/templates/` directory with all 3 utility modules ready for import by Plan 39-03 (templateRouter)
- `parseDocxFields` / `parseXlsxFields` ready to call in `registerAndExtract` tRPC mutation
- `buildCustomTemplateHtml` ready to call in `generatePreview` mutation and production PDF procedures
- `buildPreviewData` ready to merge real company branding with fixture data for hybrid previews
- All packages installed; zero TypeScript errors across the templates/ directory

---
*Phase: 39-custom-template-import-field-mapping*
*Completed: 2026-02-20*
