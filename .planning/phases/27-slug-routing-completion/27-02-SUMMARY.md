---
phase: 27
plan: 02
subsystem: subcontractor-routing
tags: [slug-routing, navigation, subcontractors, post-rename]
dependency_graph:
  requires: [27-01]
  provides: [SLUG-03, SLUG-04]
  affects: [subcontractor-form, subcontractor-detail-page]
tech_stack:
  added: []
  patterns: [callback-threading, slug-based-navigation, optimistic-invalidation]
key_files:
  modified:
    - apps/web/components/bidding/subcontractor-form.tsx
    - apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx
decisions:
  - Cast updated record as { slug: string; id: string } since tRPC infers full DB row type but we only need these two fields in the callback
  - Used router.replace (not push) so post-rename URL is not in back-stack history
  - invalidate getBySlug on same-slug update so detail view refreshes without navigation
metrics:
  duration: ~3 min
  completed: 2026-02-18
  tasks_completed: 2
  files_changed: 2
---

# Phase 27 Plan 02: Subcontractor Post-Rename Slug Navigation Summary

Thread updated slug through SubcontractorForm onSuccess so detail page navigates to new URL when companyName changes regenerate the slug.

## What Was Done

### Task 1 — Thread updated record through SubcontractorForm onSuccess

**File:** `apps/web/components/bidding/subcontractor-form.tsx`

Changed the `onSuccess` prop type from `() => void` to `(updated?: { slug: string; id: string }) => void`.

Updated `updateMutation.onSuccess` to receive the returned record from the API and forward it to the prop callback:

```tsx
onSuccess: (updated) => {
  utils.subcontractor.list.invalidate();
  utils.subcontractor.getById.invalidate();
  toast.success("Subcontractor updated successfully");
  if (onSuccess) {
    onSuccess(updated as { slug: string; id: string });
  }
},
```

The `createMutation.onSuccess` call to `onSuccess()` (no args) remains compatible since the parameter is optional.

### Task 2 — Add post-rename slug navigation to subcontractor detail page

**File:** `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx`

Replaced the static `onSuccess={() => setIsEditing(false)}` with a handler that:
- Closes the edit dialog
- If the returned slug differs from the current URL slug, navigates to the new URL via `router.replace`
- Otherwise, invalidates `getBySlug` to refresh the displayed data

```tsx
onSuccess={(updated) => {
  setIsEditing(false);
  if (updated?.slug && updated.slug !== params.subcontractorSlug) {
    router.replace(`/subcontractors/${updated.slug}`);
  } else {
    utils.subcontractor.getBySlug.invalidate({ slug: params.subcontractorSlug });
  }
}}
```

The `updateMutation.onSuccess` used for the status toggle button was left unchanged — it already invalidates correctly and does not touch the slug.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/components/bidding/subcontractor-form.tsx` | Widened onSuccess type; pass updated record in updateMutation callback |
| `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` | Slug-aware onSuccess with router.replace on slug change |

## Key Decisions

1. **Cast to `{ slug: string; id: string }`**: The tRPC inferred return type is the full DB row (`SubcontractorDirectory | undefined`). Rather than importing the full DB type into the web app's form component, we cast to the minimal shape needed at the call site.

2. **`router.replace` not `router.push`**: Post-rename navigation replaces the history entry so the user doesn't land back on a stale URL if they hit the browser Back button.

3. **Same-slug path calls `invalidate`**: When only non-name fields are updated, the slug stays the same. In that case we invalidate `getBySlug` to refresh the detail view rather than re-navigating.

## Verification Results

- `grep -n "onSuccess(updated)" subcontractor-form.tsx` — matches line 82
- `grep -n "router.replace" page.tsx` — matches line 302
- TypeScript check (`npx tsc --noEmit`) — no new errors introduced in modified files; pre-existing errors in unrelated API files (`bid.ts`, `bidGeneration.ts`, `estimateLifecycle.ts`, `oauth.ts`) are out of scope

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/web/components/bidding/subcontractor-form.tsx` — modified and committed
- `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` — modified and committed
- Commit `9c1da3b` exists in git log
