# Phase 43: Budget Domain Redesign - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the budget domain surfaces (line item table, summary cards, list views) to Procore-level density with column picker, inline row addition, filter chips, and consistent empty states. This phase establishes the domain redesign pattern that phases 44 (Change Order + Payment App) and 45 (Estimates) will replicate. No new financial logic, mutation flows, or data model changes are in scope.

</domain>

<decisions>
## Implementation Decisions

### Column Picker — Scope
- All financial tables with many columns get a column picker: budget line items, projects list, G703 continuation sheet, commitment list, and any other wide table that benefits from hiding columns.
- Not limited to the ROADMAP.md "budget line item table and projects list view" wording — apply wherever useful.

### Column Picker — Pinned Columns
- Only the frozen first column (the identifier column — Cost Code, Job #, Item #, etc.) is permanently visible and cannot be hidden.
- All other columns, including financial amount columns, are hideable via the picker.

### Column Picker — Persistence
- Column visibility selection persists in `localStorage` per table.
- A user who hides "Variance" on the budget table sees it hidden on their next visit without re-selecting.
- No server round-trip needed.

### Column Picker — Control Placement
- A gear/settings icon (⚙) sits in the top-right corner of the table header area.
- Clicking it opens a popover with a checkbox list of all hideable columns.
- No dedicated "Columns" button in the toolbar — keep the table chrome compact.

### Claude's Discretion
- Inline row add UX: Claude determines where the new row appears (top vs bottom), auto-focus field, save/cancel mechanism, and validation approach.
- Filter chips: Claude determines available filter dimensions per entity, chip visual design, and interaction with existing filter dropdowns.
- Empty states: Claude determines icon, heading, description, and CTA per entity type; also handles the "genuinely empty" vs "no filter matches" distinction.
- Column picker popover design: checkbox list style, ordering of columns, search within picker (if list is long).

</decisions>

<specifics>
## Specific Ideas

- The gear icon approach mirrors "table settings" patterns in Linear and Notion — compact without a dedicated toolbar row.
- localStorage key should be table-scoped (e.g., `col-picker:budget-line-items`) so each table's visibility is independent.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 43-budget-domain-redesign*
*Context gathered: 2026-02-22*
