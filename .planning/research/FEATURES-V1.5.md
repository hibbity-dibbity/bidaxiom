# Feature Landscape: v1.5 Project Lifecycle & Document Engine

**Domain:** Construction Management SaaS
**Version:** v1.5
**Researched:** 2026-02-18

---

## Table Stakes (Expected Features)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|---|---|---|
| **Multi-Phase Project Lifecycle** | Construction projects have distinct phases (design, build, closeout); users expect to track progress | Medium | 9-phase model replaces current 4-value status enum |
| **Structured Document Organization** | Users upload hundreds of documents per project; need to find payment apps, RFIs, contracts quickly | Medium | Flat metadata-based filtering + auto-naming |
| **Generated PDF Documents** | Payment apps, change orders, estimates need professional formatting with company branding | Medium | Server-side PDF rendering via PDFKit |
| **Automatic Document Naming** | Users need consistent naming (e.g., "2024-001-PA-005.pdf") without manual entry | Low | Naming convention config per document type |
| **Project Status Visibility** | Dashboard shows which phase each project is in (pre-contract, execution, closeout, etc.) | Low | Phase display + transition UI |
| **Phase-Aware Workflows** | System prevents invalid actions (e.g., no new change orders after closeout) | Medium | Validation in mutations + UI guards |

---

## Differentiators (Value-Add Features)

Features that set product apart; not expected but highly valued.

| Feature | Value Proposition | Complexity | Implementation Notes |
|---|---|---|---|
| **Auto-Phase Advancement** | System can auto-advance project to next phase when conditions met (all bids awarded → execute) | High | Requires background job + state checking; v1.5 MVP = manual only |
| **Custom PDF Templates** | Admins import Word/PDF templates; system field-maps to project data | High | Template parsing + field mapping validation + fallback rendering |
| **Document Relationship Tracking** | Flat list shows which payment app relates to which change order (e.g., "PA-5 relates to CO-2") | Medium | relatedEntityType + relatedEntityId metadata |
| **Audit Trail for Phase Transitions** | Admin dashboard shows who advanced to each phase, when, and why | Low | transitionHistory JSONB + auditLogs table |
| **Template Library** | Company can build reusable templates for payment apps, change orders, estimates | Medium | Template storage + CRUD endpoints + versioning |
| **Phase Transition Alerts** | Email notification when project advances to next phase (e.g., "Project X moved to Execution") | Low | Webhook + email service (existing pattern) |
| **Bulk Document Generation** | Export all payment apps for a project to PDF + ZIP | High | Rate limiting + async queue (v1.6+) |
| **Document Permissions per Phase** | Different user roles can access docs based on phase (e.g., only PM can see closeout docs) | High | Extend existing document_permissions table |

---

## Anti-Features

Features to explicitly NOT build in v1.5 (defer or reject).

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Folder-Based Navigation** | Folder hierarchy creates UX friction; users need metadata filtering | Flat list with filter/search by type, entity, date |
| **Manual PDF Creation** | Users uploading PDF copies of generated docs = duplicates + sync issues | Auto-generate PDFs from data; don't let users upload copies |
| **Multiple Templates per Document Type** | Too many templates = selection UX nightmare; users confused which to use | One default template per type; admins can override |
| **Document Versioning UI** | Complicates UX; most users don't need full version history | Hide version history; restore via admin tool if needed |
| **Real-Time Phase Auto-Advance** | Too many edge cases, false positives; risky to auto-advance without user review | Manual transitions only; future: optional auto-advance with confirmation |
| **E-Signatures in v1.5** | Integration complexity (DocuSign, HelloSign); out of scope | Store unsigned PDFs + link to external signature tool for now |
| **Phase Rollback with Data Correction** | Reverting phase while keeping data changes = inconsistent state | Allow revert, but warn: "This doesn't undo data changes" |
| **Custom Document Types** | Users want unlimited document types = metadata explosion, confusion | Fixed enum: contract, drawing, submittal, rfi, change_order, payment_app, invoice, closeout, photo, other |
| **Cascade Phase Transitions** | "Advance all projects to execution" = data disaster | Phase transitions per-project only; no bulk actions |

---

## Feature Dependencies

```
User-Facing Feature Tree:

Project Lifecycle UI
├── Phase Advancement Mutation
│   ├── Validate transition rules
│   ├── Pre-flight checks (all bids awarded? all COs approved?)
│   └── Audit log entry
├── Phase Dashboard Display
├── Phase-Aware Validations
│   ├── Estimate locked outside pre_contract/design
│   ├── No new COs after close_out
│   └── View-only in archived
└── Phase Transition Notifications

Document System
├── Flat Document Discovery
│   ├── List by documentType
│   ├── Filter by relatedEntityId
│   └── Search by name + tags
├── PDF Generation
│   ├── Load template config
│   ├── Merge data via field mappings
│   ├── Render PDF via PDFKit
│   └── Upload to MinIO
├── Auto-Naming
│   ├── Load naming convention
│   ├── Apply format + sequence
│   └── Create document with name
├── Template Management
│   ├── Upload template file
│   ├── Map fields
│   ├── Test render
│   └── Save config
└── Naming Convention Config
    ├── Define format (UI)
    ├── Set sequence start
    └── Test preview

Integration Points:
├── Payment App → Generate PDF
├── Change Order → Generate PDF
├── Estimate → Generate PDF
└── Phase Transition → Lock/unlock features
```

---

## MVP (Minimum Viable Product) for v1.5

Prioritize these to ship first. Everything else can defer to v1.5.1+.

### Phase 1 MVP: Lifecycle Foundation
1. ✅ Create `project_lifecycle_state` table
2. ✅ `advanceProjectPhase` mutation (manual only)
3. ✅ Phase display on project dashboard
4. ✅ Audit log for transitions
5. ✅ Backward compat: projects.status synced

### Phase 2 MVP: Document Metadata
1. ✅ Add documentType column to documents
2. ✅ `listDocumentsByType` endpoint (filter by type)
3. ✅ Naming convention config CRUD
4. ✅ Auto-apply naming on document creation

### Phase 3 MVP: PDF Generation
1. ✅ Create `document_templates` table
2. ✅ Template CRUD endpoints
3. ✅ PDFKit rendering for payment apps
4. ✅ Field mapping validation
5. ✅ Fallback rendering if field missing

### Phase 4 MVP: Integration
1. ✅ Phase transitions → feature locks (estimates locked outside pre_contract/design)
2. ✅ Generate payment app PDF on approval
3. ✅ Phase-aware validations (no new COs after close_out)

### Defer to v1.5.1+:
- ❌ Auto-phase advancement (requires background jobs)
- ❌ Document permissions per phase
- ❌ Template versioning UI
- ❌ Bulk PDF generation
- ❌ e-Signature integration
- ❌ Phase rollback warnings

---

## User Workflows by Role

### Project Manager

**Workflow 1: Advance Project Through Lifecycle**
```
PM views project dashboard
  ↓
Clicks "Move to Execution Phase"
  ↓
System shows pre-flight checklist:
  - [ ] All RFQs have bids awarded
  - [ ] All contracts signed
  - [ ] Budget approved
  ↓
PM confirms
  ↓
System advances phase + sends email notifications
  ↓
PM sees "Project is now in Execution Phase"
```

**Workflow 2: Access Phase-Specific Documents**
```
PM clicks "Project Documents"
  ↓
UI shows document tabs:
  - All
  - Contracts
  - Drawings
  - Submittals
  - Change Orders (4)
  - Payment Apps (3)
  ↓
PM clicks "Change Orders"
  ↓
System displays flat list (no folder tree):
  - CO-001 (Jan 5) - $5,000
  - CO-002 (Jan 12) - $2,500
  - CO-003 (Jan 20) - -$1,000
  ↓
PM can download, view versions, link related docs
```

### Accountant

**Workflow 1: Generate Payment Application PDF**
```
Accountant opens payment app record
  ↓
Clicks "Generate PDF"
  ↓
System:
  1. Loads AIA G702 template
  2. Merges data (contract sum, completed work, retainage, etc.)
  3. Renders PDF
  4. Names it: "2024-001-PA-005.pdf" (auto-naming)
  5. Uploads to project documents
  ↓
Accountant:
  - Downloads PDF
  - Prints for owner signature
  - Scans signed copy back into project
```

**Workflow 2: Filter Payment Apps by Project Phase**
```
Accountant on project dashboard
  ↓
Filters documents: documentType = "payment_app"
  ↓
System shows all payment apps in chronological order
  ↓
Accountant can:
  - Export all to ZIP + email to client
  - Bulk check approval status
  - Track payment schedule
```

### Company Admin

**Workflow 1: Set Up Document Templates**
```
Admin clicks "Settings" → "Document Templates"
  ↓
Selects "Payment Application"
  ↓
Uploads company's AIA G702 template (PDF)
  ↓
System prompts: "Map fields in template"
  ↓
Admin maps:
  - "Contract Sum" → project.budget
  - "Work Completed" → paymentApp.totalCompleted
  - "Retainage %" → company.retainageConfig.defaultRate
  ↓
Admin tests: "Generate Sample PDF"
  ↓
System renders preview
  ↓
Admin confirms + saves
```

**Workflow 2: Configure Document Naming**
```
Admin clicks "Settings" → "Document Naming"
  ↓
For "Payment Application":
  - Format: "{jobNumber}-PA-{seq}"
  - Sequence Start: 1
  ↓
For "Change Order":
  - Format: "CO-{year}-{seq}"
  ↓
System generates preview:
  - "2024-001-PA-001"
  - "CO-2024-0001"
  ↓
Admin confirms
```

---

## Feature Constraints & Limitations

| Constraint | Reason | Workaround |
|---|---|---|
| **One phase per project** | Simplicity; projects don't have parallel timelines | Projects represent single initiative only |
| **One template per document type** | Reduces user confusion; admins choose default | Admin can change template anytime |
| **Max 10 signature fields per template** | Complexity; most forms have PM + owner | If >10, admin uses external tool (DocuSign) |
| **PDF field mapping must be 1-to-1** | Prevents logic errors; no transformations except basic (currency, date) | Complex transformations done before PDF generation |
| **Naming conventions no recursion** | Prevents circular references; simplicity | Formats are flat strings, no nesting |
| **No phase history modification** | Immutable audit trail; prevents tampering | Admins can view history but not edit |
| **Flat document list only (v1.5)** | Folder navigation removed | Users must use metadata filters/search |

---

## Success Metrics

### Feature Adoption

| Metric | Target | How to Measure |
|---|---|---|
| **Phase Advancement Rate** | 80% of projects transition through at least 3 phases | Dashboard metric: phase distribution histogram |
| **PDF Generation Usage** | 95% of payment apps have generated PDF | Count documents.isGenerated = true |
| **Template Customization** | 50% of companies create custom templates | Count document_templates per company |
| **Auto-Naming Consistency** | 99% of generated documents follow naming convention | Query: documents.name matches pattern |

### Performance Metrics

| Metric | Target | Measurement |
|---|---|---|
| **Phase Transition Time** | <500ms | tRPC endpoint latency P99 |
| **PDF Render Time** | <1 second for typical document | PDFKit render latency P95 |
| **Document List Query** | <200ms for 1000 documents | listDocuments endpoint latency P95 |
| **Template Cache Hit Rate** | >80% | Cache hits / total template loads |

### User Satisfaction

| Metric | Target | How to Measure |
|---|---|---|
| **Phase Feature NPS** | >8/10 | Post-release survey |
| **Document Discovery Ease** | >4/5 stars | UI feedback / support tickets |
| **PDF Quality Satisfaction** | >9/10 | Support ticket volume for PDF issues |

---

## Risk Mitigations by Feature

| Feature | Risk | Mitigation |
|---|---|---|
| **Phase Advancement** | User advances phase prematurely | Pre-flight checklist + audit log + revert option |
| **PDF Generation** | Template field missing → blank field in PDF | Fallback rendering, placeholder text, error log |
| **Auto-Naming** | Sequence counter race condition | SELECT FOR UPDATE locking |
| **Document Type Inference** | Backfill misclassifies documents | Manual review UI, inference confidence score |
| **Template Upload** | Admin uploads invalid template | Validation: check for field names, test render |
| **Naming Format Typo** | Admin creates unparseable format | Format validation, preview before save |

---

## Phase-Specific Recommendations

### Phase 1: Lifecycle Foundation
- **Focus:** Core 9-phase model, manual transitions, audit trail
- **Skip in MVP:** Auto-advance, conditional workflows
- **Testing:** Verify phase transitions don't break existing features

### Phase 2: Document Metadata
- **Focus:** Flat discovery, auto-naming, basic filtering
- **Skip in MVP:** Document type inference from folder (use category only), folder archival
- **Testing:** Verify document count/discovery performance with 10K+ documents

### Phase 3: PDF Generation
- **Focus:** Template rendering, field mapping, fallback strategy
- **Skip in MVP:** Custom template UI (hardcode AIA G702 template), template versioning
- **Testing:** Dry-run PDF generation on all company templates; test field mappings

### Phase 4: Feature Integration
- **Focus:** Phase-aware locks/validations, workflow adaptation
- **Skip in MVP:** Phase-based permissions, conditional feature flags
- **Testing:** End-to-end scenarios (estimate in pre_contract, locked in execution)

---

## Backlog (Not in v1.5)

- E-signature workflows (DocuSign integration)
- Auto-phase advancement based on conditions
- Bulk document operations (export, generate, sign)
- Phase-specific permissions (different UI per phase)
- Document approval workflows per phase
- Template versioning + rollback
- Custom document types (beyond fixed enum)
- Multi-language PDF generation
- Phase-based reporting (metrics per phase)

