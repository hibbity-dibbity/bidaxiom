---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/components/ui/command.tsx
  - apps/web/components/search/command-palette.tsx
autonomous: true
must_haves:
  truths:
    - "Global search returns matching projects when user types a project name"
    - "Global search returns matching customers when user types a customer name"
    - "Results are visible and clickable in the command palette"
  artifacts:
    - path: "apps/web/components/ui/command.tsx"
      provides: "CommandDialog with shouldFilter support"
    - path: "apps/web/components/search/command-palette.tsx"
      provides: "Command palette with disabled client-side filtering"
  key_links:
    - from: "command-palette.tsx"
      to: "search.global tRPC query"
      via: "trpc.search.global.useQuery with server-side ILIKE"
      pattern: "trpc\\.search\\.global\\.useQuery"
---

<objective>
Fix global search returning "No results" despite data existing in the database.

Purpose: The cmdk library's built-in fuzzy filter is hiding server-fetched results because CommandItem `value` props are UUIDs (not searchable text). When the user types "test project", cmdk tries to match that against UUID values and hides all items -- even though the backend correctly returns matching rows via ILIKE.

Output: Working global search that shows matching projects and customers.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/components/ui/command.tsx
@apps/web/components/search/command-palette.tsx
@apps/api/src/trpc/routers/search.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Disable cmdk client-side filtering for server-searched CommandPalette</name>
  <files>apps/web/components/ui/command.tsx, apps/web/components/search/command-palette.tsx</files>
  <action>
**Root cause:** The `cmdk` library (Command primitive) has a built-in fuzzy filter that runs on the `value` prop of each `CommandItem`. In the command palette, `CommandItem` uses `value={result.id}` (a UUID). When the user types search text, cmdk tries to match that text against UUIDs and finds nothing, so it hides all items. The backend ILIKE query returns results correctly, but cmdk's client-side filter discards them.

**Fix in `apps/web/components/ui/command.tsx`:**
1. Modify the `CommandDialog` component to accept an optional `shouldFilter` prop (boolean) in addition to the existing `DialogProps`.
2. Forward the `shouldFilter` prop to the inner `<Command>` component (which is `CommandPrimitive`). This way consumers can opt out of cmdk's filtering.
3. Default `shouldFilter` to `undefined` so existing usages are unaffected (cmdk defaults to `true`).

The interface for CommandDialog should be:
```typescript
interface CommandDialogProps extends DialogProps {
  shouldFilter?: boolean;
}
```

**Fix in `apps/web/components/search/command-palette.tsx`:**
1. Pass `shouldFilter={false}` to the `<CommandDialog>` component. Since we perform server-side search via tRPC (ILIKE query), we do NOT want cmdk to additionally filter results on the client.
2. Also fix the `CommandItem` `value` prop: change from `value={result.id}` to `value={result.title}` for BOTH project and customer items. This ensures that even if filtering were re-enabled in the future, items would match by name rather than by UUID. It also ensures cmdk's internal selection/highlight tracking uses meaningful values.

Do NOT change the `key` prop -- that should remain `result.id` for React reconciliation.
Do NOT change the backend search router -- it is working correctly.
Do NOT remove the duplicate StandaloneCommandPalette from layout.tsx (separate issue).
  </action>
  <verify>
1. Run `cd apps/web && npx tsc --noEmit` -- no type errors.
2. Manual verification: Open the app, press Ctrl+K, type a search term that matches an existing project or customer name. Results should appear in the dropdown under "Projects" and "Customers" headings.
  </verify>
  <done>
Typing a search term in the command palette returns and displays matching projects and customers from the database. Results are visible, not filtered out by cmdk's client-side filter.
  </done>
</task>

</tasks>

<verification>
- TypeScript compilation passes with no errors
- Command palette shows results when searching for existing project/customer names
- Results are grouped under "Projects" and "Customers" headings
- Clicking a result navigates to the correct URL
</verification>

<success_criteria>
Global search returns and displays matching results when the user types a search query that matches existing data in the database.
</success_criteria>

<output>
After completion, create `.planning/quick/10-global-search-returns-no-results-debug-b/10-SUMMARY.md`
</output>
