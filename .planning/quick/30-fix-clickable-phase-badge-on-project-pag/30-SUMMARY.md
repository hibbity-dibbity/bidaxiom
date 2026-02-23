---
num: 30
status: complete
date: 2026-02-23
---

## Root Cause

`StatusBadge` was a plain function component (no `React.forwardRef`). In `lifecycle-phase-badge.tsx`, it was passed to `<PopoverTrigger asChild>`, which uses Radix's `Slot` component to merge props + ref onto the child element. Without forwardRef, the ref was silently dropped — floating-ui (which Radix uses for popover positioning) couldn't get a DOM anchor → popover rendered off-screen → appeared as "clicking does nothing."

## Fix

Added `React.forwardRef<HTMLSpanElement, StatusBadgeProps>` to `StatusBadge`, forwarding the ref to the inner `<span>`. Added `StatusBadge.displayName = "StatusBadge"`. Added `import * as React from "react"`.

All existing call sites are unchanged — `forwardRef` is backwards-compatible.

## Files modified
- `apps/web/components/shared/status-badge.tsx`

## Verification
- TypeScript compiles without new errors in apps/web
- `StatusBadge` now exports as a forwardRef component with `displayName`
- `PopoverTrigger asChild` can now attach its anchor ref → floating-ui computes correct position → popover opens reliably
