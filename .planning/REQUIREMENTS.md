# Requirements: ConstructionSaaS v1.2

**Defined:** 2026-02-17
**Core Value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

**Milestone Focus:** Fix broken job number auto-generation system and ensure reliable increment tracking across all project touchpoints.

## v1.2 Requirements

Requirements for job number system fixes and improvements.

### Job Number Configuration

- [ ] **JOBCFG-01**: Company admin can configure job number format in company settings
- [ ] **JOBCFG-02**: Company admin can set starting sequence number (e.g., 1001)
- [ ] **JOBCFG-03**: Company admin can enable/disable auto-generation
- [ ] **JOBCFG-04**: Job number configuration fields are visible and functional in company profile page

### Job Number Assignment

- [ ] **JOBASGN-01**: When auto-generation enabled, new projects receive job numbers automatically
- [ ] **JOBASGN-02**: User can manually enter job number on project creation form
- [ ] **JOBASGN-03**: Manual job number entry increments auto-generation counter
- [ ] **JOBASGN-04**: Auto-generation counter persists correctly across project creations
- [ ] **JOBASGN-05**: Job number field is visible and functional on new project creation page

### Job Number Display

- [ ] **JOBDISP-01**: Job numbers display in project list/table view
- [ ] **JOBDISP-02**: Job numbers display prominently in project detail page header
- [ ] **JOBDISP-03**: Job numbers display on project cards (if card view exists)
- [ ] **JOBDISP-04**: Job numbers display and carry through from estimates to projects

### Job Number Validation

- [ ] **JOBVAL-01**: System prevents duplicate job numbers across all projects
- [ ] **JOBVAL-02**: System validates job number format matches configured pattern
- [ ] **JOBVAL-03**: Clear error messages when job number validation fails

### Job Number Year Rollover

- [ ] **JOBROLL-01**: When year changes, sequence counter resets to starting number
- [ ] **JOBROLL-02**: Year rollover respects configured format (YY updates automatically)
- [ ] **JOBROLL-03**: Projects retain their assigned job numbers after year rollover

## Out of Scope

Items explicitly excluded from v1.2:

| Feature | Reason |
|---------|--------|
| Job number history/audit trail | Focus on fixing core functionality first; audit exists in general audit_logs |
| Bulk job number editing | Not requested; would require additional UX design |
| Custom job number prefixes per project type | Not requested; format is organization-wide |
| Job number search/filtering | Already exists in project search; just needs to work with fixed job numbers |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| JOBCFG-01 | Phase 20 | Pending |
| JOBCFG-02 | Phase 20 | Pending |
| JOBCFG-03 | Phase 20 | Pending |
| JOBCFG-04 | Phase 20 | Pending |
| JOBASGN-01 | Phase 21 | Pending |
| JOBASGN-02 | Phase 21 | Pending |
| JOBASGN-03 | Phase 21 | Pending |
| JOBASGN-04 | Phase 21 | Pending |
| JOBASGN-05 | Phase 21 | Pending |
| JOBVAL-01 | Phase 22 | Pending |
| JOBVAL-02 | Phase 22 | Pending |
| JOBVAL-03 | Phase 22 | Pending |
| JOBDISP-01 | Phase 23 | Pending |
| JOBDISP-02 | Phase 23 | Pending |
| JOBDISP-03 | Phase 23 | Pending |
| JOBDISP-04 | Phase 23 | Pending |
| JOBROLL-01 | Phase 24 | Pending |
| JOBROLL-02 | Phase 24 | Pending |
| JOBROLL-03 | Phase 24 | Pending |

**Coverage:**
- v1.2 requirements: 16 total
- Mapped to phases: 16/16 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 after roadmap creation*
