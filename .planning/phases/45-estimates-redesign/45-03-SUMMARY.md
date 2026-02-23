---
plan: 45-03
status: complete
---

## What was done
- Removed `WorkflowSidebar` from workflow page; inserted `EstimateStepperBar` between page header and step container
- Updated loading skeleton to match new full-width layout (removed sidebar-style dual-pane skeleton)
- Added comment in workflow page documenting that wizard steps use switch/case rendering (not conditional mounting — no Controller unmount risk)
- Step 1 (BasicInfo): added `goToStep(2)` Next button at bottom; added Enter-key-on-Textarea handler to advance when user presses Enter in description field (with !e.shiftKey guard to allow Shift+Enter for newlines)
- Step 2 (TemplateSelection): already had advance mechanism (`handleSkipTemplates` calling `goToStep(3)`) — no changes needed
- Step 3 (LineItems): added `Button` import and `goToStep(4)` Next button in footer alongside cost total
- Step 4 (LaborRates): added `goToStep(5)` to existing `handleSkip` (was only calling `unlockStep(5)` without navigating); added explicit Next button calling `goToStep(5)`
- Step 5 (MarkupConfig): added `Button` import, `goToStep(6)` Next button at bottom, Enter-key-on-last-Input handler on `subcontractorMarkupPercent` field
- Step 6 (SOVBuilder): added `useRouter` + `useParams` imports, extracted `projectSlug` and `estimateSlug` from URL params, added "Finalize Estimate" button with `router.push` to estimate detail page (no mutation — autoSave handles persistence)

## Files modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx`
- `apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx`
- `apps/web/components/estimates/workflow/steps/03-LineItems.tsx`
- `apps/web/components/estimates/workflow/steps/04-LaborRates.tsx`
- `apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx`
- `apps/web/components/estimates/workflow/steps/06-SOVBuilder.tsx`

## Deviations from Plan
None - plan executed exactly as written, with one minor addition: added `!e.shiftKey` guard to Step 1's Textarea Enter handler so Shift+Enter still inserts a newline (standard textarea UX expectation).

## Verification
- TypeScript compiles without new errors introduced by this plan (pre-existing errors in step files are unrelated to navigation wiring)
- `WorkflowSidebar` not imported or rendered in workflow page (only appears in a comment)
- `EstimateStepperBar` imported and rendered in workflow page
- All 6 steps have explicit advance mechanism:
  - Step 1: Next button calling `goToStep(2)`
  - Step 2: Skip/Apply buttons calling `goToStep(3)` (pre-existing)
  - Step 3: Next button calling `goToStep(4)`
  - Step 4: Next button calling `goToStep(5)`; Skip also calls `goToStep(5)`
  - Step 5: Next button calling `goToStep(6)`
  - Step 6: "Finalize Estimate" button calling `router.push` to estimate detail page
- Step 6 uses `router.push` confirmed via grep
