# Research Summary: v1.5 Project Lifecycle Redesign & Document Engine

**Project:** BIDAXIOM — Construction Management SaaS
**Milestone:** v1.5
**Domain:** Construction SaaS — project lifecycle state management, PDF generation, document engine
**Researched:** 2026-02-18
**Synthesized:** 2026-02-18
**Overall Confidence:** MEDIUM-HIGH
**Supersedes:** Previous SUMMARY.md (v1.1 enterprise UI research — now stale)

---

## Executive Summary

v1.5 is a foundational milestone that adds the operational scaffolding construction companies need to run projects end-to-end: a structured 9-phase lifecycle replacing the current flat 4-status field, a document engine that generates PDFs from live project data, and a flat metadata-first document system replacing the folder hierarchy. These three concerns are tightly coupled — lifecycle state gates document generation (change orders only generate in execution phase), and document metadata references lifecycle phase as a core filter tag — so build order matters significantly.

The recommended approach is additive and non-breaking. Introduce a `project_lifecycle_state` table alongside the existing `projects.status` column (kept in sync as a read-only backward-compat field), add metadata columns to the existing `documents` table rather than rebuilding it, and generate PDFs in-process using pdfmake for structured AIA forms and Puppeteer via BullMQ workers for custom template imports. All state transitions run through tRPC mutations with `SELECT FOR UPDATE` locking — not DB triggers — so they carry user context, are auditable, and can be tested cleanly. The entire effort builds on the existing Fastify + tRPC + Drizzle + PostgreSQL + Redis + MinIO stack with five focused library additions.

The top risk by severity is the status migration: mapping existing `active / on_hold / completed / archived` to a 9-phase lifecycle is lossy, and if done incorrectly it blocks every downstream phase. The second-ranked risk is sequence number race conditions on concurrent document generation — a silent defect that creates duplicate document numbers and breaks audit trails. Both must be solved in Phase 1, before any PDF generation or document naming work begins.

---

## Key Findings

### Recommended Stack

Five new libraries augment the existing stack. No architectural changes required. Redis and MinIO already in production; BullMQ and PDF generation layer directly on top.

**New library additions:**

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| **pdfmake** | 0.3.4 | Structured PDF generation (RFQs, AIA forms, invoices) | Declarative JSON → PDF; no browser overhead; safe in-process for standard forms |
| **Puppeteer** | 24.37.3 | Custom HTML/PDF template rendering | Full Chromium rendering for user-imported branded templates; handles complex CSS layouts |
| **docxtemplater** | 3.68.1 | DOCX/XLSX template merge with field substitution | Industry standard; handles simple AND complex OOXML merge fields; covers DOCX + XLSX + PPTX |
| **officeparser** | 6.0.4 | Extract `{placeholder}` fields from uploaded templates | AST-based output; safe for both simple and formatted fields; Dec 2025 release |
| **BullMQ** | 5.67.3 | Async job queue for PDF generation and email delivery | Successor to deprecated Bull; TypeScript-first; uses existing Redis; built-in monitoring |
| **Nodemailer** | 8.0.1 | SMTP email delivery with PDF attachments | Zero dependencies; custom-domain SMTP; no third-party ESP required by requirement |

**PDF approach is dual-track — choose the right tool per document type:**
- **pdfmake:** Auto-generated standard documents (payment apps, RFQs, change orders with predictable structure). Runs in-process in tRPC mutation. Fast, no browser overhead.
- **Puppeteer:** User-imported custom branded templates (proposals with company letterhead, non-standard layouts). Always runs via BullMQ worker — never synchronously in a request handler (100-200MB RAM per instance).

**State machine:** Simple TypeScript enum + transition table — NOT XState. The 9-phase lifecycle is mostly linear with limited branching. XState overhead is not justified until v2 when parallel approval states may emerge.

**Sequence counters:** Counter table + `SELECT FOR UPDATE` — NOT PostgreSQL native SEQUENCES. SEQUENCES do not guarantee uniqueness across concurrent transactions without application-level locking. Counter table with explicit lock is the correct pattern for tenant-scoped auto-increment.

See `.planning/research/STACK.md` for installation commands, environment variable setup, and integration code samples.

---

### Expected Features

**Must have (table stakes — missing these breaks feature parity with Procore/Buildertrend):**

| Feature | Why It's Table Stakes |
|---------|----------------------|
| 9-phase project lifecycle with manual transitions | AIA contracts define Substantial Completion as a contractual milestone; construction industry expects structured phase tracking |
| Audit trail for all state changes | Compliance requirement (FAR 4.7); who changed what, when, and why |
| Backward-transition safeguards | Prevent accidental regression (Closed → Active); require confirmation + reason log |
| Project soft delete + 30-day trash restore | Federal contractor records retention minimum (3 years, FAR 4.7) |
| Simple vs. GC (Advanced) mode selector at project creation | Reduces cognitive load for residential contractors; Buildertrend vs. Procore dichotomy |
| Feature gating by mode | Change orders, lien waivers, subcontractor management: GC mode only |
| Flat document list with metadata filters | Replaces folder hierarchy; Procore pattern; ISO 19650 taxonomy |

**Should have (differentiators for v1.5):**

| Feature | Value Proposition |
|---------|------------------|
| Proposal PDF generation | Client-ready proposals from estimates; eliminates manual Word export |
| Change Order PDF generation | AIA-compliant CO documents from existing CO entries; required fields verified against AIA standards |
| AIA G702/G703 payment application PDF | Auto-populate from payment app entries; G702 contract sections + G703 SOV breakdown |
| RFQ PDF generation | Subcontractor/supplier request documents; lowest complexity of the four types |
| Configurable document naming convention | `CO-{JOB-NUMBER}-{SEQ}`, `{jobNumber}-PA-{seq}`; auto-increment per doc type |
| Document metadata tagging | ISO 19650-inspired: documentType, relatedEntityType, phase, cost code, revision |

**Defer to v1.5.1 / v2:**

| Feature | Why Defer |
|---------|----------|
| Custom template import (Word/PDF upload with field mapping UI) | Field mapping UX is the most complex user-facing feature; validate core PDF gen first |
| Bulk metadata operations | Single-doc tagging sufficient for MVP |
| Document relationship links (RFI → Submittal → Approval chain) | Medium complexity; not blocking for document discovery |
| XState for state machine | 9-phase lifecycle is linear; upgrade if parallel approval states emerge |
| XLSX repeating-row templates with formulas | Formula cell references break on row duplication; defer until DOCX templates proven |

See `.planning/research/FEATURES.md` for full feature dependency map, user flows, and complexity matrix.

---

### Architecture Approach

v1.5 architecture is purely additive — new tables, new columns, no rewrites. The existing tRPC + Drizzle + schema-per-tenant pattern handles all three pillars without modification.

**Major components and their responsibilities:**

| Component | Type | Responsibility |
|-----------|------|---------------|
| `project_lifecycle_state` | New table | Current 9-phase state, `enteredPhaseAt`, transition history JSONB array |
| `advanceProjectPhase` mutation | tRPC | SELECT FOR UPDATE → validate transition → run pre-flight checks → audit log → update state |
| `documents.documentType` / `relatedEntityType` / `relatedEntityId` | New columns | Enable flat metadata discovery without folder navigation |
| `document_templates` | New table | Field mapping configs (JSONB), naming conventions, MinIO storage keys |
| `document_naming_conventions` | New table | Per-company, per-doc-type naming format + sequence counter |
| PDF generation service | In-process + BullMQ | pdfmake for standard forms (in-process); Puppeteer for custom templates (BullMQ worker, concurrency=2) |
| BullMQ workers | Async workers | PDF generation, email delivery — prevent tRPC event loop blocking |
| `folder_archive` | New table | Preserve original folder-document mapping for rollback and audit trail |

**Key architectural rules (non-negotiable):**
- State transitions go through tRPC mutations only — never DB triggers. Mutations carry user context, appear in application logs, and can call external services (webhooks, QBO).
- `SELECT FOR UPDATE` in all phase transitions AND sequence counter increments — mandatory for concurrent request safety.
- Puppeteer always runs via BullMQ worker — never synchronously in a tRPC route.
- `projects.status` stays read-only, synced from lifecycle state — zero breaking changes to existing API.
- Template configs stored as JSONB on `document_templates.config` (field mappings, naming format, layout, signature block positions).

**Migration strategy for existing data:**
- `project_lifecycle_state` table added as non-breaking addition; backfill existing projects with status mapping
- `documents` table gets new columns via `ALTER TABLE`; backfill `documentType` from existing `category` enum
- Original folder mapping preserved in `folder_archive` for rollback
- `folderId` deprecated (nullable, not dropped) for gradual transition

See `.planning/research/ARCHITECTURE-V1.5.md` for full table DDL, migration SQL, tRPC mutation examples, and data flow diagrams.

---

### Critical Pitfalls

Ranked by severity and the order in which they can kill the milestone.

**Tier 1 — Blocking (cause full rollback or rewrite if ignored):**

| # | Pitfall | Phase | Prevention |
|---|---------|-------|-----------|
| 1 | **State machine migration maps existing projects to wrong phase** | Phase 1 | Audit `SELECT DISTINCT(status) FROM projects` before writing migration SQL; map 100% of values including `on_hold`; transaction-wrap entire migration; keep `status_legacy` column for 3 releases; dry-run on staging first |
| 2 | **No rollback plan for failed migration** | Phase 1 | Test rollback procedure on staging before production run; backup database before migration; validate doc-count-before == doc-count-after; wrap in single transaction |
| 3 | **Sequence number race conditions on concurrent document generation** | Phase 2 | Use `SELECT FOR UPDATE` on counter table — never read-then-write without DB lock; load test with k6 at 10+ concurrent generations; monitor for duplicates with detection query |
| 4 | **PDF layout shifts push Terms & Conditions off-page** | Phase 2 | Use flow-based layout with CSS `page-break-before: always` for T&C; test with 1-item, 5-item, and 50-item proposals; never use absolute Y-pixel positioning for critical sections |

**Tier 2 — High (significant rework, erodes user trust):**

| # | Pitfall | Phase | Prevention |
|---|---------|-------|-----------|
| 5 | **Existing projects default to wrong complexity mode** | Phase 1 | Analyze actual feature usage BEFORE adding column; default `GC` mode is safer (existing users have complex workflows); log `mode_assigned_at` + `mode_assigned_by` for audit trail |
| 6 | **State machine + complexity mode interactions create invalid states** | Phase 1-2 | Design state machine independent of mode; validate current state compatibility before any mode change; prevent mode change when project is in incompatible state |
| 7 | **Merge field detection fails on formatted DOCX fields** | Phase 3 | Use `docxtemplater` (handles complex OOXML split-tag fields) — never regex-scan for `{{field}}`; test with bolded, italicized, and mixed-format template fields |
| 8 | **Unmapped template fields silently generate as blank in output** | Phase 3 | Show mapping progress "12/15 fields mapped"; require explicit handling (map, set default, or mark skip) for all unmapped fields before save; validate before committing |

**Tier 3 — Moderate (require rework, manageable with process):**

| # | Pitfall | Phase | Prevention |
|---|---------|-------|-----------|
| 9 | **Folder → metadata migration loses document context** | Phase 4 | Pre-migration audit of all folder naming patterns; keep `folder_path_legacy` column; validate doc count before == after migration |
| 10 | **File handle leaks under concurrent PDF load** | Phase 2 | Always close file streams in `finally` blocks; cache template buffers in memory (not file handles); set BullMQ Puppeteer worker concurrency = 2 |
| 11 | **Template versioning not tracked** | Phase 3 | Store `template_id` + `template_version` on every generated document; only archive templates, never delete |
| 12 | **International characters garbled in template import** | Phase 3 | Explicit `utf-8` encoding in all XML parsers; normalize field names before matching; test with German (ä, ö, ü), French (é), Spanish (ñ) templates |

See `.planning/research/PITFALLS.md` for detection queries, example failure scenarios, and phase-by-phase warning matrix.

---

## Implications for Roadmap

Research across all four files points to a clear 4-phase structure with explicit gates between phases.

### Dependency Map

```
Phase 1: Lifecycle Foundation + Mode Setup
  |
  +-- gates --> Phase 2: PDF Generation (Standard Documents)
                  |
                  +-- gates --> Phase 3: Custom Template Import
                                  |
Phase 4: Document Metadata Redesign <-- depends on stable documentType taxonomy from Phase 2-3
```

---

### Phase 1: Lifecycle Foundation + Mode Setup

**Rationale:** Everything downstream depends on valid lifecycle state. PDF generation references phase (change order PDFs are only valid in execution phase). Feature gating requires mode to be assigned. The complexity mode default decision for existing projects cannot be undone safely after users are live — it must be decided and audited before the column ships.

**Delivers:**
- `project_lifecycle_state` table + indexes
- tRPC mutations: `advanceProjectPhase`, `revertProjectPhase` (with SELECT FOR UPDATE)
- Pre-flight checks before advancing (no open COs before close_out, all bids awarded before execution)
- Transition audit log in `auditLogs` table (user, timestamp, reason, from/to phase)
- Backward compat: `projects.status` synced from lifecycle state as read-only
- Simple vs. GC mode selector on project creation form
- Feature gating by mode (change orders, lien waivers, subcontractor mgmt)
- Project soft delete (`deleted_at`, `deleted_by`) + 30-day trash restore
- Hard delete gate: admin-only, zero financial records, multi-step confirmation

**Features from FEATURES.md:** 9-phase lifecycle, Simple/GC mode, project deletion safeguards

**Pitfalls this phase must avoid:**
- Run `SELECT DISTINCT(status) FROM projects` on production before writing any migration SQL (Pitfall 2)
- Transaction-wrap the entire backfill; dry-run on staging (Pitfall 15)
- Analyze existing project feature usage before assigning mode default (Pitfall 5)
- Design state machine independent of mode from day one (Pitfall 6)

**Research flag: YES — stakeholder validation required.** Transition trigger rules (what data gates each of the 9 transitions) are BIDAXIOM-specific and cannot be resolved by external research. Document explicit entry/exit criteria per phase before implementation starts. See FEATURES.md validation gaps #1 and #2.

---

### Phase 2: PDF Generation (Standard Documents)

**Rationale:** PDF generation is the top differentiator for v1.5 and depends on stable lifecycle state (PDFs reference project phase; only certain doc types are valid per phase). Build standard document types first using pdfmake (structured, predictable) before extending to custom template imports via Puppeteer. This validates the field-mapping architecture against known AIA document structures before facing arbitrary user templates.

**Delivers:**
- Proposal PDF (project summary, SOV breakdown, pricing, terms, signature blocks, company branding)
- Change Order PDF (description, cost impact, schedule impact, AIA signature blocks)
- AIA G702/G703 Payment Application PDF (auto-populate from payment app entries; G702 contract sections + G703 SOV by cost code)
- RFQ PDF (scope items, qty, unit, deadline, vendor info)
- Document naming convention system (`{jobNumber}-PA-{seq}`, `CO-{year}-{seq}`)
- Counter table (`document_naming_conventions`) with `SELECT FOR UPDATE` increment
- BullMQ queue infrastructure: pdf-generation queue, email queue, export queue
- BullMQ workers: PDF worker (concurrency=2 for Puppeteer; unlimited for pdfmake)
- Bull Board monitoring dashboard at `/admin/queues`
- Email delivery via Nodemailer + BullMQ (queued with retry + exponential backoff)

**Stack from STACK.md:** pdfmake, BullMQ, Nodemailer, MinIO (existing), Redis (existing)

**Pitfalls this phase must avoid:**
- Implement sequence locking BEFORE first document generation goes live — not as a follow-up (Pitfall 1)
- Use flow-based PDF layout; test with 1-item, 5-item, 50-item content sizes (Pitfall 4)
- Load test concurrent generation before launch; set Puppeteer worker concurrency = 2 (Pitfall 10/12)
- pdfmake runs in-process; Puppeteer always via BullMQ worker — enforce this boundary strictly

**Research flag: NO.** AIA G702/G703 required fields are documented and verified. pdfmake + BullMQ are established patterns. Standard phase — no phase research needed.

---

### Phase 3: Custom Template Import

**Rationale:** Custom template import is architecturally distinct from standard PDF generation (Puppeteer vs. pdfmake, file upload vs. in-memory data, field detection vs. fixed schema). Deferred to Phase 3 so the core pipeline is validated before facing arbitrary user-supplied templates. Field mapping UI is the highest-complexity user-facing feature in v1.5 and needs a stable document generation foundation beneath it.

**Delivers:**
- DOCX/XLSX template upload endpoint
- Field detection via officeparser (AST-based, handles both simple and complex OOXML fields)
- Field mapping UI: "12/15 fields mapped" progress; must explicitly handle all unmapped fields
- Template merge and DOCX/XLSX output via docxtemplater
- Puppeteer-based rendering for HTML/PDF custom templates (via BullMQ worker)
- Template versioning: `template_version` stored on every generated document; templates archive-only
- UTF-8 encoding enforcement in all XML parsing paths
- `document_templates` table with JSONB config (field mappings, layout, signature block positions)

**Stack from STACK.md:** docxtemplater, officeparser, Puppeteer (via BullMQ worker)

**Pitfalls this phase must avoid:**
- Never regex-scan for merge fields — use docxtemplater to handle complex OOXML split-tag fields (Pitfall 3)
- Require explicit handling of ALL unmapped fields before save; show progress indicator (Pitfall 7)
- Implement template versioning before any user-facing template editing is possible (Pitfall 11)
- Explicit UTF-8 encoding in all XML parsing paths (Pitfall 12)

**Research flag: YES — design spike required.** Field mapping UX has no established construction SaaS reference pattern. The mapping interface (drag-drop vs. dropdown vs. `{field}` syntax) significantly impacts adoption. A UX design spike or prototype review should precede Phase 3 planning.

---

### Phase 4: Document Metadata Redesign (Flat System)

**Rationale:** Document metadata redesign is last because it depends on the `documentType` taxonomy finalized in Phases 2-3. Migrating folder → metadata requires knowing which document types exist and what their metadata fields are. Doing this earlier would require re-migrating existing documents as types are added. Phase 4 also has the highest data-loss rollback risk and must run on stable infrastructure.

**Delivers:**
- New columns on `documents`: `documentType`, `relatedEntityType`, `relatedEntityId`, `isTemplate`, `templateConfig` (JSONB)
- Flat document list UI replacing folder tree navigation
- Faceted filter by: document type, status, phase, cost code, date range, author, approval status
- ISO 19650-inspired taxonomy (document type enum, status codes, revision, discipline)
- `folder_archive` table preserving original folder-document mapping for rollback/audit
- Backfill migration: infer `documentType` from existing `category` + folder name context
- Soft-deprecation of `folderId`: nullable, not dropped, kept for gradual transition

**Pitfalls this phase must avoid:**
- Pre-migration audit of all folder naming patterns before writing migration SQL (Pitfall 8)
- Dry-run migration on 100 test documents; validate doc count before == after
- Keep `folder_path_legacy` column for at least 3 releases
- Defer DROP COLUMN `folderId` to v1.6 minimum

**Research flag: YES — data audit required.** Existing folder naming patterns in production are unknown and will determine migration complexity and classification accuracy. Run `SELECT DISTINCT name FROM folders ORDER BY name` before Phase 4 planning begins. Do not write migration SQL without this data.

---

### Phase Ordering Rationale

- **Phase 1 is an absolute prerequisite.** Lifecycle state is referenced by PDFs (phase gates doc type), feature gating (mode gates UI), and document metadata (phase is a filter tag). No other phase can ship correctly without valid lifecycle state.
- **Phase 2 precedes Phase 3** because the field-mapping architecture needs validation on known AIA document structures (fixed schema, well-documented requirements) before being extended to arbitrary user templates. Bugs in field mapping are much cheaper to fix with known inputs.
- **Phase 4 is intentionally last** because `documentType` enum values must be finalized before migrating existing documents to them. An incomplete taxonomy requires a second migration, which is expensive and risky.
- PITFALLS.md explicitly warns against building template import before state machine migration (Anti-Pattern 1), adding complexity mode without existing data analysis (Anti-Pattern 2), and document metadata redesign before core document stability (Anti-Pattern 3).

---

### Research Flags Summary

| Phase | Research Needed | Reason | Who Resolves |
|-------|----------------|--------|-------------|
| Phase 1: Lifecycle transition triggers | YES — stakeholder validation | Entry/exit criteria per phase are BIDAXIOM-specific; no external research resolves them | Product owner + lead developer workshop |
| Phase 1: Complexity mode default | YES — data audit | Must analyze real feature usage patterns before schema change | Data audit query on production |
| Phase 2: Standard PDF generation | NO | AIA G702/G703 fields documented; pdfmake + BullMQ are standard patterns | N/A |
| Phase 3: Custom template import | YES — design spike | Field mapping UX has no established construction SaaS reference pattern | UX prototyping before planning |
| Phase 4: Document metadata | YES — data audit | Existing folder naming patterns unknown; migration SQL cannot be written blind | Data audit query on production |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | All six library additions verified (versions, Node.js compatibility, TypeScript support, integration patterns). Dual-track PDF approach (pdfmake + Puppeteer) is well-established. BullMQ + existing Redis is drop-in. |
| **Features** | MEDIUM | Core standards (AIA G702/G703, ISO 19650, FAR 4.7) documented and verified. BIDAXIOM-specific transition triggers and exact Simple mode feature list need stakeholder definition — no external source can resolve these. |
| **Architecture** | HIGH | All patterns (tRPC mutations, SELECT FOR UPDATE, JSONB configs, schema-per-tenant extensions) verified against the existing codebase. No novel architecture introduced. Migration strategy is additive and reversible. |
| **Pitfalls** | MEDIUM-HIGH | State migration and sequence race condition risks are well-documented (CWE-362, PostgreSQL docs, cybertec-postgresql.com). PDF layout and OOXML template pitfalls verified via library GitHub issues and specs. No construction SaaS-specific post-mortems found — general enterprise SaaS patterns applied. |

**Overall confidence: MEDIUM-HIGH**

---

### Gaps to Address During Planning or Before Coding

| Gap | If Unresolved | How to Handle |
|-----|--------------|---------------|
| **Lifecycle transition triggers** — what data/events gate each of the 9 transitions? | Pre-flight checks are guessed; wrong checks cause state machine to be either too permissive or frustratingly strict | Stakeholder workshop before Phase 1 planning; document explicit entry/exit criteria per phase |
| **Simple mode feature list** — exact set of features visible/hidden vs. GC mode | Feature gating implementation is undefined; any code written is speculative | Define feature matrix (mode × feature) before Phase 1 planning; decisions lock at mode-column-add |
| **Existing project status distribution** — current status values and any outliers | Migration SQL is guessed; `on_hold` alone may map to multiple phases | Run `SELECT status, COUNT(*) FROM projects GROUP BY status` on production before Phase 1 |
| **Existing folder naming patterns** — how folders are currently named and nested | Folder → metadata migration accuracy unknown; classification will be incomplete | Run `SELECT DISTINCT name FROM folders ORDER BY name` before Phase 4 planning |
| **PDF branding preferences** — logo placement, color scheme, signature block layout per doc type | Phase 2 output documents have wrong layout; rework required | Stakeholder review of sample PDF mock-ups before Phase 2 implementation starts |
| **Mode upgrade path for existing projects** — allow Simple → GC mid-project or lock at creation? | If unlocked: Pitfall 6 (state + mode interaction) triggers; if locked: user frustration when scope expands | Decision required before Phase 1 ships; default recommendation is lock at creation with documented escalation path |

---

## Sources

### Primary (HIGH confidence — official documentation and specifications)

- [AIA G702/G703 Payment Application Standards](https://help.aiacontracts.com/hc/en-us/articles/1500009308242) — required fields for payment applications; G702/G703 structure
- [AIA: Substantial Completion definition](https://learn.aiacontracts.com/articles/substantial-completion-vs-final-completion-understanding-key-construction-milestones/) — contractual lifecycle milestone
- [FAR 4.7 — Federal Contractor Records Retention](https://www.acquisition.gov/far/subpart-4.7) — 3-year minimum retention
- [CWE-362 — Concurrent Execution Improper Synchronization](https://cwe.mitre.org/data/definitions/362.html) — race condition classification
- [PostgreSQL SELECT FOR UPDATE documentation](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) — row-level locking for concurrent safety
- [Cybertec: Gaps in PostgreSQL Sequences](https://www.cybertec-postgresql.com/en/gaps-in-sequences-postgresql/) — why SEQUENCE objects don't prevent duplicate numbering
- [BullMQ Official Documentation](https://docs.bullmq.io/) — queue architecture, concurrency controls, monitoring
- [docxtemplater Official Documentation](https://docxtemplater.com/docs/) — DOCX/XLSX merge field handling, complex field support
- [Puppeteer Official Documentation](https://pptr.dev/) — headless Chrome PDF rendering
- [Open-XML-SDK Issue #275](https://github.com/OfficeDev/Open-XML-SDK/issues/275) — confirmed complex merge field detection failure in OOXML

### Secondary (MEDIUM confidence — multiple sources in agreement)

- [Procore Document Management Naming Standards](https://support.procore.com/faq/what-is-a-naming-standard-in-the-document-management-tool) — naming convention patterns; ISO 19650 reference
- [Autodesk: 6 Stages of Construction](https://www.autodesk.com/blogs/construction/the-6-stages-of-construction/) — lifecycle phase reference model
- [Blackwater Tech: Document Metadata Best Practices](https://blackwater.tech/metadata-tagging-best-practices-for-construction-industry-document-management/) — ISO 19650 taxonomy for construction
- [Nodemailer Official Documentation](https://nodemailer.com/) — SMTP transport, DKIM, attachments
- [AIDI: Differences between Construction Owner and GC Software](https://www.aidi.io/blog/the-differences-between-construction-owner-and-gc-software) — Simple vs. Advanced mode justification

### Tertiary (MEDIUM-LOW — general enterprise patterns applied to construction context)

- SharePoint metadata vs. folder migration patterns — general enterprise DMS patterns applied to construction document migration; not construction-specific
- Procore/Buildertrend Simple vs. GC mode patterns — inferred from public product documentation; not verified via direct API inspection or construction PM interviews

---

*Research completed: 2026-02-18*
*Synthesized: 2026-02-18*
*Ready for roadmap: yes*
*Suggested phases: 4*
*Research flags: Phase 1 (stakeholder validation + data audit), Phase 3 (UX design spike), Phase 4 (data audit)*
*Standard phases (no research needed): Phase 2*
