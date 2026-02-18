---
phase: 27
plan: "01"
subsystem: customers, projects
tags: [slug-routing, customer-edit, navigation, ui]
dependency_graph:
  requires: []
  provides: [customer-edit-dialog, slug-customer-link]
  affects: [project-header, customer-detail-page]
tech_stack:
  added: []
  patterns: [slug-with-uuid-fallback, post-rename-router-replace]
key_files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
    - apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx
decisions:
  - "Use slug with UUID fallback (customerSlug || customerId) so existing projects without customer slugs still navigate correctly"
  - "Use router.replace (not push) after rename so browser back button returns to projects, not stale slug URL"
metrics:
  duration: "~5 min"
  completed: "2026-02-18"
  tasks_completed: 2
  files_changed: 3
---

# Phase 27 Plan 01: Fix UUID Customer Link + Add Edit Dialog to Customer Detail Page Summary

**One-liner:** Fixed project-header customer link to use slug with UUID fallback, and added full inline edit dialog to customer detail page with post-rename slug navigation.

## What Was Done

### Task 1: Fix UUID customer link in project-header.tsx

The project header was linking to customers using the raw UUID (`/customers/{uuid}`) instead of the slug-based URL. This caused broken navigation since the customer detail route expects a slug.

**Changes:**
- Added `customerSlug?: string | null` to `ProjectHeaderProps` interface alongside existing `customerId`
- Changed customer link href from `project.customerId` to `project.customerSlug || project.customerId` (slug with UUID fallback for safety)
- Updated `layout.tsx` to pass `customerSlug: project.customer?.slug ?? null` into `<ProjectHeader>`

### Task 2: Add edit dialog to customer detail page

The customer detail page had only a "Back to Customers" button with no way to edit the customer inline. Added a full edit dialog matching the pattern already used in the customers list page.

**Changes:**
- Added imports: `useRouter`, `Edit`, `createCustomerSchema`, `z`, Dialog components, Form components, `PhoneInput`, `AddressInput`, `Input`, `useState`, `useForm`, `zodResolver`, `toast`
- Added `router`, `editDialogOpen`, `utils`, form state, `updateMutation`, `handleEdit`, `handleSubmitEdit` inside the component
- Replaced single "Back to Customers" button with a flex row containing Edit + Back buttons
- Added full edit dialog at bottom of JSX with form fields matching the list page dialog
- On success: invalidates cache, shows toast, closes dialog, and navigates to new slug URL if slug changed

## Key Decisions

1. **Slug with UUID fallback**: `customerSlug || customerId` ensures backward compatibility for any project records where `customer.slug` might be null.
2. **`router.replace` after rename**: Replaces current history entry so the back button doesn't return to the now-invalid old slug URL.
3. **No `customerId` removal**: Kept `customerId` in the interface as instructed — only added `customerSlug` alongside it.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` | Added `customerSlug` prop, updated customer link href |
| `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` | Pass `customerSlug` from customer relation |
| `apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx` | Added full edit dialog with mutation and post-rename nav |

## Verification Results

- `customerSlug` appears on lines 25, 106 of project-header.tsx (interface + href)
- `customerSlug` and `customer.slug` appear in layout.tsx line 72
- `editDialogOpen`, `updateMutation`, `router.replace`, `handleEdit` all present in customer detail page
- TypeScript check: all errors are pre-existing in `api/` files unrelated to changes made

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` - modified, verified via grep
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` - modified, verified via grep
- `apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx` - rewritten, verified via grep
- Commit `093932d` confirmed in git log
