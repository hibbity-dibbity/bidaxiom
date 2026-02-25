# Phase 54: Project Header Updates - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the sticky project header: add inline Start/End date pickers to the info row, remove the Team Members KPI from the stat bar, and add three new financial KPI cards — Projected Profit, Margin %, and Customer Budget with over/under delta.

</domain>

<decisions>
## Implementation Decisions

### Date picker triggers
- Empty state: calendar icon button only (no text), with tooltip on hover — "Set start date" / "Set end date"
- Set state: displays full date — "Feb 24, 2026" format
- Clicking opens a popover calendar (DayPicker style, matching app patterns)
- Location: in the header info row (row 2), to the right of Customer and address

### Profit & Margin KPI layout
- Two-row layout: Projected value on top, Actual below in smaller muted text
- Actual always shows "—" for now (no actual cost tracking yet)
- Margin displays to one decimal: "18.5%"
- Group order: Contract Amount → Profit → Margin (financial trio, side by side)
- Negative values use red text + accounting parentheses: ($1,200)

### Customer Budget delta
- Two-row layout consistent with Profit card: primary row = budget amount, secondary row = delta
- Delta wording: "$X,XXX under" or "$X,XXX over" — no +/- signs, no parentheses
- Claude's Discretion: exact placement within the stat bar (user said don't put it with the financial trio — place it where it reads best separately)

### Empty / missing states
- **No active estimate (Profit/Margin):** use Customer Budget as the contract value fallback; if no Customer Budget either, show "—"
- **No Customer Budget entered:** Customer Budget KPI shows "—"
- **No estimate to compare for Budget delta:** show budget amount only, no delta row (Claude's discretion on exact treatment)
- **No date set:** calendar icon only; clicking opens picker to set for the first time

### Team Members KPI
- Remove entirely from the header stat bar (no replacement)

</decisions>

<specifics>
## Specific Ideas

- Negative profit uses standard accounting format: red text + parentheses e.g. ($1,200) — matches how accountants expect to see losses
- Delta label is plain English: "$12,000 under" or "$5,000 over" — no symbols, no abbreviations

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 54-project-header-updates*
*Context gathered: 2026-02-24*
