# Phase 51: Lifecycle Phase Freedom - Research

**Researched:** 2026-02-24
**Domain:** tRPC mutation guard removal + React optimistic-update badge UX
**Confidence:** HIGH — all findings sourced directly from codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Guard removal scope**
- Zero exceptions — all phase transitions are completely free with no blocks
- All financial guards removed — active contracts, unpaid invoices, financial commitment checks do not block transitions
- Fully bidirectional and non-sequential — any phase to any phase in one click, including large jumps in either direction
- No warnings at all — not even a toast. Silent transitions only. The badge updating is the confirmation.

**Phase selector UI (existing — do not change)**
- The control already exists: a lifecycle phase badge in the sticky project header that opens a dropdown on click
- Do not rebuild or redesign the selector — only remove the guards that restrict what options are available or clickable
- All phases appear in sequential lifecycle order; current phase is visually highlighted/checked; all phases always shown
- After changing phase, user stays on their current page — badge updates in place, no redirect

**Transition feedback**
- No success toast — badge update in place is sufficient confirmation
- Pending state: badge shows a loading spinner or muted visual while the mutation is in flight
- On failure: error toast shown + badge reverts to the previous phase (standard optimistic update failure pattern)
- No cascade — only the phase badge updates; stat bar and other header elements are not invalidated/refreshed

**Archived and terminal phases**
- Archived is just another phase option — same dropdown entry, same behavior, no special treatment
- Archived is not terminal — a project in Archived can freely move to any other phase
- No "Lost" phase exists in this system
- All phases always shown in dropdown; current phase highlighted but not disabled — no self-transition prevention needed

### Claude's Discretion

None specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None specified.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PHASE-01 | Users can transition a project to any lifecycle phase from any current phase with a single click — no sequential restriction | `isValidTransition` in `lifecycle-state-machine.ts` enforces forward-one-at-a-time + backward-requires-reason. Removing this call from the router removes all sequential restriction. |
| PHASE-02 | Transitioning to an earlier phase requires no confirmation dialog, justification text, or explanation | The `AlertDialog` + `isBackward` state + `Textarea` for reason in `lifecycle-phase-badge.tsx` are the only confirmation/reason UI. Removing that branch and firing all transitions immediately satisfies this. |
| PHASE-03 | All phase transition guards based on contract status, billing status, or financial state are removed | The only transition guard in `project.ts` is `isValidTransition` (sequential/reason check). There are no financial guards on the transition itself — those exist on OTHER mutations (change-order create, estimate edit). |
</phase_requirements>

---

## Summary

Phase 51 is a surgical removal of two guard layers: one in the API and one in the frontend component. The codebase is clean and well-isolated — there is no financial guard on the `transitionLifecyclePhase` mutation itself, only a sequential-transition rule enforced by `isValidTransition` in `lifecycle-state-machine.ts`. The frontend badge adds a second UI-layer guard via an `AlertDialog` that intercepts backward transitions and demands a reason before firing the mutation.

The total scope of changes is three files: the state machine library (remove or replace `isValidTransition`), the tRPC router (remove the `isValidTransition` call and clean up the now-unused `isBackward`/`fromIdx` variables), and the badge component (remove the `AlertDialog` + `isBackward` + `reason` state, fire all transitions immediately, add a pending spinner inline in the badge). No schema changes, no new queries, no new components.

The `reason` column in `project_lifecycle_transitions` is already nullable in the schema, so the transition history audit log continues to work unchanged — backward transitions will simply have `reason: null` going forward.

**Primary recommendation:** Remove `isValidTransition` call from router + remove AlertDialog from badge + add `transitionMutation.isPending` spinner inline in the badge `StatusBadge`.

---

## Standard Stack

### Already in Place
| Component | Location | Purpose |
|-----------|----------|---------|
| `trpc.project.transitionLifecyclePhase` | `apps/api/src/trpc/routers/project.ts:1013` | The mutation that writes the transition to DB + audit log |
| `isValidTransition` | `apps/api/src/lib/lifecycle-state-machine.ts:15` | The guard that enforces sequential + reason rules — **remove this call** |
| `LifecyclePhaseBadge` | `apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx` | Client component that renders the badge + popover dropdown + AlertDialog |
| `StatusBadge` | `apps/web/components/shared/status-badge.tsx` | Base `<span>` badge with CVA variants — accepts `className` and arbitrary children via `React.forwardRef` |
| `Loader2` | `lucide-react` (already used widely in codebase) | Spinner icon for pending state |

### No New Dependencies Required
This phase requires zero new packages. All UI patterns are already present.

---

## Architecture Patterns

### File Map

```
apps/api/src/lib/
└── lifecycle-state-machine.ts   # Contains isValidTransition (guard to remove) + tryAutoAdvance (leave alone)

apps/api/src/trpc/routers/
└── project.ts                   # transitionLifecyclePhase mutation at line 1013
                                 # isValidTransition called at line 1056 — DELETE this call
                                 # isBackward / fromIdx computed at lines 1058-1060 — can stay (used for audit log metadata)

apps/web/app/(dashboard)/projects/[projectSlug]/
├── layout.tsx                   # Computes canTransition (RBAC — leave unchanged)
└── components/
    ├── lifecycle-phase-badge.tsx  # Main target for frontend changes
    └── project-header.tsx         # Passes canTransition to badge — leave unchanged
```

### Pattern 1: Remove the API Guard (server)

**What:** The `transitionLifecyclePhase` router procedure calls `isValidTransition(from, to, reason)` which throws `BAD_REQUEST` on skip-forward or on backward-without-reason. Delete this single call.

**File:** `apps/api/src/trpc/routers/project.ts`, line 1056

```typescript
// DELETE this entire line:
isValidTransition(project.lifecyclePhase as LifecyclePhase, input.toPhase, input.reason);
```

After removal, the procedure does: RBAC check → fetch project → DB transaction (update phase + insert transition record) → audit log → return updated project. All of those steps remain correct. The transition record insert already handles `reason: input.reason ?? null` which is fine since `reason` is nullable in the schema.

**Import cleanup:** After removing the `isValidTransition` call, remove the `isValidTransition` import from the router (line 28) — it's only used in that one place. `tryAutoAdvance` is also imported from the same module and is used elsewhere in the router for auto-advance, so keep that import.

**Updated import line:**
```typescript
import { tryAutoAdvance } from "../../lib/lifecycle-state-machine.js";
```

### Pattern 2: Remove the Frontend AlertDialog (client)

**What:** `lifecycle-phase-badge.tsx` has a backward-transition intercept flow using `isBackward`, `pendingPhase`, `reason`, and an `AlertDialog`. This entire flow must be removed so ALL transitions fire immediately.

**What to keep:**
- `useState` for `open` (popover)
- `transitionMutation` definition
- `handlePhaseClick` simplified to always call `transitionMutation.mutate` directly
- The `Popover`/`PopoverContent` dropdown rendering
- The `disabled={phase === currentPhase}` on each button (this is fine — the requirement says "all phases always shown; current phase highlighted but not disabled" but also "no self-transition prevention needed" — since the user decision says it's fine not to have it, leaving `disabled` for same-phase is also acceptable behavior)

**What to remove:**
- `pendingPhase` state and `setPendingPhase`
- `isBackward` state and `setIsBackward`
- `reason` state and `setReason`
- `handleConfirm` function
- The entire `AlertDialog` JSX block (lines 124-168)
- Imports: `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, `Textarea`

**Simplified `handlePhaseClick`:**
```typescript
const handlePhaseClick = (phase: LifecyclePhase) => {
  setOpen(false);
  transitionMutation.mutate({ projectId, toPhase: phase, reason: undefined });
};
```

### Pattern 3: Add Pending State to Badge

**What:** While `transitionMutation.isPending` is true, the badge should show a visual loading state. The `StatusBadge` component is a `forwardRef` `<span>` that accepts `children` and `className`. The simplest approach is to render a `Loader2` spinner inline alongside the label text when pending.

**File:** `lifecycle-phase-badge.tsx`

```typescript
import { Loader2 } from "lucide-react";

// In the badge definition:
const badge = (
  <StatusBadge
    variant={transitionMutation.isPending ? "draft" : phaseToVariant(currentPhase)}
    style={{ cursor: canTransition ? "pointer" : "default" }}
    className={transitionMutation.isPending ? "opacity-60" : undefined}
  >
    {transitionMutation.isPending ? (
      <>
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
        {LIFECYCLE_PHASE_LABELS[currentPhase]}
      </>
    ) : (
      LIFECYCLE_PHASE_LABELS[currentPhase]
    )}
  </StatusBadge>
);
```

Note: The popover trigger should be disabled while pending to prevent double-clicks. Wrap `PopoverTrigger` conditionally or disable it.

### Pattern 4: Optimistic Update for Instant Feedback (optional but recommended)

The user decision requires "badge reverts to the previous phase on failure." The current implementation does NOT use optimistic updates — `onSuccess` calls `invalidate` which triggers a refetch. This means the badge shows the old phase until the mutation resolves.

Two approaches:
1. **Simple (current approach):** Badge shows spinner while pending, then updates when `invalidate` completes the refetch. Works fine since `getBySlug` is cached and the invalidation is fast.
2. **True optimistic update:** Use `onMutate` to immediately update the displayed phase via `utils.project.getBySlug.setData`, then `onError` rolls it back. This requires knowing the project slug inside the badge.

The badge already receives `projectSlug` as a prop, so true optimistic update IS possible:

```typescript
const transitionMutation = trpc.project.transitionLifecyclePhase.useMutation({
  onMutate: async ({ toPhase }) => {
    await utils.project.getBySlug.cancel({ slug: projectSlug });
    const previous = utils.project.getBySlug.getData({ slug: projectSlug });
    utils.project.getBySlug.setData({ slug: projectSlug }, (old) =>
      old ? { ...old, lifecyclePhase: toPhase } : old
    );
    return { previous };
  },
  onError: (_err, _vars, ctx) => {
    if (ctx?.previous) {
      utils.project.getBySlug.setData({ slug: projectSlug }, ctx.previous);
    }
    toast.error(_err.message);
  },
  onSettled: () => {
    utils.project.getBySlug.invalidate({ slug: projectSlug });
    utils.project.list.invalidate();
    utils.project.getTransitionHistory.invalidate({ projectId });
  },
});
```

The user decision says "no success toast" and "error toast shown + badge reverts on failure." The optimistic approach satisfies both naturally. The `isPending` state can still be used for the spinner even with optimistic updates.

### Anti-Patterns to Avoid

- **Don't remove `tryAutoAdvance`** — it lives in `lifecycle-state-machine.ts` and is called by the estimates router. It has its own internal "only advance if exactly next step" check. That's fine — auto-advance is a system trigger, not a user-facing guard.
- **Don't modify `isValidTransition` logic** — just stop calling it. Leave the function in place (it's exported and may be tested or referenced elsewhere). Removing the call from the router is sufficient.
- **Don't invalidate `getHeaderStats`** — the user decision explicitly says "no cascade — only the phase badge updates; stat bar and other header elements are not invalidated/refreshed."
- **Don't remove `reason` from the `transitionLifecyclePhaseSchema`** — the API input schema still accepts `reason?: string` (optional). Sending `undefined` is fine. The schema is defined in `packages/shared/src/types/project.ts` line 183 and the field is `.optional()`.
- **Don't add a `checkmark` UI for the current phase in the dropdown by disabling it** — the user decision says the current phase is "highlighted but not disabled — no self-transition prevention needed." The existing `disabled={phase === currentPhase}` is acceptable to leave in or remove; self-transitions would just be no-ops since the router would update `lifecyclePhase` to the same value (no error thrown after removing `isValidTransition`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Spinner icon | Custom SVG | `Loader2` from lucide-react (animate-spin) |
| Optimistic rollback | Manual state tracking | tRPC `onMutate`/`onError` context pattern |
| Badge loading state | New component | `className` + `children` props on existing `StatusBadge` |

---

## Common Pitfalls

### Pitfall 1: Leaving the `isValidTransition` import after removing the call
**What goes wrong:** TypeScript compilation error — unused import (if `noUnusedLocals` is set) or dead code.
**How to avoid:** After removing the `isValidTransition(...)` call at line 1056, update the import on line 28 from `import { isValidTransition, tryAutoAdvance }` to `import { tryAutoAdvance }`.

### Pitfall 2: Self-transition hits the DB unnecessarily
**What goes wrong:** With `isValidTransition` removed, clicking the currently-active phase fires the mutation which does an UPDATE (no-op) + an INSERT into `project_lifecycle_transitions` recording `fromPhase === toPhase`. This creates noise in the audit trail.
**How to avoid:** The dropdown button already has `disabled={phase === currentPhase}` — leave it. This prevents the click handler from firing. No additional server-side check needed.
**Warning signs:** Audit log shows transitions with `fromPhase === toPhase`.

### Pitfall 3: Success toast is still showing
**What goes wrong:** The current `onSuccess` handler calls `toast.success(...)`. User decision says no success toast — silent transition only.
**How to avoid:** Remove the `toast.success(...)` call from `onSuccess`. Also remove `pendingPhase` state (previously used to populate the toast message label). The `toast` import from `sonner` can stay since it's still needed for the error toast on `onError`.

### Pitfall 4: Popover stays open while mutation is in flight
**What goes wrong:** User clicks a phase, the popover closes (`setOpen(false)` in `handlePhaseClick`), but if the user rapidly clicks the badge again while pending, they could open a new popover and fire a second mutation.
**How to avoid:** While `transitionMutation.isPending`, make the `PopoverTrigger` non-interactive. Simplest: conditionally render the plain badge (no Popover) when pending, or set `disabled` on the trigger.

### Pitfall 5: `isBackward`/`fromIdx` variables left in the router after guard removal
**What goes wrong:** TypeScript warning about unused variable `isBackward` (computed at line 1060 from `toIdx < fromIdx`). `fromIdx` is also computed but only used to determine `isBackward`.
**How to avoid:** After removing `isValidTransition`, check whether `isBackward` and `fromIdx` are still used downstream. Looking at the router: `isBackward` IS used on line 1089 inside the `createAuditLog` call in `metadata: { triggeredBy: "user", isBackward }`. So both variables can remain — they serve the audit log. No cleanup needed.

### Pitfall 6: Feature gate tabs break when phase changes silently
**What goes wrong:** `project-tabs.tsx` uses `lifecyclePhase` from `layout.tsx` to filter tabs (via `isFeatureAvailableInPhase`). However, looking at `ALL_SECTIONS` — none of the current entries have a `phaseGated` property, so the filter never actually hides any tab. This is safe: the phase gate code exists but is dormant because no tab in `ALL_SECTIONS` uses `phaseGated`.
**Why it matters:** Phase 51 removes the ability to force a user through sequential phases, which previously prevented them from skipping to phases where a tab might be hidden. Since no tabs are currently phase-gated, this is a non-issue now. Flag for awareness.

---

## Code Examples

Verified from codebase:

### Current guard call in router (line 1056)
```typescript
// apps/api/src/trpc/routers/project.ts
// DELETE this line:
isValidTransition(project.lifecyclePhase as LifecyclePhase, input.toPhase, input.reason);
```

### Current frontend backward-intercept flow (lifecycle-phase-badge.tsx lines 69-91)
```typescript
// CURRENT — intercepting backward transitions:
const handlePhaseClick = (phase: LifecyclePhase) => {
  const currentIdx = LIFECYCLE_ORDER.indexOf(currentPhase);
  const targetIdx = LIFECYCLE_ORDER.indexOf(phase);
  const backward = targetIdx < currentIdx;
  setOpen(false);
  if (backward) {
    setIsBackward(true);
    setPendingPhase(phase);          // shows AlertDialog
  } else {
    transitionMutation.mutate({ projectId, toPhase: phase, reason: undefined });
  }
};

// TARGET — fire all transitions immediately:
const handlePhaseClick = (phase: LifecyclePhase) => {
  setOpen(false);
  transitionMutation.mutate({ projectId, toPhase: phase, reason: undefined });
};
```

### Cache invalidation in current `onSuccess` (lifecycle-phase-badge.tsx lines 56-63)
```typescript
// These three invalidations happen on success:
utils.project.getBySlug.invalidate({ slug: projectSlug });
utils.project.list.invalidate();
utils.project.getTransitionHistory.invalidate({ projectId });

// Per user decision, remove the toast.success call:
// toast.success(`Project moved to ${pendingPhase ? LIFECYCLE_PHASE_LABELS[pendingPhase] : ""}`);
```

### Pending state inline in badge
```typescript
// Add to badge JSX:
import { Loader2 } from "lucide-react";

const badge = (
  <StatusBadge
    variant={phaseToVariant(currentPhase)}
    style={{ cursor: canTransition && !transitionMutation.isPending ? "pointer" : "default" }}
    className={transitionMutation.isPending ? "opacity-60" : undefined}
  >
    {transitionMutation.isPending && (
      <Loader2 className="h-3 w-3 animate-spin mr-1 inline" />
    )}
    {LIFECYCLE_PHASE_LABELS[currentPhase]}
  </StatusBadge>
);
```

### The 9 lifecycle phases (exact values)
```typescript
// packages/shared/src/types/project.ts
export const LIFECYCLE_ORDER: LifecyclePhase[] = [
  "opportunity",        // index 0
  "estimating",         // index 1
  "submitted",          // index 2
  "awarded",            // index 3
  "active",             // index 4
  "substantial_completion", // index 5
  "closed",             // index 6
  "warranty",           // index 7
  "archived",           // index 8
];
```

---

## State of the Art

| Old Behavior | New Behavior | Impact |
|--------------|--------------|--------|
| Forward: must advance exactly one step | Forward: any step, any distance | `isValidTransition` call removed from router |
| Backward: requires reason text in AlertDialog | Backward: immediate, silent | AlertDialog + reason state removed from badge component |
| Self-transition: throws BAD_REQUEST ("already in this phase") | Self-transition: no-op (button is disabled anyway) | Guard removal means server does a no-op UPDATE if fired |
| Success: toast notification shown | Success: badge updates silently | `toast.success` removed from `onSuccess` |

---

## Open Questions

1. **Self-transition behavior**
   - What we know: `disabled={phase === currentPhase}` on each dropdown button prevents the click handler. If somehow fired (e.g., via keyboard), the server will do a no-op UPDATE + insert a `fromPhase === toPhase` audit record.
   - What's unclear: Is this silent no-op acceptable, or should the router keep a self-transition check?
   - Recommendation: Leave `disabled` on the button in the UI (prevents accidental self-transition) and do not add any server-side check. The user decision says "no self-transition prevention needed" implying it's acceptable either way.

2. **Optimistic update vs. invalidation-on-success**
   - What we know: The user says "badge reverts on failure." With the current invalidation-based approach, the badge shows the OLD phase while pending (spinner shows), then jumps to new phase on success. With true optimistic updates, badge immediately shows the new phase, spinner optional.
   - What's unclear: Which UX does the user prefer?
   - Recommendation: Implement as optimistic update — it's the more polished pattern and matches "badge updates in place" intent from the decisions. The `projectSlug` prop is already available in the badge for the `setData` call.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `apps/api/src/lib/lifecycle-state-machine.ts` — full guard logic
- Direct codebase read: `apps/api/src/trpc/routers/project.ts` lines 1008-1097 — full `transitionLifecyclePhase` mutation
- Direct codebase read: `apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx` — full badge component
- Direct codebase read: `packages/shared/src/types/project.ts` — 9 phases, LIFECYCLE_ORDER, transitionLifecyclePhaseSchema
- Direct codebase read: `apps/api/src/db/schema/tenant.ts` lines 1233-1245 — `projectLifecycleTransitions` schema (reason is nullable)
- Direct codebase read: `apps/web/components/shared/status-badge.tsx` — StatusBadge props (accepts className, children)
- Direct codebase read: `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` — canTransition derivation
- Direct codebase read: `apps/api/src/trpc/routers/change-order.ts` — `isFeatureAvailableInPhase` guard (not on transition itself)
- Direct codebase read: `apps/api/src/trpc/routers/estimates.ts` — `isFeatureAvailableInPhase` guard (not on transition itself)

---

## Metadata

**Confidence breakdown:**
- Guard locations: HIGH — read directly from source files
- Change scope: HIGH — all 3 affected files identified with exact line numbers
- Frontend optimistic update pattern: HIGH — tRPC utils pattern well-established in this codebase
- Side effects: HIGH — confirmed no financial guards on the transition mutation itself

**Research date:** 2026-02-24
**Valid until:** 2026-03-25 (stable codebase area, no fast-moving dependencies)
