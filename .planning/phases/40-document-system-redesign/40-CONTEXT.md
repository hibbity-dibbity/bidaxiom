# Phase 40: Document System Redesign - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the project Documents section's folder tree and tab-per-type navigation with a single flat table listing every document (generated PDFs, uploaded files, RFIs, submittals, transmittals, change orders, payment applications, proposals). The table is filterable by type, status, date range, and author, and links through to existing workflow detail views. No new document creation workflows in this phase — only the listing and navigation layer changes.

</domain>

<decisions>
## Implementation Decisions

### Filter presentation
- Filters live behind a filter icon toggle in the top bar — not always visible
- When filters are applied, active filters render as dismissable chips below the search bar (e.g., "Type: RFI ×")
- A text search bar is present alongside the filter toggle — users can keyword-search by document name
- URL state (nuqs) updates live as filters change — Claude decides exact timing/debounce strategy

### Row actions & bulk operations
- Clicking a row is the primary navigation action — opens the document detail view or file
- For RFIs, submittals, and transmittals with no attached file, row click navigates to the existing workflow detail page
- Each row has a ⋮ overflow menu with: Download, Copy link, Send (Email), Delete
- Bulk selection via checkboxes is supported: select multiple rows → bulk download (as zip) or bulk delete (with confirmation dialog)

### Empty & loading states
- Empty state: simple text message only — consistent with the flat design system ("No documents in this project yet.")
- Filtered empty state: same message regardless of whether filters are active (no distinction)
- Loading state: skeleton rows that match the table shape (shimmer)
- Error state: global toast notification only — table area stays blank on fetch failure

### Claude's Discretion
- URL update timing/debounce for live filter state
- Exact skeleton row count and shape
- Toast wording on fetch error
- Download "Copy link" behavior (link to detail page vs direct file URL)

</decisions>

<specifics>
## Specific Ideas

- No specific product references — open to standard flat-table patterns consistent with the existing app density
- The table replaces folder tree AND tab navigation — both surfaces go away entirely

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-document-system-redesign*
*Context gathered: 2026-02-20*
