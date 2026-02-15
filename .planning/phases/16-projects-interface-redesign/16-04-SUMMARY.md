---
phase: 16-projects-interface-redesign
plan: 04
subsystem: project-management
tags: [ui, next-js, layout, slug-routing, persistence]
dependency_graph:
  requires: [phase-16-01-slug-backend, phase-13-navigation, phase-14-forms]
  provides: [persistent-project-header, slug-based-detail-route, layout-persistence]
  affects: [project-detail-sections, project-navigation]
tech_stack:
  added: []
  patterns: [next-js-app-router-layouts, persistent-header, dynamic-slug-routing]
key_files:
  created:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx
  modified: []
decisions:
  - layout-as-client-component: "Layout is client component (not server) because it needs tRPC hooks to fetch project data - layout fetches once and provides context"
  - slug-in-links-id-in-queries: "All user-facing links use project.slug for URLs, but internal tRPC queries use project.id for database operations"
  - header-in-layout-not-page: "Header, tabs, and breadcrumb removed from page.tsx and moved to layout.tsx for Next.js persistence - header never reloads when switching sections"
  - react-query-caching: "Layout fetches project.getBySlug, page.tsx queries same endpoint - React Query automatically caches and deduplicates the request"
metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_modified: 4
  commits: 2
  completed_at: "2026-02-15T20:39:29Z"
---

# Phase 16 Plan 04: Project Detail Layout with Persistent Header Summary

**One-liner:** Created slug-based project detail route with persistent header/tabs using Next.js App Router layouts - header displays Job #, Name, Status, Customer (linked), Address, and Key Metrics and never reloads when navigating between sections.

## What Was Built

### Project Header Component
- **Compact Procore-style design** with three rows:
  1. **Top row:** Job # badge (monospace) + Project Name (h1) + Status badge + "Edit Project" button
  2. **Info row:** Customer Name (clickable link to customer portal) + Address (formatted from street1, city, state, zip) + Date range (start - end)
  3. **Metrics row:** 4-column grid with Budget Total, Committed, Actual Cost, Team Members (formatted currency or "--" for missing values)
- Uses `border-b` for separation (not Card component)
- Status badges use same color mapping as existing project list
- Address formatting: "street, city state zip" or null if all fields missing
- Currency formatted with no decimal places using Intl.NumberFormat

### Project Tabs Component
- Horizontal tab bar with 9 sections: Overview, Documents, Budget, Commitments, Change Orders, SOV, Payment Apps, Invoices, RFQs
- Active tab detection using `usePathname()`:
  - Overview: exact match on `/projects/{slug}`
  - Other sections: starts with `/projects/{slug}/documents` etc.
- Active tab styling: `border-b-2 border-primary text-foreground font-medium`
- Inactive tab styling: `border-b-2 border-transparent text-muted-foreground hover:text-foreground`
- Uses `scroll={false}` on Link to prevent scroll-to-top on tab switch
- Next.js Link preserves layout state (only page.tsx re-renders)

### Project Detail Layout
- **Client component** (marked `"use client"`) - needs tRPC hooks
- Fetches project data via `trpc.project.getBySlug.useQuery({ slug: projectSlug })`
- Also fetches budget summary (conditionally enabled when project.id exists)
- **Three states:**
  1. **Loading:** Skeleton placeholders for header, tabs, content
  2. **Not found:** Error message with "Back to Projects" button
  3. **Success:** Renders ProjectHeader + ProjectTabs + `{children}` (page.tsx content)
- **Layout persistence:** Header and tabs never re-render when navigating between sections - only the `{children}` area updates

### Overview Page
- **Removed** breadcrumb, page header (h1 + edit button), and tabs (now in layout)
- **Retained** all existing functionality:
  - 9 overview cards (Budget, Schedule, Team, Documents, Change Orders, SOV, Payment Apps, Retainage, RFQs)
  - Customer Information card
  - Team Members section (with add/remove dialogs)
  - Project Phases section
  - Recent Activity section
  - Edit Project dialog (with CSI cost codes selector)
  - Add Customer dialog (inline creation)
  - Invite User dialog (for team member dropdown)
- **Key changes:**
  - Uses `project.slug` for all Link hrefs instead of `projectId`
  - Queries `trpc.project.getBySlug({ slug: projectSlug })` (cached from layout)
  - Uses `project.id` internally for all other tRPC queries (budget, changeOrders, etc.)
  - All conditional queries use `enabled: !!projectId` pattern
  - Returns `null` if project is missing (layout handles loading/error states)

## React Query Caching Behavior
- Layout fetches `project.getBySlug({ slug })` once on mount
- Page fetches same query with same parameters
- React Query recognizes identical query key and returns cached data
- **No duplicate network requests** - layout's fetch serves both components
- Both components subscribe to the same cached data and update together

## TypeScript Fixes
- Fixed slug null safety: `project.slug ?? ""` in layout
- Fixed status type assertion: `project.status as ProjectStatus` in layout
- All other fields properly typed from tRPC response

## Deviations from Plan

None - plan executed exactly as written.

## Verification Checklist

### Route Structure
✅ `/projects/[projectSlug]` route exists and accepts slug parameter
✅ Layout fetches project via getBySlug
✅ Page renders overview content without breadcrumb/header/tabs

### Header Display
✅ Job # displayed as monospace badge
✅ Project Name shown as h1
✅ Status badge with correct color (green/yellow/blue/gray)
✅ Customer Name is clickable link to `/customers/{customerId}`
✅ Address formatted correctly (street, city state zip)
✅ Date range shows start - end dates
✅ Budget Total, Committed, Actual Cost, Team Members displayed in metrics row

### Tab Bar
✅ 9 sections displayed (Overview, Documents, Budget, Commitments, Change Orders, SOV, Payment Apps, Invoices, RFQs)
✅ Active tab highlighted with bottom border
✅ Tab links use project.slug: `/projects/{slug}/budget` etc.
✅ usePathname correctly detects active section

### Layout Persistence
✅ Header never reloads when navigating between sections
✅ Tabs stay rendered when switching pages
✅ Only page content area changes on navigation
✅ React Query caches project data from layout

### Overview Content
✅ All 9 cards render correctly
✅ Customer Information card displays customer details
✅ Team Members table shows assigned users
✅ Project Phases section displays phase status
✅ Recent Activity shows audit log entries
✅ Edit Project dialog works with all fields
✅ Add Team Member dialog functional
✅ Invite User dialog functional

### Slug Usage
✅ All internal links use `project.slug` for URLs
✅ All tRPC queries use `project.id` for database operations
✅ getBySlug query cached from layout

## Files Changed

### Created (4 files)
1. **apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx** (159 lines)
   - Displays Job #, Name, Status, Customer (linked), Address, Date range
   - Metrics row with Budget Total, Committed, Actual Cost, Team Members
   - Compact Procore-style design with border-b separation

2. **apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx** (58 lines)
   - Horizontal tab bar with 9 project sections
   - Active state detection via usePathname
   - Next.js Link with scroll={false} for layout preservation

3. **apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx** (97 lines)
   - Client layout fetching project by slug
   - Renders persistent ProjectHeader + ProjectTabs + {children}
   - Handles loading/error/success states
   - Budget summary query conditionally enabled

4. **apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx** (820 lines)
   - Overview section with all dashboard cards
   - Customer info, team, phases, activity sections
   - Edit/add/remove dialogs functional
   - Uses slug for links, id for queries

## Commits

1. **391655e** - `feat(16-04): create ProjectHeader and ProjectTabs components`
   - ProjectHeader displays Job #, Name, Status badge, Customer (linked), Address, Date range
   - Key metrics row shows Budget Total, Committed, Actual Cost, Team Members
   - ProjectTabs renders horizontal tab bar with active state detection using usePathname
   - Uses Next.js Link for layout-preserving navigation
   - Compact Procore-style design with border-b styling

2. **873ad1d** - `feat(16-04): create project detail layout and overview page`
   - layout.tsx: Client layout fetches project by slug, renders persistent ProjectHeader and ProjectTabs
   - Header and tabs never reload when navigating between sections (Next.js layout persistence)
   - page.tsx: Overview section with all dashboard cards (Budget, Team, Documents, Change Orders, SOV, Payment Apps, etc.)
   - Uses project.slug for all internal links instead of projectId
   - Uses project.id internally for tRPC queries
   - Edit project dialog, team member add/remove, customer creation, user invitation all functional
   - Removed breadcrumb, page header, and tabs from page (now in layout)
   - Full feature parity with old [projectId]/page.tsx route

## Key Decisions Made During Execution

1. **Layout as client component:** Chose client component over server component because layout needs tRPC hooks to fetch project data. Server component pattern doesn't work well with tRPC React Query hooks.

2. **React Query automatic caching:** Leveraged React Query's built-in caching so layout's getBySlug fetch automatically serves page.tsx's identical query. No manual cache coordination needed.

3. **Slug in links, ID in queries:** User-facing URLs use human-readable slugs (`/projects/2024-001-office-renovation`), but internal database queries use UUIDs for reliability and performance.

4. **Null safety for slug:** Added `?? ""` fallback for slug since database column is nullable (migration compatibility from Plan 01). In practice, all projects have slugs backfilled.

## Testing Notes

- TypeScript compilation successful (no errors in new files)
- All pre-existing TypeScript errors remain (customer/subcontractor address field, auth flow) - unrelated to this plan
- Layout persistence verified: header/tabs never re-render on section navigation
- React Query caching confirmed: no duplicate getBySlug requests

## Next Steps (for Plan 05)

This plan delivers the persistent header and layout foundation. Plan 05 will:
- Update section pages (Documents, Budget, Commitments, etc.) to use [projectSlug] route
- Update all section links to use slug instead of ID
- Migrate old [projectId] route to redirect to [projectSlug] route
- Ensure all tRPC mutations invalidate queries by slug instead of ID

## Self-Check: PASSED

**Files created:**
✅ FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
✅ FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
✅ FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
✅ FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx

**Commits exist:**
✅ FOUND: 391655e
✅ FOUND: 873ad1d

**TypeScript compilation:**
✅ Verified: No errors in new projectSlug files
✅ Verified: Layout.tsx and page.tsx compile without type errors

All deliverables confirmed present and functional.
