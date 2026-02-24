---
phase: 50-send-to-customer-flow
plan: "04"
subsystem: ui
tags: [react, change-order, header, dropdown, send-to-customer, approval-removal]
dependency_graph:
  requires:
    - 50-01 (changeOrder.sendToCustomer mutation)
    - 50-02 (SendToCustomerDialog component)
  provides:
    - CO detail page with Phase 46 two-row header layout
    - SendToCustomerDialog wired to changeOrder.sendToCustomer mutation
    - customerEmail prop on ChangeOrderDetail passed from project data
  affects:
    - apps/web/components/change-order/change-order-detail.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx
    - apps/web/components/change-order/change-order-list.tsx
tech_stack:
  added: []
  patterns:
    - Phase 46 two-row header (back nav row 1, name+status+actions row 2)
    - 3-dot DropdownMenu for secondary document actions (Generate PDF, Send to Customer)
key_files:
  created: []
  modified:
    - apps/web/components/change-order/change-order-detail.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx
    - apps/web/components/change-order/change-order-list.tsx
decisions:
  - "handleGeneratePdf stub wraps existing trpc.pdf.generateChangeOrder.useMutation — not a stub but a proper inline handler, consistent with how PDF generation worked before"
  - "void subject; void note; in onSend callback — recipients, subject, note passed by SendToCustomerDialog but changeOrder.sendToCustomer only needs changeOrderId (email delivery is handled server-side); explicit void suppresses unused variable lint"
  - "Orphaned filter removal scoped to change-order-list.tsx (the component) not change-orders/page.tsx (the route page) — the filter SelectContent lives in the list component"
  - "statusVariantMap and statusLabelMap both retain all six CO statuses in change-order-detail.tsx — badge rendering for historical approved/rejected data must remain correct"
metrics:
  duration_minutes: 5
  completed_date: 2026-02-24
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 50 Plan 04: CO Detail Header Rebuild and Send to Customer Wiring Summary

**CO detail header rebuilt to Phase 46 two-row layout with 3-dot dropdown (Generate PDF + Send to Customer), ApprovalPanel fully removed, SendToCustomerDialog wired with customerEmail and changeOrder.sendToCustomer mutation, and orphaned approval status filter options removed from CO list**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-02-24T06:53:48Z
- **Tasks:** 3
- **Files modified:** 3

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update change-order-detail.tsx — new header, remove approval flow, wire send dialog | 870f858 | apps/web/components/change-order/change-order-detail.tsx |
| 2 | Pass customerEmail prop from CO detail page wrapper | 0dd3560 | apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx |
| 3 | Remove orphaned status filter options from CO list page | c74ed29 | apps/web/components/change-order/change-order-list.tsx |

## What Was Built

### Task 1: change-order-detail.tsx

Complete restructure of the CO detail component:

**Header:** Replaced Card-based header with Phase 46 two-row layout:
- Row 1: Back nav button (ghost, sm, Link to `/projects/${projectSlug}/change-orders`)
- Row 2: `h1` title + `StatusBadge` + type `Badge` + CO number span | DropdownMenu + Edit button

**DropdownMenu contents:**
- "Generate PDF" (calls existing `generatePdfMutation.mutate`)
- "Send to Customer" (opens `sendDialogOpen` state)

**Props change:** `customerEmail?: string | null` added to `ChangeOrderDetailProps`

**State added:** `sendDialogOpen: boolean`

**Mutation added:** `sendToCustomerMutation = trpc.changeOrder.sendToCustomer.useMutation` with `onSuccess` invalidating `changeOrder.getById` and closing dialog

**Removed entirely:**
- `ApprovalPanel` import and JSX
- `approveDialogOpen`, `rejectDialogOpen`, `approvalSteps` state
- `handleAddStep`, `handleRemoveStep`, `handleUpdateStep`, `handleSubmitForApproval` handlers
- `submitMutation` (changeOrder.submit)
- Submit for Approval Dialog and all approval step configuration JSX
- "Edit & Resubmit" button for rejected status
- `getApprovalStatus` query + canCurrentUserApprove/hasPendingStep derived state
- `canApproveOrReject` condition and Approve/Reject button block
- `canEdit`, `canGeneratePdf` constants (simplified; PDF is now always available via dropdown)
- Several unused imports: `Input`, `Select*`, `Plus`, `FileDown`, `CheckCircle2`, `XCircle`, `useRouter` (replaced with `Link`)

**Kept:**
- `statusVariantMap` with all six CO statuses
- `statusLabelMap` (new) with all six CO status display strings
- Void dialog and `canVoid` logic (still valid for approved COs)
- Delete button and `canDelete` logic
- Details card, Line Items card, ChangeOrderHistory

**SendToCustomerDialog at end of JSX:**
```tsx
<SendToCustomerDialog
  open={sendDialogOpen}
  onOpenChange={setSendDialogOpen}
  documentName={co.title}
  prePopulatedEmail={customerEmail}
  prePopulatedSubject={`Change Order: ${co.title}`}
  isPending={sendToCustomerMutation.isPending}
  onSend={({ recipients, subject, note }) => {
    void subject;
    void note;
    sendToCustomerMutation.mutate({ changeOrderId: co.id });
  }}
/>
```

### Task 2: CO detail page wrapper

- Used `project.id` directly (after the `if (!project) return null` guard) to fix pre-existing `string | undefined` type error
- Passed `customerEmail={project?.customer?.email}` as new prop
- Pre-existing `project.slug: string | null` issue is out of scope (existed before plan)

### Task 3: CO list status filter cleanup

In `apps/web/components/change-order/change-order-list.tsx`:

- Removed `pending_approval`, `approved`, `rejected` from status `SelectContent` (3 items removed)
- Removed corresponding labels from `activeChips` label map (same 3 keys removed)
- Kept: `all`, `draft`, `pco_submitted`, `void`
- `statusVariantMap` in this file untouched — badge rendering for existing data unchanged

## Decisions Made

1. **onSend callback uses `void subject; void note;`**: The `sendToCustomer` mutation only needs `changeOrderId` — email delivery metadata (recipients/subject/note) would be used by a future email-sending layer, not the current mutation. Explicit `void` keeps TypeScript happy without discarding the data shape.

2. **handleGeneratePdf is not a stub**: The original component had an inline `generatePdfMutation.mutate` call. In the new layout it's wrapped in a named `handleGeneratePdf` function for use in the DropdownMenuItem's `onClick`, keeping the behavior identical.

3. **Void and Delete preserved as secondary action row**: These actions don't belong in the 3-dot dropdown (they're destructive and status-conditional). They render in a separate flex row below the header when `canVoid` or `canDelete` is true.

4. **Filter cleanup targets the list component, not the route page**: `change-orders/page.tsx` delegates all list UI to `ChangeOrderList` — the SelectContent lives in `change-order-list.tsx`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing projectId type error in page wrapper**
- **Found during:** Task 2
- **Issue:** Original file had `const projectId = project?.id` (string | undefined) which caused a TS error on the `ChangeOrderDetail` `projectId: string` prop
- **Fix:** Removed the `projectId` intermediary; used `project.id` directly after the `if (!project)` guard
- **Files modified:** apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx
- **Commit:** 0dd3560

### Out-of-Scope Deferred

**project.slug: string | null** in page wrapper — pre-existing; all change-orders route pages (list, detail, new) have this issue. Deferred; not caused by this plan.

## Self-Check: PASSED

Files modified:
- FOUND: apps/web/components/change-order/change-order-detail.tsx
- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx
- FOUND: apps/web/components/change-order/change-order-list.tsx

Commits:
- FOUND: 870f858 (feat(50-04): restructure CO detail header, remove ApprovalPanel, wire SendToCustomerDialog)
- FOUND: 0dd3560 (feat(50-04): pass customerEmail prop from CO detail page to ChangeOrderDetail)
- FOUND: c74ed29 (feat(50-04): remove orphaned status filter options from CO list page)

TypeScript:
- change-order-detail.tsx: zero errors
- page.tsx: pre-existing project.slug issue only; projectId error resolved
- change-order-list.tsx: zero errors
