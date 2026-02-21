# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.5 complete — archived Feb 21, 2026. Ready for next milestone (/gsd:new-milestone).

## Current Position

Milestone: v1.5 COMPLETE — all 5 phases (36-40), 27 plans shipped and verified
Status: Milestone archived — .planning/milestones/v1.5-ROADMAP.md + v1.5-REQUIREMENTS.md + v1.5-MILESTONE-AUDIT.md
Last activity: 2026-02-21 — v1.5 milestone archived; PROJECT.md evolved; ROADMAP.md reorganized; git tag v1.5 created

Progress: v1.0: [██████████] 100% | v1.1: [██████████] 100% | v1.2: [██████████] 100% | v1.3: [██████████] 100% | v1.4: [██████████] 100% | v1.5: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 138 (113 through v1.3, +16 in v1.4, +9 in v1.5 so far)
- Average duration: ~4.3 min/plan
- Total execution time: ~9.9 hours

**By Phase (v1.4):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 30 | 3 | ~12 min | ~4 min |
| 31 | 2 | ~35 min (incl. human review) | ~17.5 min |
| 32 | 2 | ~20 min (incl. human verify) | ~10 min |
| 33 | 2 | ~4 min | ~2 min |
| 34 | 5 | ~18 min | ~3.6 min |
| 35 | 2 | ~7 min | ~3.5 min |

**By Phase (v1.5):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 36 | 01 | ~2 min | 2 | 3 |
| 36 | 02 | ~2 min | 2 | 3 |
| 36 | 03 | ~8 min | 2 | 3 |
| 36 | 04 | ~4 min | 2 | 5 |
| 36 | 05 | ~3 min | 2 | 3 |
| 36 | 06 | ~4 min | 2 | 5 |
| 36 | 07 | ~5 min | 2 | 6 |
| 37 | 01 | ~15 min | 2 | 5 |
| 37 | 02 | ~45 min | 2+checkpoint | 9 |
| 38 | 01 | ~4 min | 2 | 5 |
| 38 | 02 | ~3 min | 2 | 4 |
| 38 | 03 | ~6 min | 2 | 3 |
| 38 | 04 | ~6 min | 2 | 3 |
| 38 | 05 | ~6 min | 2 | 3 |
| 38 | 06 | ~4 min | 2 | 3 |
| 38 | 07 | ~4 min | 2 | 3 |
| 38 | 08 | ~60 min (UAT + 3 fixes) | 2 | 4 |
| 39 | 01 | ~3 min | 2 | 6 |

*Updated after each plan completion*
| Phase 39 P01 | 3 | 2 tasks | 6 files |
| Phase 39 P02 | 6 | 2 tasks | 5 files |
| Phase 39 P03 | 5 | 2 tasks | 4 files |
| Phase 39 P04 | 5 | 2 tasks | 5 files |
| Phase 39 P05 | ~90 | 2 tasks + GAP-01 fix chain | 4 files |
| Phase 40 P02 | 1 | 1 tasks | 1 files |
| Phase 40-document-system-redesign P01 | 4 | 2 tasks | 4 files |
| Phase 40 P03 | 5 | 2 tasks | 7 files |
| Phase 40 P04 | ~30 | 2 tasks + UAT (3 inline fixes) | 6 files |

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table (full log, 40 phases, v1.5 complete).
- [Phase 36]: lifecyclePhase defaults to opportunity; projectMode defaults to gc_advanced for backward compat with existing tenants
- [Phase 36-02]: isValidTransition uses index-based comparison (LIFECYCLE_ORDER.indexOf) for O(1) ordinal arithmetic
- [Phase 36-02]: tryAutoAdvance silently returns (no throw) when project is already at or past target phase
- [Phase 36-02]: LIFECYCLE_ORDER and LifecyclePhase were not exported from @construction/shared index — fixed as Rule 3 deviation
- [Phase 36-03]: setMode has no lifecyclePhase guard — mode changes allowed at any project phase
- [Phase 36-03]: tryAutoAdvance placed after create audit log; silently no-ops if project not in preceding phase
- [Phase 36]: canTransition client-side guard uses orgRole===org:admin OR project team estimator/project_administrator; API enforces full RBAC regardless
- [Phase 36-05]: Read-only phase badge in project list uses inline Badge + phaseColors (not LifecyclePhaseBadge) — keeps list column cell minimal and server-friendly
- [Phase 36-05]: projectMode defaults to gc_advanced in form defaultValues; explicit form value takes precedence over server's user-preference fallback
- [Phase 36]: EstimateLineItemsTable uses useParams() to self-resolve projectSlug rather than threading projectMode through WorkflowStepContainer/LineItemsStep
- [Phase 36]: Billing Category dropdown is display-only in Phase 36 — billingCategory DB column deferred to Phase 37+
- [Phase 36]: Mode switch button placed in ProjectHeader next to mode badge for co-location with the badge it modifies
- [Phase 36]: PHASE_FEATURE_GATES uses inclusive allowed-phase lists; isFeatureAvailableInPhase permissive by default for unknown keys; estimates.create intentionally unguarded to preserve auto-advance flow
- [Phase 37-project-deletion-with-safeguards]: checkDeletable checks ALL blocking factors simultaneously (lifecycle phase + change orders + payment apps + commitments) returning complete reasons array
- [Phase 37-project-deletion-with-safeguards]: listDeleted lazy-purges rows older than 30 days inline before SELECT — no background job needed
- [Phase 37-project-deletion-with-safeguards]: acknowledgeRestore has no admin gate — any authenticated user with project access can dismiss the restore banner
- [Phase 37-02]: DeleteProjectButton uses utils.project.checkDeletable.fetch() (direct query fetch) for pre-flight rather than useMutation — semantically a read
- [Phase 37-02]: Deletion from project header redirects via window.location.href to avoid navigating to a soft-deleted project route
- [Phase 37-02]: createColumns factory appends admin delete column conditionally — non-admin renders never include the column
- [Phase 38-01]: documentNamingSettings uses nullable JSONB (no .default()) — null means use platform default naming pattern, matching codebase pattern for optional JSONB config columns
- [Phase 38-01]: documentNamingCounters is not project-scoped — one counter per doc type per company tenant schema for sequential PDF numbering
- [Phase 38-01]: DocumentNamingSettings is Partial<Record<PdfDocType, DocumentNamingConvention>> allowing per-type opt-in with per-type template override
- [Phase 38-02]: getCompanyBranding returns primaryColor "#3B5BDB" hardcoded in Phase 38; logo embedding deferred to Phase 39 (PDF-05 partial)
- [Phase 38-02]: pdfRouter shell has getStatus smoke-test; real procedures added in plans 38-03 through 38-06
- [Phase 38-03]: buildProposalHtml uses escapeHtml() on all user-supplied strings to prevent XSS in Puppeteer-rendered output
- [Phase 38-03]: costTypeLabel() maps DB values (labor/material/equipment/subcontractor) to display labels for the PDF; line item totals calculated as qty*unitCost in procedure
- [Phase 38-03]: "Generate Proposal PDF" button placed in estimate detail page header alongside "Edit Estimate"; success toast shown without auto-redirect to preserve UX continuity
- [Phase 38-04]: Status gate for CO PDF allows pco_submitted/pending_approval/approved; blocks draft/rejected/void
- [Phase 38-04]: ChangeOrderPdfData.lineItems uses amountChange (not qty/unit/unitCost) — CO line items schema has no cost type breakdown; scheduleImpactDays always null (no column in schema)
- [Phase 38-05]: G702 header retainagePercent derived from retainageAmount/totalCompletedAndStored at generation time; applicationNumber uses the stored text value (e.g. "PAY-2026-001") as AIA document reference
- [Phase 38-05]: "Generate AIA G702/G703 PDF" button has no status gate — all payment app statuses can generate a PDF
- [Phase 38-05]: G703 Column I (Retainage %) only rendered when uniformRetainage === false (rates differ across line items)
- [Phase 38-06]: scopeOfWork rendered with white-space: pre-wrap to preserve line breaks; paymentTerms hardcoded Net 30 with TODO comment (rfqs table has no paymentTerms column — deferred to Phase 39+)
- [Phase 38-06]: Generate RFQ PDF button has no status gate — any RFQ status can export (unlike CO which gates on submitted/pending/approved)
- [Phase 38-06]: rfqNumber uses schema rfqs.rfqNumber field directly; sequence only used as fallback if rfqNumber is empty
- [Phase 38-07]: updateDocumentNaming uses simple UPDATE on current companyProfile row (not effective-dating) — documentNamingSettings is config-only JSONB with no historical tracking requirement
- [Phase 38-07]: Only doc types with non-empty templates are sent in settings payload; empty template = use platform default ({DOC-TYPE}-{JOB-NUMBER}-{DATE})
- [Phase 38-08 UAT]: Change order form was silently failing due to 4 root causes — fixed inline during UAT (Rule 1)
- [Phase 38-08 UAT]: Pay app submit/markPaid were sending wrong field names to tRPC — fixed inline during UAT (Rule 1)
- [Phase 38-08 UAT]: RFQ dueDate datetime-local string was not converted to ISO datetime — fixed inline during UAT (Rule 1)
- [Phase 39-01]: BIDAXIOM_FIELD_KEYS uses dot-notation group keys (company.name, project.name, doc.estimateTotal, table.description) matching the canonical field reference from RESEARCH.md
- [Phase 39-01]: documentTemplates table placed BEFORE documents in createTenantSchema to allow FK reference without circular dependency
- [Phase 39-01]: buildTemplateStorageKey omits projectId — templates are company-scoped at tenants/{tenantId}/templates/{uuid}/{fileName}
- [Phase 39-01]: Partial unique index on (doc_type WHERE is_active=true) enforces one-active-template-per-type at DB level
- [Phase 39]: BIDAXIOM_FIELD_KEYS uses dot-notation group keys (company.name, project.name, doc.estimateTotal, table.description)
- [Phase 39]: documentTemplates table placed BEFORE documents in createTenantSchema to allow FK reference without circular dependency
- [Phase 39]: buildTemplateStorageKey omits projectId — templates are company-scoped at tenants/{tenantId}/templates/{uuid}/{fileName}
- [Phase 39]: Partial unique index on (doc_type WHERE is_active=true) enforces one-active-template-per-type at DB level
- [Phase 39-02]: createRequire(import.meta.url) used to CJS-require InspectModule — it has no ESM named export
- [Phase 39-02]: Original-case field display form captured via raw XML regex before InspectModule processes the docx (InspectModule lowercases all keys)
- [Phase 39-02]: ExcelJS Buffer type conflict with Node Buffer<ArrayBufferLike> resolved via Parameters<> cast — avoids unsafe any
- [Phase 39-02]: isPreview flag on buildCustomTemplateHtml defaults to true — unmapped fields render as [UNMAPPED] for preview, empty string for production
- [Phase 39-02]: table.* mapped fields separated from scalar fields by mappedTo.startsWith("table.") — rendered as HTML table rows iterating lineItems
- [Phase 39-03]: ctx.orgRole accessed directly (not ctx.session?.orgRole) — matches all existing routers in codebase; requireAdmin() takes full ctx object
- [Phase 39-03]: deleteTemplate swallows S3 DeleteObjectCommand errors non-fatally — DB row must be cleaned up even if file already gone
- [Phase 39-03]: Preview PDF uploaded to tenants/{tenantId}/previews/{templateId}/preview.pdf — predictable throwaway key overwritten on each preview generation
- [Phase 39-03]: generateRfq custom template called with empty lineItems array — RFQs have no line item table in scope
- [Phase 39-03]: All 4 pdfRouter generate* procedures check documentTemplates for active template before HTML build; realData maps doc-specific pdfData fields to BIDAXIOM_FIELD_KEYS dot-notation format
- [Phase 39-04]: getById procedure added to templateRouter (Rule 2) — field mapping page requires single-template fetch; listByDocType-without-filter is wasteful and semantically wrong
- [Phase 39-04]: Combobox options use flat list with group prefix labels — existing Combobox component is flat; prefixes provide equivalent grouped UX
- [Phase 39-04]: Left panel renders detected fields as clickable button spans (not actual docx HTML) — no mammoth browser dependency; functionally equivalent for field mapping
- [Phase 39]: renderDocxTemplate uses docxtemplater+mammoth pipeline — fills .docx placeholders then converts to HTML, preserving user formatting end-to-end
- [Phase 39-05 UAT]: GAP-01 fixed inline — render.ts was building generic BIDAXIOM-branded HTML instead of using the uploaded .docx file; replaced with renderDocxTemplate (docxtemplater+mammoth pipeline)
- [Phase 39-05 UAT]: LibreOffice alternative explored but rejected — Puppeteer+mammoth HTML path kept for infrastructure consistency with Phase 38/39 PDF stack
- [Phase 39-05 UAT]: isPreview flag cleanly separates [UNMAPPED] placeholders (preview) from empty string (production) without branching at call sites
- [Phase 40]: Page uses trpc.project.getBySlug (same query as layout) — React Query deduplicates the in-flight request; no projectId prop threading needed
- [Phase 40-01]: listUnified post-query type filter: workflow types match workflowType, category types require category match and null workflowId, file keeps remaining with no workflow attachment
- [Phase 40-01]: sendByEmail uses raw getSignedUrl with 7-day expiry (not generateDownloadUrl 1-hour) — email recipients need longer window
- [Phase 40-01]: bulk-download route derives tenant from JWT orgId — never trusts client-supplied tenantId; maintains same security posture as tRPC
- [Phase 40-03]: author options sourced from project.getBySlug teamMembers (already in React Query cache from layout) — no separate user.list call needed
- [Phase 40-03]: React Query v5 has no onError on useQuery — useEffect(documentsError) pattern used for error toast
- [Phase 40-03]: document-filters uses useEffect to sync debouncedSearch to parent onChange — avoids render-time side effect
- [Phase 40-03]: bulk-download fetches Bearer token via fetch('/api/auth/token') same as providers.tsx — consistent auth pattern
- [Phase 40-03]: RowSelectionState index-based mapping: selected rows filtered by index from memoizedData array

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 26 | restore dark/light/system mode toggle to settings/account page | 2026-02-18 | (see git) | [26-restore-dark-light-system-mode-toggle-to](./quick/26-restore-dark-light-system-mode-toggle-to/) |
| 27 | redesign user dropdown layout with grouped company section | 2026-02-18 | (see git) | [27-redesign-user-dropdown-layout-with-group](./quick/27-redesign-user-dropdown-layout-with-group/) |
| 28 | primary buttons to slate-blue; round checkboxes with slate-blue checkmark | 2026-02-18 | (see git) | [28-primary-buttons-to-slate-blue-round-chec](./quick/28-primary-buttons-to-slate-blue-round-chec/) |

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-21
Stopped at: v1.5 milestone complete — all phases verified, milestone archived, git tag created.
Resume file: None
