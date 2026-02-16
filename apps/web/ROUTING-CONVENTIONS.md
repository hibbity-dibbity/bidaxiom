# Routing Conventions

This document defines URL structure, routing patterns, and navigation conventions for the Next.js web app.

## URL Hygiene Standards

All user-facing entity URLs use slug-based routing:

| Entity | URL Pattern | Example |
|--------|-------------|---------|
| Project | `/projects/[jobNumber]-[name]` | `/projects/24001-main-street-renovation` |
| Customer | `/customers/cust-[id]-[name]` | `/customers/cust-12345678-abc-construction` |
| Subcontractor | `/subcontractors/sub-[id]-[name]` | `/subcontractors/sub-87654321-acme-hvac` |
| Estimate | `/estimates/est-[jobNumber]-[name]` | `/estimates/est-24001-main-street-estimate` |

### Benefits

- **Bookmarkable:** Users can save and share meaningful links
- **SEO-friendly:** Descriptive URLs improve search rankings
- **Self-documenting:** Job number + name visible in URL
- **User-readable:** No UUIDs in user-facing URLs

## Slug Generation

Centralized in `apps/api/src/utils/slug.ts`:

```typescript
import { generateSlug } from "@/utils/slug";

const slug = generateSlug(identifier, name);
// "24001", "Main Street Renovation" → "24001-main-street-renovation"
```

**Rules:**
- Lowercase only
- Hyphens for spaces
- No special characters
- Unique per tenant schema

**Entity-specific patterns:**
```typescript
// Projects (backward compatibility wrapper)
generateProjectSlug(jobNumber, projectName)
// → "24001-main-street-renovation"

// Customers
generateSlug(`cust-${id.slice(0,8)}`, name)
// → "cust-a5520c49-abc-construction"

// Subcontractors
generateSlug(`sub-${id.slice(0,8)}`, companyName)
// → "sub-b2b1fc58-acme-hvac"

// Estimates
generateSlug(`est-${jobNumber}`, name)
// → "est-24001-option-1"
```

## Dynamic Route Patterns

### Persistent Headers with Layout

For entity detail pages with persistent headers (project, customer, etc.):

```
[entitySlug]/
  ├── layout.tsx      # Persistent header + tabs
  ├── page.tsx        # Default tab (overview)
  ├── budget/
  │   └── page.tsx    # Budget tab
  └── documents/
      └── page.tsx    # Documents tab
```

**Layout.tsx:**
```typescript
export default function EntityLayout({ children, params }) {
  const { data: entity } = trpc.entity.getBySlug.useQuery({
    slug: params.entitySlug,
  });

  return (
    <div>
      <EntityHeader entity={entity} />  {/* Never reloads */}
      <EntityTabs entitySlug={params.entitySlug} />  {/* Never reloads */}
      <div>{children}</div>  {/* page.tsx renders here */}
    </div>
  );
}
```

**Example:** Project detail page at `/projects/24001-renovation`
- Layout queries project once via `getBySlug({ slug: "24001-renovation" })`
- Header displays project name, status, job number
- Tabs navigate between Overview, Budget, Documents, Team
- Tab changes only re-render `{children}`, header stays mounted

## Prefetching Strategy

### Hover Prefetch (Recommended)

Prefetch data when user hovers over link:

```typescript
const utils = trpc.useUtils();

const prefetchBudget = () => {
  utils.budget.getProjectSummary.prefetch({ projectId });
};

<Link
  href="/projects/24001-renovation/budget"
  scroll={false}
  onMouseEnter={prefetchBudget}
>
  Budget
</Link>
```

**Benefits:**
- Only prefetches likely navigation
- Navigation feels instant when user clicks
- Reduces unnecessary data fetching

**When to use:**
- Tab navigation (user actively considering which tab to view)
- List item links (hovering indicates interest)
- Navigation menu items (mouse hover indicates intent)

### Viewport Prefetch (Avoid)

Do NOT rely on viewport prefetch alone - it prefetches all visible links:
- Wastes bandwidth
- Increases server load
- Prefetches unlikely navigation

**Next.js default behavior:** All `<Link>` components prefetch when visible in viewport. This is fine for small apps, but in data-heavy construction apps, selective hover prefetch is preferred.

## Scroll Restoration

### List Pages

Remember scroll position when navigating back:

```typescript
useEffect(() => {
  const savedScroll = sessionStorage.getItem('projectListScroll');
  if (savedScroll) {
    window.scrollTo(0, parseInt(savedScroll));
  }
}, []);

// Save on navigation away
const handleProjectClick = (slug: string) => {
  sessionStorage.setItem('projectListScroll', window.scrollY.toString());
  router.push(`/projects/${slug}`);
};
```

### Detail Pages

Reset scroll to top when navigating to detail:

```typescript
<Link href={`/projects/${project.slug}`} scroll={true}>
  {project.name}
</Link>
```

### Tab Navigation

Maintain scroll when switching tabs:

```typescript
<Link href={`/projects/${slug}/budget`} scroll={false}>
  Budget
</Link>
```

**Scroll parameter guide:**
- `scroll={true}` → Scroll to top (detail page navigation)
- `scroll={false}` → Maintain scroll (tab navigation, same-page updates)
- `scroll={undefined}` → Next.js default behavior (usually scrolls to top)

## Migration from UUID Routes

When migrating from UUID to slug routes:

1. **Add slug column with migration script**
   ```typescript
   // apps/api/src/db/migrations/add-entity-slugs.ts
   await db.schema
     .alterTable('entities')
     .addColumn('slug', 'text', (col) => col.unique())
     .execute();

   // Populate slugs for existing records
   const entities = await db.selectFrom('entities').selectAll().execute();
   for (const entity of entities) {
     const slug = generateSlug(entity.identifier, entity.name);
     await db.updateTable('entities')
       .set({ slug })
       .where('id', '=', entity.id)
       .execute();
   }
   ```

2. **Create slug-based routes ([entitySlug])**
   ```
   app/(dashboard)/entities/
   ├── [entityId]/         # Old UUID route (keep temporarily)
   │   └── page.tsx        # Redirects to slug route
   └── [entitySlug]/       # New slug route
       └── page.tsx        # Main detail page
   ```

3. **Add redirect from old UUID route:**
   ```typescript
   // Old route: [entityId]/page.tsx
   export default async function EntityRedirect({ params }: { params: { entityId: string } }) {
     const entity = await trpc.entity.getById.query({ id: params.entityId });

     if (entity?.slug) {
       redirect(`/entities/${entity.slug}`);
     }

     notFound();
   }
   ```

4. **Update all internal links to use slugs**
   ```typescript
   // Before
   <Link href={`/projects/${project.id}`}>{project.name}</Link>

   // After
   <Link href={`/projects/${project.slug}`}>{project.name}</Link>
   ```

5. **Remove old routes after transition period** (3-6 months for external bookmarks to update)

## Real-World Examples from Phase 19

### Project Slug Migration (Phase 16)

**Before:** `/projects/a1b2c3d4-e5f6-7890-1234-567890abcdef`
**After:** `/projects/24001-main-street-renovation`

**Implementation:**
- Migration added `slug` column to projects table
- `generateProjectSlug(jobNumber, projectName)` utility created
- Layout.tsx queries via `getBySlug` procedure
- Hover prefetch on project list items
- Tab navigation uses `scroll={false}`

**Result:** URLs are bookmarkable, self-documenting, and instantly recognizable.

### Customer, Subcontractor, Estimate Slugs (Phase 19 Plan 04)

**Patterns established:**
- Customers: `cust-{uuid8}-{name}` → `/customers/cust-a5520c49-abc-construction`
- Subcontractors: `sub-{uuid8}-{companyName}` → `/subcontractors/sub-b2b1fc58-acme-hvac`
- Estimates: `est-{jobNumber}-{name}` → `/estimates/est-24001-option-1`

**Backend complete:**
- Slug utilities support all entity types
- tRPC `getBySlug` procedures added
- Database unique constraints prevent collisions
- Automatic slug generation on create/update

**Frontend migration:** Pending (backend foundation complete, frontend routes still use UUID patterns)

### Hover Prefetch Pattern (Phase 16)

**Project overview tabs:**
```typescript
// apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
const utils = trpc.useUtils();

const tabs = [
  { name: 'Overview', href: '', prefetch: () => utils.project.getBySlug.prefetch({ slug }) },
  { name: 'Budget', href: '/budget', prefetch: () => utils.budget.getProjectSummary.prefetch({ projectId }) },
  { name: 'Documents', href: '/documents', prefetch: () => utils.document.listByProject.prefetch({ projectId }) },
];

{tabs.map(tab => (
  <Link
    href={`/projects/${slug}${tab.href}`}
    scroll={false}
    onMouseEnter={tab.prefetch}
  >
    {tab.name}
  </Link>
))}
```

**Result:** Instant perceived navigation, no loading spinners when clicking tabs after hover.

## Performance Considerations

### Slug Parsing Performance

Slug parsing is fast (string operations only):

```typescript
export function parseSlug(slug: string): string {
  const parts = slug.split('-');

  // Numeric identifier (job number)
  if (/^\d+$/.test(parts[0])) {
    return parts[0];
  }

  // Prefixed identifier (cust-*, sub-*, est-*)
  if (parts.length >= 2 && /^[a-z]+$/.test(parts[0])) {
    return parts[1]; // Extract ID portion
  }

  return slug;
}
```

**Cost:** O(n) where n = slug length (typically 30-50 chars). Negligible overhead.

### Database Lookups

Slug column has unique index for fast lookups:

```sql
-- Equivalent performance to UUID lookup
SELECT * FROM projects WHERE slug = '24001-main-street-renovation';
SELECT * FROM projects WHERE id = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
```

Both use indexed lookups, similar query plan and execution time.

## References

- Slug utilities: `apps/api/src/utils/slug.ts`
- Migration script: `apps/api/src/db/migrations/add-entity-slugs.ts`
- Research: `.planning/phases/19-component-library-architecture/19-RESEARCH.md`
- Phase 19 Plan 04 Summary: `.planning/phases/19-component-library-architecture/19-04-SUMMARY.md`
