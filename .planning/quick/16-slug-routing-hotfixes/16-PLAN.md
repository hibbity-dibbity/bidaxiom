---
phase: quick-16
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/trpc/routers/search.ts
  - apps/api/src/services/projectConversion.ts
  - apps/web/components/estimates/actions/ConvertToProjectButton.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Global search returns slug-based URLs for projects that navigate correctly"
    - "ConvertToProjectButton navigates to slug-based project URL after conversion"
    - "Both E2E flows complete without 404 errors"
  artifacts:
    - path: "apps/api/src/trpc/routers/search.ts"
      provides: "Slug-based URL generation in search results"
      contains: "projects.slug"
    - path: "apps/api/src/services/projectConversion.ts"
      provides: "Project slug in conversion response"
      exports: ["projectSlug"]
    - path: "apps/web/components/estimates/actions/ConvertToProjectButton.tsx"
      provides: "Slug-based navigation after conversion"
      pattern: "router\\.push.*projects.*slug"
  key_links:
    - from: "search.ts line 60"
      to: "projects.slug column"
      via: "SELECT query includes slug"
      pattern: "slug: projects\\.slug"
    - from: "ConvertToProjectButton.tsx line 29"
      to: "mutation response projectSlug"
      via: "router.push uses data.projectSlug"
      pattern: "router\\.push.*data\\.projectSlug"
---

<objective>
Fix slug routing bugs identified in milestone v1.1 audit that break E2E flows

**Purpose:** Two critical bugs cause 404s in key user flows:
1. Global search (⌘K) returns UUID URLs instead of slug-based URLs
2. ConvertToProjectButton navigates to UUID route instead of slug route

**Output:** Both E2E flows work correctly with slug-based routing
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

# Existing slug utilities
@apps/api/src/utils/slug.ts

# Files with bugs
@apps/api/src/trpc/routers/search.ts
@apps/api/src/services/projectConversion.ts
@apps/web/components/estimates/actions/ConvertToProjectButton.tsx
</context>

<tasks>

<task type="auto">
  <name>Fix search router to return slug-based URLs</name>
  <files>
    apps/api/src/trpc/routers/search.ts
  </files>
  <action>
Update search router to generate slug-based project URLs:

1. Add `slug` to project SELECT query (line 23-27):
```typescript
.select({
  id: projects.id,
  name: projects.name,
  jobNumber: projects.jobNumber,
  customerId: projects.customerId,
  slug: projects.slug,  // ADD THIS
})
```

2. Update project result transformation (line 60) to use slug:
```typescript
url: `/projects/${p.slug}`,  // CHANGE from p.id to p.slug
```

This ensures global search (⌘K) generates URLs like `/projects/24001-main-street` instead of `/projects/{uuid}`, fixing E2E Flow #2.
  </action>
  <verify>
```bash
# Verify slug is selected in query
grep "slug: projects.slug" apps/api/src/trpc/routers/search.ts

# Verify URL uses slug
grep 'url: `/projects/\${p.slug}`' apps/api/src/trpc/routers/search.ts
```
  </verify>
  <done>
Search router selects project slug and generates URLs using `/projects/${p.slug}` format
  </done>
</task>

<task type="auto">
  <name>Update convertToProject to return projectSlug</name>
  <files>
    apps/api/src/services/projectConversion.ts
  </files>
  <action>
Update convertEstimateToProject function to return projectSlug for frontend navigation:

1. After line 62 (before transaction), query project to get slug:
```typescript
// 4. Get project slug for navigation
const [project] = await db
  .select({ slug: schema.projects.slug })
  .from(schema.projects)
  .where(eq(schema.projects.id, estimate.projectId))
  .limit(1);

if (!project || !project.slug) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Project slug not found",
  });
}
```

2. Update return statement (line 94-97) to include projectSlug:
```typescript
return {
  projectId: estimate.projectId,
  projectSlug: project.slug,  // ADD THIS
  budgetLineItemsCreated: budgetLineItems.length,
};
```

This ensures ConvertToProjectButton receives slug for navigation, fixing E2E Flow #1.
  </action>
  <verify>
```bash
# Verify project slug is queried
grep "slug: schema.projects.slug" apps/api/src/services/projectConversion.ts

# Verify projectSlug is returned
grep "projectSlug: project.slug" apps/api/src/services/projectConversion.ts
```
  </verify>
  <done>
convertEstimateToProject service returns projectSlug in response alongside projectId and budgetLineItemsCreated
  </done>
</task>

<task type="auto">
  <name>Update ConvertToProjectButton to use projectSlug</name>
  <files>
    apps/web/components/estimates/actions/ConvertToProjectButton.tsx
  </files>
  <action>
Update ConvertToProjectButton to navigate using projectSlug from mutation response:

1. Remove `projectId` prop (line 11) - no longer needed for navigation:
```typescript
interface ConvertToProjectButtonProps {
  estimateId: string;
  // REMOVE: projectId: string;
  onSuccess?: () => void;
  variant?: ButtonProps["variant"];
}
```

2. Remove `projectId` from props destructuring (line 16-21):
```typescript
export function ConvertToProjectButton({
  estimateId,
  // REMOVE: projectId,
  onSuccess,
  variant = "default"
}: ConvertToProjectButtonProps) {
```

3. Update onSuccess handler (line 25-29) to use `data.projectSlug`:
```typescript
onSuccess: (data) => {
  toast.success(`Project activated with ${data.budgetLineItemsCreated} budget line items`);
  onSuccess?.();
  // Navigate to project budget page using slug
  router.push(`/projects/${data.projectSlug}/budget`);  // CHANGE from projectId to data.projectSlug
},
```

This ensures navigation goes to `/projects/{slug}/budget` instead of `/projects/{uuid}/budget`, completing the fix for E2E Flow #1.

Note: Any components using ConvertToProjectButton will need `projectId` prop removed in their usage (to be handled separately if found).
  </action>
  <verify>
```bash
# Verify projectId prop removed from interface
grep -v "projectId.*string" apps/web/components/estimates/actions/ConvertToProjectButton.tsx

# Verify navigation uses data.projectSlug
grep 'router.push.*data.projectSlug' apps/web/components/estimates/actions/ConvertToProjectButton.tsx
```
  </verify>
  <done>
ConvertToProjectButton navigates using projectSlug from mutation response, no longer accepts projectId prop
  </done>
</task>

</tasks>

<verification>
Run global search and verify results contain slug-based URLs:
1. Start dev server and sign in
2. Open command palette (⌘K)
3. Search for a project
4. Click result - should navigate to `/projects/{slug}` not `/projects/{uuid}`

Test estimate conversion flow:
1. Navigate to estimate detail page
2. Click "Convert to Project" button
3. Should navigate to `/projects/{slug}/budget` not `/projects/{uuid}/budget`
</verification>

<success_criteria>
- Global search returns project URLs in format `/projects/{slug}`
- ConvertToProjectButton navigates to `/projects/{slug}/budget` after successful conversion
- No 404 errors occur in either E2E flow
- All changes use existing slug utilities (no new slug generation logic)
</success_criteria>

<output>
After completion, create `.planning/quick/16-slug-routing-hotfixes/16-SUMMARY.md`
</output>
