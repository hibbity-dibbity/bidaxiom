---
plan: 45-01
status: complete
---

## What was done
- Patched `useWorkflowState.ts`: `goToStep` now allows free navigation to any step 1-6. Removed the `maxUnlockedStep` guard condition. `maxUnlockedStep` and `unlockStep` remain in store for visual tracking.
- Created `EstimateStepperBar.tsx`: New horizontal stepper with 6 steps, 3 visual states (done=teal+check, active=teal+number, future=gray-outline), connecting lines that fill teal for completed segments, label only on active step with fixed-height placeholder for non-active to prevent layout shifts.

## Files modified
- `apps/web/components/estimates/workflow/useWorkflowState.ts`
- `apps/web/components/estimates/workflow/EstimateStepperBar.tsx` (new)

## Verification
- TypeScript compiles without errors on target files (pre-existing `apps/api` errors are out of scope)
- `goToStep` uses `step >= 1 && step <= 6` guard only — confirmed via grep
- `EstimateStepperBar` exports correct component, uses `bg-primary` for done/active states, `bg-border` for future connecting lines
