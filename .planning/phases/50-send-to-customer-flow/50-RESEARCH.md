# Phase 50: Send-to-Customer Flow - Research

**Researched:** 2026-02-24
**Domain:** React dialog implementation, tRPC mutations for status transitions, header layout alignment, status badge cleanup
**Confidence:** HIGH (all findings from direct file reads of current codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase boundary:**
Add a "Send to Customer" action to proposal and change order detail pages. The action opens a dialog pre-populated with the customer's contact email, allows adding additional recipients, collects a subject and optional note, and marks the document status as "Submitted" on confirm. No email is actually transmitted. Existing Approve/Reject/Submit buttons are removed from both page types. Orphaned status options are cleaned up.

This phase also aligns the proposal detail page header (and CO detail page header) to the standard layout established in recent phases — this is a prerequisite to correct button placement, not scope creep.

**Button placement:**
- Both proposal and change order detail page headers must match the standard layout from Phase 46 (sticky compact header pattern)
- Header structure:
  - Line 1: back nav
  - Vertical gap
  - Line 2: [Document Name] [Status Badge] ... [3-dot dropdown: Generate PDF, Send to Customer] [Edit] button
- "Send to Customer" lives in the 3-dot dropdown alongside "Generate PDF"
- Same placement on both proposal and change order detail pages

**Dialog design:**
- Title: "Send to Customer"
- Fields: document name (view-only), recipient email (pre-populated + additional addresses), subject, optional note
- Confirm: "Send" / Cancel: "Cancel"

**Status behavior:**
- Proposals: Send → "submitted"; always available; always re-sendable (idempotent)
- Change orders: Claude researches CO status machine, applies equivalent

**Approval flow removal:**
- Proposal detail: Remove Approve, Reject, Submit buttons entirely
- CO detail: Remove Approve, Reject buttons entirely
- Clean up orphaned status badge options

### Claude's Discretion
- Dialog component implementation
- CO status mapping
- Which status badge values to clean up
- Header layout alignment details

### Deferred Ideas (OUT OF SCOPE)
- (None stated — no deferred section in CONTEXT.md)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-01 | Proposal detail page has a "Send to Customer" button that opens a dialog; no approval step required before button appears | `estimates.sendToCustomer` mutation (new): idempotent status → "submitted". Dialog in proposal detail page. NextStepsPanel and SubmitEstimateButton removed. |
| FLOW-02 | Change order detail page has a "Send to Customer" button with the same dialog behavior | `changeOrder.sendToCustomer` mutation (new): status → "pco_submitted" (idempotent). Dialog in CO detail component. Submit/Approve/Reject buttons removed. |
| FLOW-03 | Dialog contains a recipient email field pre-populated from customer's primary contact email | `project.getBySlug` returns `customer.email` — already fetched on both pages. Pre-populate from `project.customer?.email`. |
| FLOW-04 | Clicking "Send"/"Confirm" changes document status and closes dialog — no email transmitted | tRPC mutation on submit: update DB status, invalidate query cache, close dialog. No email transport layer. |
</phase_requirements>

---

## Summary

Phase 50 touches four files plus two new API mutations. The proposal detail page (`estimates/[estimateSlug]/page.tsx`) and the change order detail component (`change-order-detail.tsx`) both need header restructuring to match the standard layout, then the old approval-flow buttons are removed and replaced with a 3-dot dropdown containing "Generate PDF" and "Send to Customer".

The "Send to Customer" action opens a Radix Dialog (already available as `components/ui/dialog.tsx`) with four fields: document name (read-only), recipient email (pre-populated), subject (text input), and note (textarea). On "Send", a new tRPC mutation updates the document status and invalidates the cache. No email transport is needed.

The status mapping for proposals is trivial: "submitted" is already the correct status and the `estimateLifecycle.ts` state machine already allows all statuses to reach "submitted" (the `submitEstimate` mutation handles this but currently only allows `draft → submitted`; the new `sendToCustomer` mutation must be idempotent — it sets status to "submitted" regardless of current status). For change orders, `pco_submitted` is the closest semantic equivalent ("proposal sent to customer for review"). The `sendToCustomer` mutation on COs sets status to `pco_submitted` regardless of current status (idempotent).

The customer email for pre-population comes from `project.getBySlug` which already returns `customer: { email, contactName, companyName, ... }`. Both the proposal detail page and CO detail page already call `trpc.project.getBySlug.useQuery({ slug: projectSlug })`.

**Primary recommendation:** Add `estimates.sendToCustomer` and `changeOrder.sendToCustomer` tRPC mutations; create a shared `SendToCustomerDialog` component; rebuild both detail page headers to the Phase 46 3-dot dropdown pattern; strip all approval-flow buttons.

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-dialog` | existing | Dialog primitive backing `components/ui/dialog.tsx` | Already installed and wrapped; used throughout codebase |
| tRPC + React Query | existing | New `sendToCustomer` mutations on both routers | Pattern established in all existing mutations |
| `lucide-react` | existing | `MoreVertical` icon for 3-dot trigger | Already imported in `project-header.tsx` |
| Sonner | existing | `toast.success` / `toast.error` | Already used in all mutation handlers |
| Drizzle ORM | existing | DB update in new mutation | Used in all routers |

### No New Dependencies

This phase adds no new npm packages. All required components and libraries exist.

---

## Architecture Patterns

### Recommended File Changes

```
apps/api/src/trpc/routers/
├── estimates.ts         # Add sendToCustomer mutation
└── change-order.ts      # Add sendToCustomer mutation

apps/web/components/
├── shared/
│   └── send-to-customer-dialog.tsx   # NEW: shared dialog component
├── estimates/
│   └── (no new files — dialog lives in send-to-customer-dialog.tsx)
└── change-order/
    └── change-order-detail.tsx       # Restructure header, remove approval buttons

apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/
└── page.tsx             # Restructure header, wire dialog, remove NextStepsPanel
```

### Pattern 1: Standard Detail Page Header (from Phase 46)

**What:** Compact two-row detail page header matching the project header pattern.

**Structure:**
```
Line 1: [back nav link/button]
(vertical gap ~mb-4)
Line 2: flex justify-between
  Left:  [Document Title] [StatusBadge variant=...]
  Right: [DropdownMenu 3-dot] [Edit Button]
```

**Example (proposal detail page):**
```tsx
// Source: Project header pattern from apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
// and phase CONTEXT.md locked decision

<div className="space-y-4">
  {/* Back nav */}
  <Button variant="ghost" size="sm" asChild>
    <Link href={`/projects/${projectSlug}/estimates`}>
      <ArrowLeft className="h-4 w-4 mr-1" />
      Back to Proposals
    </Link>
  </Button>

  {/* Header row */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-bold">{estimate.name}</h1>
      <StatusBadge variant={estimateVariantMap[estimate.status]}>
        {estimateLabelMap[estimate.status]}
      </StatusBadge>
    </div>
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleGeneratePdf}>
            <FileText className="h-4 w-4 mr-2" />
            Generate PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSendDialogOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send to Customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button asChild>
        <Link href={`/projects/${projectSlug}/estimates/${estimateSlug}/workflow`}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Proposal
        </Link>
      </Button>
    </div>
  </div>
</div>
```

### Pattern 2: SendToCustomerDialog Component

**What:** Shared dialog used on both proposal and CO detail pages. Receives document name, pre-populated email, and onSend callback. Manages its own form state. Returns recipient list + subject + note to parent on submit.

**Recommendation:** Create as a controlled component that accepts `open`/`onOpenChange` props, keeping dialog state in the parent page (consistent with existing dialog patterns in `change-order-detail.tsx`).

```tsx
// Source: Pattern from apps/web/components/change-order/change-order-detail.tsx
// apps/web/components/shared/send-to-customer-dialog.tsx

interface SendToCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  prePopulatedEmail: string | null | undefined;
  isPending: boolean;
  onSend: (data: { recipients: string[]; subject: string; note: string }) => void;
}

export function SendToCustomerDialog({
  open,
  onOpenChange,
  documentName,
  prePopulatedEmail,
  isPending,
  onSend,
}: SendToCustomerDialogProps) {
  const [recipientInput, setRecipientInput] = useState("");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  // Pre-populate email when dialog opens
  useEffect(() => {
    if (open && prePopulatedEmail && !recipientInput) {
      setRecipientInput(prePopulatedEmail);
    }
  }, [open, prePopulatedEmail]);

  const handleSend = () => {
    const recipients = recipientInput
      .split(",")
      .map(e => e.trim())
      .filter(Boolean);
    onSend({ recipients, subject, note });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Document name — read-only */}
          <div className="space-y-1">
            <Label>Document</Label>
            <p className="text-sm text-muted-foreground">{documentName}</p>
          </div>
          {/* Recipient email */}
          <div className="space-y-2">
            <Label htmlFor="recipients">Recipient Email(s)</Label>
            <Input
              id="recipients"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="email@example.com, another@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple addresses with commas.
            </p>
          </div>
          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Proposal for [Project Name]"
            />
          </div>
          {/* Note — optional */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a personal message to your customer..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isPending || !recipientInput.trim()}>
            {isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 3: tRPC sendToCustomer Mutations

**Proposals — `estimates.sendToCustomer`:**

The proposal's "Send to Customer" must be idempotent: any status → "submitted". The existing `submitEstimate` mutation only accepts `draft` status (enforced by `canTransitionEstimate`). The new mutation bypasses the state machine constraint and sets "submitted" unconditionally (the business intent is "re-sendable at any time").

```typescript
// apps/api/src/trpc/routers/estimates.ts — add after submitEstimate
sendToCustomer: protectedProcedure
  .input(z.object({ estimateId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }
    const { db, schema } = ctx.tenant;
    const abilities = await loadProjectAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
    ForbiddenError.from(abilities).throwUnlessCan("manage", "Estimate");

    const [estimate] = await db
      .select()
      .from(schema.estimates)
      .where(eq(schema.estimates.id, input.estimateId))
      .limit(1);

    if (!estimate) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
    }

    // Idempotent: set to submitted regardless of current status
    // Note: terminal states (under_contract) should not be re-sent — guard if needed
    const [updated] = await db
      .update(schema.estimates)
      .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.estimates.id, input.estimateId))
      .returning();

    return updated;
  }),
```

**Change Orders — `changeOrder.sendToCustomer`:**

The CO status machine is: `draft → pco_submitted → pending_approval → approved/rejected → void`. The semantic equivalent of "sent to customer" for a CO is `pco_submitted` (PCO = Proposed Change Order, sent to the owner/customer for review). This is idempotent: any status that isn't terminal (`void`) can be moved to `pco_submitted`. However, the business constraint from the CONTEXT says "always re-sendable" — set to `pco_submitted` unconditionally for all non-void states.

```typescript
// apps/api/src/trpc/routers/change-order.ts — add as new procedure
sendToCustomer: protectedProcedure
  .input(z.object({ changeOrderId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }
    const { db, schema } = ctx.tenant;
    const abilities = await loadProjectAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
    ForbiddenError.from(abilities).throwUnlessCan("manage", "ChangeOrder");

    const [co] = await db
      .select()
      .from(schema.changeOrders)
      .where(eq(schema.changeOrders.id, input.changeOrderId))
      .limit(1);

    if (!co) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Change order not found" });
    }

    if (co.status === "void") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot send a voided change order" });
    }

    // Generate PCO number if not already set
    let pcoNumber = co.pcoNumber;
    if (!pcoNumber) {
      pcoNumber = await getNextChangeOrderNumber(db, schema.changeOrderCounters, co.projectId, "pco");
    }

    const [updated] = await db
      .update(schema.changeOrders)
      .set({
        status: "pco_submitted",
        pcoNumber,
        submittedAt: co.submittedAt ?? new Date(),
        submittedBy: co.submittedBy ?? ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.changeOrders.id, input.changeOrderId))
      .returning();

    return updated;
  }),
```

### Pattern 4: Status Badge Cleanup

**Proposals (estimate status variants):**

Current `estimateVariantMap` in `estimates/[estimateSlug]/page.tsx`:
```typescript
const estimateVariantMap: Record<EstimateStatus, "draft" | "pending" | "approved" | "active"> = {
  draft: "draft",
  submitted: "pending",
  accepted: "approved",
  under_contract: "active",
};
```
All four statuses remain valid after Phase 50 — none become orphaned. No cleanup needed for estimate status badges.

**Change Orders (CO status variants):**

Current `statusVariantMap` in `change-order-detail.tsx`:
```typescript
const statusVariantMap: Record<ChangeOrderStatus, "draft" | "pending" | "approved" | "rejected" | "cancelled" | "warning"> = {
  draft: "draft",
  pco_submitted: "pending",
  pending_approval: "warning",
  approved: "approved",
  rejected: "rejected",
  void: "cancelled",
};
```
All six CO statuses remain valid in the schema. None become orphaned by Phase 50. The `pending_approval` status will no longer be reachable by normal UI flow (since "Submit for Approval" is removed), but it may exist in historical data and should stay in the map. **No type-level cleanup required**, but the approval-triggering UI code (Submit for Approval dialog, Approve/Reject buttons, ApprovalPanel component render) is removed from the detail view.

**StatusBadge variants to retain:** All existing variants in `status-badge.tsx` remain needed by other pages. No changes to the shared component.

### Anti-Patterns to Avoid

- **Keeping the NextStepsPanel on the proposal detail page:** It renders SubmitEstimateButton, GenerateBidButton, and ConvertToProjectButton inline. After Phase 50, SubmitEstimateButton must be gone. Remove the entire `<NextStepsPanel>` from the proposal detail page and replace with the 3-dot dropdown pattern.
- **Modifying the `canTransitionEstimate` function** to allow re-submission from all states: The `submitEstimate` procedure (used by SubmitEstimateButton) is being removed from the UI. The lifecycle service is not the right place to encode idempotent send-to-customer behavior. The new `sendToCustomer` mutation bypasses it intentionally.
- **Storing recipients/subject/note in the database:** This phase explicitly does not transmit email. There is no need to persist dialog form data to the DB — only the status change is recorded. The dialog data is ephemeral.
- **Re-triggering PCO number generation on repeat sends:** The CO `sendToCustomer` mutation must check if `pcoNumber` already exists and reuse it — not generate a new one on each send. PCO numbers are sequential and should be assigned once.
- **Using `window.confirm()` for the approval flow removal:** The approval buttons already use proper Dialogs. The task is simply to remove those buttons from the JSX, not to add confirmation dialogs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog with overlay | Custom modal div | `components/ui/dialog.tsx` (Radix) | Already exists; handles focus trapping, accessibility, escape key, portal |
| 3-dot dropdown | Custom dropdown div | `components/ui/dropdown-menu.tsx` (Radix) | Already used in `project-header.tsx` with `MoreVertical` trigger |
| Multi-email parsing | Complex CSV parser | `.split(",").map(e => e.trim()).filter(Boolean)` | Sufficient for this use case; no complex validation needed |
| Status update tRPC | Custom fetch | tRPC mutation + `utils.invalidate()` | Consistent with every other mutation in codebase |

**Key insight:** Every UI primitive needed in this phase already exists in `components/ui/`. The work is wiring them together in a new component and two page updates.

---

## Common Pitfalls

### Pitfall 1: Customer Email is Nullable

**What goes wrong:** Dialog opens with empty recipient field on projects where the customer has no email saved.
**Why it happens:** `customers.email` is `text("email")` (nullable, no `.notNull()`). Many customers may have been created without an email.
**How to avoid:** In the dialog, pre-populate with `project?.customer?.email ?? ""`. If empty, the field remains blank and the user fills it manually. Do not throw an error or block the dialog from opening.
**Warning signs:** Dialog crashes or shows `"null"` in the email field.

### Pitfall 2: CO sendToCustomer Creates Duplicate PCO Numbers

**What goes wrong:** A CO gets sent twice and ends up with two different PCO numbers in history.
**Why it happens:** The mutation generates a new PCO number unconditionally.
**How to avoid:** In the mutation, check `if (!co.pcoNumber)` before calling `getNextChangeOrderNumber`. If already assigned, reuse the existing `pcoNumber`. This is documented in the Pattern 3 code example above.
**Warning signs:** CO list shows CO-001 in first send, then CO-002 for the same CO on resend.

### Pitfall 3: Proposal Detail Page Still Shows NextStepsPanel After Removal of SubmitEstimateButton

**What goes wrong:** The NextStepsPanel remains visible below the cards, rendering confusing "Submit for Approval" or "Generate Bid" guidance.
**Why it happens:** The `<NextStepsPanel>` is rendered at the bottom of the proposal detail page. When removing SubmitEstimateButton from the header, developers may forget the panel itself also contains status-driven CTAs.
**How to avoid:** Remove the entire `<NextStepsPanel>` import and usage from `estimates/[estimateSlug]/page.tsx`. The CTA-card below the proposal cards is gone entirely in the new design.
**Warning signs:** After Phase 50, visiting a proposal detail page shows a "Next Steps" card at the bottom.

### Pitfall 4: ApprovalPanel Still Renders on CO Detail

**What goes wrong:** Even after removing Approve/Reject header buttons, the `<ApprovalPanel>` card (showing approval workflow steps) still renders in the CO detail view.
**Why it happens:** The `<ApprovalPanel>` component is rendered separately from the approval action buttons. Removing the buttons in the header does not remove the panel below.
**How to avoid:** The `<ApprovalPanel>` component renders when `co.status` is `pco_submitted`, `pending_approval`, `approved`, or `rejected`. Since Send to Customer can move COs to `pco_submitted`, the approval panel may appear for "sent" COs. Decision: **Remove the `<ApprovalPanel>` from the CO detail view entirely** (it exposes an internal workflow that no longer exists in the UI). Also remove the `approveDialogOpen` and `rejectDialogOpen` state and related handler props.
**Warning signs:** After Phase 50, "pco_submitted" COs show an empty "Approval Workflow" card.

### Pitfall 5: estimate.getBySlug Does Not Return Customer Email

**What goes wrong:** `estimate.customer?.email` is undefined on the proposal detail page.
**Why it happens:** `trpc.estimates.getBySlug` returns only estimate fields — it does not join the customer table. Customer data comes from `trpc.project.getBySlug` (which does join customers).
**How to avoid:** The proposal detail page already calls `trpc.project.getBySlug.useQuery({ slug: projectSlug })` (line 44 of `estimates/[estimateSlug]/page.tsx`). Use `project?.customer?.email` — not `estimate.customer?.email`.
**Warning signs:** Email field is always empty despite customer having an email saved.

### Pitfall 6: CO statusVariantMap Missing the New "pco_submitted" After Sending

**What goes wrong:** TypeScript error or "draft" variant shown for `pco_submitted` COs.
**Why it happens:** If the developer cleans up the `statusVariantMap` thinking `pco_submitted` is no longer used, but the `sendToCustomer` mutation sets COs to `pco_submitted`.
**How to avoid:** Keep `pco_submitted: "pending"` in `statusVariantMap`. This status becomes the primary post-send state.
**Warning signs:** TypeScript reports `ChangeOrderStatus` has unhandled cases, or COs show "draft" styling after being sent.

---

## Code Examples

### Customer Email Access on Proposal Detail Page

```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx line 44
// project.getBySlug already fetched; customer.email available:
const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });

// Use in dialog:
const customerEmail = project?.customer?.email; // string | null | undefined
```

### CO Page Already Fetches Project Data

```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx
const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
// project.customer.email available here; pass to ChangeOrderDetail as prop
```

**Note:** The `ChangeOrderDetail` component currently receives `projectId` and `projectSlug` only. To pass `customerEmail`, either:
- (Option A) Add `customerEmail?: string | null` prop to `ChangeOrderDetail`
- (Option B) Move the project query inside `ChangeOrderDetail` — not preferred (duplicate query)

**Recommendation:** Option A — add `customerEmail` prop to the component interface. The CO detail page already calls `trpc.project.getBySlug` and can pass `project?.customer?.email`.

### DropdownMenu Pattern (from project-header.tsx)

```tsx
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx lines 126-144
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handleGeneratePdf}>
      Generate PDF
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setSendDialogOpen(true)}>
      Send to Customer
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Dialog Pattern (from change-order-detail.tsx)

```tsx
// Source: apps/web/components/change-order/change-order-detail.tsx lines 422-461
// Pattern: open state managed in parent, Dialog controlled externally

const [sendDialogOpen, setSendDialogOpen] = useState(false);

<SendToCustomerDialog
  open={sendDialogOpen}
  onOpenChange={setSendDialogOpen}
  documentName={estimate.name}
  prePopulatedEmail={project?.customer?.email}
  isPending={sendToCustomerMutation.isPending}
  onSend={({ recipients, subject, note }) => {
    sendToCustomerMutation.mutate({ estimateId: estimate.id });
    setSendDialogOpen(false);
  }}
/>
```

### tRPC Mutation + Cache Invalidation Pattern

```tsx
// Source: pattern from apps/web/components/change-order/change-order-detail.tsx
const utils = trpc.useUtils();

const sendToCustomerMutation = trpc.estimates.sendToCustomer.useMutation({
  onSuccess: () => {
    void utils.estimates.getBySlug.invalidate({ slug: estimateSlug });
    toast.success("Proposal sent to customer");
    setSendDialogOpen(false);
  },
  onError: (error) => {
    toast.error(error.message ?? "Failed to send proposal");
  },
});
```

### Idempotent Status Update (Drizzle)

```typescript
// Source: pattern from estimates.ts submitEstimate
// For sendToCustomer — no status guard, always sets to "submitted"
const [updated] = await db
  .update(schema.estimates)
  .set({
    status: "submitted",
    submittedAt: new Date(),
    updatedAt: new Date(),
  })
  .where(eq(schema.estimates.id, input.estimateId))
  .returning();
```

---

## State of the Art (Current Codebase)

| Old Pattern | Phase 50 Pattern | Why Changed |
|-------------|------------------|-------------|
| NextStepsPanel with SubmitEstimateButton | 3-dot dropdown with "Send to Customer" | Approval workflow removed; simpler send action replaces internal submit |
| CO header: Approve/Reject/Submit buttons inline | CO header: 3-dot dropdown with Generate PDF + Send to Customer | Approval flow removed; consistent with proposal detail |
| CO detail renders ApprovalPanel for pco_submitted/pending_approval/approved/rejected | ApprovalPanel removed entirely | Internal approval workflow no longer exposed in UI |
| Proposal status "submitted" = "submitted for internal approval" | "submitted" = "sent to customer" | Semantic shift — same status value, new meaning |
| CO status "pco_submitted" = "submitted for internal approval workflow" | "pco_submitted" = "sent to customer" | Semantic reuse — PCO number assigned on first send only |

---

## Open Questions

1. **Under-contract and accepted estimate statuses — block "Send to Customer"?**
   - What we know: CONTEXT says "always available; always re-sendable (idempotent)." The estimate status machine has `accepted` and `under_contract` as post-submitted states.
   - What's unclear: Should a user be able to "re-send" a proposal that's already `accepted` or `under_contract`? Re-sending would move it back to `submitted`.
   - Recommendation: The CONTEXT says idempotent, so allow it for all non-terminal cases. For `under_contract` (terminal), block with a toast error. For `accepted`, allow but set back to `submitted`. If this is undesirable, the planner should add a status guard in the mutation for `under_contract`.

2. **Where do the GenerateBidButton and ConvertToProjectButton go?**
   - What we know: Both currently live in `NextStepsPanel`. The NextStepsPanel is being removed entirely.
   - What's unclear: The CONTEXT does not mention preserving Generate Bid or Convert to Project functionality.
   - Recommendation: Remove both buttons entirely as part of removing NextStepsPanel. If the product needs them later, they can be added back to the 3-dot dropdown in a future phase. The planner should note this as an explicit removal.

3. **CO detail page: should ApprovalPanel history be preserved for existing data?**
   - What we know: The `ChangeOrderHistory` component (separate from ApprovalPanel) shows history events. The `ApprovalPanel` shows live workflow steps.
   - What's unclear: COs that already have `pending_approval` or multi-step approval workflows will lose their approval status display.
   - Recommendation: Remove `ApprovalPanel` — the approval workflow is being phased out. `ChangeOrderHistory` can remain (it shows all historical events). Existing `pending_approval` COs may need a data migration to `pco_submitted` to not appear stuck, but that is out of scope for Phase 50.

---

## Sources

### Primary (HIGH confidence)

- Direct read: `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` — verified current proposal header, NextStepsPanel usage, project.getBySlug call
- Direct read: `apps/web/components/change-order/change-order-detail.tsx` — verified CO header structure, all approval buttons, ApprovalPanel usage, statusVariantMap
- Direct read: `apps/web/components/estimates/lifecycle/NextStepsPanel.tsx` — verified SubmitEstimateButton, GenerateBidButton, ConvertToProjectButton present
- Direct read: `apps/web/components/estimates/actions/SubmitEstimateButton.tsx` — verified calls `trpc.estimates.submitEstimate`
- Direct read: `apps/api/src/trpc/routers/estimates.ts` — verified submitEstimate mutation, canTransitionEstimate guard, procedures list
- Direct read: `apps/api/src/services/estimateLifecycle.ts` — verified state machine: `draft → submitted`, `submitted → accepted`, `accepted → under_contract`
- Direct read: `apps/api/src/trpc/routers/change-order.ts` — verified submit mutation (pco_submitted), getNextChangeOrderNumber call, procedure signatures
- Direct read: `packages/shared/src/types/change-order.ts` — verified VALID_CO_STATUS_TRANSITIONS: `draft:["pco_submitted","void"]`, `pco_submitted:["pending_approval","draft","void"]`
- Direct read: `apps/api/src/db/schema/tenant.ts` — verified `customers.email` is nullable, `changeOrders.status` valid values, `estimates.status` valid values
- Direct read: `apps/api/src/trpc/routers/project.ts` — verified `getBySlug` returns `customer: { email, companyName, contactName, ... }`
- Direct read: `apps/web/components/shared/status-badge.tsx` — verified all variant values
- Direct read: `apps/web/components/ui/dialog.tsx` — verified Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle components exist
- Direct read: `apps/web/components/ui/dropdown-menu.tsx` — confirmed via grep that DropdownMenu is in `components/ui/dropdown-menu.tsx`
- Direct read: `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — verified DropdownMenu + MoreVertical usage pattern

### Secondary (MEDIUM confidence)

- None required — all findings verified from direct file reads.

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from existing codebase; no new installs
- Current page structure: HIGH — proposal detail and CO detail pages read directly
- Status machine: HIGH — `estimateLifecycle.ts` and `VALID_CO_STATUS_TRANSITIONS` read directly from source
- Customer email access path: HIGH — `project.getBySlug` return shape verified from router code and schema
- Architecture recommendations: HIGH — based on direct code patterns from same codebase
- Open questions: MEDIUM — require product/planner decision, not technical uncertainty

**Research date:** 2026-02-24
**Valid until:** 2026-03-25 (stable domain — only invalidated by schema changes to estimates/changeOrders status fields)
