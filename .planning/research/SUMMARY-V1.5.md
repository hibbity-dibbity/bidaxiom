# Research Summary: v1.5 Project Lifecycle Redesign & Document Engine

**Project:** Construction Management SaaS v1.5
**Researched:** 2026-02-18
**Overall Confidence:** HIGH

## Executive Summary

v1.5 extends the existing project management system with three interconnected features:

1. **9-Phase Lifecycle** — Replace simple 4-value status enum with a structured project state machine (pre_contract → design → bidding → execution → close_out → maintenance → archived) tracked in a new `project_lifecycle_state` table. Implements phase transitions via tRPC mutations (not DB triggers) for auditability and context awareness.

2. **Flat Document Metadata** — Add metadata columns (`documentType`, `relatedEntityType`, `relatedEntityId`) to existing documents table to enable flat-file discovery without folder navigation. Maintain backward compatibility with optional `folder_archive` for historical reference.

3. **PDF Generation & Templates** — Implement server-side PDF rendering in Fastify API using PDFKit library. Support custom templates with field mapping configs (JSONB) + auto-naming conventions per document type per company.

All changes are **non-breaking** and leverage existing patterns (tRPC mutations, JSONB configs, schema-per-tenant isolation). The architecture is proven by similar implementations already in the codebase (estimate lifecycle, bid lifecycle, document workflows).

---

## Key Findings

### Stack Recommendations

**Lifecycle State Machine**
- Pattern: tRPC mutations with SELECT FOR UPDATE locking
- Rationale: Application context + auditability over DB triggers; prevents race conditions; visible in logs
- Risk: Data loss if migration mapping is inaccurate — mitigate with audit trail + admin review

**Document System**
- Pattern: Flat metadata columns + optional folder_archive for historical reference
- Rationale: Flat discovery scales better than folder navigation; metadata enables API-friendly filtering; archive preserves org structure for compliance
- Risk: Classification accuracy during migration — mitigate with inference from existing category + folder context, then manual review

**PDF Generation**
- Technology: PDFKit (not React-PDF, not Puppeteer)
- Location: In Fastify API (not separate service)
- Rationale: Simplicity (v1.5 volume), alignment with MinIO storage, easier debugging
- Risk: Field mapping complexity — mitigate with template validation + fallback rendering

---

## Architecture Implications for Roadmap

### Phase Dependencies

```
Phase 1: Lifecycle Foundation
├─ Prerequisite for Phase 4 (feature integration)
└─ Non-breaking: can develop in parallel with Phase 2

Phase 2: Document Metadata
├─ Prerequisite for Phase 3 (PDF generation)
├─ Non-breaking: can develop in parallel with Phase 1
└─ Moderate complexity: backfill + index tuning

Phase 3: PDF Generation & Templates
├─ Depends on: Phase 2 (document metadata)
├─ Highest complexity: field mapping validation
└─ Risk mitigation: template dry-run suite

Phase 4: Feature Integration
├─ Depends on: Phase 1, 2, 3
└─ Moderate complexity: wiring phase contexts
```

### Build Order Rationale

1. **Phase 1 first** — Lifecycle foundation is foundational; non-breaking so can ship independently
2. **Phase 2 in parallel** — No dependency on Phase 1; non-breaking; adds metadata for future use
3. **Phase 3 after Phase 2** — Needs document metadata (documentType, relatedEntityId); can parallelize template UI work
4. **Phase 4 last** — Requires all prior phases; integrates phase transitions with business logic

**Total estimated effort:** 16-21 weeks (4 phases, some parallelization possible)

---

## Critical Architectural Decisions

| Decision | Chosen | Why | Alternative Rejected |
|----------|--------|-----|-----|
| **Phase transitions** | tRPC mutations | Context + auditability; visible in logs; easy to test | DB triggers (no context, harder to debug) |
| **Concurrency control** | SELECT FOR UPDATE | PostgreSQL-native, no app-level locks, atomic | Application locks (complexity) |
| **Document discovery** | Flat metadata | Scales with API filtering; no folder navigation complexity | Keep folders (UX friction remains) |
| **PDF rendering** | Fastify + PDFKit | Simplicity, no extra service; fast iteration | Separate service (deployment overhead) |
| **Template storage** | MinIO (files) + JSONB (config) | Existing patterns; files versioned in S3; configs atomic | All-in-DB (bloat) |
| **Sequence counters** | App-level + SELECT FOR UPDATE | Tenant-scoped, atomic | Redis (added dependency), DB SEQUENCES (not multi-tenant) |

---

## Risk Assessment

### High-Risk Areas

1. **Status Migration Mapping** (Risk: Data Loss)
   - Problem: "on_hold" status could map to any phase paused
   - Mitigation: Store original status in metadata, admin review UI, audit trail, dry-run migration
   - Confidence: MEDIUM (depends on data accuracy in field)

2. **Template Field Mapping** (Risk: PDF Generation Failure)
   - Problem: Templates reference removed/renamed columns → rendering fails
   - Mitigation: Template validation suite, dry-run all templates pre-launch, fallback rendering
   - Confidence: MEDIUM (depends on care in mapping specification)

3. **Document Type Inference** (Risk: Misclassification)
   - Problem: Legacy documents with mixed folder contents, ambiguous categories
   - Mitigation: Inference from category + folder, then manual review UI, audit trail
   - Confidence: MEDIUM (depends on data quality)

### Medium-Risk Areas

1. **Circular Document Relationships** — Mitigated by 1-level depth limit
2. **PDF Performance Spike** — Mitigated by rate limiting + future async queue
3. **Phase Transition Validation Logic** — Mitigated by comprehensive pre-flight checks
4. **Backward Compatibility** — Mitigated by read-only projects.status sync

---

## Implications for Phases

### Phase 1: Lifecycle Foundation
- **New tables:** `project_lifecycle_state`
- **Safe to ship alone?** YES (non-breaking, backward compat via read-only projects.status)
- **Deeper research needed?** NO (tRPC/SELECT FOR UPDATE patterns proven in codebase)

### Phase 2: Document Metadata
- **New tables:** `document_naming_conventions`, optional `folder_archive`
- **New columns:** `documents.documentType`, `relatedEntityType`, `relatedEntityId`
- **Safe to ship alone?** YES (non-breaking, parallel with Phase 1)
- **Deeper research needed?** MEDIUM — Validate category/folder classification logic for backfill

### Phase 3: PDF Generation
- **New tables:** `document_templates`
- **New libraries:** PDFKit npm package
- **Safe to ship alone?** NO (depends on Phase 2 for document metadata)
- **Deeper research needed?** HIGH — Field mapping syntax, template validation, fallback strategy

### Phase 4: Feature Integration
- **Changes to:** estimate router, change order router, payment app router
- **Safe to ship alone?** NO (depends on Phases 1-3)
- **Deeper research needed?** MEDIUM — Phase-aware business logic, edge cases (e.g., archived projects can't create new COs)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| **Stack & Architecture** | **HIGH** | Verified against codebase: tRPC patterns, Drizzle ORM, schema-per-tenant model all match recommendations |
| **Lifecycle Design** | **HIGH** | 9-phase model aligns with industry standard (AIA, construction project management) |
| **Document Metadata** | **HIGH** | Simple column additions, non-breaking, proven indexing strategy |
| **PDF Generation** | **MEDIUM** | PDFKit is solid, but template field mapping complexity is unverified; needs proof-of-concept |
| **Migration Strategy** | **MEDIUM** | Data backfill depends on existing data quality; needs validation on actual schema |
| **Phase Transitions** | **HIGH** | SELECT FOR UPDATE pattern proven in codebase (e.g., job number generation) |

---

## Roadmap Implications

### Suggested Phase Structure

**Phase 1: Project Lifecycle Foundation** (4-6 weeks)
- Create `project_lifecycle_state` table
- Implement `advanceProjectPhase` mutation
- Migrate existing projects (status → phase)
- Update project queries to read from lifecycle_state
- **Deliverables:** Admin can advance projects through 9-phase lifecycle; audit trail recorded

**Phase 2: Document Metadata System** (4-5 weeks)
- Add metadata columns to documents table
- Create `document_naming_conventions` table
- Backfill document types from existing category + folder
- Implement `listDocumentsByType` endpoint
- **Deliverables:** Flat document discovery by type; auto-naming on creation

**Phase 3: PDF Generation & Templates** (5-6 weeks)
- Create `document_templates` table
- Implement PDFKit rendering in Fastify
- Build template import workflow
- Generate PDFs for payment apps, change orders
- **Deliverables:** Admin uploads templates; system auto-generates PDFs with field mapping; documents auto-named

**Phase 4: Feature Integration** (3-4 weeks)
- Wire lifecycle phases into estimate, CO, payment app workflows
- Add phase-aware validations
- Add notifications on phase transitions
- Testing + stabilization
- **Deliverables:** Phase context available throughout platform; workflows adapt per phase

### Phase Ordering Rationale

1. **Phase 1 must come first** — Foundational; other phases reference it
2. **Phase 2 can parallel Phase 1** — No dependencies
3. **Phase 3 requires Phase 2** — Document metadata must exist before PDF generation
4. **Phase 4 integrates all** — Must come last

---

## Gaps & Unknowns

### Validation Needed

1. **PDF Template Complexity** — Need proof-of-concept:
   - Can we parse Word/PDF templates to extract field names?
   - What's the learning curve for users mapping fields?
   - Fallback strategy if field missing during render?

2. **Document Type Inference Accuracy** — Need data audit:
   - What % of existing documents have ambiguous category/folder combos?
   - Can we auto-classify with >95% confidence?
   - Manual review effort for edge cases?

3. **Status Migration Correctness** — Need validation:
   - Which projects are "on_hold"? What phase should they map to?
   - Are there edge cases (e.g., projects with completion date but still active)?

### Future Enhancements (Beyond v1.5)

1. **Async PDF Generation** — Bull queue for high-volume rendering
2. **Template Versioning** — Track template changes over time
3. **Phase Auto-Advance** — Automatic transition when conditions met (e.g., → maintenance when past endDate)
4. **Document e-Signatures** — Integrate DocuSign for signature workflows
5. **Phase-Based Workflows** — Different UI/features per phase

---

## Success Criteria for Each Phase

### Phase 1
- ✅ Existing projects successfully migrated to lifecycle phases
- ✅ Phase transitions recorded in audit log
- ✅ Phase-aware queries work correctly
- ✅ Backward compatibility with existing projects.status queries

### Phase 2
- ✅ All documents backfilled with documentType
- ✅ Flat discovery queries perform well (<500ms for typical dataset)
- ✅ Naming conventions configurable per document type
- ✅ No document data loss during migration

### Phase 3
- ✅ Templates render without errors for all document types
- ✅ Field mapping validation works reliably
- ✅ Naming conventions applied correctly to generated PDFs
- ✅ Fallback rendering works when field missing

### Phase 4
- ✅ Phase context visible in all related modules
- ✅ Phase-aware validations prevent invalid actions
- ✅ Notifications sent on phase transitions
- ✅ End-to-end workflow tested (pre_contract → design → execution)

---

## Summary Table

| Aspect | Recommendation | Confidence | Risk |
|--------|---|---|---|
| **Architecture Pattern** | tRPC mutations, SELECT FOR UPDATE | HIGH | MEDIUM |
| **Project Lifecycle** | 9-phase model, `project_lifecycle_state` table | HIGH | LOW |
| **Document System** | Flat metadata, optional `folder_archive` | HIGH | MEDIUM |
| **PDF Technology** | PDFKit + MinIO | MEDIUM | MEDIUM |
| **Migration Path** | Non-breaking, phased backfill, audit trail | MEDIUM | MEDIUM |
| **Build Order** | Phases 1-2 parallel, then 3, then 4 | HIGH | MEDIUM |
| **Overall Readiness** | Ready for Phase 1 kickoff | HIGH | MEDIUM |

---

## Next Steps

1. **Validate PDF Template Strategy** — Create proof-of-concept:
   - Test Word/PDF field extraction
   - Build sample AIA G702 template + field mapping
   - Measure rendering time + accuracy

2. **Audit Existing Data** — Analyze:
   - Document type inference accuracy
   - Status-to-phase migration edge cases
   - Naming convention patterns (are current names structured?)

3. **Detailed Phase 1 Plan** — Before kickoff:
   - Migration script + dry-run on staging
   - Test data for all 9 phases
   - Rollback procedure

4. **Stakeholder Review** — Get buy-in on:
   - 9-phase lifecycle model
   - Flat document discovery UX
   - PDF template maintenance responsibility

