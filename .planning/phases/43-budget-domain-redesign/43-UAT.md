---
phase: 43-budget-domain-redesign
uat_started: 2026-02-22
status: complete
tests_total: 18
tests_passed: 17
tests_failed: 1
tests_skipped: 0
gaps:
  - id: GAP-01
    test: 8
    description: >
      Projects filter is wired to old `projectStatusEnum` (active/on_hold/completed/archived) but
      projects use the 9-phase `lifecyclePhaseEnum` (opportunity/estimating/submitted/awarded/active/
      substantial_completion/closed/warranty/archived). Three fixes needed:
      (1) projects/page.tsx: change nuqs param from `status: parseAsStringEnum([...old...])` to
          `lifecyclePhase: parseAsStringEnum([...9 phases...])` and update tRPC input accordingly.
      (2) projects-filters.tsx: change Select options to 9 lifecycle phases with display labels;
          change chip prefix from "Status:" to "Phase:" with proper display labels.
      (3) isFiltered in page.tsx: switch from `filters.status` to `filters.lifecyclePhase`.
    severity: minor
    files_likely:
      - apps/web/app/(dashboard)/projects/page.tsx
      - apps/web/app/(dashboard)/projects/components/projects-filters.tsx
---

# Phase 43 UAT: Budget Domain Redesign

## Test Results

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Budget table column picker opens | pass | |
| 2 | Budget column picker hides/shows columns | pass | |
| 3 | Column picker localStorage persistence | pass | |
| 4 | G703 picker pins Item + Description | pass | |
| 5 | Budget inline add row — no modal | pass | |
| 6 | Budget inline add — Enter saves, Escape cancels | pass | |
| 7 | SOV inline add row — no modal | pass | |
| 8 | Projects filter chips appear | fail | Chip appears but label says "Status: X" — projects use phases now, chip label should match current filter dimension name |
| 9 | Projects chip × removes filter | pass | |
| 10 | Projects Clear all chips | pass | |
| 11 | Projects empty state (no data vs filtered) | pass | |
| 12 | Customers inline search (not in Card) | pass | |
| 13 | Customers empty state | pass | |
| 14 | Subcontractors filter chips | pass | |
| 15 | Change orders search + filter chips | pass | |
| 16 | Change orders empty state | pass | |
| 17 | Payment apps search + status chip | pass | |
| 18 | RFQs filter chips + empty state | pass | |

## Test Details

### Test 1: Budget table column picker opens
**Navigate to:** Any project → Budget tab
**Expected:** A gear icon (⚙) appears in the top-right of the Budget Line Items table header toolbar. Clicking it opens a popover with a checkbox list of hideable columns.

### Test 2: Budget column picker hides/shows columns
**Expected:** Unchecking a column in the picker immediately hides that column from the table (header, rows, and footer); re-checking it brings it back. The Cost Code column is NOT in the picker list (it is pinned).

### Test 3: Column picker localStorage persistence
**Expected:** Hide a column, then reload the page — the column remains hidden. The gear icon remembers your preference.

### Test 4: G703 picker pins Item + Description
**Navigate to:** Any project with a pay app → G702/G703 tab
**Expected:** The gear icon on the G703 continuation sheet opens a picker with 9 hideable columns. "Item" and "Description" are NOT in the list (both pinned). Other columns (Scheduled Value, % from previous, This Period %, etc.) ARE in the list.

### Test 5: Budget inline add row — no modal
**Navigate to:** Any project → Budget tab
**Expected:** Clicking "Add Line Item" does NOT open a dialog/modal. Instead, a new input row appears inline at the bottom of the table with an auto-focused Cost Code select field.

### Test 6: Budget inline add — Enter saves, Escape cancels
**Expected (Enter):** Fill in Cost Code + Budgeted Amount → press Enter → row disappears and new line item appears in the table; footer total updates.
**Expected (Escape):** Click Add Line Item, then press Escape immediately — draft row disappears with no save; footer total unchanged.

### Test 7: SOV inline add row — no modal
**Navigate to:** Any project with a pay app → G702/G703 tab → SOV Editor section (or SOV tab)
**Expected:** Clicking "Add SOV Item" does NOT open a dialog. An inline draft row appears with an auto-focused Description input.

### Test 8: Projects filter chips appear
**Navigate to:** Projects list page → apply any filter (e.g. Status = Active)
**Expected:** A chip labeled "Status: Active" appears below the search bar with an × button.

### Test 9: Projects chip × removes filter
**Expected:** Clicking × on the "Status: Active" chip clears the status filter; chip disappears; project list shows all statuses.

### Test 10: Projects Clear all chips
**Expected:** With 2+ active filters (e.g. Status + Customer), clicking "Clear all" removes all chips and resets the project list.

### Test 11: Projects empty state (no data vs filtered)
**Expected (no projects):** With no projects, an empty state with FolderOpen icon and "No projects yet" heading + "Create Project" button appears.
**Expected (filtered empty):** With filters that match nothing, SearchX icon + "No projects match your filters" heading with no CTA button appears.

### Test 12: Customers inline search (not in Card)
**Navigate to:** Customers list page
**Expected:** The search input is a standalone input field directly above the table (with a Search icon on the left), NOT wrapped inside a Card component. It looks clean and inline.

### Test 13: Customers empty state
**Expected (no customers):** Building2 icon + "No customers yet" heading + "Add Customer" button.
**Expected (search no match):** SearchX icon + "No customers match your search" heading + no CTA.

### Test 14: Subcontractors filter chips
**Navigate to:** Subcontractors list page → set Status to Active or select a Trade
**Expected:** A chip appears for the active status/trade filter below the filter controls. Clicking × removes the chip and resets that filter.

### Test 15: Change orders search + filter chips
**Navigate to:** Any project → Change Orders tab
**Expected:** An inline search bar appears above the table. Filtering by Status or Type shows a chip; × removes it. Search filters the list in real-time (with ~300ms debounce).

### Test 16: Change orders empty state
**Expected (no COs):** FilePlus icon + "No change orders yet" heading.
**Expected (filtered empty):** SearchX icon + "No change orders match your filters" heading.

### Test 17: Payment apps search + status chip
**Navigate to:** Any project → Payment Applications tab
**Expected:** An inline search bar appears above the list. Filtering by Status creates a chip. Searching by application number filters the list.

### Test 18: RFQs filter chips + empty state
**Navigate to:** Any project → RFQs tab
**Expected:** Inline search + status filter is present. Selecting a status creates a chip. With no RFQs: FileQuestion icon + "No RFQs yet" heading + "New RFQ" CTA. With filters active and no match: SearchX icon + "No RFQs match your filters".
