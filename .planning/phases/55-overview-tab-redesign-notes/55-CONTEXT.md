# Phase 55: Overview Tab Redesign + Notes - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the Overview tab: remove KPI cards, Customer Info section, and Project Phases section. Update Project Details to show building dimensions. Simplify Team Members to a compact display. Add a Notes section for team communication. No new navigation or project-level capabilities — purely within the Overview tab.

</domain>

<decisions>
## Implementation Decisions

### Notes section design
- Flat list display (not chat-bubble style)
- Input at the bottom, note list above it (comment-box pattern)
- Deletion: users can delete their own notes; admins can delete any note (trash icon on hover)
- Character limit: ~500 characters per note
- Empty state: just the input — no empty-state message above it

### Project Details layout
- Building dimensions: 4-cell mini-stat grid — Width, Length, Height, Sq Ft — in a compact row
- Section contents: project description (read-only) + dimensions grid only. No start/end dates here (already in sticky header)
- Description is read-only on the Overview tab; editing goes through the Edit Project page
- Dimensions empty state: grid always renders, values show "—" when not set

### Overview tab section order + visual treatment
- Section order: **Project Details → Team Members → Notes**
- No section headings, no dividers — sections separated by whitespace gaps only
- Empty Project Details: Claude's Discretion (handle gracefully)

### Team Members simplified display
- Layout: horizontal flex row per member — small avatar (h-7/w-7) | Full Name | Role in proper case (e.g., "Project Manager")
- No column header row, no description text, no assigned-date column
- Keep existing add/remove member actions if they already exist — do NOT remove working capabilities
- Empty state: muted text "No team members assigned"

### Claude's Discretion
- Empty Project Details section treatment (show or hide when both description and dimensions are unset)
- Exact spacing between sections

</decisions>

<specifics>
## Specific Ideas

- Role format is "Project Manager" style (title case), not "project_manager" or "PM"
- Notes character limit is a soft ceiling (~500 chars) — show a counter as user approaches the limit
- Trash icon on notes appears on hover; deletion is immediate (no confirmation dialog needed)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 55-overview-tab-redesign-notes*
*Context gathered: 2026-02-24*
