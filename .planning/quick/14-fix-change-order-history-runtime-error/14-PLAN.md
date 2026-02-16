---
type: quick
wave: 1
depends_on: []
files_modified:
  - apps/web/components/change-order/change-order-history.tsx
autonomous: true

must_haves:
  truths:
    - "Component renders history entries without runtime errors"
    - "Status change entries display correctly for string values"
    - "Field update entries display correctly for all value types"
  artifacts:
    - path: "apps/web/components/change-order/change-order-history.tsx"
      provides: "Type-safe history rendering"
      min_lines: 140
  key_links:
    - from: "getHistoryDescription function"
      to: "entry.oldValue/newValue"
      via: "type-safe string conversion"
      pattern: "typeof.*string.*String"
---

<objective>
Fix runtime error in change-order-history component where `.replace()` is called on non-string values.

Purpose: The component assumes `oldValue` and `newValue` are always strings, but the schema defines them as JSONB (`$type<unknown>()`), meaning they can be strings, numbers, objects, or arrays. Lines 74 and 78 call `.replace(/_/g, " ")` without checking the type first.

Output: Component safely renders all history entry types without runtime errors.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/web/components/change-order/change-order-history.tsx
@apps/api/src/db/schema/tenant.ts (lines 517-527 for schema definition)
</context>

<tasks>

<task type="auto">
  <name>Add type-safe value formatting to history rendering</name>
  <files>apps/web/components/change-order/change-order-history.tsx</files>
  <action>
Add a helper function `formatHistoryValue` that safely converts any value type to string:

```typescript
const formatHistoryValue = (value: unknown): string => {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};
```

Update the `getHistoryDescription` function to use this helper:

1. **Line 65** (field_update oldValue): Change from `{entry.oldValue || "(empty)"}` to `{formatHistoryValue(entry.oldValue)}`

2. **Line 66** (field_update newValue): Change from `{entry.newValue}` to `{formatHistoryValue(entry.newValue)}`

3. **Line 74** (status_change oldValue): Change from `{entry.oldValue?.replace(/_/g, " ") || "none"}` to:
   ```typescript
   {typeof entry.oldValue === "string" ? entry.oldValue.replace(/_/g, " ") : formatHistoryValue(entry.oldValue) || "none"}
   ```

4. **Line 78** (status_change newValue): Change from `{entry.newValue?.replace(/_/g, " ")}` to:
   ```typescript
   {typeof entry.newValue === "string" ? entry.newValue.replace(/_/g, " ") : formatHistoryValue(entry.newValue)}
   ```

This ensures `.replace()` is only called on actual strings, and all other types are safely converted.
  </action>
  <verify>
1. Check TypeScript compilation: `npm run type-check` in apps/web (no errors)
2. Manual test: Navigate to a change order with history and confirm component renders without console errors
3. Test with different entry types: field_update (various value types), status_change (string status values)
  </verify>
  <done>
- Component renders all history entry types without calling `.replace()` on non-string values
- formatHistoryValue helper safely converts any type to string
- Status change entries still format underscores to spaces for string values
- Non-string values (numbers, objects, arrays) are displayed using JSON.stringify or String conversion
  </done>
</task>

</tasks>

<verification>
Manual testing:
1. Navigate to project with change orders
2. Open change order detail page with history
3. Confirm no runtime errors in browser console
4. Verify various history entry types display correctly
</verification>

<success_criteria>
- No runtime errors when rendering change order history
- Status change entries with string values display with spaces instead of underscores
- Field update entries display correctly regardless of value type (string, number, object)
- All existing history entries render without breaking the component
</success_criteria>

<output>
After completion, create `.planning/quick/14-fix-change-order-history-runtime-error/14-SUMMARY.md`
</output>
