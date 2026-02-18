# Feature Landscape: v1.5 Project Lifecycle Redesign & Document Engine

**Domain:** Construction SaaS — Project lifecycle state management, document generation/management
**Researched:** 2026-02-18
**Confidence:** MEDIUM (core standards verified via Procore/Buildertrend patterns and AIA forms; specific BIDAXIOM lifecycle transitions need validation)

---

## Table Stakes

Features users expect from construction project management software. Missing these = feature parity loss.

### Project Lifecycle State Machine (9 Phases)

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| **9-phase state machine** (Opportunity → Estimating → Submitted → Awarded → Active → Substantial Completion → Closed → Warranty → Archived) | Industry standard in Procore, Buildertrend, and construction workflows. AIA contracts define Substantial Completion as a contractual milestone triggering warranty, insurance, and payment finality. | High | None (new) | **Confidence: MEDIUM**. Standard construction phases documented; specific transition triggers for BIDAXIOM need definition. |
| **Manual state transitions** | Users must control advancement (e.g., mark project "Awarded" after winning bid, "Active" when construction starts). No ambiguity should force auto-advancement. | Low | Exists (status field today) | Users click button to transition; UI validates allowable next states. |
| **State-scoped data visibility** | Different states show/hide features. E.g., budget tracking not needed in Opportunity phase; change orders only in Active phase. | Medium | Exists (phase-aware feature gating) | Reduces UI clutter, improves UX clarity. |
| **Backward-transition safeguards** | Prevent accidental regression (e.g., cannot revert from Closed to Active without explicit unlock). | Low | Exists (soft delete patterns) | Require confirmation + reason log for backward moves. |
| **Audit trail for state changes** | Track who changed status, when, and why (required for compliance). | Low | Exists (audit log table) | Store in state_transitions table with user_id, old_state, new_state, reason, timestamp. |

### Simple vs. Advanced Contractor Mode

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| **Mode selector at project creation** | Contractors choose scope: Simple (residential/small jobs, minimal features) vs. Advanced/GC (large projects, full feature set). Industry pattern in Buildertrend (residential-focused) vs. Procore (enterprise). | Low | None (new) | **Confidence: MEDIUM**. Pattern exists but BIDAXIOM needs mode definitions. |
| **Feature hiding based on mode** | Advanced mode shows: change orders, subcontractor management, multi-phase budgets, lien waivers. Simple mode hides these (users see: estimates, basic payments, documents). | Medium | Exists (feature gates, role-based permissions) | Use feature flags or mode column in projects table. |
| **Mode badge in persistent header** | Show current mode (Simple/Advanced) in top nav so users know active scope. | Low | Exists (UI component system) | One-liner in dashboard/project header. |
| **Mode change lock** | Cannot change mode mid-project (e.g., once "Active" status). Switching requires new project. | Low | None | Safeguard: prevents mid-project feature surprises. |

### Project Deletion with Safeguards

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| **Soft-delete flag** | Mark projects as deleted without destroying data (compliance: federal contractors must retain records for 3+ years). | Low | Exists (soft_delete pattern) | Add deleted_at, deleted_by timestamps. Exclude from list views. |
| **Hard-delete with confirmations** | Only allow hard delete if: (1) project in Opportunity/Estimating, (2) no financial records, (3) 3+ confirmations, (4) admin only. | Medium | Exists (cascading deletes) | Validate: zero change orders, zero payment apps, zero documents before allowing delete. |
| **Restore from trash** | 30-day retention; users see deleted projects in "Trash" section, can restore or permanently delete. | Low | Soft delete + restore logic | Query deleted_at < 30 days for restore. |
| **Deletion audit trail** | Log what was deleted, by whom, when, and why. Non-repudiable record. | Low | Exists (audit table) | deletion_log(project_id, deleted_by, deleted_at, reason, deleted_records_snapshot). |

---

## Differentiators

Features that set BIDAXIOM apart. Not expected industry-wide; valued by power users.

### PDF Generation (Multi-Document Type)

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Proposal PDF generation** | Automatically generate client-ready proposals from estimates. Includes: project summary, SOV breakdown, pricing, terms, logo/branding. Eliminates manual Word export. | Medium | Estimate workflow, branding/company settings | **Confidence: HIGH** (AIA standards + Procore patterns). Required fields: project name, address, estimate items with quantities/rates, subtotal, tax, total, company logo, company info. Layout: header (company info), project details table, itemized cost table, summary/terms section. |
| **Change Order PDF generation** | Auto-generate CO documents from BIDAXIOM CO entries. Includes: original contract sum, CO description, cost impact, schedule impact, signature blocks. | Medium | Change order workflow, approval routing | **Confidence: HIGH** (AIA patterns). Required fields: project name/number, CO description, reason, cost breakdown (labor/materials), impact on contract sum and schedule, signature blocks (contractor/owner/PM), date, CO number. |
| **Invoice/Payment Application PDF** | Generate AIA G702/G703-compliant payment applications directly from payment app entries. Auto-populate with phase breakdown, retainage, prior amounts. | High | Payment application workflow, cost tracking | **Confidence: HIGH** (AIA G702/G703 documented). Required G702 sections: (1) Project info (owner, contractor, architect, dates), (2) Contract price + changes, (3) Work completed to date, (4) Retainage %, (5) Current payment due. G703 continues with SOV breakdown by cost code/phase. Requires notarization fields. |
| **RFQ PDF generation** | Generate RFQ documents to subcontractors/suppliers. Includes: project scope, item list, quantity, unit, deadline, return instructions. | Low | Cost estimate/budget module | **Confidence: MEDIUM** (standard templates exist; BIDAXIOM integration needs definition). Required fields: project name/address, RFQ items (description, qty, unit), delivery date, payment terms, supplier info section. |
| **Custom template import** | Users upload Word/PDF/Excel templates, map fields (e.g., {{project_name}}, {{total_cost}}) to BIDAXIOM data, generate customized PDFs. Supports company-specific branding. | High | PDF rendering engine, field mapping UI | **Confidence: MEDIUM** (Aspose/LibreOffice patterns; native implementation is heavy). Field mapping UX critical: drag-drop or {field} syntax to bind document placeholders to BIDAXIOM columns. |

### Document Naming Convention System

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Configurable naming template** | Users define naming rules: e.g., `CO-{JOB-NUMBER}-{SEQ}` or `RFQ-{YEAR}-{SEQ}-{VENDOR}`. Auto-applies to generated documents. | Medium | Document storage, sequence counter | **Confidence: HIGH** (Procore supports ISO 19650 + custom patterns). Patterns to support: {JOB-NUMBER}, {PROJECT-NAME}, {DOC-TYPE}, {SEQ}, {YEAR}, {MONTH}, {DATE}, {VENDOR/SUBCONTRACTOR}, {PHASE}. Backend: parse template, substitute variables, auto-increment sequence. |
| **Automatic sequence numbering** | Per-document-type counters (CO sequence, RFQ sequence, etc.). Resets annually or per-project. | Low | Counter/sequence table | Global + per-project options. |
| **Naming conflict prevention** | If document name exists, auto-append (1), (2), etc. or require user override. | Low | Document existence check | Validation on upload + generation. |

### Document System Redesign (Flat Table + Metadata Filters)

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Flat document list** | Replace folder tree with a single searchable table. All documents (RFIs, submittals, transmittals, change orders, invoices) in one view with sortable/filterable columns. | Medium | Document storage refactor, metadata schema | **Confidence: HIGH** (Procore pattern; AIA submittals require structured metadata). Replaces folder hierarchy (common pain point: "Where did I save that RFI?"). |
| **Metadata tagging per document type** | ISO 19650-inspired taxonomy: status (S1-ready, D1-approved, A-construction-ready), revision code, discipline, document type, phase, cost code. CSI MasterFormat division mapping. | Medium | Metadata schema, taxonomy automation | **Confidence: HIGH** (industry standard). Core fields: document_type (enum: RFI/Submittal/Transmittal/CO/Invoice/RFQ/etc.), phase (from project lifecycle), cost_code (from budget), status (Draft/Submitted/Approved/Rejected), revision, author, created_date, modified_date, approval_status. |
| **Faceted search/filter** | Filter by: document type, status, phase, cost code, date range, author, approval status. Multi-select. Saves common filter sets. | Medium | Search backend (full-text or faceted index), filter persistence | Users can save filter "Show me all Approved submittals for Phase 3" as a view. |
| **Bulk metadata operations** | Apply tags/status to multiple docs: Select N documents, set status=Approved, phase=Active, cost_code=3000. | Low | Bulk update API, permission checks | Speeds workflow; requires audit log for compliance. |
| **Document relationship links** | Link related docs: e.g., RFI → Submittal → Transmittal → Approval. Visualize dependency chain. | Medium | Document relationship graph | Improves traceability. |

---

## Anti-Features

Features explicitly NOT to build (scope safeguards).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Folder-based document storage** | Causes "lost document" UX problems. Deep nesting hides files. Doesn't scale with multi-disciplinary projects. | Use flat table + metadata filters (already planned). Folders become views/saved filters. |
| **Manual PDF generation (no templating)** | Users manually create/edit PDFs in Word/Acrobat. Duplicates effort, introduces errors, breaks branding consistency. | Implement auto-generation with templates + custom import. |
| **Auto-transition state machine** | Tempting but dangerous: "Auto-advance to Active when first change order approved" → unexpected state shifts → compliance issues. | Keep all transitions manual + logged. Optional auto-triggers (future) only after 2+ phases of validation. |
| **Unlimited backward transitions** | Users revert project state casually, losing audit trail integrity and confusing financial records. | Safeguard: backward transitions require approval + reason. Track in audit log. |
| **Hard delete (unrestricted)** | Violates federal retention requirements (3-year minimum). Creates compliance risk. | Soft delete + trash/restore pattern. Hard delete only with multi-step confirmation and admin role. |
| **Mode switching mid-project** | Changes feature availability mid-lifecycle → user confusion, broken workflows. "Wait, where did my change order form go?" | Lock mode at creation. If scope expands, require new project or explicit escalation. |
| **Unstructured document metadata** | Free-text "tags" → inconsistency → search failure. "Phase 1" vs "Phase-1" vs "P1". | Enforce controlled vocabulary. Dropdown/enum for all core fields. |

---

## Feature Dependencies

### Phase 1: Project Lifecycle State Machine
- **Depends on:** Existing project table + status field
- **Blocks:** State-scoped feature visibility, simple/advanced mode gating
- **Data schema:** Add state_transitions audit table, locked_until timestamp

### Phase 2: Simple vs. Advanced Mode
- **Depends on:** Project lifecycle state machine
- **Blocks:** Feature flag configuration, role-based permissions
- **Data schema:** Add mode column (enum: simple/advanced), mode_locked_at

### Phase 3: Project Deletion with Safeguards
- **Depends on:** Existing soft-delete pattern, audit logging
- **Blocks:** None (orthogonal)
- **Data schema:** Add deleted_at, deleted_by, expand deletion_log table

### Phase 4: PDF Generation (Core Types)
- **Depends on:** Estimate, change order, payment app, budget modules (exist)
- **Blocks:** Custom template import, document naming
- **Tech:** PDF library (e.g., PDFKit, LibreOffice, Aspose)

### Phase 5: Custom Template Import
- **Depends on:** PDF generation core types
- **Blocks:** None
- **Tech:** Field mapping UI, template validation

### Phase 6: Document Naming Convention
- **Depends on:** Document storage, PDF generation
- **Blocks:** Document management redesign
- **Data schema:** Add naming_template (company), sequence counters per doc type

### Phase 7: Document Management Redesign
- **Depends on:** All above features (naming, metadata, PDF gen)
- **Blocks:** None (final polish)
- **Data schema:** Major refactor: flat documents table, metadata columns, ISO 19650 fields

---

## MVP Recommendation

### Build First (MVP)
1. **Project Lifecycle State Machine** (9 phases)
   - Establishes foundation for all downstream features
   - Minimal UI: dropdown to change state, confirmation dialog
   - Dependency: None
   - Complexity: Low-Medium

2. **Simple vs. Advanced Mode** (feature gating)
   - Unlock advanced features (change orders, lien waivers) for GC mode only
   - Simplify UX for residential/small contractors
   - Dependency: State machine (for context)
   - Complexity: Low

3. **PDF Generation (Proposal + Change Order + Invoice)**
   - High-value differentiator; enables modern workflows
   - Start with templated output; custom import in v1.5.1
   - Dependency: Existing estimate/CO/payment modules
   - Complexity: Medium

4. **Document Metadata & Flat List**
   - Redesign document discovery (flat table > folder chaos)
   - ISO 19650 core fields (status, revision, phase, cost code)
   - Dependency: None (orthogonal to state machine)
   - Complexity: Medium

### Defer (Post-MVP)
- **Custom Template Import:** Complex field mapping UI. Build after core PDF gen is validated in production.
- **Document Naming Convention Customization:** Phase 2 feature; most users accept auto-naming. Configurable naming is power-user feature.
- **Bulk metadata operations:** Phase 2. Single-doc tagging sufficient for MVP.

---

## Complexity Analysis

| Feature | Frontend | Backend | Data Schema | Testing | Priority |
|---------|----------|---------|-------------|---------|----------|
| State machine (manual transitions) | ★★☆ (dropdown UI) | ★★☆ (validation, audit) | ★★☆ (audit table) | ★★★ (edge cases: backward transitions) | 1 (blocker for other features) |
| Simple/Advanced mode | ★★☆ (feature toggles) | ★★☆ (role checks, queries) | ★☆☆ (mode enum) | ★★☆ (permission tests) | 2 (unlocks advanced features) |
| Project deletion | ★☆☆ (confirm dialog) | ★★☆ (cascade logic) | ★☆☆ (soft delete flags) | ★★★ (data integrity) | 3 (polishing, compliance) |
| PDF generation | ★★★ (template rendering) | ★★★ (templating engine) | ★★☆ (template table) | ★★★ (PDF output samples) | 4 (differentiator) |
| Custom template import | ★★★ (field mapper UI) | ★★★ (PDF rendering, validation) | ★★☆ (template storage) | ★★★ (template parsing) | 7 (power-user feature, defer) |
| Document naming | ★★☆ (UI optional) | ★★☆ (sequence logic, parsing) | ★★☆ (counter table, template) | ★★☆ (name collision tests) | 5 (after PDF gen) |
| Document system redesign | ★★★ (table + filters) | ★★★ (indexing, faceted search) | ★★★ (metadata columns, refactor) | ★★★ (search accuracy) | 6 (final polish) |

---

## User Flows

### Flow 1: Create Project & Select Mode
1. User clicks "New Project"
2. Form appears: Name, Address, Client, Mode selector (Simple/Advanced radio)
3. User selects Advanced → form shows additional fields (GC name, Estimator, etc.)
4. User creates project → Project starts in Opportunity state

### Flow 2: Advance Project Through Lifecycle
1. User views project dashboard
2. Current state badge shown: "Opportunity"
3. User clicks "Mark as Estimating" → confirmation dialog → state transitions to Estimating
4. Estimate workflow becomes available; change order form hidden (until Active)
5. Once estimate submitted → user clicks "Mark as Submitted"
6. Later, user clicks "Mark as Awarded" (job won)
7. At construction start → "Mark as Active" → change orders + payment apps now visible

### Flow 3: Generate Proposal PDF
1. User completes estimate in SOV builder
2. "Export as Proposal PDF" button appears
3. Click → PDF rendered with: company logo, project summary, itemized SOV, terms, signature blocks
4. PDF downloads; user emails to client

### Flow 4: Generate Change Order PDF
1. User creates change order (UI exists)
2. "Generate PDF" button → PDF rendered: description, cost impact, schedule impact, approval signature blocks
3. PDF emailed to stakeholders for approval
4. Returned signed → uploaded back to system, status → Approved

### Flow 5: Browse Documents (New Flat UI)
1. User navigates to Documents section
2. Flat list shown: 47 documents in project
3. Filter by: "Document Type = Submittal, Status = Pending Review" → 5 results
4. User selects one → preview + metadata sidebar (phase, cost code, author, revision)
5. Can tag/update status in bulk

---

## Sources

- [Procore Document Management Naming Standards](https://support.procore.com/faq/what-is-a-naming-standard-in-the-document-management-tool)
- [AIA G702/G703 Payment Application Standards](https://help.aiacontracts.com/hc/en-us/articles/1500009308242-Instructions-G702-1992-Application-and-Certificate-for-Payment)
- [Construction Project Lifecycle Phases (Autodesk)](https://www.autodesk.com/blogs/construction/the-6-stages-of-construction/)
- [Construction Document Metadata Best Practices (Blackwater Tech)](https://blackwater.tech/metadata-tagging-best-practices-for-construction-industry-document-management/)
- [ISO 19650 Metadata Standards](https://www.procore.com/faq/what-is-a-naming-standard-in-the-document-management-tool)
- [Construction Software: Simple vs. Advanced Features](https://www.aidi.io/blog/the-differences-between-construction-owner-and-gc-software)
- [Federal Contractor Records Retention (FAR 4.7)](https://www.acquisition.gov/far/subpart-4.7)
- [Substantial Completion (AIA Contract Documents)](https://learn.aiacontracts.com/articles/substantial-completion-vs-final-completion-understanding-key-construction-milestones/)

---

## Validation Gaps

These require phase-specific research or stakeholder validation:

1. **Lifecycle transition triggers:** What data/events auto-trigger or should manually trigger transitions? (e.g., "Does first payment app automatically advance to Active, or always manual?")
2. **Simple mode hidden features:** Exact feature list for residential vs. GC. (e.g., Is lien waiver visible in Simple mode?)
3. **PDF template structure:** BIDAXIOM-specific branding/layout preferences. (e.g., Logo placement, color scheme, required signature blocks per document type.)
4. **Document metadata mapping:** Which cost codes/phases matter most for filtering? (e.g., Should documents filter by CSI division or BIDAXIOM cost code?)
5. **Mode upgrade path:** If user starts Simple, can they upgrade to Advanced mid-project, or requires new project? (Compliance / UX implication.)

---

## Confidence Summary

| Area | Level | Reason |
|------|-------|--------|
| **Lifecycle phases** | MEDIUM | Standard 9-phase construction model documented; specific BIDAXIOM triggers need validation. |
| **Simple/Advanced modes** | MEDIUM | Pattern confirmed in Buildertrend/Procore; feature list needs BIDAXIOM specifics. |
| **PDF standards (G702/G703)** | HIGH | AIA standards documented; proposal/invoice/CO required fields verified. |
| **Document naming (ISO 19650)** | MEDIUM | Standards exist; Procore implementation confirmed; BIDAXIOM template syntax needs definition. |
| **Document metadata taxonomy** | MEDIUM | Industry best practices verified; BIDAXIOM metadata schema needs alignment with cost codes/phases. |
| **Deletion safeguards** | MEDIUM | Federal retention (3-year) confirmed; soft-delete pattern is standard; specific BIDAXIOM policy needs definition. |
