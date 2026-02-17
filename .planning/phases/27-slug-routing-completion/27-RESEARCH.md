# Phase 27: Slug Routing Completion - Research

**Researched:** 2026-02-17
**Domain:** Next.js App Router slug-based routing, tRPC slug procedures, Drizzle schema
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLUG-01 | Customer detail page is accessible via slug-based URL (e.g., /customers/abc-construction) | Directory `/customers/[customerSlug]/` exists; `customer.getBySlug` tRPC procedure is fully implemented; list page navigates via `customer.slug` |
| SLUG-02 | Customer edit page uses slug-based URL | Edit is a Dialog on the list page — no separate `/edit` route exists. Assessment: the success criteria says "saving or navigating away preserves the slug URL pattern," which is met if the edit dialog stays on the slug-based detail page. A dedicated `/customers/[customerSlug]/edit/page.tsx` may or may not be needed. |
| SLUG-03 | Subcontractor detail page uses slug-based URL (e.g., /subcontractors/smith-plumbing) | Directory `/subcontractors/[subcontractorSlug]/` exists; `subcontractor.getBySlug` is fully implemented; list page navigates via `sub.slug` |
| SLUG-04 | Subcontractor edit page uses slug-based URL | Edit is an inline Dialog on the detail page — same assessment as SLUG-02. The URL stays at `/subcontractors/[subcontractorSlug]` during edit. |
</phase_requirements>

---

## Summary

**The slug routing infrastructure is already substantially complete.** Both the database schema (slug columns), tRPC backend (getBySlug procedures), and frontend route directories (`[customerSlug]`, `[subcontractorSlug]`) exist and are wired together. This phase is about verifying and fixing remaining gaps — not building slug routing from scratch.

The primary gap found in the codebase is a UUID-based link in `project-header.tsx` (line 105) that links to `/customers/${project.customerId}` instead of using the customer's slug. The project overview page at `/projects/[projectSlug]/page.tsx` (line 586) already uses `project.customer.slug || project.customer.id` as a fallback. The project-header does not receive the customer slug at all — its `ProjectHeaderProps` interface only has `customerId`, not `customerSlug`.

**The edit requirements (SLUG-02, SLUG-04) are already behaviorally satisfied.** Customers edit via a Dialog on the list page at `/customers`; the URL does not change to a UUID. Subcontractors edit via a Dialog on the detail page at `/subcontractors/[subcontractorSlug]`; the URL stays slug-based throughout editing. No separate `/edit` route is needed unless the requirements specifically demand a dedicated edit URL.

**Primary recommendation:** Fix the project-header UUID customer link, verify slug generation for existing records (legacy data may have null slugs), and confirm both edit dialogs stay on slug-based URLs during save.

---

## Current State Assessment

### What Is Already Done (HIGH confidence — verified by reading source files)

| Component | Status | Evidence |
|-----------|--------|----------|
| `customers.slug` DB column | DONE | `tenant.ts` line 130: `slug: text("slug").unique()` |
| `subcontractorDirectory.slug` DB column | DONE | `tenant.ts` line 687: `slug: text("slug").unique()` |
| `customer.getBySlug` tRPC procedure | DONE | `customer.ts` lines 134-177 |
| `subcontractor.getBySlug` tRPC procedure | DONE | `subcontractor.ts` lines 228-302 |
| Customer slug generation on create | DONE | `customer.ts` lines 214-215: `generateSlug("cust-${id.slice(0,8)}", name)` |
| Customer slug regeneration on update | DONE | `customer.ts` lines 288-293 |
| Sub slug generation on create | DONE | `subcontractor.ts` line 66: `generateSlug("sub-${id.slice(0,8)}", companyName)` |
| Sub slug regeneration on update | DONE | `subcontractor.ts` lines 384-385 |
| `[customerSlug]` route directory | DONE | `apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx` |
| `[subcontractorSlug]` route directory | DONE | `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` |
| Customer detail page calls `getBySlug` | DONE | `customers/[customerSlug]/page.tsx` line 25 |
| Sub detail page calls `getBySlug` | DONE | `subcontractors/[subcontractorSlug]/page.tsx` line 41-43 |
| Customer list navigates by slug | DONE | `customers/page.tsx` line 259: `router.push("/customers/${customer.slug}")` |
| Sub list navigates by slug | DONE | `subcontractors/page.tsx` line 174: `router.push("/subcontractors/${sub.slug}")` |

### What Still Needs Fixing (HIGH confidence — verified by reading source files)

| Issue | File | Line | Problem | Fix |
|-------|------|------|---------|-----|
| UUID-based customer link | `project-header.tsx` | 105 | `href="/customers/${project.customerId}"` uses UUID | Change to use customer slug |
| Missing `customerSlug` in ProjectHeaderProps | `project-header.tsx` | 17-33 | Interface has `customerId` but no `customerSlug` | Add `customerSlug?: string | null` to interface |
| ProjectLayout does not pass customerSlug | `[projectSlug]/layout.tsx` | 63-82 | `ProjectHeader` is called with `customerId` but customer slug not passed | Pass customer slug from `project.customer.slug` |

### Slug Fallback Risk (MEDIUM confidence)

The project overview page at `/projects/[projectSlug]/page.tsx` line 586 uses:
```tsx
<Link href={`/customers/${project.customer.slug || project.customer.id}`}>
```
This fallback to UUID means if a customer has no slug (legacy record), the link breaks. This is a pre-existing risk to document, not a new problem to solve in this phase.

---

## Architecture Patterns

### Reference Implementation: Project Slug Routing

The project slug routing (completed in Phase 16) is the established pattern:

```
apps/web/app/(dashboard)/projects/
├── page.tsx                 # List — navigates via project.slug
├── new/page.tsx             # Create form
└── [projectSlug]/
    ├── layout.tsx           # Fetches project by slug, renders header+tabs, passes slug to children
    ├── page.tsx             # Overview — uses params.projectSlug
    ├── edit/page.tsx        # Edit page — uses params.projectSlug
    └── components/
        ├── project-header.tsx
        └── project-tabs.tsx
```

### Customer Current Pattern

```
apps/web/app/(dashboard)/customers/
├── page.tsx                 # List + edit dialog (inline, no separate edit route)
└── [customerSlug]/
    └── page.tsx             # Detail — calls trpc.customer.getBySlug({ slug: customerSlug })
```

**Customers use modal edit on the list page.** The edit button on the list page opens a Dialog. The URL during editing is `/customers` — which is fine since edit was never at a customer-specific URL. SLUG-02 success criteria says "saving or navigating away preserves the slug URL pattern." Since the detail page at `/customers/[customerSlug]` is already slug-based, and editing via a dialog there would preserve the slug URL, the only gap is whether there should be a dedicated edit route.

### Subcontractor Current Pattern

```
apps/web/app/(dashboard)/subcontractors/
├── page.tsx                 # List — navigates via sub.slug
├── new/page.tsx             # Create form (separate page)
└── [subcontractorSlug]/
    └── page.tsx             # Detail + inline Edit Dialog
```

**Subcontractors use modal edit on the detail page.** When the "Edit" button is clicked, a Dialog opens at URL `/subcontractors/[subcontractorSlug]`. The URL never becomes UUID-based. SLUG-04 is behaviorally satisfied.

### Slug Generation Pattern (Backend)

Both customer and subcontractor routers use `generateSlug` from `apps/api/src/utils/slug.ts`:

```typescript
// Source: apps/api/src/utils/slug.ts
import slug from "slug";

export function generateSlug(identifier: string, name: string): string {
  const slugIdentifier = slug(identifier, { lower: true });
  const slugName = slug(name, { lower: true });
  return `${slugIdentifier}-${slugName}`;
}

// Customer: "cust-{first8charsOfId}" + companyName/contactName
// Result: "cust-a1b2c3d4-abc-construction"

// Subcontractor: "sub-{first8charsOfId}" + companyName
// Result: "sub-a1b2c3d4-smith-plumbing"
```

### isValidSlug Validation

Both `customer.getBySlug` and `subcontractor.getBySlug` validate the slug before querying:

```typescript
// Source: apps/api/src/utils/slug.ts
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
```

---

## Common Pitfalls

### Pitfall 1: Legacy Records with Null Slugs

**What goes wrong:** Customers or subcontractors created before slug generation was implemented may have `null` slugs. Navigating to their detail page via slug would fail (no slug to navigate with).
**Why it happens:** The `create` mutation was updated to generate slugs, but old records remain `null`.
**How to avoid:** The list page uses `customer.slug` directly for navigation — if slug is null, `router.push("/customers/null")` would be called. Check if any records have null slugs and whether a data migration was run.
**Warning signs:** Detail page shows "Customer not found" for some records but not others; list page navigates to `/customers/null`.

### Pitfall 2: Slug Regeneration on Name Update Breaks Bookmarked URLs

**What goes wrong:** When a customer/sub company name is updated, the slug is regenerated. Any bookmarked URL or external link using the old slug breaks.
**Why it happens:** The slug includes the company name: `cust-a1b2c3d4-old-company-name` → `cust-a1b2c3d4-new-company-name`.
**How to avoid:** This is accepted behavior documented in the codebase. The `id` prefix (`cust-{8 chars}`) ensures the slug remains unique. No redirect is implemented — this is by design.
**Warning signs:** After renaming a customer, the old URL returns 404.

### Pitfall 3: ProjectHeader UUID Customer Link

**What goes wrong:** The project detail header shows a link to the customer that uses `project.customerId` (UUID), navigating to `/customers/{uuid}` which has no matching route under `[customerSlug]`.
**Why it happens:** `ProjectHeaderProps` interface was built before slug routing and only receives `customerId`.
**How to avoid:** Pass `customerSlug` from `project.customer.slug` through `ProjectLayout` to `ProjectHeader`.
**Warning signs:** Clicking "View Customer" on a project detail page results in a 404 or blank page.

### Pitfall 4: SubcontractorForm Does Not Navigate to Slug URL After Create

**What goes wrong:** After creating a new subcontractor via `/subcontractors/new`, `SubcontractorForm` redirects to `/subcontractors` (the list) if no `onSuccess` is provided.
**Why it happens:** The form falls back to `router.push("/subcontractors")` on success without `onSuccess` callback.
**Current behavior:** Create navigates to list (acceptable). The requirement is that DETAIL and EDIT pages use slug URLs — which they already do.
**Warning signs:** After create, user expects to land on the new subcontractor's detail page but instead sees the list.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug generation | Custom regex/toLowerCase logic | `generateSlug()` from `apps/api/src/utils/slug.ts` | Already handles edge cases, uses `slug` npm package |
| Slug validation | Custom regex | `isValidSlug()` from `apps/api/src/utils/slug.ts` | Consistent with what the tRPC procedures expect |
| Lookup by slug | Custom query | `trpc.customer.getBySlug` / `trpc.subcontractor.getBySlug` | Already implemented and tested |

---

## Code Examples

### Verified: Customer Detail Page (slug routing already working)

```typescript
// Source: apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx
export default function CustomerDetailPage({
  params,
}: {
  params: { customerSlug: string };
}) {
  const { customerSlug } = params;
  const { data: customer, isLoading } = trpc.customer.getBySlug.useQuery({ slug: customerSlug });
  // ...
}
```

### Verified: Subcontractor Detail Page (slug routing already working)

```typescript
// Source: apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx
export default function SubcontractorDetailPage({ params }: { params: { subcontractorSlug: string } }) {
  const { data: subcontractor, isLoading } = trpc.subcontractor.getBySlug.useQuery({
    slug: params.subcontractorSlug,
  });
  // Edit Dialog updates subcontractor via trpc.subcontractor.update.useMutation
  // URL stays at /subcontractors/[subcontractorSlug] throughout editing
}
```

### Fix Needed: ProjectHeader UUID Link

```typescript
// CURRENT (broken — uses UUID): apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx line 105
href={`/customers/${project.customerId}`}

// FIXED (use slug from customer object):
href={`/customers/${project.customerSlug || project.customerId}`}
// Requires adding customerSlug to ProjectHeaderProps interface
// Requires passing project.customer?.slug from layout.tsx
```

### Fix Needed: ProjectLayout — Pass customerSlug to ProjectHeader

```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
// project.customer is fetched with full select() including slug column
<ProjectHeader
  project={{
    id: project.id,
    // ... existing fields ...
    customerId: project.customerId,
    customerSlug: project.customer?.slug ?? null,  // ADD THIS
    customerName: project.customer?.companyName || project.customer?.contactName || null,
  }}
/>
```

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| `/projects/[projectId]` UUID route | `/projects/[projectSlug]` human-readable route | Done (Phase 16) |
| `/customers/[customerId]` UUID route | `/customers/[customerSlug]` human-readable route | Route exists, mostly working |
| `/subcontractors/[subcontractorId]` | `/subcontractors/[subcontractorSlug]` | Route exists, mostly working |
| Customer link using `customerId` | Customer link using customer slug | Still uses UUID in project-header.tsx |

---

## Open Questions

1. **Do any existing customer/subcontractor records have null slugs?**
   - What we know: Slug generation was added to create/update mutations. Records created before this change may have null slugs.
   - What's unclear: When slug generation was added relative to production data. `verify-slug-migration.ts` and `verify-slugs.ts` files exist in the repo root — they may have been used to backfill slugs.
   - Recommendation: Run a quick query against the DB to count records with null slugs before planning. If null-slug records exist, the plan needs a data migration task.

2. **Should customer edit have a dedicated `/customers/[customerSlug]/edit` route?**
   - What we know: Currently, customer edit is a Dialog on the list page at `/customers`. Subcontractor edit is a Dialog on the detail page at `/subcontractors/[slug]`.
   - What's unclear: SLUG-02 says "editing a customer uses a slug-based URL." Currently editing happens at `/customers` (list) not at `/customers/[slug]`. Depends on interpretation.
   - Recommendation: Move the edit dialog to the customer detail page (modal at `/customers/[customerSlug]`), matching the subcontractor pattern. This satisfies the letter of SLUG-02 without needing a dedicated `/edit` route.

3. **Post-edit navigation when slug changes**
   - What we know: If a customer's name changes, their slug changes. The subcontractor detail page invalidates `getBySlug` with the OLD slug after an update mutation.
   - What's unclear: If the slug regenerates on name update, the query for the old slug will return nothing on next render.
   - Recommendation: After a successful edit that changes the slug, navigate to the new slug URL using `router.replace("/customers/${updatedCustomer.slug}")`. The `update` mutation returns the updated record with the new slug.

---

## Sources

### Primary (HIGH confidence)

- `apps/api/src/db/schema/tenant.ts` — Verified slug columns on customers (line 130) and subcontractorDirectory (line 687)
- `apps/api/src/trpc/routers/customer.ts` — Verified getBySlug (lines 134-177), slug generation on create (lines 214-215) and update (lines 288-293)
- `apps/api/src/trpc/routers/subcontractor.ts` — Verified getBySlug (lines 228-302), slug generation on create (line 66) and update (lines 384-385)
- `apps/api/src/utils/slug.ts` — Verified generateSlug, isValidSlug, generateProjectSlug implementations
- `apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx` — Verified uses trpc.customer.getBySlug
- `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` — Verified uses trpc.subcontractor.getBySlug, inline edit dialog
- `apps/web/app/(dashboard)/customers/page.tsx` — Verified navigates by customer.slug, edit is dialog on list page
- `apps/web/app/(dashboard)/subcontractors/page.tsx` — Verified navigates by sub.slug
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — Verified UUID customer link at line 105
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` — Verified ProjectHeader called without customerSlug

---

## Metadata

**Confidence breakdown:**
- Schema state: HIGH — Read source files directly
- tRPC procedures: HIGH — Read source files directly
- Frontend route state: HIGH — Read source files directly
- Remaining gaps: HIGH — Found via grep across entire web app
- Legacy null-slug risk: MEDIUM — Files suggest migration was run but not verified against live DB

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable codebase, no external dependencies)
