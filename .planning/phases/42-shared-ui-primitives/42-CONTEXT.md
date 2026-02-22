# Phase 42: Shared UI Primitives - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the shared `table.tsx` primitive with sticky headers, frozen first columns, sortable column headers with chevron indicators, and sticky summary footer rows. Consolidate the status badge system — delete the duplicate `estimates/lifecycle/StatusBadge.tsx` and lock in the 4-tier semantic color model for all badge variants. Every downstream domain phase (43-46) inherits these primitives.

</domain>

<decisions>
## Implementation Decisions

### Column freeze scope
- **All tables** get a frozen first column — not just wide financial tables. Projects list, customers list, subcontractors list, CO list, payment app list, and all line item tables all freeze their first column.
- Specific confirmed tables: budget line items (cost code), SOV builder (description), CO line items (description), estimate line items (description/item), G703 continuation sheet (SOV description)
- The frozen column is always the first column (cost code, name, or description depending on table)

### Sort interaction behavior
- **Single-column sort only** — clicking a new header replaces the current sort; no multi-column Shift+click
- **Unsorted state shows subtle dual-chevron icon** (↑↓) on every sortable column header — makes sortability discoverable without waiting for hover
- **2-state cycle: Unsorted → Ascending → Descending** — no third click back to unsorted; toggle between ascending and descending once a column is sorted
- **Client-side sort only** — sorts already-fetched data in the browser; no server re-fetch required

### Footer row content
- **Budget line items footer:** Total budget, total spent, total variance (3 contextually meaningful columns)
- **G703 continuation sheet footer:** Claude's discretion — pick aggregates appropriate to AIA G702 reconciliation
- **CO list and projects list footers:** Show total dollar values of the currently displayed rows; if filters are applied, the footer totals must reflect the filtered/visible set only (not all records)
- **Other financial line item tables** (estimate line items, commitment list): Claude's discretion for what aggregates matter most

### Claude's Discretion
- G703 footer exact column selection (AIA G702 context: scheduled value total + work-to-date + balance to finish is standard)
- Exact sticky positioning implementation (CSS `position: sticky` vs JS scroll listener)
- Whether payment app list and estimate list get footer rows (CO list and projects list confirmed; others at Claude's discretion)
- Frozen column shadow/border treatment (visual separation from scrollable columns)
- Status badge tier mapping for ambiguous statuses (submitted→amber, under_review→amber, active→green, paid→green, closed→gray, archived→gray, won→green, lost→gray, partial_conditional→amber — Claude can finalize this mapping)

</decisions>

<specifics>
## Specific Ideas

- Footer totals on filtered lists must be **live** — recalculate as filters change. A footer showing "$0 total" because it's not filtering-aware would be confusing and wrong.
- The dual-chevron unsorted indicator is a hint, not clutter — keep it subtle (muted-foreground color, smaller than active chevrons)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 42-shared-ui-primitives*
*Context gathered: 2026-02-21*
