# Phase 44: Change Order and Payment App Redesign - Research

**Researched:** 2026-02-22
**Domain:** Inline list-row approval actions, CSV export from filtered TanStack Table, tRPC mutation patterns
**Confidence:** HIGH — all findings drawn from direct codebase inspection

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIST-04 | All list views with filtering support have an "Export CSV" button that downloads the currently filtered and sorted result set as a CSV file. | TanStack `table.getRowModel().rows` already holds the filtered+sorted result; client-side CSV generation via `Blob` + `URL.createObjectURL` requires no new packages; the export button lives in the existing filter toolbar row |
| LIST-05 | Change order list rows display inline Approve and Reject action buttons for pending COs; activating either shows a confirmation; CO status updates without full page navigation. | `trpc.changeOrder.approve` and `trpc.changeOrder.reject` mutations already exist and are already wired in `ApprovalPanel` (detail page); the list component needs per-row state for which dialog is open; `canCurrentUserApprove` must be resolved at list level — either by adding it to the `list` endpoint or by calling `getApprovalStatus` per-row |
| LIST-06 | Payment application list rows display inline Approve and Mark Paid action buttons for pending pay apps; status updates without navigating to detail page. | `trpc.paymentApp.approve` and `trpc.paymentApp.markPaid` mutations exist; `getApprovalStatus` returns `canCurrentUserApprove`; inline actions on the list replace the "View" button in the Actions column for eligible rows |
</phase_requirements>

---

## Summary

Phase 44 adds three UX features to two existing list views. Both lists are fully implemented as TanStack Table v8 components built in Phase 42. No new libraries are needed: CSV generation is client-side using the native `Blob` API, and all approval mutations (`changeOrder.approve`, `changeOrder.reject`, `paymentApp.approve`, `paymentApp.markPaid`) already exist in the tRPC routers.

The CSV export feature (LIST-04) is straightforward: `table.getRowModel().rows` already contains the filtered and sorted data visible to the user. Iterating over those rows to build a comma-separated string and triggering a download via `URL.createObjectURL` is a zero-dependency pattern. The export button lives in the existing filter toolbar area alongside the status/type selects and the "New" button.

The inline approval features (LIST-05, LIST-06) require careful state management: each row needs its own dialog open/close state so clicking Approve on row 3 doesn't open a dialog for row 1. The approval authorization check (`canCurrentUserApprove`) is currently computed inside `ApprovalPanel` via `trpc.changeOrder.getApprovalStatus` which is called once per detail page load. At the list level, two approaches exist: (A) add `canCurrentUserApprove` to the `changeOrder.list` and `paymentApp.list` API endpoints directly, or (B) call `getApprovalStatus` per row client-side. Approach A is cleaner but requires API changes. Approach B works without API changes but fires N queries for N rows. **Recommendation: Approach A** — add `canCurrentUserApprove` to the list endpoints. Both list queries already load project-level abilities, so the CASL check is available in the same request handler. For the CO list, the pending step also needs to exist; for the payment app list, `canCurrentUserApprove` is already computed in `getApprovalStatus`.

The confirmation dialog requirement in LIST-05 maps directly to the existing Approve/Reject Dialog pattern from `ApprovalPanel`. The dialogs can be extracted or duplicated inline in the list component — the simplest approach is to render one reusable `<Dialog>` outside the table (shared across all rows) and track `pendingApprovalId`/`pendingAction` state rather than per-row dialog state.

**Primary recommendation:** Add `canCurrentUserApprove` to both list API endpoints; render shared dialogs outside the table body driven by `pendingId` state in the list component; generate CSV client-side from `table.getRowModel().rows` with no npm install.

---

## Standard Stack

### Core (already installed — no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | `^8.21.3` | `table.getRowModel().rows` for filtered+sorted CSV data | Already wired in both list components |
| `trpc` (project client) | — | `changeOrder.approve`, `changeOrder.reject`, `paymentApp.approve`, `paymentApp.markPaid` | All mutations already implemented in API router |
| `sonner` | — | `toast.success` / `toast.error` on mutation result | Used throughout; already imported in `ApprovalPanel` |
| Native `Blob` + `URL.createObjectURL` | browser API | Client-side CSV download trigger | No npm package needed; universally supported |
| shadcn `Dialog` | — | Confirmation dialogs for approve/reject | Already used in `ApprovalPanel` and `PaymentAppDetailPage` |
| shadcn `Button` | — | Inline action buttons in table rows | Already used throughout both list components |

### No New Installs Needed
All required capabilities are already present. Phase 44 is purely a UI + API-field enhancement.

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Recommended File Locations
```
apps/
├── api/src/trpc/routers/
│   ├── change-order.ts        # Modify: add canCurrentUserApprove to list endpoint
│   └── payment-app.ts         # Modify: add canCurrentUserApprove to list endpoint
└── web/
    └── components/
        ├── change-order/
        │   └── change-order-list.tsx   # Modify: CSV export + inline Approve/Reject
        └── payment-app/
            └── payment-app-list.tsx    # Modify: CSV export + inline Approve/Mark Paid
```

### Pattern 1: canCurrentUserApprove on List Endpoint (API side)

**What:** Compute whether the current user can approve the current pending step for each CO or pay app, and return that boolean alongside each list item.

**When to use:** Whenever list rows need to conditionally show action buttons based on the viewer's approval authorization. Computing it server-side avoids N+1 queries from the client.

**CO list endpoint change:**
```typescript
// In change-order.ts list procedure — after fetching changeOrders array:
// Fetch all pending approval steps for the fetched COs in one query
const pendingSteps = await db
  .select()
  .from(schema.approvalWorkflowSteps)
  .where(
    and(
      inArray(
        schema.approvalWorkflowSteps.changeOrderId,
        changeOrders.map(co => co.id)
      ),
      eq(schema.approvalWorkflowSteps.status, "pending")
    )
  );

const normalizedRole = ctx.orgRole?.startsWith("org:") ? ctx.orgRole : `org:${ctx.orgRole}`;

// Build a map: coId -> canCurrentUserApprove
const approvalMap = new Map<string, boolean>();
for (const step of pendingSteps) {
  const canApprove =
    (step.approverUserId && step.approverUserId === ctx.userId) ||
    (step.approverRole && step.approverRole === normalizedRole) ||
    (!step.approverUserId && !step.approverRole);
  approvalMap.set(step.changeOrderId, !!canApprove);
}

return changeOrders.map(co => ({
  ...co,
  lineItemCount: countMap.get(co.id) ?? 0,
  canCurrentUserApprove: approvalMap.get(co.id) ?? false,
  hasPendingApprovalStep: pendingSteps.some(s => s.changeOrderId === co.id),
}));
```

**Payment app list endpoint change** (simpler — same pattern):
```typescript
// After fetching paymentApps, fetch pending steps in bulk
const pendingSteps = await db
  .select()
  .from(schema.paymentAppApprovalSteps)
  .where(
    and(
      inArray(
        schema.paymentAppApprovalSteps.paymentAppId,
        paymentApps.map(pa => pa.id)
      ),
      eq(schema.paymentAppApprovalSteps.status, "pending")
    )
  );

const userOrgRole = ctx.orgRole ?? "org:member";
const approvalMap = new Map<string, boolean>();
for (const step of pendingSteps) {
  let canApprove = false;
  if (step.requirementType === "specific") {
    canApprove = step.approverUserId === ctx.userId;
  } else if (step.approverRole) {
    canApprove = userOrgRole === step.approverRole;
  } else {
    canApprove = true;
  }
  approvalMap.set(step.paymentAppId, canApprove);
}

return paymentApps.map(pa => ({
  ...pa,
  canCurrentUserApprove: approvalMap.get(pa.id) ?? false,
}));
```

### Pattern 2: Shared Dialog with Pending ID State (UI side)

**What:** Track a single `pendingActionId` and `pendingAction` state in the list component. A shared `<Dialog>` outside the table body renders based on these. When the user clicks Approve on a row, set `pendingActionId = row.id` and `pendingAction = "approve"`. Dialog renders once and targets the selected item.

**When to use:** When multiple rows can trigger the same action but the dialog content is identical. Avoids rendering N dialog instances.

```typescript
// In ChangeOrderList component:
const [pendingActionId, setPendingActionId] = useState<string | null>(null);
const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
const [comments, setComments] = useState("");
const utils = trpc.useUtils();

const approveMutation = trpc.changeOrder.approve.useMutation({
  onSuccess: () => {
    utils.changeOrder.list.invalidate({ projectId });
    toast.success("Change order approved");
    setPendingActionId(null);
    setPendingAction(null);
    setComments("");
  },
  onError: (error) => {
    toast.error(error.message || "Failed to approve change order");
  },
});

const rejectMutation = trpc.changeOrder.reject.useMutation({
  onSuccess: () => {
    utils.changeOrder.list.invalidate({ projectId });
    toast.success("Change order rejected");
    setPendingActionId(null);
    setPendingAction(null);
    setComments("");
  },
  onError: (error) => {
    toast.error(error.message || "Failed to reject change order");
  },
});

// In table row render — only show for rows where canCurrentUserApprove = true
// and status is pco_submitted or pending_approval:
{(row.original.canCurrentUserApprove &&
  (row.original.status === "pco_submitted" || row.original.status === "pending_approval")) && (
  <>
    <Button
      size="sm"
      variant="default"
      onClick={(e) => {
        e.stopPropagation(); // Prevent row click navigation
        setPendingActionId(row.original.id);
        setPendingAction("approve");
      }}
    >
      Approve
    </Button>
    <Button
      size="sm"
      variant="destructive"
      onClick={(e) => {
        e.stopPropagation();
        setPendingActionId(row.original.id);
        setPendingAction("reject");
      }}
    >
      Reject
    </Button>
  </>
)}

// Shared dialogs rendered outside the table:
<Dialog open={pendingActionId !== null && pendingAction === "approve"}
        onOpenChange={(open) => { if (!open) { setPendingActionId(null); setPendingAction(null); setComments(""); }}}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Approve Change Order</DialogTitle>
      <DialogDescription>This action is irreversible.</DialogDescription>
    </DialogHeader>
    <Textarea value={comments} onChange={(e) => setComments(e.target.value)}
              placeholder="Comments (optional)" rows={3} />
    <DialogFooter>
      <Button variant="outline" onClick={() => { setPendingActionId(null); setPendingAction(null); }}>Cancel</Button>
      <Button
        disabled={approveMutation.isPending}
        onClick={() => approveMutation.mutate({ changeOrderId: pendingActionId!, comments: comments || undefined })}
      >
        {approveMutation.isPending ? "Approving..." : "Approve"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Pattern 3: Client-side CSV Export from TanStack Table

**What:** Iterate `table.getRowModel().rows` (which are already filtered and sorted by TanStack), format each row as CSV, create a `Blob`, and trigger a download. No server round-trip. No npm package.

**When to use:** When the full data set is already client-side (which it is — both list components fetch all matching records from the API and filter client-side). Avoids server-side export endpoint complexity.

**CO list export example:**
```typescript
const handleExportCsv = () => {
  const rows = table.getRowModel().rows;
  const headers = ["CO #", "Title", "Type", "Status", "Amount", "Date"];
  const csvRows = [
    headers.join(","),
    ...rows.map(row => {
      const co = row.original;
      return [
        getChangeOrderNumber(co),
        `"${(co.title ?? "").replace(/"/g, '""')}"`,
        co.type,
        co.status,
        Number(co.totalAmount).toFixed(2),
        new Date(co.createdAt).toLocaleDateString(),
      ].join(",");
    }),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `change-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
```

**Export button placement:** In the filter toolbar row, after the status/type selects and before the "New" button:
```tsx
<Button variant="outline" size="sm" onClick={handleExportCsv}
        disabled={table.getRowModel().rows.length === 0}>
  <Download className="h-4 w-4 mr-2" />
  Export CSV
</Button>
```

### Pattern 4: Payment App Inline Mark Paid

**What:** Payment app rows in `approved` status get a "Mark Paid" button. This uses the existing `trpc.paymentApp.markPaid` mutation which expects `{ paymentAppId }`. A simple `confirm()` dialog is sufficient per the existing pattern in `PaymentAppDetailPage` — or use a shadcn Dialog if the requirement says "confirmation."

**Status eligibility matrix for payment apps:**
- `submitted` or `under_review` + `canCurrentUserApprove === true` → show Approve button
- `approved` → show Mark Paid button (any authenticated user with `manage` permission can mark paid, per API)
- Other statuses → no inline action buttons

### Anti-Patterns to Avoid

- **Per-row `getApprovalStatus` queries:** Each row calling `trpc.changeOrder.getApprovalStatus` would fire a separate HTTP request per row. With 20 COs on screen, that's 20 extra queries on list load. Solve by including `canCurrentUserApprove` in the list endpoint.
- **Blocking row click navigation when action buttons are present:** The entire table row has `onClick={() => router.push(...)}`. Action buttons must call `e.stopPropagation()` to prevent row navigation when clicked.
- **CSV with raw dates/numbers:** Export should format amounts as numeric strings (no `$` prefix — let Excel parse them as numbers), and dates as locale strings. Wrap text fields containing commas or quotes with double-quoted strings and escape internal quotes.
- **Using `window.open` for CSV download:** `URL.createObjectURL` + a programmatically clicked `<a>` is correct. `window.open` treats the blob URL as a page navigation.
- **Forgetting `URL.revokeObjectURL`:** Memory leak if not called after click. Call immediately after `link.click()` — the browser has already queued the download.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV encoding | Custom escaping logic | Standard pattern: wrap text in `""`, escape `"` as `""` | Handles commas, newlines, Unicode in field values |
| Approval permission check | Per-component CASL evaluation | `canCurrentUserApprove` field on list API response | API already has the user context, ability, and pending step — don't duplicate |
| Per-row dialog instances | One `<Dialog>` per row | Shared dialog outside table + `pendingActionId` state | Avoids React mounting N dialog trees for N rows |
| Server export endpoint | tRPC procedure + streaming | Client-side Blob from `table.getRowModel().rows` | All data is already in the client; server round-trip adds latency and complexity |

**Key insight:** The approval mutations and CASL permission checks are already implemented end-to-end in the API router. Phase 44 is purely wiring the existing mutations to new trigger points (list rows) rather than building new back-end logic.

---

## Common Pitfalls

### Pitfall 1: Row Click vs. Action Button Click Conflict

**What goes wrong:** The table row has `onClick={() => router.push(...)}`. When the user clicks an inline action button, the row click fires too, navigating away before the mutation completes.

**Why it happens:** Event bubbling — button click events bubble up to the parent `<TableRow>` onClick handler.

**How to avoid:** Call `e.stopPropagation()` in every inline button's onClick handler:
```tsx
onClick={(e) => {
  e.stopPropagation();
  setPendingActionId(row.original.id);
}}
```

**Warning signs:** Clicking Approve instantly navigates to the detail page instead of opening the dialog.

### Pitfall 2: Stale canCurrentUserApprove After Mutation

**What goes wrong:** After approving a CO from the list, the same row still shows Approve/Reject buttons because the list query cache hasn't been invalidated.

**Why it happens:** tRPC React Query caches results with 5-minute stale time (per MEMORY.md). The mutation's `onSuccess` must explicitly invalidate the list query.

**How to avoid:** In `onSuccess` of both `approve` and `reject` mutations:
```typescript
utils.changeOrder.list.invalidate({ projectId });
// or more surgical:
utils.changeOrder.list.invalidate();
```
The list invalidation triggers a refetch which will return the new status and `canCurrentUserApprove: false`.

**Warning signs:** Row still shows action buttons after successful approval.

### Pitfall 3: CSV Field Values Containing Commas or Quotes

**What goes wrong:** A CO title like `Foundation, Phase 1` exports as three columns instead of one, breaking the CSV structure.

**Why it happens:** Naive `.join(",")` doesn't escape field values.

**How to avoid:** Wrap every text field in double-quotes and escape any internal double-quotes as `""`:
```typescript
const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
```
Numbers and dates that don't contain commas don't need quoting.

**Warning signs:** Opening the exported CSV in Excel shows misaligned columns.

### Pitfall 4: Approve Mutation ID Mismatch

**What goes wrong:** The `changeOrder.approve` mutation expects `{ changeOrderId }` but the list row uses `row.original.id`. These are the same field. The confusion is that `ApprovalPanel` takes `changeOrderId` as a prop but `paymentApp.approve` takes `{ paymentAppId }`.

**How to avoid:** Match the API schema field names precisely:
- CO: `approveRejectSchema` uses `changeOrderId`
- Pay App: `approveRejectPaymentAppSchema` uses `paymentAppId`
- Pay App markPaid: `markPaymentAppPaidSchema` uses `paymentAppId`

**Warning signs:** tRPC type error on the mutation call site.

### Pitfall 5: Payment App Approval Requires Submitted/Under_Review Status

**What goes wrong:** Attempting to render an Approve button for a pay app in `draft` status. The API will reject with `BAD_REQUEST`.

**Why it happens:** The API `paymentApp.approve` validates `status === "submitted" || status === "under_review"`.

**How to avoid:** Only render the Approve button when `row.original.status === "submitted" || row.original.status === "under_review"`. The Mark Paid button only shows for `status === "approved"`.

### Pitfall 6: CO Approve Button for Wrong Statuses

**What goes wrong:** Showing Approve/Reject on a `draft` CO that has `canCurrentUserApprove: false` anyway, but the user finds confusing disabled buttons.

**How to avoid:** Gate the inline buttons on both the status AND `canCurrentUserApprove`:
```tsx
{(row.original.canCurrentUserApprove &&
  (row.original.status === "pco_submitted" || row.original.status === "pending_approval")) && (
  // render action buttons
)}
```

---

## Code Examples

Verified from codebase inspection:

### Existing CO Approve Mutation (in ApprovalPanel — same API call needed in list)
```typescript
// Source: apps/web/components/change-order/approval-panel.tsx
const approveMutation = trpc.changeOrder.approve.useMutation({
  onSuccess: () => {
    utils.changeOrder.getById.invalidate();
    utils.changeOrder.getApprovalStatus.invalidate({ changeOrderId });
    utils.changeOrder.list.invalidate();
    toast.success("Change order approved");
    onApproveDialogChange(false);
    setComments("");
  },
  onError: (error) => {
    toast.error(error.message || "Failed to approve change order");
  },
});

const handleApprove = () => {
  approveMutation.mutate({
    changeOrderId,
    comments: comments || undefined,
  });
};
```

### Existing Pay App Mark Paid Mutation (in PaymentAppDetailPage — same API call needed in list)
```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx
const markPaidMutation = trpc.paymentApp.markPaid.useMutation({
  onSuccess: () => {
    utils.paymentApp.getById.invalidate({ id: paymentAppId });
    toast.success("Payment application marked as paid");
  },
  onError: (error) => {
    toast.error(error.message || "Failed to mark as paid");
  },
});

const handleMarkAsPaid = () => {
  if (confirm("Mark this payment application as paid?")) {
    markPaidMutation.mutate({ paymentAppId });
  }
};
```
Note: The list version should use a proper shadcn `Dialog` rather than `confirm()`, consistent with the approval dialog UX.

### Existing TanStack Table Row Model (CO List — basis for CSV export)
```typescript
// Source: apps/web/components/change-order/change-order-list.tsx
const table = useReactTable({
  data: displayedChangeOrders,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  enableSortingRemoval: false,
});

// CSV export uses:
const rows = table.getRowModel().rows; // already filtered + sorted
```

### API Pattern for Bulk Pending Step Fetch (to add to list endpoints)
```typescript
// Based on existing approval step queries in change-order.ts
const pendingSteps = await db
  .select()
  .from(schema.approvalWorkflowSteps)
  .where(
    and(
      inArray(
        schema.approvalWorkflowSteps.changeOrderId,
        changeOrders.map(co => co.id)
      ),
      eq(schema.approvalWorkflowSteps.status, "pending")
    )
  );
```
This replaces N individual `getApprovalStatus` queries with a single bulk query. The `inArray` with an empty array must be guarded (skip the query when `changeOrders` is empty to avoid SQL errors).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Card-per-row CO list (before Phase 42) | TanStack Table with sticky header/footer | Phase 42 | CSV export now trivial via `table.getRowModel().rows` |
| Approval actions only on detail page | Approval actions on list row (Phase 44) | Phase 44 | Reduces clicks from 3+ to 1 for approvers reviewing multiple COs |
| Approval panel queries `getApprovalStatus` per detail page | List endpoint returns `canCurrentUserApprove` per row | Phase 44 | No N+1 queries from list view |

**What changed in prior phases relevant here:**
- Phase 42: Both list components converted from card layout to TanStack Table — `table.getRowModel().rows` is now available for CSV export without additional setup
- Phase 41 (VISUAL-03): Approval dialogs and `canCurrentUserApprove` pattern established — Phase 44 moves the trigger point from the detail page header to the list row, not the dialog design itself
- Phase 41 (G702Form): Submit/Mark Paid mutations lifted to `paymentAppId/page.tsx` — the same mutations are callable from the list without touching the detail page

---

## Open Questions

1. **Empty array guard for `inArray`**
   - What we know: Drizzle's `inArray` with an empty array throws or generates invalid SQL on some databases
   - What's unclear: Whether Drizzle v0.30+ handles empty arrays gracefully
   - Recommendation: Add an explicit guard: `if (changeOrders.length === 0) return []` before the `inArray` query

2. **Comments field for reject from list view**
   - What we know: The API `changeOrder.reject` requires `comments` (validated in the mutation handler: `if (!comments.trim()) toast.error(...)`). The API schema makes `comments` optional, but `ApprovalPanel.handleReject` validates client-side.
   - What's unclear: Should the list-level reject dialog require comments (same as detail page) or make them optional?
   - Recommendation: Match the detail page behavior — require rejection comments, optional approval comments.

3. **CSV filename convention**
   - What we know: No existing CSV export exists in the app to establish a convention
   - What's unclear: Whether to include project name/slug in the filename
   - Recommendation: `change-orders-{projectSlug}-{YYYY-MM-DD}.csv` and `payment-apps-{projectSlug}-{YYYY-MM-DD}.csv`; the project slug is available as a prop in both list components

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `apps/web/components/change-order/change-order-list.tsx` — complete file read
- Direct codebase inspection — `apps/web/components/payment-app/payment-app-list.tsx` — complete file read
- Direct codebase inspection — `apps/api/src/trpc/routers/change-order.ts` — full router including `approve`, `reject`, `list`, `getApprovalStatus` procedures
- Direct codebase inspection — `apps/api/src/trpc/routers/payment-app.ts` — full router including `approve`, `markPaid`, `list`, `getApprovalStatus` procedures
- Direct codebase inspection — `apps/web/components/change-order/approval-panel.tsx` — existing mutation wiring pattern
- Direct codebase inspection — `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx` — existing markPaid mutation pattern
- Direct codebase inspection — `packages/shared/src/types/change-order.ts` — `approveRejectSchema`, status enum, valid transitions
- Direct codebase inspection — `packages/shared/src/types/payment-app.ts` — `approveRejectPaymentAppSchema`, `markPaymentAppPaidSchema`, status enum, valid transitions
- `.planning/phases/42-shared-ui-primitives/42-RESEARCH.md` and `42-05-PLAN.md` — TanStack Table patterns established in Phase 42

### Secondary (MEDIUM confidence)
- Native `Blob` + `URL.createObjectURL` CSV download — browser standard API, universally supported in all modern browsers; no source verification needed beyond MDN knowledge

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and wired; no new dependencies
- Architecture: HIGH — patterns derived directly from existing code (`ApprovalPanel`, `changeOrder.approve`, TanStack table)
- API changes: HIGH — `inArray` bulk fetch pattern is already used in `changeOrder.list` for `lineItemCounts`; same pattern applies for pending steps
- Pitfalls: HIGH — all pitfalls derived from inspecting actual code paths and API validation logic

**Research date:** 2026-02-22
**Valid until:** 2026-03-24 (stable domain; 30-day validity)
