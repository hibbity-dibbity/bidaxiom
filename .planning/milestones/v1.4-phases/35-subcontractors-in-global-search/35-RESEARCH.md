# Phase 35 Research: Subcontractors in Global Search

**Researched:** 2026-02-18
**Overall Confidence:** HIGH — all findings are from direct codebase inspection, no inference needed.

---

## Summary

This phase follows an established, well-worn pattern. Estimates were added to ⌘K search in Phase 28 and provide the exact template to follow. All infrastructure exists: the subcontractor table has a `slug` column, a `getBySlug` procedure is already implemented, and the detail page is routed at `/subcontractors/[subcontractorSlug]`. The work is purely additive: extend the shared type enum, add one DB query in the search router, add one `CommandGroup` block in the command palette.

---

## Files That Need to Change

### 1. Shared types — enum extension

**File:** `packages/shared/src/types/search.ts`

Current `type` enum:
```typescript
type: z.enum(["project", "customer", "estimate"]),
```
Must become:
```typescript
type: z.enum(["project", "customer", "estimate", "subcontractor"]),
```

This is the only file in `packages/shared/` that needs to change.

---

### 2. tRPC search router — add subcontractor query

**File:** `apps/api/src/trpc/routers/search.ts`

- Imports needed: `subcontractorDirectory` from `ctx.tenant.schema` (already destructured pattern — just add it)
- The router uses `authorizedProcedure` (which is `protectedProcedure + withAbilities`). The subcontractor router uses `protectedProcedure`. Either is acceptable here; `authorizedProcedure` is what the existing search router uses — stay consistent.
- Search fields to query: `companyName` (primary), `contactName` (secondary). Both exist on the table.
- Slug column: `slug` — exists, is `text("slug").unique()`, nullable (set on create/update via `generateNameSlug`).
- URL pattern: `/subcontractors/${slug}`

Query to add (follows existing pattern exactly):
```typescript
const subcontractorResults = await ctx.tenant.db
  .select({
    id: subcontractorDirectory.id,
    companyName: subcontractorDirectory.companyName,
    contactName: subcontractorDirectory.contactName,
    slug: subcontractorDirectory.slug,
  })
  .from(subcontractorDirectory)
  .where(
    or(
      ilike(subcontractorDirectory.companyName, searchPattern),
      ilike(subcontractorDirectory.contactName, searchPattern)
    )
  )
  .limit(limit);
```

Then in the results transform array:
```typescript
...subcontractorResults
  .filter((s) => s.slug !== null)
  .map((s) => ({
    type: "subcontractor" as const,
    id: s.id,
    title: s.companyName,
    subtitle: s.contactName ?? null,
    url: `/subcontractors/${s.slug}`,
  })),
```

The `filter((s) => s.slug !== null)` guard matches the estimate pattern (`isNotNull(estimates.slug)` in WHERE clause) — either approach works. Doing it at the DB level with `isNotNull(subcontractorDirectory.slug)` in the WHERE is cleaner.

---

### 3. Command palette — add Subcontractors group

**File:** `apps/web/components/search/command-palette.tsx`

- Add icon import: `Building2` from `lucide-react` (this icon is already used in the subcontractor detail page, so it is the correct semantic choice; it is available in lucide-react)
- Add a `CommandGroup heading="Subcontractors"` block, following the same conditional pattern as Estimates:
```tsx
{results.some((r) => r.type === "subcontractor") && (
  <CommandGroup heading="Subcontractors">
    {results
      .filter((r) => r.type === "subcontractor")
      .map((result) => (
        <CommandItem
          key={result.id}
          value={result.title}
          onSelect={() => handleSelect(result.url)}
        >
          <Building2 className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>{result.title}</span>
            {result.subtitle && (
              <span className="text-xs text-muted-foreground">
                {result.subtitle}
              </span>
            )}
          </div>
        </CommandItem>
      ))}
  </CommandGroup>
)}
```
- Update `placeholder` on `CommandInput` if desired: currently `"Search projects, customers, jobs..."` — could add "subcontractors" but this is optional/cosmetic.

**Type label mechanism:** The "Subcontractor" type label IS the `CommandGroup heading="Subcontractors"`. There are no inline badges for existing types — the group heading is the sole type label. This satisfies requirement SRCH-03.

---

## DB Schema Details

**Table name (Drizzle):** `subcontractorDirectory` in `ctx.tenant.schema`
**Physical table name:** `subcontractor_directory`
**Defined in:** `apps/api/src/db/schema/tenant.ts` at line 672

Key columns:
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `companyName` | text NOT NULL | Primary search field |
| `contactName` | text nullable | Secondary search field |
| `contactEmail` | text nullable | In subcontractor.list search, but not needed for global search |
| `slug` | text unique nullable | Used for URL routing; set via `generateNameSlug(companyName)` |
| `status` | text | "active", "inactive", "blacklisted" — consider filtering to "active" only in global search |
| `createdAt` / `updatedAt` | timestamp | |

**Slug nullable gotcha:** The `slug` column is `text("slug").unique()` with no `.notNull()`. It is nullable in the schema. In practice all records should have a slug (it is generated on create and update), but a defensive `isNotNull` filter in the WHERE clause is recommended, matching the estimate pattern.

**Status filter consideration:** The existing search for projects/customers does NOT filter by status. For subcontractors, filtering to only `status = 'active'` would prevent surfacing blacklisted or inactive subs in search. This is a product decision — the requirements do not specify. Recommended: filter to `active` only (add `eq(subcontractorDirectory.status, "active")` to the WHERE clause using `and()`). This is a safe default.

---

## URL Pattern for Subcontractor Detail Page

**Route directory:** `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx`

**URL pattern:** `/subcontractors/{slug}`

The page uses `params.subcontractorSlug` to call `trpc.subcontractor.getBySlug.useQuery({ slug: params.subcontractorSlug })`. Navigating to `/subcontractors/{slug}` is the correct target URL.

---

## How Type Labels Are Rendered

The `CommandGroup heading` prop IS the type label. Each heading is rendered by cmdk as a section divider with text above the grouped results.

Current groups and headings:
- `heading="Projects"` — always shown (no conditional guard)
- `heading="Customers"` — always shown (no conditional guard)
- `heading="Estimates"` — conditionally shown: `{results.some((r) => r.type === "estimate") && ...}`

**Note:** Projects and Customers groups are NOT guarded by `.some()` checks. They always render even if empty, which would show an empty group header. Estimates uses the conditional guard. For Subcontractors, follow the Estimates pattern (conditional guard) since subcontractors are not universally present in every search result set.

Icons used per type:
- Projects: `FileText`
- Customers: `User`
- Estimates: `Calculator`
- Subcontractors: use `Building2` (already in the subcontractor detail page import list, correct semantic icon)

---

## Existing Search Query Structure

The search router uses:
- `ilike(column, searchPattern)` for case-insensitive text matching
- `searchPattern = \`%${query}%\`` for contains-style matching
- `.limit(limit)` per entity type, then `results.slice(0, limit)` on the merged array
- No full-text search, no pg_trgm — plain ILIKE
- All queries run independently (not a single UNION query)

The `authorizedProcedure` in search.ts grants access to `ctx.tenant.schema` which includes `subcontractorDirectory` — no additional middleware is needed.

---

## Procedure Type Mismatch — Not a Problem

The search router uses `authorizedProcedure`. The subcontractor router uses `protectedProcedure`. Both have access to `ctx.tenant`. The difference is `authorizedProcedure` also loads CASL abilities via `withAbilities` middleware — but the search router does NOT call `ForbiddenError.from(abilities).throwUnlessCan(...)` for any of its queries. It simply queries the data. This is consistent behavior — global search is designed to search across all entity types without per-entity permission checks. The subcontractor query should follow the same pattern: query without CASL check, relying on the tenant scope for data isolation.

---

## Gotchas

### 1. Slug can be null (minor)
The slug column is nullable in the schema. Add `isNotNull(subcontractorDirectory.slug)` to the WHERE clause so null-slug records are excluded. In practice this should not occur (slug is generated on create), but defensive filtering is correct.

### 2. No DB index on companyName
There is no explicit index on `subcontractor_directory.company_name` in the schema. The ILIKE with `%...%` pattern is not indexable anyway (leading wildcard). At subcontractor-directory scale (hundreds, not millions of records), this is not a performance concern. No index work needed.

### 3. Shared package rebuild
After updating `packages/shared/src/types/search.ts`, the shared package dist may need to be rebuilt (`npm run build` in `packages/shared`) before the API can pick up the new type. Check whether the dev server auto-rebuilds or requires a manual step.

### 4. Result ordering
The search router merges all result arrays then calls `.slice(0, limit)`. Projects come first, then customers, then estimates. Subcontractors will be appended last. If a user searches for a name that matches many entity types, subcontractors will be deprioritized by the merge order. This is acceptable; the requirements do not specify ordering relative to other types.

### 5. No contactEmail in global search
The subcontractor.list procedure searches `companyName`, `contactName`, AND `contactEmail`. For global search, matching on email is less useful and adds noise. Recommend searching only `companyName` and `contactName` in the global search query.

---

## Implementation Order

1. Update `packages/shared/src/types/search.ts` — add `"subcontractor"` to the type enum
2. Update `apps/api/src/trpc/routers/search.ts` — add subcontractor query and result mapping
3. Update `apps/web/components/search/command-palette.tsx` — add `Building2` icon import and `CommandGroup` block
4. Test: search for a known subcontractor company name, verify group appears and navigation works

No DB migrations needed. No new tRPC procedures needed. No new pages needed.

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| File paths | HIGH | Direct filesystem inspection |
| Schema (table, columns, slug) | HIGH | Read from tenant.ts directly |
| URL routing | HIGH | Page file at `[subcontractorSlug]/page.tsx` confirmed |
| Search query pattern | HIGH | Existing search.ts read verbatim |
| Type label mechanism | HIGH | Command palette read verbatim — group heading is the label |
| Slug nullability gotcha | HIGH | Schema definition explicitly lacks .notNull() |
| Status filter recommendation | MEDIUM | Product decision, requirements silent — recommendation based on UX reasoning |
