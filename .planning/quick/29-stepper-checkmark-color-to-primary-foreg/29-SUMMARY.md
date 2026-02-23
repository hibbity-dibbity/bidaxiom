---
num: 29
status: complete
date: 2026-02-23
---

## What was done

**Task 1 — EstimateStepperBar.tsx checkmark style:**
- Done step circle: changed from `bg-primary border-primary` (filled teal) to `bg-transparent border-primary` (outlined teal). This makes the teal checkmark visible against the circle background.
- Check icon: changed from `text-primary-foreground` (white) to `text-primary` (teal brand color) and added `strokeWidth={2.5}` for bold weight.
- Active step remains filled teal (`bg-primary border-primary`) with white number — visually distinct from done (outlined + checkmark).

**Task 2 — COMPONENT-ORGANIZATION.md documentation:**
- Added "Progress Stepper (Multi-Step Workflow)" section documenting `EstimateStepperBar` as the canonical site-wide stepper pattern.
- Documents all 3 visual states (done/active/future), connecting line colors, label rules, and guidance for adapting to new workflows via a parallel Zustand store.

## Files modified
- `apps/web/components/estimates/workflow/EstimateStepperBar.tsx`
- `apps/web/COMPONENT-ORGANIZATION.md`

## Verification
- TypeScript compiles without errors on EstimateStepperBar
- Done state: outlined teal circle + teal bold checkmark
- Active state: filled teal circle + white number (unchanged)
- Future state: gray outlined circle + muted number (unchanged)
