---
num: 31
status: complete
date: 2026-02-23
---

## What was done

Corrected the done-step visual design in `EstimateStepperBar.tsx` to match the BIDAXIOM company logo (teal circle with a large dark slate checkmark).

**Changes:**
- Done circle: restored `bg-primary border-primary` (solid filled teal) — was incorrectly changed to `bg-transparent border-primary` in quick-29
- Check icon: `text-brand-slate h-5 w-5 strokeWidth={3}` — larger (20px vs 16px), bolder stroke (3 vs 2.5), dark slate color (`--brand-slate: 210 25% 25%`) matching the logo font/icon color
- Updated COMPONENT-ORGANIZATION.md canonical spec to reflect the correct done-state visual

**Visual result:**
- Done: solid teal filled circle + large bold dark-slate checkmark (matches BIDAXIOM logo)
- Active: solid teal filled circle + white step number (unchanged)
- Future: gray outlined circle + muted number (unchanged)

## Files modified
- `apps/web/components/estimates/workflow/EstimateStepperBar.tsx`
- `apps/web/COMPONENT-ORGANIZATION.md`
