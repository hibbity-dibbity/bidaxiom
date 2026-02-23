# Phase 45: Estimates Redesign - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The estimate creation wizard gains a visible horizontal progress stepper. All currency input fields across the application are migrated to react-number-format NumericFormat (live masking, numeric submission value). Section grouping with divider lines is applied to estimate wizard steps where multiple logical field groups exist.

**Note on FORM-03 scope:** The ROADMAP requirement text mentions "change order, project, customer" forms for section grouping. During discussion, the user scoped FORM-03 to estimate wizard steps only — CO, project, and customer forms are NOT in scope for section grouping in this phase.

</domain>

<decisions>
## Implementation Decisions

### Stepper visual design
- Completed steps: Filled brand teal circle with a ✓ checkmark icon
- Active step: Filled brand teal circle with the step number
- Future steps: Gray outline circle with the step number
- Three distinct visual tiers: done (teal + check) / active (teal + number) / future (gray outline + number)
- Step labels: Only the **active step** shows its label below the circle — other steps show circles only
- Connecting line: Present between circles; fills with brand teal as steps complete (left-to-right progress fill)

### Stepper navigation rules
- Clicking a **completed step** jumps back freely — forward steps remain marked complete (no invalidation)
- Clicking a **future step** is allowed — user can jump forward, no validation gate enforced
- Moving **forward**: explicit "Next" button at the bottom of each step + Enter key on the last field of a step
- **Final step (Step 6)**: Is a read-only review/summary of all entered data; "Submit" button fires from the review step

### Currency input behavior
- **Focus behavior**: Claude decides — use react-number-format's default (stays formatted while focused; cursor placed in field)
- **Empty field**: Blank with no placeholder — the `$` prefix appears as the user starts typing, not before
- **Existing CurrencyInput component**: Claude decides — audit call sites and choose convert-to-wrapper or delete-and-migrate based on what minimizes risk
- **Submission value**: JavaScript number via `onValueChange` — the formatted string never reaches the server; the value submitted is numeric (e.g., `1250`, not `"$1,250.00"`)

### Form section grouping (estimate wizard steps only)
- **Separator style**: Horizontal divider line + section heading above each group of fields
- **Heading typography**: `text-xs font-semibold uppercase tracking-wider text-muted-foreground` — subtle, doesn't compete with field labels
- **Which steps get grouping**: Claude audits all 6 steps and applies dividers + headings only where a step has 2+ logically distinct field groups; simple steps stay flat
- **Scope**: Estimate wizard steps only — change order, project, and customer forms are explicitly NOT in scope for this phase

### Claude's Discretion
- react-number-format default focus behavior (stay formatted vs strip to raw) — use library default
- Whether to convert or delete the existing `CurrencyInput` component — decide after call site audit
- Which specific estimate wizard steps receive section grouping — audit fields per step and apply where warranted

</decisions>

<specifics>
## Specific Ideas

- The stepper should feel like a linear progress bar for a 6-step flow — users should be able to see "I'm on step 3 of 6" at a glance from the circle states alone, even without reading the label
- The active step label appearing below the active circle gives context without cluttering the bar — users can identify where they are by label, not just by circle color
- The review/summary step as Step 6 (or the final step) is intentional — it gives users a chance to scan everything before committing the submission

</specifics>

<deferred>
## Deferred Ideas

- Section grouping on change order form — mentioned in ROADMAP FORM-03 requirement text but user scoped out of this phase; defer to a future polish phase
- Section grouping on project form — same as above
- Section grouping on customer form — same as above

</deferred>

---

*Phase: 45-estimates-redesign*
*Context gathered: 2026-02-23*
