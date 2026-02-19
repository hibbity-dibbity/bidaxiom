# Requirements: ConstructionSaaS v1.5

**Defined:** 2026-02-18
**Core Value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

**Milestone Focus:** Replace the flat project status model with a 9-phase state machine, add Simple vs GC complexity modes, generate professional PDF documents from within the app, redesign the document management system, and add project deletion.

---

## v1.5 Requirements

### Lifecycle — 9-Phase State Machine

- [x] **LIFE-01**: The existing project status field (Active/Inactive/etc.) is fully replaced by a 9-phase lifecycle state machine: **Opportunity → Estimating → Submitted → Awarded → Active → Substantial Completion → Closed → Warranty → Archived**. All existing projects are migrated to the new phases (existing data preserved, status mapped to nearest equivalent phase).
- [x] **LIFE-02**: Valid lifecycle transitions are enforced — only forward-adjacent moves are allowed unless an admin explicitly unlocks a backward transition with a reason.
- [x] **LIFE-03**: The system auto-advances projects through lifecycle phases based on system events (e.g., first estimate created → Estimating; estimate submitted → Submitted; award recorded → Awarded; construction start date reached → Active; final payment app approved → Substantial Completion; project closeout → Closed; warranty period passed → Warranty; archive action → Archived). Auto-advance is enabled by default for all projects.
- [x] **LIFE-04**: Every phase transition (manual or auto) is recorded in an audit log: `user_id`, `old_phase`, `new_phase`, `triggered_by` (system or user), `timestamp`, `reason`.
- [x] **LIFE-05**: The project list view and project header display the current lifecycle phase instead of the old status field. A color-coded phase badge is shown (StatusBadge component).
- [x] **LIFE-06**: Phase-specific feature visibility: certain features are only accessible in appropriate phases (e.g., Change Orders only accessible from Active phase onward; Estimates only editable in Opportunity/Estimating phases).

### Project Mode — Simple vs GC

- [x] **MODE-01**: When creating a new project, the user selects a complexity mode: **Simple** (lump sum / draws / T&M — suitable for smaller jobs) or **GC/Advanced** (CSI cost codes + SOV + sub management — suitable for larger GC projects). The default mode is configurable in Company Settings.
- [x] **MODE-02**: Mode is locked after the project reaches the Active phase. The project detail page shows the current mode as a read-only badge.
- [x] **MODE-03**: Simple mode hides: CSI division breakdown, SOV builder, subcontractor bid management, lien waivers. GC/Advanced mode shows all features.
- [x] **MODE-04**: Existing projects default to GC/Advanced mode on migration (they already use advanced features).

### Project Deletion

- [x] **DEL-01**: An admin-only "Delete Project" action is available on the project detail page and the projects table row menu. Non-admin users do not see this option.
- [x] **DEL-02**: Project deletion is blocked (with a clear error message) if the project is in Awarded, Active, Substantial Completion, Closed, or Warranty phase, OR if it has any financial records (change orders, payment applications, committed costs).
- [x] **DEL-03**: When deletion is permitted (Opportunity/Estimating/Submitted phases with no financial records), the user is shown a confirmation dialog that requires typing the project name to confirm.
- [x] **DEL-04**: Deleted projects use soft delete (deleted_at, deleted_by timestamps). A 30-day recovery window is available via admin tools. Hard delete fires automatically after 30 days.
- [x] **DEL-05**: All deletion actions are logged to the audit trail.

### PDF Generation — Standard Documents

- [ ] **PDF-01**: From the Estimates section, a "Generate Proposal PDF" button produces a branded PDF proposal containing: company logo, project name/address, estimate line items with quantities and rates, subtotals, total, and a signature block.
- [ ] **PDF-02**: From the Change Orders section, a "Generate PDF" button on any approved or pending change order produces a branded PDF containing: project name/number, CO number, description, cost breakdown (labor/materials), contract sum impact, schedule impact, and signature blocks.
- [ ] **PDF-03**: From the Payment Applications section, a "Generate PDF" button on any payment application produces an AIA G702/G703-compliant document containing: project info (owner/contractor/architect), application number, period dates, contract price, retainage %, amount due, and SOV breakdown by cost code.
- [ ] **PDF-04**: From the Bidding/Procurement section, a "Generate RFQ PDF" button on any RFQ produces a branded PDF containing: project name/address, list of items (description, qty, unit), submission deadline, and payment terms.
- [ ] **PDF-05**: All generated PDFs use the company logo and brand colors stored in Company Settings. If no custom template is uploaded, a default BIDAXIOM-branded template is used.
- [ ] **PDF-06**: Generated PDFs are stored in the project's document library immediately upon generation and are accessible for download from the document list.

### PDF Templates — Custom Import + Field Mapping

- [ ] **TMPL-01**: In Company Settings → Document Templates, an admin can upload a Word (.docx) or Excel (.xlsx) file as a custom document template for any of the 4 document types (Proposal, Change Order, Payment Application, RFQ).
- [ ] **TMPL-02**: After uploading a template, the system automatically detects merge fields (e.g., `{{project_name}}`, `{{total_amount}}`) in the document and presents a visual field mapping interface where the user maps each detected field to a BIDAXIOM data field (project, estimate, change order, payment app, company).
- [ ] **TMPL-03**: The field mapping UI shows mapping progress (e.g., "Mapped 8/10 fields"). All detected fields must be explicitly mapped to a data source or marked as static text before the template can be saved.
- [ ] **TMPL-04**: After field mapping, the user can generate a preview PDF using sample data to verify the output before activating the template.
- [ ] **TMPL-05**: Custom templates are scoped per company. A company can have one active template per document type; additional uploaded templates are saved but inactive until selected.
- [ ] **TMPL-06**: Template version history is maintained. When a template is updated, previously generated documents retain a reference to the template version used to generate them.

### Document Naming Conventions

- [ ] **NAME-01**: In Company Settings → Document Naming, an admin can configure a naming template per document type using a format string with supported variables: `{JOB-NUMBER}`, `{PROJECT-NAME}`, `{DOC-TYPE}`, `{SEQ}`, `{YEAR}`, `{MONTH}`, `{DATE}`.
- [ ] **NAME-02**: A per-document-type sequence counter auto-increments each time a document of that type is generated. Sequence counters are company-scoped (not project-scoped).
- [ ] **NAME-03**: The naming convention settings page shows a live preview of the resulting filename (e.g., `CO-{JOB-NUMBER}-{SEQ}` → `CO-2025-001-003`).
- [ ] **NAME-04**: When no custom naming convention is configured, generated documents use a sensible default: `{DOC-TYPE}-{JOB-NUMBER}-{DATE}`.

### Document System Redesign

- [ ] **DOC-01**: The project Documents section is redesigned from the current folder/tab structure to a flat table view. All documents (RFIs, submittals, transmittals, change orders, payment applications, proposals, uploaded files) appear in a single table.
- [ ] **DOC-02**: The flat document table supports filtering by: document type, status (Draft / Submitted / Approved / Rejected), date range, and author. Filters are URL-state managed (nuqs).
- [ ] **DOC-03**: Each document row shows: document name, type badge, status badge, related entity (e.g., "CO-005"), created by, created date, and a download link.
- [ ] **DOC-04**: Existing RFI, Submittal, and Transmittal workflow functionality is preserved and accessible from the document table (click a row to view workflow details, approvals, revisions).
- [ ] **DOC-05**: Documents can be filtered by type to reproduce the previous tab experience (e.g., filter by "Submittal" to see all submittals).

---

## Out of Scope

Items explicitly excluded from v1.5:

| Feature | Reason |
|---------|--------|
| Email from within the system | User deferred — out of v1.5 scope |
| E-signature integration (DocuSign/Adobe Sign) | Deferred to v2; signature blocks are placeholders only in v1.5 |
| Parallel state workflows (e.g., owner + GC approval simultaneously) | Linear state machine for v1.5; XState parallel states deferred to v2 |
| AI document drafting improvements | AI drafting deferred; v1.5 focuses on PDF generation |
| Owner/client portal access to generated PDFs | Client portals deferred indefinitely |
| Bulk document metadata editing | v1.5 supports single-doc operations; bulk deferred |
| Document relationship graph visualization | Deferred; document links stored as metadata but no visual graph in v1.5 |
| Mode upgrade path mid-project | Mode is locked at Active phase; upgrade requires new project |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIFE-01 through LIFE-06 | Phase 36 | Pending |
| MODE-01 through MODE-04 | Phase 36 | Pending |
| DEL-01 through DEL-05 | Phase 37 | Pending |
| PDF-01 through PDF-06 | Phase 38 | Pending |
| TMPL-01 through TMPL-06 | Phase 39 | Pending |
| NAME-01 through NAME-04 | Phase 38 | Pending |
| DOC-01 through DOC-05 | Phase 40 | Pending |

**Coverage:**
- v1.5 requirements: 30 total
- Mapped to phases: 30/30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 — initial definition*
