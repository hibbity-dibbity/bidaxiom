# Feature Landscape: UX Redesign — Procore-Level Density & Polish

**Domain:** Construction SaaS UX — Redesigning existing features to match enterprise density and professionalism
**Researched:** 2026-02-21
**Confidence:** MEDIUM-HIGH (Procore patterns verified via official documentation and release notes; BuilderTrend patterns from reviews; general SaaS table/form patterns from NN/G and design systems)

---

## Scope Note

This research covers **UX patterns for existing features** — not new functionality. The goal is to understand how Procore, BuilderTrend, and modern construction SaaS tools handle the surfaces already built in BIDAXIOM, so the redesign can target the right patterns.

Surfaces covered:
1. Dense financial data tables (budget, cost codes, SOV)
2. Approval workflow UI (change orders, pay apps)
3. Project overview / header design
4. Tabbed navigation within a project
5. Form patterns for complex data entry (estimates, change orders)
6. List views (project list, document list)

---

## Surface 1: Dense Financial Data Tables

### Table Stakes

Features every enterprise-grade financial table must have.

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Sticky/frozen header row** | Users scroll 50+ rows; without sticky header, column context is lost | LOW | CSS `position: sticky` on `<thead>`; standard in all enterprise tables |
| **Frozen left column(s)** | Budget tables have 15+ columns; cost code / line item name must stay visible while scrolling right | LOW | First 1-2 columns pinned; requires overflow-x scroll container |
| **Right-aligned numbers** | Financial values must align on decimal point for scan-comparison | LOW | CSS text-align: right on all currency/percent columns |
| **Monospace font for numbers** | Proportional fonts make digit-width inconsistent; numbers can't be compared visually | LOW | Use `font-variant-numeric: tabular-nums` or dedicated monospace stack |
| **Column resizing** | Long budget codes ("03-100 - Concrete Formwork") truncate; users need to resize | MEDIUM | Procore added this in 2024 for budget modifications specifically |
| **Show/hide columns** | Budget has 20+ possible columns; most users need 8-10; others need different 8-10 | MEDIUM | Column picker via gear/settings icon; persist per user in localStorage or DB |
| **Totals/summary row** | Budget tables must show column totals (committed, remaining, forecast); users expect sticky footer | LOW | Sticky `<tfoot>` with SUM aggregates; remains visible while scrolling |
| **Row density control** | Power users want 40px compact rows; casual users want 56px comfortable rows | LOW | Icon switcher outside table (compact / normal / relaxed); persist preference |
| **Sort by any column** | Users sort by cost code, by variance, by committed amount | LOW | Click column header to toggle asc/desc/none; sort indicator in header |
| **Zebra striping or line dividers** | Wide tables need visual row guides to track across 20 columns | LOW | Prefer subtle line dividers over zebra stripes (zebra conflicts with hover/selected states) |

### Differentiators

Patterns that elevate above baseline.

| Pattern | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Column pinning by user** | Users choose which columns to pin left/right, not just default first column | MEDIUM | Drag-to-pin or right-click pin; Procore's 2025 budget upgrade added this |
| **Grouped rows with collapse** | Group budget lines by CSI division, by phase, or by cost type; collapse/expand groups | MEDIUM | Reduces cognitive load on 100+ line budgets; Procore uses WBS grouping |
| **Inline editing with explicit save** | Edit a value in the cell, then confirm (checkmark) or cancel (X) — no modal required | MEDIUM | Reduces context switching; must show "unsaved" state clearly before confirm |
| **Side panel detail on row click** | Clicking a row amount opens a right-side panel with drill-down detail (transactions, line item history) — Procore's 2025 budget upgrade replaced modals with side panels | MEDIUM | Keeps table in view; panel width ~400px; closeable with Esc |
| **Keyboard navigation** | Tab through editable cells; arrow keys navigate rows; Enter to edit, Esc to cancel | MEDIUM | Procore added keyboard navigation to budget table in 2025 |
| **Multi-select and copy values** | Select multiple rows; bulk-copy values across rows (e.g., copy approved amount to invoiced) | MEDIUM | Procore added multi-select + copy-values to budget table in 2025 |
| **Snapshot/compare view** | Show budget at a point in time vs. current; highlight variances in red/green | HIGH | Procore snapshot feature; useful for period-end reporting |
| **Filter chips below toolbar** | Active filters shown as removable pills below the table header; shows filter state at a glance | LOW | Pattern from Procore NGX list views; clear individual or "Clear all" |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Modals for row detail** | Hides the table; breaks context; users lose their place | Use side panel / drawer pattern instead |
| **Zebra stripes + row hover + selected state** | Three gray states conflict visually and create muddy UI | Use line dividers; distinct hover color (e.g., blue-50); distinct selected color (e.g., blue-100) |
| **Center-aligned numbers** | Makes digit comparison impossible; looks decorative, not professional | Right-align all financial values |
| **Pagination for financial tables** | Budget tables need all rows visible for scroll-comparison; pagination breaks analysis | Use virtual scroll or simple scroll with sticky footer; pagination appropriate for list views only |
| **Non-resizable columns for code fields** | Budget code "03-200 - Concrete Reinforcing Steel" needs 300px+ minimum | Allow column resizing; set smart minimums |

---

## Surface 2: Approval Workflow UI (Change Orders, Pay Apps)

### How Procore Structures Change Order Status

Procore's change order workflow uses these default statuses, which map to visual states:

| Status | Type | Budget Impact | Implied Color |
|--------|------|--------------|---------------|
| Draft | Non-final | None | Gray |
| Pending - In Review | Active | Shows in "Pending" column | Yellow/Amber |
| Pending - Pricing | Active | None yet | Yellow/Amber |
| Pending - Proceeding | Active | None yet | Yellow/Amber |
| Pending - Revised | Active | None | Yellow/Amber |
| Pending - Not Pricing | Active | None | Yellow/Amber |
| Approved | Final | Full CO value added | Green |
| Rejected | Final | None | Red |
| No Charge | Final | None | Neutral/Gray |
| Void | Cancelled | None | Strikethrough/Gray |

**Key insight:** Only Approved and Pending - In Review statuses impact budget. Visual grouping of "Pending-*" variants under a yellow/amber semantic color is the correct pattern.

### Table Stakes for Approval Workflow

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Status badge on every row** | Users scan list for "what needs my attention"; status must be visible without clicking | LOW | Colored badge/chip: Draft=gray, Pending=amber, Approved=green, Rejected=red, Void=muted |
| **Status filter in list header** | Filter CO list by "Pending - In Review" to see what needs approval action | LOW | Procore uses grouped filter panel left of list; BIDAXIOM should use filter chips |
| **Approval action on detail page** | "Approve" and "Reject" buttons visible and prominent on CO detail; not buried in menu | LOW | Procore: primary CTA button placement in page header/action area |
| **Status history / audit trail** | Show who changed status and when; users need this for dispute resolution | LOW | Expandable timeline or activity log section at bottom of detail page |
| **Workflow diagram** | Show where CO is in the approval chain; who is next reviewer | MEDIUM | Procore uses workflow v2 panel with step indicators |
| **Bulk status update** | Select 5 COs, mark all as Approved in one action | MEDIUM | Floating bulk action bar appears when rows selected |

### Differentiators for Approval Workflow

| Pattern | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **In-line quick approve from list** | Approve/reject without opening detail page; right-click or hover action button | MEDIUM | Saves time for reviewers processing many COs |
| **Custom status labels** | Procore allows 50 custom statuses at company level; construction companies have unique workflow stages | HIGH | Store as enum list; map to Procore-equivalent "types" (draft/pending/approved/rejected) for budget impact |
| **Workflow routing visualization** | Show approval chain as horizontal step indicators: "PM Review → Owner Review → Approved" | MEDIUM | Useful when multiple approval tiers exist |
| **Email notification integration** | When CO status changes, auto-send notification to relevant parties | MEDIUM | Already partially implemented in BIDAXIOM; UX needs to surface notification status |
| **Rejection reason required** | Reject action requires free-text reason; shown in audit trail | LOW | Prevents ambiguous rejections; forces documentation |

### Anti-Features for Approval Workflow

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Approval action in dropdown menu** | Buried actions cause missed approvals; "approve" should never require 3 clicks | Surface Approve/Reject as primary buttons on detail page header |
| **Generic status colors** | Using arbitrary colors (purple for pending, teal for approved) creates learning overhead | Follow semantic convention: gray=draft, amber=pending, green=approved, red=rejected |
| **Status that doesn't map to budget impact** | Users lose trust if status says "Approved" but budget doesn't update | Make budget impact explicit; show it in status tooltip or helper text |

---

## Surface 3: Project Overview / Header Design

### What Procore Surfaces at Project Level

Procore's Project Overview page contains:
- Project information card (name, description, logo, total value, team roster)
- "My Open Items" card (user-assigned tasks, overdue/due next counts)
- "All Open Items" across all tools (RFIs, Submittals, Punch List)
- Quick Create menu (Change Events, RFIs, Submittals, Tasks, etc.)
- Project Insights (risk signals: avg RFI response time, overdue submittals)
- Project Links (customizable links to frequently accessed tools)
- Activity Feed ("Recently Changed Items" with who + when)

**Critical gap:** Procore's Project Overview does NOT surface financial metrics (budget spend, contract value) on the overview page itself. Financial data lives in the Budget tool tab.

### Table Stakes for Project Header

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Project name + status badge prominent** | First thing users see when entering a project; status tells them where project is in lifecycle | LOW | Top-left in header; status badge next to name |
| **Job number visible** | Construction projects are referenced by number in RFQs, COs, pay apps; must always be visible | LOW | Small label below/near project name |
| **Key financial summary** | Contract value, spent %, budget variance — power users need these at-a-glance | MEDIUM | Stats bar below project title: 3-5 key metrics in a horizontal row |
| **Project address / client name** | Field teams reference address; office references client | LOW | Secondary metadata row below project name |
| **Team contact access** | "Who is the PM on this?" should be answerable from project header | LOW | Avatars or names of key roles (PM, Super, Estimator) |
| **Navigation tabs persistent** | Project tabs (Budget, Change Orders, Pay Apps, etc.) must stay accessible throughout project | LOW | Horizontal tab bar below project header; does not scroll away |
| **Quick create action** | "+New" or "Create" button prominently placed to start frequent actions (CO, document, task) | LOW | Primary button in header right area |

### Differentiators for Project Header

| Pattern | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sticky project header** | Header with project name, status, and key metrics stays fixed as user scrolls tab content | MEDIUM | NN/G recommends keeping sticky header compact; max 64-80px; only name + status + tabs need to stick |
| **Financial health indicator** | Single "health" color or icon (on budget / over budget / at risk) calculated from budget variance | LOW | Green dot / amber dot / red dot next to budget metric; immediate signal |
| **Project progress bar** | Visual representation of schedule progress or billing progress | LOW | Optional; useful if project has defined timeline |
| **Contextual alerts in header** | "3 change orders need approval" or "Payment app due in 2 days" surfaced as badge in header | MEDIUM | Procore surfaces this in "Open Items" cards; BIDAXIOM could show in tab labels (e.g., "Change Orders (3)") |

### Anti-Features for Project Header

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full-height hero header** | Takes 200px+ of vertical space; reduces visible content area for data tables | Keep header compact: 60-80px max; sticky |
| **Dashboard-style widget grid** | Looks like a BI tool, not a construction PM tool; too much scrolling to reach actual work | Use stat bar pattern: 4-6 key numbers in a single horizontal row |
| **No financial summary on overview** | Users have to navigate to Budget tab to see if they're over budget | Expose 3 key financial figures in the header stat bar |
| **Status buried in metadata** | Project status should never require hunting; it communicates project phase | Status badge in H1 area, always visible |

---

## Surface 4: Tabbed Navigation Within a Project

### What Procore Does

Procore uses a sidebar navigation model at the project level (not tabs). Users click tools from a left sidebar categorized by discipline. The sidebar can be collapsed. Key insight: Procore does NOT use horizontal tabs for project tools — it uses a persistent left nav with tool categories (Project Management, Financial Management, Quality & Safety, etc.).

**Contrast:** BIDAXIOM uses horizontal tabs (Budget, Change Orders, Pay Apps, Estimates, Documents, RFQs, Workflows). This is actually more appropriate for a focused construction finance tool than Procore's sprawling tool-per-page model.

### Table Stakes for Tabbed Navigation

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Active tab indicator** | Current tab must be clearly distinguished from inactive tabs | LOW | Bold text + bottom border accent color; avoid subtle color-only distinction |
| **Tab labels with count badges** | "Change Orders (4)" tells user how many items before clicking | LOW | Show count for action-required items; consider only showing for non-zero counts |
| **Tabs do not scroll away** | Navigation must be always accessible; tabs below a sticky header is the correct pattern | LOW | Combined: sticky header + tabs form a 80-110px sticky band at top |
| **Tab order reflects workflow order** | Tabs ordered by logical workflow (Estimates → Budget → Change Orders → Pay Apps → Documents) | LOW | Current BIDAXIOM order should be reviewed against actual user workflow |
| **No more than 8-10 tabs** | More than 8 tabs causes horizontal overflow on smaller screens and overwhelms users | LOW | If >8 tabs needed, use "More" overflow dropdown for less-used tabs |
| **Mobile: tabs scroll horizontally** | On smaller screens, tabs should allow horizontal scroll rather than wrapping | LOW | CSS `overflow-x: auto` on tab bar; no line breaks |

### Differentiators for Tabbed Navigation

| Pattern | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Tab persistence per project** | Remember which tab user last visited per project; return to it on re-entry | LOW | Store in sessionStorage or URL param |
| **Deep linking to tabs** | URL changes when tab changes (e.g., `/projects/123/change-orders`); allows bookmarking and sharing | LOW | Already standard in Next.js routing; verify BIDAXIOM implements this |
| **Nested tabs (max 2 levels)** | Some tabs may warrant sub-tabs (e.g., Budget tab with sub-tabs: Summary / Modifications / Forecasting) | MEDIUM | Keep max 2 levels; third level = use accordion/collapsible section instead |
| **Tab content pre-loading** | Load adjacent tab data in background; reduces perceived switching latency | MEDIUM | React Query prefetch on tab hover |

### Anti-Features for Tabbed Navigation

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **3+ levels of nested tabs** | Creates "where am I?" confusion; users lose orientation | Max 2 levels; use accordion or section headings for 3rd level |
| **Tabs that look like buttons** | Users confuse navigational tabs with action buttons | Tabs: text-only with border indicator. Buttons: filled/outlined with background |
| **Tab reorder without save** | If tabs are customizable, users expect persistence | Save tab order preference server-side |
| **Scrolling tabs without overflow indicator** | Users don't know more tabs exist off-screen | Show fade/gradient indicator at scroll edge |

---

## Surface 5: Form Patterns for Complex Data Entry

### Estimate Forms (6-Step Guided)

BIDAXIOM has a 6-step estimate wizard. Best practices for this pattern:

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Step indicator with labels** | Users need to know where they are and how many steps remain | LOW | Horizontal stepper bar at top: Step 1 of 6 → Project Info → Line Items → etc. |
| **Steps influence each other** | Actions in Step 2 (line items) should carry forward to Step 4 (SOV); no re-entry | MEDIUM | State managed centrally; review step shows all data |
| **Can navigate backwards freely** | Users need to correct Step 2 data while reviewing Step 5 | LOW | Allow backward navigation without data loss |
| **Progress is auto-saved** | Leaving the wizard mid-way should not lose data | MEDIUM | Persist draft state to DB on each step completion |
| **Final review step** | Step N-1 (or final step) shows full summary before submit | LOW | Read-only preview of all entered data; "looks good, submit" confirmation |
| **Validation per step, not all at end** | Errors caught at Step 2 not reported at Step 6 submission | LOW | Validate on "Next" click; show inline errors before advancing |

### Change Order Forms

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Single-page form** | Change orders are simpler than estimates; a modal or single-page form is appropriate | LOW | Wizard overkill for COs; use single scrollable form with sections |
| **Inline line item entry** | Add cost line items (labor, materials) directly in the form without separate modal | MEDIUM | Add row button below cost table; inline row with editable cells |
| **Auto-calculation of totals** | As user enters line items, total auto-calculates; no manual sum required | LOW | JavaScript real-time calculation; read-only total field |
| **Reason / description required** | Change orders must document what changed and why | LOW | Required textarea field; min character count can help enforce quality |
| **Attach supporting documents** | CO requires quote from subcontractor, photos, etc. | LOW | File upload inline in the form, not a separate step |
| **Preview PDF before submission** | Generate preview PDF inline; user reviews before finalizing | MEDIUM | Button "Preview as PDF" opens in side panel or new tab |

### SOV (Schedule of Values) Builder

The SOV builder in BIDAXIOM is a table-within-a-form pattern:

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Add/remove rows inline** | Users add line items row-by-row without leaving the table | LOW | "Add line item" button at bottom; row immediately appears editable |
| **Auto-populate from cost catalog** | Type a cost code, auto-complete from CSI/company catalog | MEDIUM | Combobox with search; Procore uses work breakdown structure for this |
| **Running total visible** | As rows are added, total contract value updates in real time | LOW | Sticky footer row shows SUM |
| **Reorder rows** | Drag to reorder SOV line items (order matters for G703 column numbering) | MEDIUM | Drag handle on row left; react-dnd or dnd-kit |
| **Import from spreadsheet** | Paste CSV/Excel SOV data directly | HIGH | Procore supports CSV import for SSOV; useful for large SOVs |
| **Percentage completion column** | For pay apps: each SOV row needs % complete and $ billed this period | LOW | Additional columns appear when in "pay app" mode |

### Anti-Features for Forms

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **All fields on one giant form** | Cognitively overwhelming for estimates (50+ fields); users miss required fields | Use step-by-step wizard for estimates; single-page sections for COs |
| **Modal for SOV line item entry** | Opens separate modal to add each line item; breaks flow and hides table context | Inline row addition directly in the table |
| **Validate only on final submission** | User completes 6 steps then sees 12 errors back on Step 2 | Validate each step on "Next"; validate line items on blur |
| **No auto-save for wizard** | User abandons at Step 4; data lost; has to start over | Auto-save draft to DB after each step |
| **Unformatted number fields** | Currency fields that accept "1000" should format as "$1,000.00" on blur | Auto-format with Intl.NumberFormat; accept raw number input |

---

## Surface 6: List Views (Project List, Document List, CO List)

### Table Stakes for List Views

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Search bar above list** | Users need to find "Riverside Medical" by name or "CO-2024-047" by number | LOW | Debounced search; searches name + ID fields |
| **Filter chips/bar** | Filter by status, date range, project type, assigned user | LOW | Displayed as pills below search bar; removable; "Clear all" |
| **Sort by column header** | Click column header; toggles asc/desc/none | LOW | Sort indicator (chevron) in header; sort state shown visually |
| **Empty state with action** | When no results: show message "No change orders yet" + "Create Change Order" CTA | LOW | Empty states should not be blank screens |
| **Pagination or infinite scroll** | Long lists need pagination (50-100 per page) or virtual scroll | LOW | Use pagination for list views (predictable); virtual scroll for table views |
| **Row hover highlight** | Visual feedback that row is clickable/interactive | LOW | Subtle background color on hover; cursor: pointer |
| **Status badge on each row** | Status visible in list without opening record | LOW | Same badge system as detail page |
| **Bulk actions** | Select multiple records for bulk status update, delete, export | MEDIUM | Checkbox appears on hover; bulk action bar appears at top/bottom when items selected |

### Differentiators for List Views

| Pattern | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Saved filter views** | Save "My Pending COs" as a named filter; return to it quickly | MEDIUM | Filter sets stored per user; shown as quick-select tabs above list |
| **Column picker in list views** | Show/hide columns; custom column order | MEDIUM | Gear icon in header opens column picker panel |
| **Export to CSV/Excel** | Send list data to accounting teams; construction always has Excel requirements | LOW | Export button in toolbar; apply current filters/sort to export |
| **Floating bulk action bar** | When rows selected, floating bar appears (bottom or top) showing: "3 selected: Update Status, Export, Delete" | MEDIUM | Dismisses when selection cleared; persistent while selected |
| **Quick edit on hover** | Hover row shows "quick edit" icon; opens side panel without navigating away | MEDIUM | Procore NGX pattern for CO list view |

### Anti-Features for List Views

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Filter panel always visible** | Takes 25-30% of screen width; most users use 1-2 filters max | Use filter chips above table; expand to filter panel only on "Filter" click |
| **No empty state** | Blank page when no data exists; users think something is broken | Always show empty state with explanation + primary action CTA |
| **Select all checkboxes always visible** | Checkboxes in left column reduce content width; unused feature constantly visible | Checkbox appears on row hover only; select-all in header appears when any row selected |
| **Fixed column widths too narrow** | Project names truncate at 150px; users can't read them | Smart defaults: name column minimum 200px; allow resize |

---

## Table Stakes: Construction SaaS Must-Haves

Every tool in this space has these. Missing = product feels incomplete.

| Pattern | Surface | Why Non-Negotiable |
|---------|---------|-------------------|
| Semantic status badges (color-coded) | All list views and detail pages | Construction professionals scan for status; color provides instant signal |
| Right-aligned currency with $ prefix | All financial tables | Industry standard; misaligned numbers look unfinished |
| Sticky table headers | All scrollable tables | Non-negotiable for any table > 10 rows |
| Tab navigation at project level | Project detail pages | Expected information architecture for project-scoped tools |
| Inline search on every list | All list views | Users can't scroll through 50+ projects to find one |
| Approval action buttons prominent | Change order detail, pay app detail | Buried approval actions cause missed deadlines |
| Activity/audit trail on records | Change orders, pay apps, documents | Required for dispute resolution; standard in construction |
| PDF export from financial forms | Pay apps, change orders | Construction industry runs on paper documents; PDF generation is a basic requirement |
| Cost code autocomplete | Budget, CO forms, SOV | Manual code entry causes errors; catalog lookup prevents typos |

---

## Differentiators: What Separates Best-in-Class

| Pattern | Surface | Why It Differentiates |
|---------|---------|----------------------|
| Side panel drill-down replacing modals | Budget, CO lists, document lists | Keeps context table visible; reduces disorienting full-page transitions |
| Column pinning user-controlled | Financial tables | Power users configure their workspace; reduces scrolling for what matters to them |
| Keyboard navigation in tables | Budget, SOV builder | Accountants and PMs live in spreadsheets; keyboard-driven entry is 5x faster |
| Filter chips persisted as named views | CO list, project list | Saves "My Pending Approvals" filter; power user time-saver |
| Tab badge counts for action items | Project navigation tabs | "Change Orders (3)" tells user immediately where attention is needed |
| Contextual quick-create from any page | Global / project level | Command palette (⌘K already built) + context-aware quick create from header |
| Financial health at-a-glance in header | Project header | Single-screen answer to "are we on budget?" — not a separate navigation step |
| Inline row addition in SOV/CO line items | Estimate, CO forms | No modal disruption; stays in context of the table being built |

---

## Anti-Features: Commonly Requested, Actually Problematic

| Anti-Feature | Why Requested | Why It Fails | What to Do Instead |
|--------------|---------------|--------------|-------------------|
| **Real-time collaboration cursors** | "Like Google Docs" | Construction financials need strict version control; concurrent edits cause data conflicts | Optimistic locking with "currently editing" warning banner |
| **AI auto-fill estimates** | Reduces data entry effort | Incorrect AI values cause project budget disasters; users don't trust AI for financials | AI suggestions shown as non-binding reference only, user must confirm each value |
| **Drag-and-drop everything** | Feels modern | Accidental drops on financial data cause irreversible errors without undo | Drag-drop for ordering only (SOV rows); never for value entry or status change |
| **Dashboard widget customization** | Users want "their" view | Widget drag-drop is a dev sprint; actual value is low; power users want data density not widgets | Saved filter views + column picker gives 90% of value at 10% of complexity |
| **Folder-based document management** | "That's how we organize files" | Deep nesting hides files; "Where is that CO from last March?" never has a good answer in folders | Flat table + metadata filters; folders become saved filter views |
| **Auto-advance approval status** | "Workflow automation" | Auto-advancing a CO to "Approved" based on a rule can have financial contract implications | Keep all approvals manual + audit-logged; automation creates liability |
| **Infinite scroll for list views** | "No pagination is cleaner" | Users can't return to their scroll position; can't see total count; export is unclear | Pagination for list views; virtual scroll only for spreadsheet-style tables |

---

## Competitor Feature Analysis

### Procore vs BuilderTrend vs BIDAXIOM Target State

| Surface | Procore | BuilderTrend | BIDAXIOM Target |
|---------|---------|--------------|-----------------|
| **Financial tables** | Dense, column-configurable, WBS grouping, snapshot comparison, side-panel drill-down | Basic; adequate for residential scale; less column control | Procore-level: sticky headers, frozen columns, column picker, side-panel drill-down |
| **Approval workflow** | 10+ status types, custom statuses, workflow routing, NGX list view | Simpler approval flow; fewer status stages | Semantic 4-type badge system (draft/pending/approved/rejected) + inline approve from list |
| **Project header** | Project info card + open items + activity feed; NO financial summary in overview | Clean header; task-centric; less financial emphasis | Compact sticky header with stat bar: contract value, budget variance, % billed |
| **Project navigation** | Left sidebar (tool-per-page); heavy; enterprise scale | Top nav + left sidebar | Horizontal tabs (current) — appropriate for BIDAXIOM scope; refine labels and active states |
| **Estimate forms** | Dedicated estimating tool with takeoff, catalog, assembly pricing | Basic budget entry | 6-step wizard (already built); improve step indicators, inline line item entry, auto-save |
| **CO forms** | Multi-tier (Change Event → PCO → CO); very detailed | Simpler single-form CO | Single-page CO form with inline line item table; no extra tiers needed at BIDAXIOM's scale |
| **List view patterns** | NGX: grouped filters, quick-edit hover, bulk actions, column picker | Clean but less feature-rich | Filter chips, bulk action bar, column picker, hover quick-edit, empty states |
| **User experience** | Complex; steep learning curve; praised for power; criticized for clutter | Praised for ease; criticized for lacking depth | Target: Procore density with BuilderTrend's learnability — dense but not overwhelming |

### What Procore Gets Right (Copy These)

- **NGX list view pattern:** Filter panel opens left; list is main content; side panel for detail. Three-column layout.
- **Budget side panel:** Click a value → side panel slides in with drill-down; table stays visible.
- **Status-typed workflow:** Draft → Pending variants → Approved/Rejected. Budget impact tied to status type.
- **Column management pattern:** Gear icon → column picker → drag/drop to reorder → persist per user.
- **Sidebar eliminated on budget page:** Actions consolidated into header. Sidebar removal increased content area.

### What Procore Gets Wrong (Avoid These)

- **Too many modules creating navigation maze:** Procore's left nav has 20+ tools. Users with access to 5 modules see empty/locked categories constantly.
- **Steep learning curve:** Financial tools designed for controllers, not field PMs. Terminology is accounting-first.
- **Module isolation:** Tools don't cross-reference well; "Where do I go to see my COs?" requires knowing which module.
- **Overwhelming first impression:** New users consistently report feeling lost. Empty states are poor.

### What BuilderTrend Gets Right (Copy These)

- **Approachable entry:** New projects set up in minutes. Defaults are sensible for most residential cases.
- **Client portal simplicity:** External stakeholders (owners) can use it without training.
- **Clear visual hierarchy:** Fewer competing elements; easier to find the next action.

### What BuilderTrend Gets Wrong (Avoid These)

- **Insufficient density for commercial/GC work:** Tables lack power-user features (column config, freeze, bulk actions).
- **Missing financial depth:** Budget tracking adequate for residential; insufficient for commercial GC workflows with complex SOVs.

---

## Feature Prioritization: UX Redesign Focus

### P1 — Visual consistency and completion (low complexity, high impact)

- [ ] Standardize status badges across all surfaces (same 4 semantic colors everywhere)
- [ ] Right-align and format all currency values with monospace numerals
- [ ] Add sticky/frozen table headers to all financial tables
- [ ] Freeze first column on all wide tables (budget, SOV)
- [ ] Standardize empty states on all list views with actionable CTA
- [ ] Add filter chips pattern to all list views (replace inline dropdowns)
- [ ] Count badges on project tabs where action items exist
- [ ] Compact sticky project header (name + status + job number + stat bar + tabs)

### P2 — Interaction improvements (medium complexity, high user impact)

- [ ] Column picker (show/hide) on financial tables and list views
- [ ] Row density control (compact/normal) on financial tables
- [ ] Inline row addition for SOV/CO line item tables (remove modal)
- [ ] Side panel pattern for row detail (replace modals where possible)
- [ ] Bulk action floating bar on all list views with multi-select
- [ ] Keyboard navigation in budget table and SOV builder
- [ ] Inline approve/reject quick action on CO list rows
- [ ] Export CSV/Excel from all list views

### P3 — Power user features (higher complexity, power user impact)

- [ ] User-controlled column pinning in budget table
- [ ] Saved filter views ("My Pending Approvals")
- [ ] Column pinning right-click or drag-to-pin interaction
- [ ] Snapshot comparison view in budget table
- [ ] Multi-select and copy-values across budget rows

---

## Sources

- [Procore Budget Improvements](https://www.procore.com/whats-new/budget-improvements) — column resizing, navigation consolidation
- [Procore Change Order Statuses](https://support.procore.com/faq/what-are-the-default-statuses-for-change-orders-in-procore) — 10 default statuses with budget impact mapping
- [Procore Project Overview](https://support.procore.com/products/online/user-guide/project-level/project-overview/tutorials/about-the-project-overview) — overview page structure, quick create, open items
- [Procore What's New — NGX Change Orders](https://www.procore.com/whats-new) — NGX list view pattern, side panel on budget click, keyboard nav
- [Procore Q2 2024 Project Financials Release](https://www.procore.com/whats-new/now-live-q2-2024-project-financials-quarterly-release) — Latest Cost/Latest Price columns, Change Events redesign
- [Procore Navigation FAQ](https://support.procore.com/faq/how-do-i-navigate-procores-tools) — sidebar + toolbox structure
- [Pencil & Paper — Enterprise Data Tables UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — row density standards, alignment, bulk actions, sticky footers
- [Pencil & Paper — Enterprise Filtering Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering) — filter chips, sidebar filters, applied filters redundancy
- [Eleken — Table Design UX Guide](https://www.eleken.co/blog-posts/table-design-ux) — zebra vs line dividers, column freezing, totals rows
- [NN/G — Sticky Headers](https://www.nngroup.com/articles/sticky-headers/) — content-to-chrome ratio, height guidelines, opaque backgrounds
- [Buildertrend Review 2026 — The Digital Project Manager](https://thedigitalprojectmanager.com/tools/buildertrend-review/) — UX strengths and weaknesses
- [Procore vs Buildertrend Comparison](https://buildern.com/resources/blog/buildertrend-vs-procore/) — market positioning and UX tradeoffs
- [Construction SaaS UX Fixes (Medium, AlterSquare, Jan 2026)](https://medium.com/@altersquare/your-construction-saas-looks-like-every-other-tool-7-ux-fixes-that-actually-win-rfps-90c1ca4d77c9) — construction-specific UX differentiation
- [Procore User Reviews — Capterra](https://www.capterra.com/p/56250/Procore/reviews/) — real user UX pain points (complexity, navigation)
- [Schedule of Values Guide](https://www.mastt.com/guide/schedule-of-values) — SOV table structure and data requirements

---

*Feature research for: BIDAXIOM UX Redesign — Procore-level density and polish*
*Researched: 2026-02-21*
