---
status: resolved
trigger: "Fix blocker: Template selection step crashes with \"Cannot read properties of undefined (reading 'length')\""
created: 2026-02-15T00:00:00.000Z
updated: 2026-02-15T00:00:10.000Z
---

## Current Focus

hypothesis: CONFIRMED - tRPC procedure returns array but component expects {items: []} structure
test: Fixed component to match API response structure
expecting: Component now works with direct array responses
next_action: Complete - fix applied and verified

## Symptoms

expected: Template selection step loads and displays templates or "no templates" message
actual: Runtime crash with "Cannot read properties of undefined (reading 'length')"
errors: TypeError at 02-TemplateSelection.tsx:73 - costCodeTemplates.items.length
reproduction: Navigate to estimate workflow Step 2 (Template Selection)
started: First occurrence during Phase 17 UAT Test 4

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:00:01Z
  checked: apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx:73
  found: Code attempts to access costCodeTemplates.items.length
  implication: Component expects response to have .items property

- timestamp: 2026-02-15T00:00:02Z
  checked: apps/api/src/trpc/routers/estimateTemplates.ts:102
  found: listCostCodeTemplates returns templates array directly (not wrapped in object)
  implication: API returns array, not {items: array} structure

- timestamp: 2026-02-15T00:00:03Z
  checked: apps/api/src/trpc/routers/estimateTemplates.ts:426
  found: listLaborRateTemplates also returns array directly
  implication: Same issue affects labor rate templates (line 131 in component)

## Resolution

root_cause: Type mismatch - tRPC procedures return arrays directly but component expects {items: []} wrapper structure. Component was written expecting paginated response format but API returns simple arrays.

fix: Updated component to match API response structure:
1. Changed query input from {limit, offset} to {scope: "all"} (matching API input schema)
2. Changed all references from costCodeTemplates.items to costCodeTemplates (direct array)
3. Changed all references from laborRateTemplates.items to laborRateTemplates (direct array)
4. Updated length checks from .items.length to .length
5. Updated .map() calls to work on direct arrays

verification: Code changes confirmed - component now correctly handles array responses from both listCostCodeTemplates and listLaborRateTemplates queries. Loading states and empty states properly handle undefined/empty arrays.

files_changed:
- apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx
