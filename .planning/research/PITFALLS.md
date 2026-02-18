# Domain Pitfalls: v1.5 Project Lifecycle Redesign & Document Engine

**Domain:** Construction SaaS - v1.5 Feature Addition (State Machine Migration, Document Generation, Template Import, Complexity Modes, Sequence Numbering, Metadata Redesign)
**Researched:** 2026-02-18
**Confidence:** MEDIUM-HIGH (verified with official database/XML docs + WebSearch; limited specific case studies for construction doc generation)

---

## Critical Pitfalls (High Risk — Cause Rewrites or Major Incidents)

### Pitfall 1: Sequence Number Race Conditions on Concurrent Document Generation

**What goes wrong:**
When two users or automated processes generate documents simultaneously, both requests read the "current sequence number" before either writes the next value back. Result: duplicate sequence numbers (e.g., two documents both named "Proposal-001"). Later deletes create permanent gaps that never fill. Incrementing via SQL SEQUENCE objects doesn't prevent this without explicit locking.

**Risk Level:** CRITICAL

**Why it happens:**
- Database SEQUENCEs are designed to avoid gaps but NOT to provide exclusive locks
- Two concurrent transactions can each read `CURRVAL = 100`, both increment to 101, both commit
- No application-level locking is in place during the read-check-increment window
- Testing with single-threaded scenarios misses the problem entirely
- Developers assume SEQUENCE objects handle concurrency (they don't fully)

**Consequences:**
- Duplicate document numbers break downstream references (billing, audits, legal holds)
- Users report "this document already exists" errors
- Gaps in numbering break auto-increment assumptions in other features
- Rollback transactions consume sequence numbers and never release them, creating silent gaps
- No way to "repair" gaps without complex backfill logic
- Audit fails because numbering has holes

**Prevention:**
- Use database-level exclusive locks (Oracle advisory locks, PostgreSQL `FOR UPDATE`, SQL Server `WITH (XLOCK)`)
- Alternative: Maintain a counter table + explicit lock acquisition before read-check-increment operation
- Use `SEQUENCES` with `NOCACHE` (forces single-threaded evaluation) but accept performance cost
- Implement application-level distributed lock (Redis lock, database lock table) for 100% guarantee
- Test with load testing tool (k6, JMeter) with concurrency = expected simultaneous document generations
- Log all sequence number acquisitions; periodically audit for gaps and unexpected patterns
- In tests: simulate 10+ concurrent document creations; verify no duplicates

**Detection:**
- Monitor for duplicate document numbers in logs
- Query: `SELECT sequence_number, COUNT(*) FROM documents GROUP BY sequence_number HAVING COUNT(*) > 1`
- Alert on gaps: expected_next - actual_next > threshold
- Track sequence rollbacks in transaction logs
- Test: try to create 2+ documents in parallel from same endpoint

**Recommended Phase:** Phase 2 (document generation core). Must be implemented before live use.

**Integration Pitfall:** If implemented incorrectly, affects all subsequent phases (3, 4, 5+) that depend on document naming.

---

### Pitfall 2: State Machine Migration Breaks Projects Mid-Status

**What goes wrong:**
Existing projects have status values like 'Pending', 'In Progress', 'Completed' (flat, string-based). New 9-phase state machine uses phases 'Bidding', 'Design', 'Preconstruction', etc. with phase-specific substates. Migration script maps old → new but misses cases:
- Project in undefined state (database corruption, legacy imports)
- Project status doesn't map cleanly (e.g., "Hold" → which phase?)
- Mid-migration, half the codebase uses old status strings, half uses new phase enums
- Rollback required but old statuses overwritten in database

**Risk Level:** CRITICAL

**Why it happens:**
- State machines are all-or-nothing: every status field must be valid
- Legacy data often contains "unknown" or "transitional" statuses
- Developers write feature code before all old code paths are updated
- No clear demarcation of "migration window" where both old and new exist
- Quick mapping ("Pending" → "Bidding") without validating if projects in that state actually belong there

**Consequences:**
- Projects get stuck in invalid state (can't transition, UI crashes)
- Reports filter by old status strings → filter returns zero (logic breaks)
- Bulk operations (bulk status change) fail silently for unmapped records
- Rollback requires restoring from backup; migration must be re-run
- State transition validators reject old-to-new direct transitions
- Features dependent on state (e.g., document generation for "Design" phase only) fail silently

**Prevention:**
- Audit all existing records BEFORE migration: `SELECT DISTINCT(status) FROM projects` → identify ALL possible values
- Pre-allocate mapping for 100% of values, including "unknown" → "error" state or "legacy" → specific phase
- Create interim "compatibility layer" enum that accepts both old and new values, enforces new state machine rules
- Run migration in transaction; validate 100% success before commit or full rollback
- Keep old status field as `status_legacy` for 3+ releases (audit trail, rollback capability)
- Add database constraint: `CHECK (status IN (new_valid_state_machine_values))` AFTER migration succeeds
- Test rollback procedure BEFORE production migration (restore backup, verify data consistency)
- Create "validation queries" that run after migration: count by phase, verify distribution, check for unmapped values

**Detection:**
- Query: `SELECT COUNT(*) FROM projects WHERE status NOT IN (valid_state_machine_values)`
- Spike in state transition errors in logs
- Bulk operations report partial failures
- User reports: "My project is stuck"
- Phase-dependent features don't trigger

**Recommended Phase:** Phase 1 (before implementing any new phase-dependent features). This is a prerequisite, not an afterthought.

**Integration Pitfall:** All downstream phases (2, 3, 4, 5+) depend on valid state machine. Broken migration blocks entire v1.5 launch.

---

### Pitfall 3: Merge Field Detection Failure on Formatted Template Fields

**What goes wrong:**
User creates a Word template with merge fields like `{{ProjectName}}` (bolded or italicized). When the template import system scans for merge fields, it looks for `<w:instrText>` or `<w:fldSimple>` XML tags. But Word stores formatted merge fields as "complex" merge fields split across multiple XML elements (`<w:fldData>`, `<w:fldCharSeparate>`, `<w:fldChar>`), making them invisible to simple field detection regex.

Result: Field doesn't get detected → merge succeeds with placeholder text still in document → PDF has literal `{{ProjectName}}` instead of actual project name → customer sends broken document to client.

**Risk Level:** HIGH

**Why it happens:**
- Word uses different XML schemas for simple vs. complex merge fields
- Simple field = entire merge field in one XML tag
- Complex field = merge field split across opening/closing/separator tags with formatting applied
- Most template parsers only scan for simple fields (easier to implement)
- Testing with unformatted templates misses the issue
- Developers don't understand OOXML structure differences

**Consequences:**
- Customer imports template, gets silently broken output
- Field values don't populate; documents look unprofessional
- No error message ("merge failed") — field just stays as placeholder
- Customer doesn't discover until PDF is sent to client
- Fixing requires re-creating template without formatting
- Loss of customer trust ("import doesn't work")
- Support burden explaining how to recreate templates

**Prevention:**
- Use Open XML parsing library (not regex): python-docx, OpenXmlSDK, docxtemplater
- These libraries handle both simple and complex field schemas automatically
- Test template import with: unformatted fields, partially formatted, fully formatted, mixed formatting
- For XLSX: validate field names match regex `^[A-Za-z0-9_]+$` (spaces/special chars fail)
- Scan for unsupported field types before import: add validation message "Field 'Project Name' has bold formatting; this may cause detection issues"
- Support "field detection preview" before finalize: "Found 12 fields: ProjectName, ClientName, BudgetAmount, ..."
- Log detected fields vs. actual merge results for debugging

**Detection:**
- Compare detected field list against user's expected fields
- Output document has placeholder text instead of values
- Log: "Detected fields: [X], actual merges: [Y]" → mismatch alert
- User reports: "Merge field didn't populate"

**Recommended Phase:** Phase 3 (template import foundation). Phase 2 is core documents; Phase 3 is template import.

---

### Pitfall 4: PDF Page Layout Shifts Break Terms & Conditions Positioning

**What goes wrong:**
Proposal template has: proposal header (p1), project scope (p2), terms & conditions printed on page 3 with specific positioning. As proposal content grows (more line items, more scope details), proposal section expands to 1.5 pages. Terms & conditions automatically push to page 4. But PDF template had absolute positioning: "Terms at Y=500px" which now overlaps with end of proposal.

Result: Terms overlap proposal text, or worse, T&C text is hidden off-page. Legal exposure: customer didn't see terms, contract enforceability questioned.

**Risk Level:** CRITICAL (Legal/Compliance)

**Why it happens:**
- PDF generation treats pages as fixed height (typically 11" = 792px)
- Dynamic content doesn't automatically push subsequent sections down (depends on library)
- Absolute positioning in PDF is pixel-based, not flow-based
- Testing with "typical" proposal size (1.2 pages of content) doesn't trigger page overflow
- No CSS print rules or page break logic in place
- Developers unfamiliar with PDF layout challenges from HTML/CSS conversion

**Consequences:**
- Critical terms not visible in generated document
- Legal/compliance risk (contract enforceability questioned)
- Customer signs without seeing all terms
- Reputational damage if discovered ("we didn't see the terms")
- Regulatory issues on public works (prevailing wage terms not visible)

**Prevention:**
- Use flow-based PDF generation (not absolute positioning): CSS print rules (page-break-before, page-break-inside: avoid)
- Never assume content will fit on one page: test with min/max content scenarios
- For Terms & Conditions: always use `page-break-before: always` or similar to force new page
- Validate PDF output: automated check that section X is on page N (use pdfplumber or similar)
- Test proposal generation with: minimal content (1 item), typical content (5 items), max content (50 items)
- Implement content-aware page breaks: if proposal extends > 80% of page, force T&C to next page
- Visual regression testing on PDFs: compare pages before/after content growth
- Scan PDF for hidden/off-page content: verify all text is readable

**Detection:**
- Visual regression testing on PDF output (compare rendered pages)
- Automated validation: extract text from page 3 → must contain "Terms and Conditions"
- User reports: "I can't see all the terms"
- PDF accessibility scan shows hidden text

**Recommended Phase:** Phase 2 (PDF generation core). Test with dynamic content early.

---

### Pitfall 5: Existing Projects Without "Complexity Mode" Default to Wrong Behavior

**What goes wrong:**
New feature: projects can be "Simple" (basic workflow) or "GC" (general contractor, complex workflow). Old projects created before this feature was added have no `complexity_mode` value (NULL in database). When you add the feature, you must pick a default: Simple or GC?

If default is Simple: contractors with complex projects suddenly can't access advanced features they've been using. If default is GC: simple users see extra UI they don't need.

**Risk Level:** HIGH

**Why it happens:**
- Feature addition assumes all records have the new field populated
- Developers don't anticipate NULL values in production
- Backward compatibility logic is incomplete or never tested with NULL
- No clear demarcation of "migration window" where both old and new exist
- Guessing at defaults without analyzing actual existing projects

**Consequences:**
- Existing customers lose functionality (Simple default breaks complex workflows)
- Existing customers get confused UI (GC default shows advanced options they don't use)
- Data migration script creates wrong mode for projects (guess wrong, break 1000 projects)
- No audit trail: can't tell which projects were auto-assigned vs. user-selected
- Features gated by complexity_mode don't trigger correctly

**Prevention:**
- Run analysis BEFORE adding feature: what % of existing projects are "simple" vs. "complex"?
- Use feature usage patterns: projects with multiple phases → GC; projects with single phase → Simple
- Make `complexity_mode` NOT NULL with explicit value, not NULL default
- Add migration: `UPDATE projects SET complexity_mode = 'Simple' WHERE complexity_mode IS NULL AND {detection_logic}` (e.g., based on feature usage)
- Better: manual selection: prompt user on first login "Is this project simple or complex?" and store answer
- Add `complexity_mode_assigned_at` and `complexity_mode_assigned_by` for audit trail
- Support mode switching (allow upgrade Simple → GC) but log intent
- Test: create project, migrate db, verify mode is correct value (not NULL)
- Add migration check query: `SELECT COUNT(*) FROM projects WHERE complexity_mode IS NULL`

**Detection:**
- Query: `SELECT COUNT(*) FROM projects WHERE complexity_mode IS NULL`
- User reports missing features or unexpected UI
- Bulk operations fail on old vs. new projects differently

**Recommended Phase:** Phase 1 (before shipping complexity_mode feature). Must be decided upfront.

---

### Pitfall 6: State Machine and Complexity Mode Interactions Cause Invalid States

**What goes wrong:**
State machine has states for each phase. Complexity mode (Simple vs GC) changes which states are available. Example: Simple projects can only have "Bidding" + "Completion"; GC projects have full 9-phase workflow.

User creates project as Simple, then switches to GC. But project is currently in "Completion" state, which doesn't have a "next" state in GC phase workflow (should be "Preconstruction" → "Design" → ...). System breaks because state assumes state machine is fixed.

**Risk Level:** HIGH

**Why it happens:**
- Treating state machine and complexity mode independently
- Not planning what happens when mode changes mid-project
- State machine assumes all projects follow same transition rules
- No validation when complexity_mode changes

**Consequences:**
- Projects stuck in incompatible state when mode changes
- State transitions fail or behave unexpectedly
- Reporting by phase becomes invalid
- Document generation keyed to phase fails

**Prevention:**
- Design state machine to be independent of complexity mode; use both as query filters
- When complexity_mode changes: check if current state is compatible; if not, ask user for new state
- Validate: `IF complexity_mode_change THEN validate_current_state_is_compatible(new_mode)`
- Support state "remapping" when mode changes: provide migration path (old state → closest valid state)
- Prevent complexity_mode changes on projects in certain states (only allow when in "Bidding" or "Completion")
- Test: create project as Simple, transition states, change to GC, verify state is still valid

**Detection:**
- State transition failures after complexity_mode change
- Inconsistent state display (state shows "Completion" but UI expects "Design")
- Logging: flag all complexity_mode changes and resulting state validation

**Recommended Phase:** Phase 1 (before Phase 2 features depend on state + complexity_mode together)

---

## Moderate Pitfalls (Medium Risk — Require Significant Rework)

### Pitfall 7: Field Mapping Import Loses Data on Unmapped Fields

**What goes wrong:**
User imports a Word template with 15 merge fields: `ProjectName`, `ClientName`, `Amount`, `StartDate`, etc. Template import system requires user to map each field to a database column. User maps 12 fields, misses 3 (StartDate, ApprovalDate, BudgetFreeze).

System generates document with missing fields as blank/placeholder. User exports that document thinking it's complete, sends to client. Fields are empty, contract appears incomplete.

**Risk Level:** MEDIUM

**Why it happens:**
- Manual field mapping is error-prone; user can't see unmapped fields in a summary
- System doesn't warn about partial mappings
- No validation: "You've mapped 12/15 fields; continue anyway?"
- Complex templates with many fields exceed practical manual mapping
- Developers assume users will catch all missing mappings

**Consequences:**
- Document generation produces invalid/incomplete output
- No audit of what was/wasn't mapped
- Customer sends incomplete contract unintentionally
- Difficult to trace why a field is missing
- Support burden explaining how to re-map

**Prevention:**
- Show field mapping progress: "Mapped 12/15 fields (80%). Missing: StartDate, ApprovalDate, BudgetFreeze"
- Require explicit handling of unmapped fields: map to column, set default value, or mark as "skip/ignore"
- Validate before save: "All fields must be mapped or explicitly ignored. Unmapped: [list]"
- Support "field detection preview": scan template → show all detected fields before mapping starts
- Provide undo/rollback: can always re-import and remap
- Add template versioning: document which fields are "required" vs. "optional"
- Post-generation validation: extract actual field values from document and compare against merged data

**Detection:**
- Compare merged field list against template field list
- Document contains placeholder text instead of values
- Log: incomplete mappings

**Recommended Phase:** Phase 3 (template import). Build validation first.

---

### Pitfall 8: Folder-to-Metadata Migration Loses Hierarchical Information

**What goes wrong:**
Old system: documents stored in folder hierarchy `/Projects/{ProjectId}/{Phase}/{DocumentType}/`. Metadata-driven system: flat folder, documents tagged with project_id, phase, document_type metadata.

Migration script extracts folder path and attempts to populate metadata, but:
- Deep nesting (3+ levels) → unclear mapping to metadata fields
- Folder names have spaces/special characters → metadata validation rejects them
- Sub-folders represent implicit relationships (BOM is under "procurement") → metadata schema doesn't have "procurement" field
- Mixed naming conventions in old folders: some `ProjectName`, some `Project-Name`, some `PROJECT_NAME`

Result: ~30% of documents migrate with truncated/invalid metadata. Old hierarchy lost. Users can't find documents.

**Risk Level:** MEDIUM-HIGH

**Why it happens:**
- Folder structure and metadata schema are fundamentally different data models
- Tool-based migration assumes 1:1 mapping; reality is messy
- Metadata validation is too strict (allows only exact values)
- No preview/validation before bulk migration
- Developers don't understand legacy folder naming conventions

**Consequences:**
- Documents lose location context
- Search by folder context broken
- Users can't find their documents
- Manual re-tagging effort (1000s of documents)
- Rollback required, re-migrate with corrected logic
- Frustration with "new system loses my old documents"

**Prevention:**
- Pre-migration audit: analyze all folder names and nesting patterns
- Design metadata schema to capture folder hierarchy: add `folder_path_legacy` field
- Run "dry run" migration on 100 test documents; validate completeness
- Create mapping table: old folder patterns → new metadata values
- For ambiguous folders: default to "Miscellaneous" rather than skip/error
- Keep `folder_path_legacy` for 3+ releases as audit trail and rollback support
- Build migration preview: show before/after for sample documents
- Implement rollback: keep original folder location in metadata until user confirms new location
- Validate: count documents before migration vs. after migration (should match)

**Detection:**
- Query: `SELECT COUNT(*) FROM documents WHERE metadata_incomplete = true`
- User: "I can't find my documents"
- Audit: compare old folder count vs. migrated document count (should match)

**Recommended Phase:** Phase 4 (document system redesign). This is late but essential.

---

### Pitfall 9: XLSX Table Row Merge Fields Don't Repeat Reliably

**What goes wrong:**
User creates Excel template with a repeating table (line items: item name, qty, price). Template import marks the row as repeating. When merged, system should duplicate the row for each item. But:
- Excel row heights vary → row repeating logic has off-by-one errors
- Merged cells in header → row duplication skips/duplicates header cells
- Formulas in rows don't update cell references → all rows show same calculation result
- Row height auto-fit doesn't persist after merge

Result: output Excel has correct data in first row, then data repeats incorrectly or formulas fail.

**Risk Level:** MEDIUM

**Why it happens:**
- Excel row repeating is more complex than Word (Excel has formulas, cell references)
- Merge libraries don't reliably handle row height changes
- Testing with simple tables (no formulas, no merged cells) misses complexity
- Excel's internal cell reference system (`$A$1` vs. `A1`) handled incorrectly

**Consequences:**
- Generated spreadsheet has incorrect data or formula errors
- Customer uses broken spreadsheet for budget/analysis → wrong numbers
- No clear error message ("repeating failed") — data just duplicates wrong
- Difficult to debug

**Prevention:**
- For Excel: avoid repeating tables; instead generate separate worksheet per data set
- If must repeat: test with formulas, merged cells, varying heights
- Use library that properly handles Excel row repeating + formula updates (docxtemplater, Aspose)
- Validate output: extract values from generated spreadsheet, compare against merged data
- Support "preview before save": show generated output with sample data
- Document Excel template constraints: no repeating tables with formulas, no merged cells in data rows

**Detection:**
- Generated Excel has incorrect calculated values
- User reports: "My budget formulas are broken"
- Compare row count: expected (n items) vs. actual (generated)

**Recommended Phase:** Phase 5 (advanced templates). Phase 3 is basic template import; Phase 5 extends to complex tables.

---

### Pitfall 10: Document Import Encoding Issues with International Characters

**What goes wrong:**
User in Germany imports template with umlauts (ä, ö, ü). DOCX is unzipped to XML; encoding metadata is UTF-8, but XML declaration missing or incorrect. When template system parses XML, it defaults to ASCII or Latin1. Umlauts become garbled (ä → ?,  ö → ?).

Merge happens with corrupted field names: `Äuftragsname` becomes `?uftragname` → doesn't match database field `Auftragsname` → field doesn't merge.

**Risk Level:** MEDIUM

**Why it happens:**
- DOCX/XLSX encoding handling is error-prone (nested ZIP + XML)
- XML parsers have different default encodings
- File upload doesn't validate encoding before processing
- Testing with ASCII-only templates misses the issue
- Not understanding OOXML encoding requirements

**Consequences:**
- International users can't import templates with local characters
- Merge fields with accents fail silently
- No error message; field just stays empty
- Customer sees broken document
- Loss of international market support

**Prevention:**
- Always parse DOCX/XLSX with explicit encoding: `encoding='utf-8'` in XML parser
- Validate ZIP manifest encoding before extracting
- Normalize field names: `Äuftragsname` → `Auftragsname` (remove accents) for matching
- Test imports with international characters: German (ä, ö, ü), French (é, è, ê), Spanish (ñ, á), Chinese/Japanese
- Log encoding errors during import
- Provide fallback: if field not found, offer suggestions (did you mean "Auftragsname"?)

**Detection:**
- Test import with non-ASCII template
- Merged document has ? characters instead of correct characters
- Field detection fails for accented field names

**Recommended Phase:** Phase 3 (template import). Build encoding support early.

---

### Pitfall 11: Backward Compatibility Breaks When New State Transitions Are Required

**What goes wrong:**
Old code path: project can transition from "In Progress" → "Completed" directly. New feature adds intermediate states (Testing, Review, Approval) before Completed.

New code: old direct transition is invalid (not in state machine). Existing scheduled jobs that transition projects automatically fail. Webhook integrations that expect "In Progress" → "Completed" now get unexpected intermediate states.

**Risk Level:** MEDIUM

**Why it happens:**
- State machine changes are rarely backward-compatible with integrations
- Scheduled jobs not updated at same time as schema changes
- Third-party APIs or webhooks assume old state transitions
- Code review didn't catch all callers of old transition

**Consequences:**
- Scheduled jobs crash or hang
- Third-party integrations receive unexpected states → break parsing
- Customer workflows (IFTTT, Zapier) stop working
- Rollback required to restore old transition logic
- Sudden feature breakage after update

**Prevention:**
- Support state transition aliases: `"Complete" can be alias for "Approval" → "Completed"` for backward compat
- Before changing state machine: audit all callers of state transitions (search codebase)
- Update all scheduled jobs, webhooks, integrations at same time as state machine change
- Use feature flags: new state machine behind flag; gradual rollout to 10% customers
- Versioned state transitions: "TransitionV1" (old) vs. "TransitionV2" (new); support both
- Test: run old integration against new state machine; verify graceful handling

**Detection:**
- Spike in state transition errors in logs
- Scheduled jobs fail with "invalid state transition"
- Third-party integration errors logged

**Recommended Phase:** Phase 1 & 2 (state machine + document generation). Before shipping, audit all code paths.

---

### Pitfall 12: Concurrent Document Operations Create File Handle Leaks

**What goes wrong:**
Document generation opens a DOCX template file, reads it, generates PDF output, and closes the file. But if multiple concurrent requests generate documents from same template, file handles aren't released properly (especially on Windows, where file locking is stricter).

Result: "File in use" errors after 50-100 concurrent document generations. PDF generation slows to crawl. Service becomes unresponsive.

**Risk Level:** MEDIUM

**Why it happens:**
- File handle management is left implicit (relies on garbage collection)
- No explicit `finally` block to close file streams
- Template cache holds file handles indefinitely
- Testing sequential document generation doesn't trigger contention
- Windows file locking is stricter than Linux

**Consequences:**
- Service crashes or hangs under load
- Customers report: "Can't download proposal PDF"
- Requires service restart to recover
- Performance degradation (OS limits on open file handles)

**Prevention:**
- Use context managers / try-finally to guarantee file closure: `with open(template) as f: ...`
- Cache uncompressed template in memory (not file), not on disk
- Implement connection/handle pool: limit concurrent file accesses to template count
- Monitor open file handles: set alert if > 1000
- Load test: generate 100 documents concurrently; verify file handles released
- Use async file I/O where possible (not blocking on disk I/O)

**Detection:**
- OS error: "Too many open files" or Windows "File in use"
- Monitor `lsof | grep template` → count open handles
- Performance degradation under concurrent load

**Recommended Phase:** Phase 2 (PDF generation). Load test before shipping.

---

### Pitfall 13: Template Versioning Not Tracked; User Updates Template, Old Documents Invalidated

**What goes wrong:**
Admin creates template v1.0 and generates 50 documents from it. Then admin updates template (changes field names, adds sections). User exports old document from the system; template has changed; exported document now has old structure/fields but new template.

No record of which template version was used to generate each document. User confused why old document doesn't match current template.

**Risk Level:** MEDIUM

**Why it happens:**
- Template versioning not implemented; templates assumed immutable
- No metadata stored with document: "generated from template v1.0"
- No version control on templates

**Consequences:**
- User confusion when re-editing old documents
- Inconsistent document structure across batches
- Audit trail unclear (was this document generated from v1 or v2 of the template?)

**Prevention:**
- Track template versions: auto-increment on each save
- Store with each document: `template_id`, `template_version`, `generated_at`
- Support template rollback: can restore previous version
- Block template deletion: only allow "archive"
- When exporting document, include template version in metadata
- On import, warn user if template has changed since original

**Detection:**
- Compare template version in document metadata vs. current template version
- User reports: "My old document looks different now"

**Recommended Phase:** Phase 3 (template import). Part of template lifecycle management.

---

## Minor Pitfalls (Low Risk — Require Process/Documentation Fixes)

### Pitfall 14: Sequence Number Gaps Confuse Users and Auditors

**What goes wrong:**
Document sequence numbers: 1, 2, 3, 4, 7, 8, 10... (gaps where 5, 6, 9 were deleted). Users assume numbering is wrong, auditors investigate, compliance team asks "where are documents 5 and 6?" — creates manual review overhead.

**Risk Level:** LOW (annoying, not breaking)

**Why it happens:**
- Users delete old/draft documents, expecting numbers to reuse
- Database sequences don't backfill gaps (by design)
- No transparency: gaps are silent, not explained to user

**Consequences:**
- Audit questions (non-critical but annoying)
- Manual review of audit trail
- User confusion: "Did I miss a document?"
- Compliance meetings to explain gaps

**Prevention:**
- Document and communicate: "Document numbers are sequential and never reused, even if a document is deleted"
- Show audit trail: (if user views document 1, 2, 4) explain "Document 3 was deleted on [date]"
- Use soft delete: mark documents as deleted, don't hard delete; maintain numbering integrity
- Add note in settings: "Sequence numbers are permanent and unique"

**Detection:**
- Manual review of number sequence (query: SELECT * FROM documents ORDER BY sequence_number)
- Audit questions from compliance team

**Recommended Phase:** Phase 2 (document generation). Communicate early.

---

### Pitfall 15: No Rollback Plan for Failed State Machine Migration

**What goes wrong:**
State machine migration script runs, converts 10,000 projects. Script completes, but during validation, you find 500 projects in invalid state. Too late to rollback (data already modified, old values overwritten).

You have to manually fix 500 records using raw SQL, creating risk of further corruption.

**Risk Level:** MEDIUM (if migration fails)

**Why it happens:**
- No transaction wrapping: migration commits incrementally
- No backup before migration
- Validation happens too late (after commit, not in dry-run)

**Consequences:**
- Data corruption that requires manual SQL fixes
- Extended downtime for validation + fixes
- Risk of cascading issues (dependent features break)
- Customer impact

**Prevention:**
- Wrap entire migration in transaction: either all succeed or all rollback
- Run validation as part of transaction (not after)
- Backup database before migration; keep backup for 24 hours
- Dry-run migration on staging environment first
- Define rollback procedure and test it before production run
- Use zero-downtime migration strategy: dual-write (both old and new formats) then cut over

**Detection:**
- Validation query identifies invalid states
- Backup restore time > SLA

**Recommended Phase:** Phase 1 (state machine). Before live migration.

---

### Pitfall 16: Complexity Mode and State Machine Interaction Causes UI Confusion

**What goes wrong:**
UI shows "Complexity: Simple" but displays "Current Phase: Design". Simple projects shouldn't have Design phase. User confused because UI is showing contradictory information.

**Risk Level:** LOW (UX issue, not data integrity)

**Why it happens:**
- UI developed without understanding the constraints between complexity_mode and state machine
- No validation in UI layer to prevent displaying incompatible combinations
- State and complexity mode stored independently without constraint

**Consequences:**
- User confusion
- Support questions: "Why does my Simple project show Design phase?"
- Low-level trust in system accuracy

**Prevention:**
- UI layer validates: don't show phase if it's not valid for current complexity_mode
- Add UI tests: create project with each complexity_mode, verify only valid phases displayed
- Document compatibility matrix in UI or help text

**Detection:**
- User reports inconsistency
- UI QA testing across complexity_mode combinations

**Recommended Phase:** Phase 2 (UI for phase-dependent features)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | When it Breaks |
|-------------|---------------|------------|----------------|
| **Phase 1: State Machine** | State machine migration with invalid data mapping | Audit all status values, pre-allocate mappings, transaction-wrap migration | 500+ projects in unexpected states |
| **Phase 1: State Machine** | No rollback plan for migration | Backup DB, test rollback, dry-run on staging | Migration partially succeeds, corrupts data |
| **Phase 1: Complexity Mode** | Existing projects default to wrong complexity_mode | Analyze existing projects, pre-assign based on usage patterns | 50% of customers lose features or see wrong UI |
| **Phase 2: Document Generation** | Sequence number race conditions on concurrent generation | Database locking, load testing with concurrency | 50+ concurrent document requests |
| **Phase 2: PDF Generation** | Dynamic content shifts T&C off page | Flow-based layout, test with min/max content | T&C hidden off-page, legal/compliance issue |
| **Phase 2: Document Naming** | File handle leaks under concurrent load | Context managers, memory caching, load testing | 50+ concurrent generations cause service hang |
| **Phase 3: Template Import** | Merge field detection fails on formatted fields | Use Open XML parsers, test formatted templates | Customer template has formatted fields, no merge |
| **Phase 3: Template Mapping** | Unmapped fields generate as blank/placeholder | Field mapping validation, preview before finalize | Customer sends incomplete document to client |
| **Phase 3: Template Versioning** | No version tracking, template changes invalidate old docs | Store template_version with document, support rollback | Confusion about which version was used |
| **Phase 3: Encoding** | International characters garbled in templates | UTF-8 explicit encoding, normalize field names | German/French/Spanish users can't use templates |
| **Phase 4: Metadata Migration** | Folder structure lost, users can't find documents | Pre-migration audit, legacy field retention, preview | 30% of documents unmapped, users lost |
| **Phase 5: XLSX Templates** | Repeating rows with formulas fail | Avoid repeating in Excel, or use proper library | Budget formulas generate wrong numbers |
| **All Phases** | Backward compatibility breaks integrations | Audit all code callers, update simultaneously, feature flags | Scheduled jobs fail, webhooks break |
| **All Phases** | State + Complexity mode interactions create invalid states | Design mode-independent state machine, validate transitions | Projects stuck in state incompatible with mode |

---

## Feature Ordering Anti-Patterns (What NOT to Build First)

### Anti-Pattern 1: Template Import Before State Machine Migration

**Pitfall:** Building template import (Phase 3) before completing state machine migration (Phase 1) means:
- Templates reference old status fields (no longer valid in state machine)
- Merge fields for status become ambiguous (which phase substatus?)
- Templates must be re-created after migration
- Customer work gets wasted

**Correct order:** State machine migration (Phase 1) → PDF generation core (Phase 2) → Template import (Phase 3)

---

### Anti-Pattern 2: Complexity Mode Feature Without Existing Data Analysis

**Pitfall:** Adding complexity_mode field without analyzing existing projects first means:
- Default assignment (Simple vs. GC) is guessed, breaks 50% of customers
- Requires emergency hot-fix data migration
- Damage to user trust

**Correct approach:** Phase 1 includes data audit and pre-assignment logic before schema change.

---

### Anti-Pattern 3: Document System Redesign (Metadata) Before Core Document Stability

**Pitfall:** Redesigning folder-to-metadata while core document generation is still evolving means:
- Metadata schema changes require data re-migration
- Document refs break during migration
- Phase 4 becomes unstable (bad foundation for Phase 5+)

**Correct order:** Phases 1-3 stabilize document generation and simple templates. Phase 4 is folder → metadata redesign (requires stable core).

---

### Anti-Pattern 4: Complex Templates (XLSX, Repeating Rows) Before Simple Template Stability

**Pitfall:** Building XLSX + repeating row support before simple DOCX templates are solid means:
- Complex issues mask simple issues
- Debugging is harder
- Quality of basic feature suffers

**Correct order:** Phase 3 = basic DOCX templates, simple merge. Phase 5 = XLSX, repeating rows, advanced features.

---

## Summary of Prevention Priorities by Phase

### **Phase 1 (Critical Dependencies):**
- Sequence number locking strategy (prevent race conditions)
- State machine migration with rollback plan (transaction-wrapped, validated)
- Complexity mode pre-assignment (analyze existing data upfront)
- Backward compatibility audit (all code callers, integrations)

### **Phase 2 (Critical):**
- PDF generation with flow-based layout (not absolute positioning)
- Load testing with concurrency (file handle leaks, sequence contention)
- T&C positioning validation (visual regression testing)
- Document naming sequence locking implementation

### **Phase 3 (High):**
- Merge field detection with Open XML parsers (not regex)
- Field mapping validation (all fields mapped or explicitly ignored)
- Encoding support (international characters)
- Template versioning and audit trail

### **Phase 4 (Moderate):**
- Folder migration pre-audit (understand structure before migration)
- Legacy metadata retention (rollback support)
- Mapping table validation

### **Phase 5+ (Lower):**
- Complex XLSX templates (after Phase 3 proven stable)
- Repeating row formulas (after Phase 4 document organization solid)

---

## Sources

**Database Sequences & Race Conditions:**
- [Gaps in sequences in PostgreSQL, causes and remedies](https://www.cybertec-postgresql.com/en/gaps-in-sequences-postgresql/)
- [PostgreSQL: Documentation: CREATE SEQUENCE](https://www.postgresql.org/docs/current/sql-createsequence.html)
- [Sequence Numbers - SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/sequence-numbers/sequence-numbers?view=sql-server-ver17)
- [Using PostgreSQL advisory locks to avoid race conditions](https://firehydrant.com/blog/using-advisory-locks-to-avoid-race-conditions-in-rails/)
- [CWE-362: Concurrent Execution with Improper Synchronization](https://cwe.mitre.org/data/definitions/362.html)

**Backward Compatibility & Schema Evolution:**
- [Backward Compatibility in Schema Evolution: Guide](https://www.dataexpert.io/blog/backward-compatibility-schema-evolution-guide/)
- [Backward Compatibility Is Not Optional](https://techwasti.com/backward-compatibility-is-not-optional/)
- [API Versioning Strategies for SaaS Platforms](https://antler.digital/blog/api-versioning-strategies-for-saas-platforms/)

**PDF Generation & Layout:**
- [Page Breaks in HTML to PDF Conversion](https://www.convertapi.com/blog/css-pagebreaks)
- [Common Issues in HTML-to-PDF Printing](https://www.customjs.space/blog/html-to-pdf-issues/)

**Word/Excel Merge Fields & Template Processing:**
- [Complex mergefields not working · Open-XML-SDK Issue](https://github.com/OfficeDev/Open-XML-SDK/issues/275)
- [Merge Fields in Microsoft Word Templates](https://help.lawmatics.com/en/articles/10699857-merging-fields-in-microsoft-word-templates-docx)
- [Unable to get text of MergeFields · python-docx Issue](https://github.com/python-openxml/python-docx/issues/1370)
- [XLSX Templates – S-Docs Knowledge Base](https://kb.sdocs.com/knowledge-base/sdocs/understanding-template-formats/xlsx-templates/)

**Document Metadata & Migration:**
- [From folder to metadata structure](https://metashare.com/en/from-folder-structure-to-metadata-structure/)
- [Mastering SharePoint Information Architecture 2026](https://clonepartner.com/blog/sharepoint-metadata-vs-folders-information-architecture)
- [What Does It Mean to Flatten Your Document Libraries?](https://www.orchestry.com/insight/why-you-should-flatten-your-document-libraries)

**Table & Row Merging in PDF/Office:**
- [MailMerge: Table Headers and Repeating Blocks](https://www.textcontrol.com/blog/2017/08/01/mailmerge-table-headers-and-repeating-blocks/)
- [Merging Tables That Break Across Multiple Pages](https://www.accessibilityunraveled.com/pdf-remediation/merging-tables-that-break-across-multiple-pages/)
- [7 Table Accessibility Problems in PDFs and How to Fix Them](https://www.continualengine.com/blog/table-accessibility-problems-in-pdfs/)

---

**Overall Confidence:** MEDIUM-HIGH
- State machine migration pitfalls: HIGH (well-documented database patterns)
- Sequence numbering race conditions: HIGH (CWE-362, standard database security issue)
- PDF layout challenges: MEDIUM (limited construction-specific examples)
- Template merge field detection: MEDIUM (OOXML specs verified, but limited case studies)
- Document metadata migration: MEDIUM (SharePoint/enterprise patterns apply, less construction-specific data)

**Limitations:**
- Could not find construction SaaS-specific post-mortems for v1.5-style feature additions
- Limited case studies of sequence number failures in construction doc generation
- Prevailing wage/compliance document term visibility issues not well documented in public sources
