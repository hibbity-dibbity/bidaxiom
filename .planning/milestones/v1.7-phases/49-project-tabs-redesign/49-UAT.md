---
phase: 49-project-tabs-redesign
created: 2026-02-24
status: in_progress
tests_total: 7
tests_passed: 6
tests_failed: 0
tests_skipped: 0
tests_pending: 1
---

# Phase 49 UAT: Project Tabs Redesign

## Session

Started: 2026-02-24
Tester: User (browser)
Status: In progress

---

## Test Results

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Tab bar shows 6 tabs in correct order | PASS | All 6 tabs visible after removing phase gate |
| 2 | Proposals tab navigates to /estimates (URL) | PASS | URL confirmed /estimates |
| 3 | Expenses tab shows placeholder page (Receipt icon, heading, Back button) | PASS | |
| 4 | Breadcrumb on /estimates shows "Proposals" | PASS | |
| 5 | Proposals list page uses Proposal terminology throughout | PASS | |
| 6 | Create Proposal form uses Proposal terminology | PASS | Terminology correct; inline breadcrumb row overlaps tab bar — fixed separately |
| 7 | Proposal detail page uses Proposal terminology | pending | |

---

## Test Details

### Test 1: Tab bar shows 6 tabs in correct order

**Steps:**
1. Open any project detail page (e.g., `/projects/[slug]`)
2. Look at the tab bar

**Expected:** Six tabs visible left-to-right: Overview · Documents · Proposals · Change Orders · Invoices · Expenses

**Status:** FAIL

**Root cause:** `ALL_SECTIONS` entry for Change Orders has `phaseGated: "change_orders"`. `isFeatureAvailableInPhase` only allows this tab in `["awarded", "active", "substantial_completion", "closed", "warranty", "archived"]`. Pre-award projects (opportunity/estimating/submitted) get the tab filtered out.

**Fix:** Remove `phaseGated: "change_orders"` from the Change Orders entry in `project-tabs.tsx`. In the simplified UX, Change Orders should always be visible (empty is fine — same as the Expenses placeholder approach).

---

### Test 2: Proposals tab navigates to /estimates (URL)

**Steps:**
1. On a project detail page, click the "Proposals" tab

**Expected:** URL changes to `/projects/[slug]/estimates` — tab says "Proposals" but URL slug is `/estimates`

**Status:** pending

---

### Test 3: Expenses tab shows placeholder page

**Steps:**
1. On a project detail page, click the "Expenses" tab

**Expected:**
- Page shows a Receipt icon
- Heading reads "Expense Tracking"
- Description text about expense tracking coming soon
- "Back to Overview" link is present
- No toast notification fires

**Status:** pending

---

### Test 4: Breadcrumb on /estimates shows "Proposals"

**Steps:**
1. Navigate to a project's proposals tab (`/projects/[slug]/estimates`)
2. Look at the breadcrumb trail in the top bar

**Expected:** Breadcrumb reads "Proposals" (not "estimates" or "Estimates")

**Status:** pending

---

### Test 5: Proposals list page uses Proposal terminology

**Steps:**
1. Navigate to a project's proposals tab (`/projects/[slug]/estimates`)
2. Check: page heading, action button, search placeholder, and empty state copy

**Expected:**
- Page heading: "Proposals"
- Button: "New Proposal"
- Search: "Search proposals by name..."
- Empty state: "No proposals yet" or "No proposals match..."

**Status:** pending

---

### Test 6: Create Proposal form uses Proposal terminology

**Steps:**
1. Click "New Proposal" to open the create form
2. Check: page heading, form label, breadcrumb trail

**Expected:**
- Page heading: "Create New Proposal"
- Form field label: "Proposal Name"
- Breadcrumb: shows "Proposals" / "New Proposal"

**Status:** pending

---

### Test 7: Proposal detail page uses Proposal terminology

**Steps:**
1. Click into an existing proposal (or create one)
2. Check the detail page heading, buttons, and any not-found fallback

**Expected:**
- Detail page heading: "Proposal Details"
- Edit button: "Edit Proposal"
- Not-found state (if applicable): "Proposal Not Found" / "Back to Proposals"

**Status:** pending

---

## Gaps Found

None yet.

---

## Fix Plans

None yet.
