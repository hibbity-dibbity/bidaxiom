---
status: complete
phase: 38-pdf-generation-and-document-naming
source: [38-01-SUMMARY.md, 38-02-SUMMARY.md, 38-03-SUMMARY.md, 38-04-SUMMARY.md, 38-05-SUMMARY.md, 38-06-SUMMARY.md, 38-07-SUMMARY.md]
started: 2026-02-19T00:00:00Z
updated: 2026-02-19T03:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Proposal PDF generates and lands in document library
expected: Navigate to a project → Estimates → click an estimate → click "Generate Proposal PDF". Loading state shows, success toast fires, PDF appears in project Documents tab.
result: pass

### 2. Change Order PDF — status gate + document library
expected: Click "Generate PDF" on an approved or pending CO — success toast fires and document appears in document library. On a rejected/void CO, the "Generate PDF" button should NOT be visible at all.
result: pass

### 3. Payment Application PDF (AIA G702/G703)
expected: Navigate to a project → Payment Applications → click a pay app → click "Generate AIA G702/G703 PDF". Success toast fires and document appears in document library.
result: pass

### 4. RFQ PDF generates
expected: Navigate to a project → Bidding tab → click an RFQ → click "Generate RFQ PDF". Success toast fires and document appears in document library.
result: pass

### 5. Document Naming settings page loads with 4 type sections
expected: Go to /settings/document-naming. Page shows 4 sections (Proposal, Change Order, Payment Application, RFQ), each with a template input field and variable chip badges for {JOB-NUMBER}, {PROJECT-NAME}, {DOC-TYPE}, {SEQ}, {YEAR}, {MONTH}, {DATE}.
result: pass

### 6. Live preview updates as you type
expected: Type a template like "CO-{JOB-NUMBER}-{SEQ}" in the Change Order template input. The live preview below the input immediately updates to show a sample filename like "CO-2026-001-003.pdf".
result: pass

### 7. Naming convention saved and applied to new PDF
expected: Save the document naming settings. Generate another PDF of that type. The new document in the library uses the configured filename pattern instead of the default.
result: pass

### 8. Sequence counter increments across generations
expected: Generate two Proposal PDFs for the same project. Both appear in the document library with DIFFERENT sequence numbers (e.g., ...001... and ...002...).
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
