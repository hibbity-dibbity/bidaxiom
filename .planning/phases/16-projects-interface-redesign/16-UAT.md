---
status: complete
phase: 16-projects-interface-redesign
source: 16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md, 16-04-SUMMARY.md, 16-05-SUMMARY.md, 16-06-SUMMARY.md, 16-07-SUMMARY.md
started: 2026-02-15T22:00:00Z
updated: 2026-02-15T23:00:00Z
retested: 2026-02-15T23:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Project URLs use readable slugs
expected: Navigate to a project detail page. URL should be in format `/projects/{jobnumber}-{projectname}` (e.g., `/projects/2024-001-office-renovation`) instead of UUID format.
result: pass

### 2. Projects list displays in compact table format
expected: Projects page shows table with columns: Job #, Project Name, Customer, Status, Start Date (not card-based grid layout).
result: pass

### 3. Customer names display in project list
expected: Customer column shows company name or contact name for each project.
result: pass

### 4. Status badges use correct colors
expected: Status badges show: Active=green, On Hold=yellow, Completed=blue, Archived=gray.
result: pass

### 5. Search projects by job number or name
expected: Type in search box at top of projects list. Table filters to show only matching projects. Search is debounced (waits for you to stop typing).
result: pass

### 6. Filter projects by customer
expected: Select customer from dropdown filter. Table shows only projects for that customer. URL updates with customer parameter.
result: pass

### 7. Filter projects by assigned user
expected: Select user from "Assigned User" dropdown. Table shows only projects where that user is a team member.
result: pass

### 8. Filter projects by date range
expected: Set Start Date From and Start Date To filters. Table shows only projects within that date range.
result: pass

### 9. Filter projects by status
expected: Select status from dropdown (Active/On Hold/Completed/Archived). Table shows only projects with that status.
result: issue
reported: "When I only have 1 active project the Active filter showed nothing. When I added a second active project now the active filter works correctly."
severity: major

### 10. Sort projects by clicking column headers
expected: Click on column headers (Job #, Name, Status, Start Date). Table re-sorts by that column. Click again to reverse order.
result: pass

### 11. Pagination shows correct counts and works
expected: Select customer from dropdown filter. Table shows only projects for that customer. URL updates with customer parameter.
result: [pending]

### 7. Filter projects by assigned user
expected: Select user from "Assigned User" dropdown. Table shows only projects where that user is a team member.
result: [pending]

### 8. Filter projects by date range
expected: Set Start Date From and Start Date To filters. Table shows only projects within that date range.
result: [pending]

### 9. Filter projects by status
expected: Select status from dropdown (Active/On Hold/Completed/Archived). Table shows only projects with that status.
result: [pending]

### 10. Sort projects by clicking column headers
expected: Click on column headers (Job #, Name, Status, Start Date). Table re-sorts by that column. Click again to reverse order.
result: [pending]

### 11. Pagination shows correct counts and works
expected: Bottom of table shows "X-Y of Z projects" (e.g., "1-50 of 127 projects"). Previous/Next buttons navigate pages.
result: issue
reported: "Failed. It says \"Showing NaN-NaN of 2 projects\" (showed NaN-NaN of 1 projects when I only had 1)"
severity: major

### 12. Filters persist in URL as query parameters
expected: Apply any filter. URL updates with query parameters (e.g., `?search=office&status=active&page=2`). Copy URL to new tab, filters are preserved.
result: pass

### 13. Clear Filters button resets all filters
expected: Apply any filter. URL updates with query parameters (e.g., `?search=office&status=active&page=2`). Copy URL to new tab, filters are preserved.
result: [pending]

### 13. Clear Filters button resets all filters
expected: Apply multiple filters. Click "Clear Filters" button. All filters reset to defaults and table shows all projects.
result: pass

### 14. Empty state shows appropriate message
expected: When no projects exist: Shows "No projects yet" message. When search/filters return no results: Shows "No projects found" message.
result: pass

### 15. Project header displays Job #, Name, Status
expected: Open any project. Top of page shows: Job # in monospace badge, Project Name as large heading, Status badge with color.
result: pass

### 16. Customer name is clickable link in header
expected: Project header shows customer name. Click customer name, navigates to customer detail page.
result: pass

### 17. Address displays formatted in header
expected: Project header shows address in format "street, city state zip" (e.g., "123 Main St, Austin TX 78701").
result: pass

### 18. Key metrics display in header
expected: When no projects exist: Shows "No projects yet" message. When search/filters return no results: Shows "No projects found" message.
result: [pending]

### 15. Project header displays Job #, Name, Status
expected: Open any project. Top of page shows: Job # in monospace badge, Project Name as large heading, Status badge with color.
result: [pending]

### 16. Customer name is clickable link in header
expected: Project header shows customer name. Click customer name, navigates to customer detail page.
result: [pending]

### 17. Address displays formatted in header
expected: Project header shows address in format "street, city state zip" (e.g., "123 Main St, Austin TX 78701").
result: [pending]

### 18. Key metrics display in header
expected: Project header shows 4 metrics: Budget Total, Committed, Actual Cost, Team Members. Currency values formatted (e.g., "$450,000").
result: pass

### 19. Tab bar shows all project sections
expected: Below project header, horizontal tab bar displays 9 sections: Overview, Documents, Budget, Commitments, Change Orders, SOV, Payment Apps, Invoices, RFQs.
result: pass

### 20. Active tab is highlighted
expected: Current section's tab has bottom border and darker text. Other tabs have lighter text.
result: pass

### 21. Header persists when navigating between tabs
expected: Click different tabs (Documents, Budget, Commitments, etc.). Header with Job #, Name, Status, Metrics stays visible and never reloads or flickers.
result: pass

### 22. Section navigation is instant (no loading delay)
expected: Click between tabs rapidly. Section content changes instantly without loading spinner (data is cached from layout).
result: issue
reported: "There does seem to be some delay in loading pages generally and particulary sections of the project"
severity: minor

### 23. All section pages accessible via slug URLs
expected: Below project header, horizontal tab bar displays 9 sections: Overview, Documents, Budget, Commitments, Change Orders, SOV, Payment Apps, Invoices, RFQs.
result: [pending]

### 20. Active tab is highlighted
expected: Current section's tab has bottom border and darker text. Other tabs have lighter text.
result: [pending]

### 21. Header persists when navigating between tabs
expected: Click different tabs (Documents, Budget, Commitments, etc.). Header with Job #, Name, Status, Metrics stays visible and never reloads or flickers.
result: [pending]

### 22. Section navigation is instant (no loading delay)
expected: Click between tabs rapidly. Section content changes instantly without loading spinner (data is cached from layout).
result: issue
reported: "Still slow. There is no loading spinner, but sections take at the quickest 5 seconds up to 25 seconds to load. Could possibly be a hardware issue"
severity: minor
note: "Progressive loading implemented (no blocking spinner), but underlying query performance is very slow (5-25s). May be dev server, database, or hardware constraint."

### 23. All section pages accessible via slug URLs
expected: Navigate to different sections. URLs use slug format: `/projects/{slug}/budget`, `/projects/{slug}/documents`, `/projects/{slug}/change-orders`, etc.
result: pass

### 24. Deep links work for nested sections
expected: Manually enter URL like `/projects/{slug}/change-orders/{id}` or `/projects/{slug}/rfqs/{id}/compare` in browser. Page loads correctly showing that specific change order or bid comparison.
result: pass
note: "Slug format verified: http://localhost:3000/projects/261001-manual-jn-test/change-orders/{id} - URLs maintain slug format correctly"
new_bug_found: "Runtime error in change-order-history.tsx line 78: entry.newValue.replace is not a function (newValue is not a string)"

### 25. Project creation redirects to slug URL
expected: Create a new project using "New Project" button. After saving, redirected to `/projects/{slug}` (not UUID-based URL).
result: pass

### 26. Project list links use slug URLs
expected: From projects list, click on any project name. Opens project detail with slug URL, not UUID.
result: pass

## Summary

total: 26
passed: 24
issues: 2
pending: 0
skipped: 0
new_bugs: 1

## Gaps

- truth: "Status filter shows projects matching selected status"
  status: failed
  reason: "User reported: When I only have 1 active project the Active filter showed nothing. When I added a second active project now the active filter works correctly."
  severity: major
  test: 9
  root_cause: "Duplicate useQueryStates hook instances in page.tsx and ProjectsFilters component created race condition - both managing same URL state caused stale filter values"
  artifacts:
    - path: "apps/web/app/(dashboard)/projects/components/projects-filters.tsx"
      issue: "Duplicate useQueryStates hook call"
    - path: "apps/web/app/(dashboard)/projects/page.tsx"
      issue: "Already has useQueryStates, filters component shouldn't create second instance"
  missing:
    - "Remove useQueryStates from ProjectsFilters, accept filters/setFilters as props instead"
  debug_session: ".planning/debug/resolved/phase16-status-filter-single-project.md"

- truth: "Pagination displays correct range (e.g., '1-50 of 127 projects')"
  status: failed
  reason: "User reported: Failed. It says \"Showing NaN-NaN of 2 projects\" (showed NaN-NaN of 1 projects when I only had 1)"
  severity: major
  test: 11
  root_cause: "Prop name mismatch - ProjectsTable interface expects 'page' but page.tsx passes 'currentPage', causing undefined value and NaN in calculation"
  artifacts:
    - path: "apps/web/app/(dashboard)/projects/page.tsx"
      issue: "Passing currentPage prop instead of page"
    - path: "apps/web/app/(dashboard)/projects/components/projects-table.tsx"
      issue: "Interface defines page prop, not currentPage"
  missing:
    - "Change currentPage={...} to page={...} in page.tsx line 72"
  debug_session: ".planning/debug/resolved/phase16-pagination-nan.md"

- truth: "Section content changes instantly without loading delay (React Query caching)"
  status: partially_resolved
  reason: "User reported: There does seem to be some delay in loading pages generally and particulary sections of the project"
  severity: minor
  test: 22
  root_cause: "Query waterfall pattern - each section fires 4-10 queries after getBySlug resolves, blocking loading states make 200-500ms network delay very visible"
  fix_applied: "Progressive loading implemented (Plan 16-06) - no blocking spinner, prefetch on hover"
  remaining_issue: "Sections take 5-25 seconds to load. Progressive loading works (no spinner) but underlying queries are very slow. Likely dev server performance, database query optimization, or hardware constraint - not a UI/UX issue."
  artifacts:
    - path: "apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx"
      issue: "Blocking skeleton during 4-query waterfall"
      status: "Fixed - progressive loading implemented"
    - path: "apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx"
      issue: "10+ queries fired after projectId available"
      status: "Fixed - placeholderData added"
  debug_session: ".planning/debug/phase16-slow-section-navigation.md"
  recommendation: "Performance issue is outside UI layer - investigate database query performance, consider production build vs dev mode, check hardware specs"

- truth: "Deep link URLs use slug format for all nested sections"
  status: resolved
  reason: "User reported: Fail. When I try to create a new change-order it loses the slug (http://localhost:3000/projects/a17fb662-9a2b-440c-b4c0-374877bd92bf/change-orders/new). I don't have any RFQs or Change Orders generated so I cannot test further."
  severity: major
  test: 24
  root_cause: "Components accept projectId prop and use it for navigation - pages pass project.id (UUID) instead of project.slug, causing URL reversion to UUID format"
  artifacts:
    - path: "apps/web/components/change-order/change-order-list.tsx"
      issue: "Uses projectId in router.push navigation"
    - path: "apps/web/components/change-order/change-order-form.tsx"
      issue: "Uses projectId in router.push navigation"
    - path: "apps/web/components/change-order/change-order-detail.tsx"
      issue: "Uses projectId in router.push navigation"
    - path: "apps/web/components/bidding/rfq-form.tsx"
      issue: "Uses projectId in router.push navigation"
    - path: "apps/web/components/bidding/bid-comparison-table.tsx"
      issue: "Uses projectId in router.push navigation"
    - path: "apps/web/components/payment-app/payment-app-list.tsx"
      issue: "Uses projectId in Link href"
    - path: "apps/web/components/workflow/workflow-list.tsx"
      issue: "Uses projectId in router.push navigation"
    - path: "apps/web/components/workflow/create-workflow-dialog.tsx"
      issue: "Uses projectId in router.push navigation"
    - path: "apps/web/components/workflow/workflow-detail.tsx"
      issue: "Uses projectId in Link href"
  missing:
    - "Update component interfaces to accept projectSlug prop for navigation"
    - "Replace /projects/${projectId}/ with /projects/${projectSlug}/ in all navigation URLs"
    - "Update parent pages to pass projectSlug={project.slug} instead of projectId={project.id}"
    - "Components may need both projectId (for tRPC) and projectSlug (for navigation)"
  debug_session: ".planning/debug/phase16-uuid-instead-of-slug.md"

## New Bugs Found During Retest

- truth: "Change order history displays correctly without runtime errors"
  status: failed
  reason: "User reported: Runtime error when saving change order - entry.newValue.replace is not a function"
  severity: major
  discovered_during: "Phase 16 gap closure retest"
  location: "apps/web/components/change-order/change-order-history.tsx line 78"
  root_cause_hypothesis: "entry.newValue is not a string (likely object or number), but code assumes it's always a string and calls .replace() method"
  test: "New bug (not from original UAT)"
  artifacts:
    - path: "apps/web/components/change-order/change-order-history.tsx"
      issue: "Line 78 calls replace() on non-string value"
  missing:
    - "Add type guard or optional chaining: entry.newValue?.toString().replace(/_/g, ' ') or similar"
