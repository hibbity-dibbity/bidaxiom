# Phase 22: Validation & Duplicate Prevention - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

When a user manually enters a job number (on new project creation or project edit), the system validates it for format compliance and uniqueness. Validation blocks submission on failure. This phase covers the project creation form and the project edit form only — bulk validation, job number history, and admin overrides are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Duplicate resolution UX
- Show inline error under the job number field — not a toast
- Error text: "[number] is already assigned to [Project Name] →" — clickable link opens the existing project in a **new tab**
- Duplicate check fires **on blur** (when user leaves the field)
- **Hard block**: duplicate detected = form submission disabled until resolved
- Check is **case-insensitive** ("ABC-001" and "abc-001" treated as the same)
- Duplicate validation applies to **both new project form and edit project form**

### Format validation scope
- Format validation only applies **when auto-gen is enabled** (i.e., a template is configured and active)
- When auto-gen is disabled: no format enforcement — any string is acceptable
- **Hard block**: format mismatch prevents form submission
- Error message: generic — "Job number doesn't match the required format" (no template hint in the error itself; the format hint is already shown below the input)
- Format validation triggers **on blur**, same as duplicate checking

### Validation ordering
- Both checks fire on blur
- If format fails: show format error (no need to check duplicates yet — format must pass first)
- If format passes: check for duplicates
- On submit: re-run both validations as a safety net

### Claude's Discretion
- Loading/pending state while async duplicate check is in-flight
- Exact field error styling (color, icon, placement)
- Debounce timing if needed for blur-triggered API calls

</decisions>

<specifics>
## Specific Ideas

- The duplicate error must include the project name (not just a number), making it immediately clear which project already owns it
- Clicking the link opens the conflicting project in a new tab so the user doesn't lose their in-progress form

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-validation-and-duplicate-prevention*
*Context gathered: 2026-02-17*
