# Phase 51: Lifecycle Phase Freedom - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all guards from the project lifecycle phase control. The dropdown/badge UI already exists and already works — the phase is exclusively about removing the restrictions that prevent free navigation between phases. No UI rebuild, no new controls, just constraint removal.

</domain>

<decisions>
## Implementation Decisions

### Guard removal scope
- **Zero exceptions** — all phase transitions are completely free with no blocks
- All financial guards removed — active contracts, unpaid invoices, financial commitment checks do not block transitions
- **Fully bidirectional and non-sequential** — any phase to any phase in one click, including large jumps in either direction (e.g., Opportunity → Completed, Completed → Opportunity)
- **No warnings at all** — not even a toast. Silent transitions only. The badge updating is the confirmation.

### Phase selector UI (existing — do not change)
- The control already exists: a lifecycle phase badge in the sticky project header that opens a dropdown on click
- **Do not rebuild or redesign the selector** — only remove the guards that restrict what options are available or clickable
- All phases appear in sequential lifecycle order; current phase is visually highlighted/checked; all phases always shown
- After changing phase, user stays on their current page — badge updates in place, no redirect

### Transition feedback
- No success toast — badge update in place is sufficient confirmation
- **Pending state:** badge shows a loading spinner or muted visual while the mutation is in flight
- **On failure:** error toast shown + badge reverts to the previous phase (standard optimistic update failure pattern)
- No cascade — only the phase badge updates; stat bar and other header elements are not invalidated/refreshed

### Archived & terminal phases
- Archived is just another phase option — same dropdown entry, same behavior, no special treatment
- Archived is **not terminal** — a project in Archived can freely move to any other phase via the same dropdown
- No "Lost" phase exists in this system — Claude should handle only the phases that actually exist in the current data model
- All phases always shown in dropdown; current phase highlighted (checkmark/bold/active state) but not disabled — no self-transition prevention needed

</decisions>

<specifics>
## Specific Ideas

- The key work is in the server-side mutation (remove guard logic) and the dropdown component (remove any disabled/hidden states on options)
- The existing dropdown UI works correctly — the minimum viable change is: (1) remove server guards, (2) ensure all phases are enabled/clickable in the dropdown, (3) add pending state to badge while mutation is in flight

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 51-lifecycle-phase-freedom*
*Context gathered: 2026-02-24*
