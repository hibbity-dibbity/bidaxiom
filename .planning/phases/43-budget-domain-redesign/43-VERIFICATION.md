---
phase: 43-budget-domain-redesign
verified: 2026-02-22T18:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Open budget page and click the gear icon in the BudgetLineItemTable header; uncheck Description; reload the page"
    expected: "Description column remains hidden after reload (localStorage key col-picker:budget-line-items persists)"
    why_human: "localStorage persistence requires a live browser session to confirm"
  - test: "Open the G703 continuation sheet; click the gear icon; confirm Item and Description are absent from the picker list"
    expected: "Only 9 hideable columns appear; Item and Description are pinned and never listed"
    why_human: "Visual inspection of popover content cannot be grepped"
  - test: "Open a project budget tab; click Add Line Item; press Escape immediately"
    expected: "Draft row disappears without saving; footer total is unchanged"
    why_human: "Keyboard interaction and UI state cannot be verified programmatically"
  - test: "Open CommitmentList with no commitments; verify empty state appearance"
    expected: "An ad-hoc dashed-border div renders (NOT the shared EmptyState component) — note this is an anti-pattern but CommitmentList was not in scope for LIST-03"
    why_human: "CommitmentList empty state uses ad-hoc JSX; a future phase should migrate it to EmptyState"
---

# Phase 43: Budget Domain Redesign Verification Report

**Phase Goal:** The budget domain surfaces — line item table, summary cards, and list views — are redesigned to Procore-level density with column picker, inline row addition, filter chips, and consistent empty states, establishing the domain redesign pattern that change order and payment app phases will replicate.

**Verified:** 2026-02-22T18:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Budget line item table and projects list have a column picker (popover with checkbox list) that shows/hides columns immediately without page reload | VERIFIED | `budget-line-item-table.tsx` L37-38 imports `useColumnVisibility`+`ColumnPicker`; L237 renders `<ColumnPicker table={table} />`; `projects-table.tsx` L25-26 imports both; L144 renders picker; `columnVisibility` state wired into `useReactTable` in both |
| 2 | SOV line items can be added as a new inline row by clicking "Add line item" — no modal dialog opens | VERIFIED | `sov-editor.tsx` L36-39 declares `DraftSovRow` type; L42-44 holds draft state + focus ref; L225-234 Add SOV Item button sets draftRow directly (no DialogTrigger); L316-371 draft row renders in TableBody after server rows; `budget-line-item-table.tsx` L44-48 same pattern for budget items |
| 3 | Every major list view (projects, customers, subcontractors, change orders, payment apps, estimates, RFQs) has an inline search bar directly above the table | VERIFIED | Projects: `projects-filters.tsx` L138-145 search Input with Search icon; Customers: `customers/page.tsx` L272-280 inline search div; Subcontractors: `subcontractors/page.tsx` L183-189 search Input; ChangeOrders: `change-order-list.tsx` L190-198 search Input; PaymentApps: `payment-app-list.tsx` L216-225 search Input; Estimates: `estimates/page.tsx` L76-86 search Input (conditional on data); RFQs: `rfqs/page.tsx` L132-141 search Input |
| 4 | Active filter selections display as removable filter chips below the search bar; each chip has label + × button; "Clear all" removes all simultaneously | VERIFIED | `filter-chips.tsx` L16-43 full implementation with X buttons and Clear all; Projects: `projects-filters.tsx` L85-131 derives `activeChips` from status/customer/assignedUser/dates; renders `<FilterChips chips={activeChips} onClearAll={clearFilters} />`; Subcontractors: `subcontractors/page.tsx` L143-162; ChangeOrders: `change-order-list.tsx` L105-127; PaymentApps: `payment-app-list.tsx` L84-97; RFQs: `rfqs/page.tsx` L88-98 |
| 5 | Every list view displays a contextual empty state (icon + heading + description + CTA) when empty or no filter match | VERIFIED | `EmptyState` component at `empty-state.tsx` L20-49 fully implements icon+heading+description+optional CTA; Projects: `projects-table.tsx` L127-139 renders EmptyState with isFiltered variant; Customers: `customers/page.tsx` L405-415; Subcontractors: `subcontractors/page.tsx` L305-323; ChangeOrders: `change-order-list.tsx` L241-259; PaymentApps: `payment-app-list.tsx` L392-412; Estimates: `estimates/page.tsx` L136-150; RFQs: `rfqs/page.tsx` L229-247 |

**Score: 5/5 truths verified**

---

### Required Artifacts

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `apps/web/hooks/use-column-visibility.ts` | localStorage-backed columnVisibility state + stable callback | Yes | Yes (34 lines, SSR guard, useCallback) | Imported in 4 table files | VERIFIED |
| `apps/web/components/shared/column-picker.tsx` | Gear icon popover with per-column visibility checkboxes | Yes | Yes (66 lines, Settings2 icon, Checkbox list, getCanHide filter) | Used in budget-line-item-table, projects-table, g703-continuation, commitment-list | VERIFIED |
| `apps/web/components/shared/empty-state.tsx` | Empty state UI (icon + heading + description + optional CTA) | Yes | Yes (49 lines, Link+onClick CTA variants) | Used in projects-table, customers, subcontractors, change-order-list, payment-app-list, estimates, rfqs | VERIFIED |
| `apps/web/components/shared/filter-chips.tsx` | Filter chip row with dismiss buttons and Clear all | Yes | Yes (43 lines, exports FilterChip type, returns null for empty array) | Used in projects-filters, subcontractors, change-order-list, payment-app-list, rfqs | VERIFIED |
| `apps/web/components/budget/budget-line-item-table.tsx` | Column picker + inline draft row for add | Yes | Yes (497 lines, draftRow state, handleDraftSave, handleDraftKeyDown, ColumnPicker) | useColumnVisibility + ColumnPicker wired; createMutation.mutate called from handleDraftSave | VERIFIED |
| `apps/web/components/payment-app/sov-editor.tsx` | Inline draft row for SOV add (no dialog) | Yes | Yes (457 lines, DraftSovRow, draftRow state, keyboard handlers) | createMutation.mutate called from handleDraftSave; locked state disables button | VERIFIED |
| `apps/web/app/(dashboard)/projects/components/projects-table.tsx` | Column picker + isFiltered prop + EmptyState | Yes | Yes (248 lines, isFiltered required prop, EmptyState renders with FolderOpen/SearchX) | useColumnVisibility + ColumnPicker wired; EmptyState wired to isFiltered | VERIFIED |
| `apps/web/app/(dashboard)/projects/components/columns.tsx` | jobNumber column with enableHiding: false | Yes | Yes (L46: `enableHiding: false` on jobNumber) | createColumns called by ProjectsTable | VERIFIED |
| `apps/web/components/payment-app/g703-continuation.tsx` | TanStack Table with column picker (item+desc pinned) | Yes | Yes (296 lines, 11 columns defined, item+desc have enableHiding: false, row.getVisibleCells()) | useColumnVisibility + ColumnPicker wired; footer conditional per visible column | VERIFIED |
| `apps/web/components/budget/commitment-list.tsx` | Column picker for commitment table | Yes | Yes (369 lines, vendorName enableHiding: false, ColumnPicker in toolbar) | useColumnVisibility + ColumnPicker wired | VERIFIED |
| `apps/web/app/(dashboard)/projects/components/projects-filters.tsx` | Filter chips for project filters | Yes | Yes (239 lines, activeChips derived from status/customer/assignedUser/dates, FilterChips rendered) | FilterChips rendered below filter row | VERIFIED |
| `apps/web/app/(dashboard)/projects/page.tsx` | isFiltered prop computed and passed to ProjectsTable | Yes | Yes (L47-54: isFiltered computation, L97: passed to ProjectsTable) | isFiltered={isFiltered} wired to ProjectsTable | VERIFIED |
| `apps/web/app/(dashboard)/customers/page.tsx` | Inline search + EmptyState | Yes | Yes (L272-280: inline search div, L405-415: EmptyState with Building2/SearchX) | search state wired to trpc query; EmptyState rendered | VERIFIED |
| `apps/web/app/(dashboard)/subcontractors/page.tsx` | Filter chips (status+trade) + EmptyState | Yes | Yes (L143-162: activeChips, L220: FilterChips, L305-323: EmptyState) | FilterChips + EmptyState both wired | VERIFIED |
| `apps/web/components/change-order/change-order-list.tsx` | Search + filter chips + EmptyState | Yes | Yes (354 lines, displayedChangeOrders filtered, activeChips, FilterChips, EmptyState) | All three wired | VERIFIED |
| `apps/web/components/payment-app/payment-app-list.tsx` | Search + status chip + EmptyState | Yes | Yes (415 lines, displayedPaymentApps, activeChips, FilterChips, EmptyState) | All three wired | VERIFIED |
| `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx` | Search + EmptyState | Yes | Yes (153 lines, displayedEstimates, EmptyState with FileText/SearchX) | Search wired to filter; EmptyState rendered | VERIFIED |
| `apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/page.tsx` | Search + status chip + EmptyState | Yes | Yes (250 lines, filteredRfqs includes search, activeChips, FilterChips, EmptyState) | All three wired | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Detail |
|------|----|-----|--------|--------|
| `use-column-visibility.ts` | `localStorage` | `typeof window === "undefined"` SSR guard + `localStorage.setItem` in `useCallback` | WIRED | L8: SSR guard; L22: localStorage.setItem in functional updater |
| `budget-line-item-table.tsx` | `useColumnVisibility` | `const { columnVisibility, onColumnVisibilityChange } = useColumnVisibility("budget-line-items")` | WIRED | L62 |
| `budget-line-item-table.tsx` | `ColumnPicker` | `<ColumnPicker table={table} />` in header div | WIRED | L237 |
| `budget-line-item-table.tsx` | `trpc.budget.createLineItem.useMutation` | `createMutation.mutate(...)` in `handleDraftSave` | WIRED | L121-127 |
| `sov-editor.tsx` | `trpc.sov.create.useMutation` | `createMutation.mutate(...)` in `handleDraftSave` | WIRED | L122-129 |
| `projects-table.tsx` | `useColumnVisibility` | `useColumnVisibility("projects-list")` | WIRED | L64 |
| `projects-table.tsx` | `EmptyState` | `<EmptyState icon={isFiltered ? SearchX : FolderOpen} .../>` | WIRED | L127-139 |
| `projects/page.tsx` | `ProjectsTable.isFiltered` | `isFiltered={isFiltered}` prop | WIRED | L97 |
| `g703-continuation.tsx` | `useColumnVisibility` | `useColumnVisibility("g703-continuation")` | WIRED | L78 |
| `g703-continuation.tsx` | `ColumnPicker` | `<ColumnPicker table={table} />` | WIRED | L91 |
| `commitment-list.tsx` | `useColumnVisibility` | `useColumnVisibility("commitment-list")` | WIRED | L59 |
| `commitment-list.tsx` | `ColumnPicker` | `<ColumnPicker table={table} />` in toolbar | WIRED | L185 |
| `projects-filters.tsx` | `FilterChips` | `<FilterChips chips={activeChips} onClearAll={clearFilters} />` | WIRED | L236 |
| `change-order-list.tsx` | search state | `displayedChangeOrders` filtered by `debouncedSearch` via `useMemo` | WIRED | L94-103 |
| `rfqs/page.tsx` | `FilterChips` | `<FilterChips chips={activeChips} onClearAll={clearAllFilters} />` | WIRED | L162 |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| TABLE-06 | 43-01, 43-02 | Column picker control on financial tables and projects list | SATISFIED | ColumnPicker wired into BudgetLineItemTable, ProjectsTable, G703Continuation, CommitmentList with enableHiding: false on identity columns |
| TABLE-07 | 43-03 | SOV and budget line items added inline without modal | SATISFIED | DraftBudgetRow in budget-line-item-table.tsx; DraftSovRow in sov-editor.tsx; add Dialog removed from both; Enter/Escape/blur handlers present |
| LIST-01 | 43-04, 43-05 | Inline search bar on all 7 major list views | SATISFIED | Search Input present in all 7: projects, customers, subcontractors, change orders, payment apps, estimates, RFQs |
| LIST-02 | 43-04, 43-05 | Removable filter chips below search bar with Clear all | SATISFIED | FilterChips rendered in projects, subcontractors, change orders, payment apps, RFQs; customers has no secondary filters (only search); chips remove correctly via onRemove callbacks |
| LIST-03 | 43-04, 43-05 | Contextual empty state (icon+heading+description+CTA) on all list views | SATISFIED | EmptyState used in all 7 list views with genuinely-empty and no-match variants; icon, heading, description, and conditional CTA all present |

**All 5 requirement IDs from PLAN frontmatters are accounted for and satisfied.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `commitment-list.tsx` | 188-205 | Ad-hoc empty state (two dashed-border divs) instead of shared EmptyState | Warning | CommitmentList empty state is inconsistent with the 7 scoped list views; however CommitmentList was not listed in the success criteria or LIST-03 scope. Future phase should migrate. |

No blocker anti-patterns found. The ad-hoc empty state in CommitmentList is a warning-level inconsistency but was not scoped in the LIST-03 requirement (which targets 7 specific top-level list views) and does not block phase goal achievement.

---

### Human Verification Required

#### 1. Column Picker localStorage Persistence

**Test:** Open the budget page, click the gear icon, uncheck "Description", reload the page.
**Expected:** Description column remains hidden after reload.
**Why human:** localStorage persistence requires a live browser session.

#### 2. G703 Pinned Columns in Picker

**Test:** Open the G702/G703 page, click the gear icon above the G703 table.
**Expected:** Popover shows exactly 9 columns (scheduledValue, fromPreviousPct, thisPeriodPct, workThisPeriod, materialsStored, totalCompleted, pctComplete, balanceToFinish, retainage); Item and Description are absent.
**Why human:** Visual inspection of popover contents cannot be grepped.

#### 3. Inline Add Row Keyboard Behavior

**Test:** Open a project budget tab, click "Add Line Item", fill in cost code and description, press Enter.
**Expected:** Draft row disappears; new row appears in table; footer total updates after mutation completes; no modal opened at any point.
**Why human:** Keyboard interaction and mutation-driven UI state cannot be verified programmatically.

#### 4. Filter Chip Removal

**Test:** On the Projects page, select a Customer filter, then click the × on the resulting chip.
**Expected:** Customer filter clears; chip disappears; project list refreshes to unfiltered results.
**Why human:** Chip × button interaction and real-time filter behavior requires manual testing.

#### 5. CommitmentList Empty State (Warning Only)

**Test:** Open a project Budget tab > Commitments with no commitments and no filters.
**Expected:** Ad-hoc dashed-border div renders with "No commitments yet" — this is expected given current implementation, but is inconsistent with the shared EmptyState pattern established in this phase.
**Why human:** Visual inconsistency requires a human to decide whether it merits a gap plan or can be deferred.

---

### Gaps Summary

No gaps blocking goal achievement. All 5 success criteria are implemented and wired. The phase goal is achieved:

- The column picker pattern (TABLE-06) is established in 4 tables with localStorage persistence and `enableHiding: false` on identity columns.
- The inline row addition pattern (TABLE-07) is established in BudgetLineItemTable and SovEditor; add Dialogs removed from both.
- Inline search (LIST-01) is present on all 7 required list views.
- Filter chips (LIST-02) are present on all applicable views (views with only a search bar, like Customers, correctly omit chips since there are no secondary filter dimensions to chip).
- Shared EmptyState (LIST-03) is wired in all 7 required list views with contextual genuinely-empty and no-match variants.

The one warning item (CommitmentList ad-hoc empty state) is not a blocker — CommitmentList was not listed in the LIST-03 scope and does not affect the phase goal.

---

_Verified: 2026-02-22T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
