# Phase 39: Custom Template Import + Field Mapping - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A company admin can upload a branded Word (.docx) or Excel (.xlsx) file as a custom template for any of the 4 document types (Proposal, Change Order, Payment Application, RFQ). The system detects merge fields in the uploaded document, presents a visual field mapping interface, lets the user map detected fields to BIDAXIOM data, and activates the template as the company's default for that document type. PDF generation (built in Phase 38) uses the active custom template when one is set, falling back to the built-in Puppeteer layout when none is set.

Requirements: TMPL-01 through TMPL-06 (TMPL-06 scope reduced to FK reference only — no version history UI).

</domain>

<decisions>
## Implementation Decisions

### Merge Field Syntax
- Delimiter: `<<angle_brackets>>` — e.g. `<<project_name>>`, `<<total_amount>>`
- Detection: regex scan on .docx text runs and .xlsx cell values for `<<...>>` patterns
- Case-insensitive: `<<Project_Name>>` and `<<project_name>>` both detected and treated as the same field
- Display: field shown as typed by the user in the template (not normalized)

### Available Data Contexts (Field Mapping Targets)
All 4 data contexts are supported:
1. **Company / Branding** — company name, address, phone, license number, primary color
2. **Project** — project name, job number, address, client name, lifecycle phase, start/end dates
3. **Document-Specific** — varies per doc type:
   - Proposal: estimate total, subtotals, prepared-by
   - Change Order: CO number, description, cost delta, status
   - Payment Application: application number, period dates, contract price, retainage %, amount due
   - RFQ: RFQ number, submission deadline, payment terms, scope of work
4. **Line Item Tables** (repeating rows) — estimate line items, CO line items, SOV rows; rendered as expandable table sections in the output document

### Who Authors Templates
- User authors their Word/Excel template using BIDAXIOM-provided field reference guide
- User types `<<field_name>>` directly in their document
- System detects whatever they typed upon upload — no guided insertion flow
- BIDAXIOM publishes a canonical field reference list (downloadable, shown in UI sidebar)

### Field Mapping UI Layout
- **Split view**: left panel = text preview of the uploaded document with detected `<<fields>>` highlighted in amber; right panel = mapping list
- Clicking a highlighted field in the left panel scrolls the mapping list to that field (and vice versa)
- Progress indicator in the right panel header: "X / Y fields mapped"

### Field Picker
- Grouped dropdown (select/combobox) per mapping row
- Groups: Company, Project, [Doc-Type-Specific], Line Tables
- Searchable type-ahead within the dropdown

### Unmappable Fields
- Fields with no BIDAXIOM equivalent: user can mark as **Ignored** — field placeholder is stripped from output
- No static text replacement option (keep it simple)

### Save Behavior
- Save is always allowed regardless of mapping completeness
- Unmapped fields are auto-ignored on save (stripped from output)
- A warning toast on save summarizes: "2 unresolved fields were removed from output: <<custom_field>>, <<other>>"
- Completely unmapped templates (0 fields mapped) can be saved — useful for static branding-only templates

### Preview Generation
- Available **at any time** during mapping, not gated on completion
- Unmapped fields render as `[UNMAPPED]` in the preview PDF
- Sample data: **hybrid** — real company branding (name, logo, colors from company profile), fixture data for all project/document fields (e.g., "Project Alpha", "$50,000", "CO-2026-001")
- Preview uses same Puppeteer pipeline as Phase 38, but with custom template rendering instead of built-in HTML

### Template Activation
- Toggle switch on each template card — only one template active per doc type at a time
- Toggling on auto-deactivates the previously active template for that doc type
- No confirmation dialog (instant)
- PDF generation (Phase 38 procedures) checks for active custom template first; falls back to built-in layout if none

### Existing Documents on Template Switch
- Previously generated PDFs are frozen — they reference the template that generated them (via `template_id` FK)
- No re-generation prompt or banner
- No template version history UI — TMPL-06 is satisfied by storing `template_id` on `project_documents` rows only

### Version History (Simplified)
- **No version history UI** — user does not need this
- Technical traceability only: `project_documents.template_id` FK stores which template was used to generate each PDF
- Uploading a new file over an existing template replaces it in-place (no versioning, no history)
- Old template files in S3 are overwritten (no retention)

</decisions>

<specifics>
## Specific Ideas

- Field reference guide should be downloadable from the template upload page (e.g., a PDF or shown inline in a collapsible sidebar)
- The split-view layout should be similar to a diff tool — template text on left, structured mapping on right — easy to scan at a glance
- Line item tables are the most complex rendering challenge: `<<line_item_description>>`, `<<line_item_amount>>` etc. inside a repeating section need special handling in docx/xlsx rendering

</specifics>

<deferred>
## Deferred Ideas

- Parallel approval workflows within templates (linear state machine only in v1.5)
- E-signature integration / signature placeholder embedding (deferred to v2)
- Template sharing between companies / marketplace
- AI-assisted field mapping suggestions (could auto-suggest mapping based on field name similarity)
- Bulk re-generation of existing documents when a new template is activated

</deferred>
