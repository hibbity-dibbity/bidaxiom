# Phase 52: Trade Simplification - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the CSI division code trade selector on subcontractor create/edit forms and the subcontractors list filter with a plain 12-trade list. Subcontractors can hold multiple trades. Existing CSI data is cleared. The scope is the subcontractor create/edit forms, the subs list page, the subcontractor detail page, and global search — RFQs and any other trade-using surfaces are explicitly out of scope.

The 12 trades (in this order): Plumbing, Electrical, HVAC, Concrete, Metal Buildings, Framing, Roofing, Painting, Flooring, Drywall, General, Other.

</domain>

<decisions>
## Implementation Decisions

### Existing trade data
- Existing CSI codes are **cleared to null** — no auto-mapping to the new 12 trades
- Subcontractors with no trade assigned display a dash (—) in the list row trade column
- A **new `trade` column** is added to the schema (do not repurpose the existing `csi_division` column)
- The trade filter dropdown does **not** include an "Unassigned" or "No trade" option — subs with null trade always appear in "All" only

### Multi-trade support
- Each subcontractor can have **multiple trades** (not single-select)
- The form control is a **combobox with checkboxes** — click to open, check each applicable trade
- In the subcontractor list row, trades display as **first trade badge + overflow count**: e.g., `[Plumbing] +2`
- The filter uses **any-match logic**: a sub with Plumbing + HVAC appears when filtering by either Plumbing or HVAC

### "Other" trade behavior
- When "Other" is selected, an **optional free-text field** appears for the user to specify the trade (e.g., "Elevator installation")
- In the list row, the **custom text is shown** (not "Other") if a custom description was entered; if no custom text, show "Other"
- "Other" **is included** as a filter option in the dropdown — filtering by Other shows all subs that selected Other, regardless of custom text

### Trade display surfaces
- **Global search (⌘K):** The sub's trade(s) appear next to the subcontractor name in search results (plain-English trade names, not CSI codes)
- **Sub detail page:** Trades appear in the **main details field section** (alongside company name, email, phone — not in a header badge)
- **RFQs:** Out of scope — not updated in this phase

</decisions>

<specifics>
## Specific Ideas

- The combobox with checkboxes pattern should match any existing multi-select combobox in the codebase if one exists (check `components/ui/combobox.tsx` or similar)
- "Other" custom text field should appear inline below or adjacent to the trade combobox when Other is checked — not a separate page or dialog
- The overflow display `[Plumbing] +2` should use the existing StatusBadge component variant for consistency

</specifics>

<deferred>
## Deferred Ideas

- RFQ trade filter — explicitly out of scope for this phase, but should use the same 12-trade list when updated
- Trade-based subcontractor suggestions during RFQ creation — future capability

</deferred>

---

*Phase: 52-trade-simplification*
*Context gathered: 2026-02-24*
