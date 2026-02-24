# Phase 48: Project Mode Removal - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all user-facing controls for switching between Simple and GC/Advanced project modes, and hide all GC/Advanced-only tabs (Budget, SOV, Commitments, Payment Applications) from the project UI. Underlying code, routes, and database records are preserved — only UI access points are removed.

</domain>

<decisions>
## Implementation Decisions

### Hidden tab URL behavior
- When a user navigates directly to a removed tab URL (e.g., `/projects/slug/budget`, `/sov`, `/commitments`, `/payment-applications`), show a **placeholder page** at that URL — not a redirect, not a 404
- Placeholder behavior is **consistent across all four removed tabs** (Budget, SOV, Commitments, Payment Applications)
- A **brief informational toast** ("That page isn't available") appears when the user lands on a placeholder
- **Route files are kept on disk** — only the tab navigation links are removed; the page route components stay as placeholder pages
- Placeholder page content: simple "not available" message (Claude decides exact copy and empty-state style)

### Mode badge and mode switcher removal
- The **project detail page has a mode badge** (shows "Simple" or "GC/Advanced") — **remove it entirely** from the UI; keep the underlying code
- The **3-dot (ellipsis) menu on the project detail page** contains a "Switch to Simple/GC" dropdown item — **remove only that mode-switch item**; the "Delete project" button remains in the 3-dot menu
- **Project creation form** at `/projects/new` has a "Project Mode" field — **hide it from the UI**; keep the field code intact

### Database default for new projects
- All **newly created projects should default to `simple`** mode in the database, even though the UI hides the field — keep the data meaningful for future use

### GC-specific CTAs outside the tabs
- **Remove any GC-specific CTAs on the project Overview tab** that link to Budget, SOV, Commitments, or Payment Applications features
- The **financial stat bar** in the sticky project header is mode-neutral — no changes needed
- **Audit and remove any mode-conditional UI** inside the Change Orders and Proposals/Estimates tabs (content inside the tabs, not just the tabs themselves) — research should grep for mode-gated rendering and remove any GC-only fields or buttons found

### Scope of surfaces to clean
Known surfaces that require changes:
1. Project tab bar — remove Budget, SOV, Commitments, Payment Applications tabs
2. Mode badge on project detail page — remove
3. Mode-switch item in 3-dot ellipsis menu — remove (keep Delete project)
4. Project creation form "Project Mode" field — hide
5. Project Overview GC-specific CTAs — remove any found
6. Inside Change Orders and Proposals tabs — audit for mode-conditional content, remove GC-specific elements

### Claude's Discretion
- Exact placeholder page copy and empty-state design
- Toast styling and duration
- How to handle any mode-conditional rendering found by grep inside the retained tabs

</decisions>

<specifics>
## Specific Ideas

- The 3-dot menu behavior is explicit: **keep Delete project, remove the mode-switch item only**
- User confirmed the mode badge is currently a clickable/visible element on the project detail page alongside the ellipsis menu
- User confirmed the project creation form at `/projects/new` has a labeled "Project Mode" field

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 48-project-mode-removal*
*Context gathered: 2026-02-23*
