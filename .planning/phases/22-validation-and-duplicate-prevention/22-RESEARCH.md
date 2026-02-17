# Phase 22: Validation & Duplicate Prevention - Research

**Researched:** 2026-02-16
**Domain:** React Hook Form blur validation, tRPC imperative queries, case-insensitive DB queries, shared package exports
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase Boundary**
When a user manually enters a job number (on new project creation or project edit), the system validates it for format compliance and uniqueness. Validation blocks submission on failure. This phase covers the project creation form and the project edit form only.

**Duplicate resolution UX**
- Show inline error under the job number field — not a toast
- Error text: "[number] is already assigned to [Project Name] →" — clickable link opens the existing project in a **new tab**
- Duplicate check fires **on blur** (when user leaves the field)
- **Hard block**: duplicate detected = form submission disabled until resolved
- Check is **case-insensitive** ("ABC-001" and "abc-001" treated as the same)
- Duplicate validation applies to **both new project form and edit project form**

**Format validation scope**
- Format validation only applies **when auto-gen is enabled**
- When auto-gen is disabled: no format enforcement
- **Hard block**: format mismatch prevents form submission
- Error message: generic — "Job number doesn't match the required format"
- Format validation triggers **on blur**, same as duplicate checking

**Validation ordering**
- Both checks fire on blur
- Format checked first; if it passes, then duplicate checked
- On submit: re-run both validations as a safety net

### Claude's Discretion
- Loading/pending state while async duplicate check is in-flight
- Exact field error styling
- Debounce timing for blur-triggered API calls

### Deferred Ideas (OUT OF SCOPE)
None documented.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| JOBVAL-01 | System prevents duplicate job numbers across all projects | `checkJobNumberAvailability` tRPC query exists (Phase 21); needs case-insensitive fix (`ilike`) and project name return; `excludeProjectId` needed for edit form self-exclusion; frontend hard-blocks submit on duplicate |
| JOBVAL-02 | System validates job number format matches configured pattern | `validateJobNumberFormat()` in `apps/api/src/utils/job-number.ts` must be exported from `@construction/shared` before web can use it client-side; function has no server-only deps |
| JOBVAL-03 | Clear error messages when job number validation fails | React Hook Form `form.setError("jobNumber", ...)` + inline `FormMessage` renders error; duplicate error stores project name+slug in state to render clickable link |
</phase_requirements>

---

## Summary

Phase 21 built all the backend foundation: `checkJobNumberAvailability` query in `company.ts`, `validateJobNumberFormat()` and `parseTemplatePattern()` utilities in `job-number.ts`. This phase is primarily frontend integration work with three targeted API/package changes.

**Three required non-frontend changes discovered:**
1. `checkJobNumberAvailability` in `company.ts` uses `eq()` (exact match) — must be changed to `ilike()` for case-insensitive comparison, must return project `name` + `slug`, and must accept `excludeProjectId` parameter for the edit form self-exclusion case.
2. `validateJobNumberFormat()` exists in `apps/api/src/utils/job-number.ts` but is NOT exported from `@construction/shared` — the web client cannot import it. It must be added to the shared package exports. (The function has zero server-only dependencies; it is a pure regex function.)
3. The edit project page at `/projects/[slug]/edit` does not exist. The project header links to it but the route 404s. The edit project dialog state (`editProjectOpen`, `editJobNumber`) exists in the overview page but the dialog itself is NOT rendered in `page.tsx` (confirmed by reading to line 919 — only InviteUser dialog is at the bottom). Phase 22 must create the edit page.

**Primary recommendation:** Create the edit project page; export `validateJobNumberFormat` from shared; fix `checkJobNumberAvailability`; wire blur handlers in both forms using `form.setError()` + `utils.company.checkJobNumberAvailability.fetch()`.

---

## Standard Stack

### Core (All Already Installed — No New Dependencies)

| Library | Version | Purpose | Status in Codebase |
|---------|---------|---------|---------------------|
| react-hook-form | ^7.71.1 | Form state, `setError`, `clearErrors`, `handleSubmit` | In use in `project-form.tsx` |
| @hookform/resolvers | ^5.2.2 | Zod schema resolver (already wired) | In use |
| zod | ^3.25.76 | Schema validation | In use |
| @trpc/react-query | ^11.10.0 | `useUtils()` for imperative `fetch()` | In use in multiple components |
| @tanstack/react-query | ^5.90.21 | Underlying query layer | In use |
| use-debounce | ^10.1.0 | Optional — for onChange typing; NOT needed for blur handlers | Installed, unused in forms |
| drizzle-orm (API) | current | `ilike()`, `ne()`, `and()` for case-insensitive query | `ilike` already imported in `search.ts` |

**No new packages needed.** `use-debounce` is available but not required for blur-triggered validation (blur is already a natural debounce point).

---

## Architecture Patterns

### File Changes Required

```
apps/
├── api/src/trpc/routers/
│   └── company.ts                       # MODIFY: ilike, return name+slug, add excludeProjectId
├── web/components/project/
│   └── project-form.tsx                 # MODIFY: add blur validation hooks
└── web/app/(dashboard)/projects/[projectSlug]/
    └── edit/
        └── page.tsx                     # CREATE: edit project page with blur validation
packages/
└── shared/src/
    ├── index.ts                         # MODIFY: export validateJobNumberFormat, parseTemplatePattern
    └── types/
        └── company.ts                   # MODIFY: add validateJobNumberFormat + parseTemplatePattern
                                         #         (or create new job-number.ts in shared/src/utils/)
```

### Pattern 1: Blur-Triggered Async Validation with React Hook Form

**What:** `onBlur` on the job number Input runs (1) synchronous format check, then (2) async duplicate check via `utils.company.checkJobNumberAvailability.fetch()`. Uses `form.setError()` to inject errors.

**When to use:** Any field needing async server validation without blocking typing.

```typescript
// Source: React Hook Form v7 + tRPC useUtils pattern from codebase
const utils = trpc.useUtils();
const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
const [duplicateProject, setDuplicateProject] = useState<{
  name: string;
  slug: string;
} | null>(null);

const handleJobNumberBlur = async (value: string) => {
  // Clear any previous duplicate state
  setDuplicateProject(null);

  if (!value) {
    form.clearErrors("jobNumber");
    return;
  }

  // Step 1: Format check (synchronous, only when auto-gen is enabled)
  if (jobNumberSettings?.enabled) {
    const formatOk = validateJobNumberFormat(value, jobNumberSettings.template);
    if (!formatOk) {
      form.setError("jobNumber", {
        type: "manual",
        message: "Job number doesn't match the required format",
      });
      return; // Stop — don't run duplicate check
    }
  }

  // Step 2: Duplicate check (async)
  form.clearErrors("jobNumber");
  setIsCheckingDuplicate(true);
  try {
    const result = await utils.company.checkJobNumberAvailability.fetch({
      jobNumber: value,
      excludeProjectId: currentProjectId ?? undefined, // undefined for new, project.id for edit
    });
    if (!result.available && result.existingProjectName && result.existingProjectSlug) {
      setDuplicateProject({
        name: result.existingProjectName,
        slug: result.existingProjectSlug,
      });
      // Set an error to mark field invalid (message empty — UI rendered separately)
      form.setError("jobNumber", { type: "manual", message: " " });
    } else {
      form.clearErrors("jobNumber");
    }
  } catch {
    // Don't block the user on network error — let submit-time re-check catch it
  } finally {
    setIsCheckingDuplicate(false);
  }
};
```

### Pattern 2: Duplicate Error Link Rendering in JSX

**What:** `FormMessage` only renders strings. The duplicate error requires a clickable link. Store duplicate info in state and render the link UI alongside `FormMessage` (which handles format errors).

```typescript
// In the FormField render function, after Input:
<FormControl>
  <Input
    {...field}
    value={field.value || ""}
    className={cn("font-mono", isCheckingDuplicate && "opacity-60")}
    onBlur={(e) => handleJobNumberBlur(e.target.value)}
    onChange={(e) => {
      field.onChange(e);
      // Clear duplicate state when user types
      if (duplicateProject) {
        setDuplicateProject(null);
        form.clearErrors("jobNumber");
      }
    }}
  />
</FormControl>

{/* Duplicate error with link — rendered when duplicate detected */}
{duplicateProject && (
  <p className="text-sm font-medium text-destructive mt-1.5">
    {form.getValues("jobNumber")} is already assigned to{" "}
    <Link
      href={`/projects/${duplicateProject.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:no-underline"
    >
      {duplicateProject.name} →
    </Link>
  </p>
)}

{/* Format errors from setError — only shows when no duplicate message */}
{!duplicateProject && <FormMessage />}

{/* Loading indicator */}
{isCheckingDuplicate && (
  <p className="text-xs text-muted-foreground mt-1">Checking availability...</p>
)}
```

### Pattern 3: Submit Guard Re-validation

**What:** Before calling the mutation, re-run both validations as a safety net.

```typescript
const onSubmit = async (values: ProjectFormValues) => {
  const jobNum = values.jobNumber;

  if (jobNum) {
    // Re-run format check
    if (jobNumberSettings?.enabled) {
      const formatOk = validateJobNumberFormat(jobNum, jobNumberSettings.template);
      if (!formatOk) {
        form.setError("jobNumber", {
          type: "manual",
          message: "Job number doesn't match the required format",
        });
        return;
      }
    }

    // Re-run duplicate check
    try {
      const result = await utils.company.checkJobNumberAvailability.fetch({
        jobNumber: jobNum,
        excludeProjectId: currentProjectId ?? undefined,
      });
      if (!result.available) {
        if (result.existingProjectName && result.existingProjectSlug) {
          setDuplicateProject({ name: result.existingProjectName, slug: result.existingProjectSlug });
        }
        form.setError("jobNumber", { type: "manual", message: " " });
        return;
      }
    } catch {
      // Proceed — server will enforce uniqueness at DB level
    }
  }

  createMutation.mutate(values); // or updateMutation
};
```

### Pattern 4: API Fix — checkJobNumberAvailability

**What:** Modify `checkJobNumberAvailability` in `apps/api/src/trpc/routers/company.ts`.

```typescript
// Source: drizzle-orm — ilike already used in apps/api/src/trpc/routers/search.ts
// Already imported: import { isNull, desc, eq } from "drizzle-orm";
// Add to imports: ilike, ne, and, SQL
import { isNull, desc, ilike, ne, and } from "drizzle-orm";

checkJobNumberAvailability: protectedProcedure
  .input(z.object({
    jobNumber: z.string().min(1),
    excludeProjectId: z.string().uuid().optional(),
  }))
  .query(async ({ ctx, input }) => {
    if (!ctx.tenant) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }

    const baseCondition = ilike(ctx.tenant.schema.projects.jobNumber, input.jobNumber);
    const whereClause = input.excludeProjectId
      ? and(baseCondition, ne(ctx.tenant.schema.projects.id, input.excludeProjectId))
      : baseCondition;

    const [existing] = await ctx.tenant.db
      .select({
        id: ctx.tenant.schema.projects.id,
        name: ctx.tenant.schema.projects.name,
        slug: ctx.tenant.schema.projects.slug,
      })
      .from(ctx.tenant.schema.projects)
      .where(whereClause)
      .limit(1);

    return {
      available: !existing,
      existingProjectId: existing?.id ?? null,
      existingProjectName: existing?.name ?? null,
      existingProjectSlug: existing?.slug ?? null,
    };
  }),
```

### Pattern 5: Export validateJobNumberFormat from Shared Package

**What:** Add `validateJobNumberFormat` and `parseTemplatePattern` to the shared package so the web client can use them. These functions are pure (no server deps — no DB, no Node APIs, just regex).

Option A (simpler): Copy the two functions into `packages/shared/src/types/company.ts` and export from `packages/shared/src/index.ts`.

Option B (cleaner): Create `packages/shared/src/utils/job-number.ts`, move both functions there, export from `index.ts`.

Recommended: Option A since `previewJobNumber` already lives in `company.ts` and these are all job-number utilities.

```typescript
// Add to packages/shared/src/index.ts:
export { validateJobNumberFormat, parseTemplatePattern } from "./types/company";

// Add to packages/shared/src/types/company.ts (copy from apps/api/src/utils/job-number.ts):
export function parseTemplatePattern(template: string): RegExp {
  let pattern = template
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\{YYYY\\}/g, "\\d{4}")
    .replace(/\\{YY\\}/g, "\\d{2}")
    .replace(/\\{MM\\}/g, "\\d{2}")
    .replace(/\\{DD\\}/g, "\\d{2}");

  const sequenceMatch = template.match(/\{(N+)\}/);
  if (sequenceMatch) {
    const length = sequenceMatch[1].length;
    pattern = pattern.replace(/\\{N+\\}/, `\\d{${length}}`);
  }
  return new RegExp(`^${pattern}$`);
}

export function validateJobNumberFormat(jobNumber: string, template: string): boolean {
  const pattern = parseTemplatePattern(template);
  return pattern.test(jobNumber);
}
```

### Pattern 6: Edit Project Page

**What:** Create the missing edit page that `project-header.tsx` already links to.

```
apps/web/app/(dashboard)/projects/[projectSlug]/edit/page.tsx
```

The edit page should:
- Fetch project by slug using `trpc.project.getBySlug.useQuery({ slug: projectSlug })`
- Pre-populate all fields including `jobNumber`
- Wire the same blur validation (with `excludeProjectId: project.id` passed to the availability check)
- Call `trpc.project.update.useMutation` on submit
- Redirect back to `/projects/${project.slug}` on success (slug may change if job number or name changed)

The overview page (`page.tsx`) has leftover `editProjectOpen`, `editJobNumber` state from an earlier implementation that was abandoned in favor of the `/edit` route approach. These can be cleaned up but are not blocking.

### Anti-Patterns to Avoid

- **`useQuery` with `enabled` for blur validation:** Leads to firing on every re-render where input has a value. Use `utils.procedure.fetch()` in an event handler instead.
- **`use-debounce` on blur:** Blur fires once per focus loss. No debounce needed. `use-debounce` is appropriate if implementing `onChange`-triggered checks (not the chosen pattern here).
- **Async Zod `.refine()` in `zodResolver`:** RHF's async validation via Zod refine is unreliable and fires on every validation cycle. Keep async validation in the blur handler.
- **`formState.isValid` for submit blocking:** `isValid` is unreliable with manually set errors in some RHF modes. Disable the submit button using `!!formState.errors.jobNumber || isCheckingDuplicate` or rely on the submit guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Case-insensitive SQL | Raw `sql\`LOWER(job_number) = LOWER(${val})\`` | `ilike()` from drizzle-orm | Already used in `search.ts`, cleaner, PostgreSQL-idiomatic |
| Field error rendering | Custom error `<p>` components | `form.setError()` + `<FormMessage />` (shadcn/ui) | Already wired in both forms |
| Imperative API call | Manual `fetch(url)` with auth header | `utils.company.checkJobNumberAvailability.fetch()` | Type-safe, automatically includes auth headers via tRPC client |
| Format regex building | New template-to-regex function | `validateJobNumberFormat()` + `parseTemplatePattern()` (from shared after export) | Already built and tested in Phase 21 |

---

## Common Pitfalls

### Pitfall 1: Edit Form Self-Duplicate Detection
**What goes wrong:** User opens edit form for project with job "ABC-001", submits without changing it. The availability check finds "ABC-001" and incorrectly reports it as a duplicate of itself.
**Why it happens:** Current query has no way to exclude the current project.
**How to avoid:** Pass `excludeProjectId: project.id` in all calls from the edit form. This is a **required API change** in this phase.
**Warning signs:** Edit form always shows "already assigned" for any project with a job number.

### Pitfall 2: `validateJobNumberFormat` Not Available on Client
**What goes wrong:** Developer imports `validateJobNumberFormat` from `@construction/shared` and gets a build error — it's not exported.
**Why it happens:** Phase 21 implemented this in the API utils, not in shared.
**How to avoid:** Add export to `packages/shared/src/types/company.ts` and `packages/shared/src/index.ts`. This is a **required package change** in this phase.
**Warning signs:** TypeScript error `Module '"@construction/shared"' has no exported member 'validateJobNumberFormat'`.

### Pitfall 3: Edit Page Doesn't Exist Yet
**What goes wrong:** Project header links to `/projects/${slug}/edit` which 404s.
**Why it happens:** No page exists at `apps/web/app/(dashboard)/projects/[projectSlug]/edit/page.tsx`.
**How to avoid:** Create the page. This is a **required creation task** in this phase.
**Warning signs:** Clicking "Edit Project" in the project header shows 404.

### Pitfall 4: `form.setError` with Whitespace-Only Message
**What goes wrong:** Setting `message: " "` to mark field invalid while rendering custom error UI works, but `FormMessage` may render a blank line of space.
**How to avoid:** Use `{!duplicateProject && <FormMessage />}` to conditionally render `FormMessage` only when showing format errors, not when showing the custom duplicate link.

### Pitfall 5: Race Condition on Slow Network
**What goes wrong:** User blurs, slow network, user changes field and blurs again. First response arrives after second request, overwrites correct result.
**Why it happens:** No request cancellation.
**How to avoid:** Capture the `value` at request start, compare with `form.getValues("jobNumber")` when response arrives. Only apply the result if the value matches:
```typescript
const valueAtCheck = value;
const result = await utils.company.checkJobNumberAvailability.fetch({ jobNumber: value });
if (form.getValues("jobNumber") !== valueAtCheck) return; // stale — discard
```

### Pitfall 6: Format Validation Only When Auto-Gen Enabled
**What goes wrong:** Developer applies format validation always, breaking workflows where auto-gen is disabled and users enter free-form job numbers.
**Why it happens:** Missing the conditional — format check is gated on `jobNumberSettings?.enabled`.
**How to avoid:** Always check `if (jobNumberSettings?.enabled)` before calling `validateJobNumberFormat`.

### Pitfall 7: Drizzle `and()` with Single Condition
**What goes wrong:** `and(singleCondition)` may or may not be supported depending on drizzle version. The API code should conditionally include `and()`.
**How to avoid:** Use `input.excludeProjectId ? and(cond1, cond2) : cond1` — already shown in Pattern 4 code.

---

## Code Examples

### Existing: checkJobNumberAvailability (Phase 21 state — needs modification)

```typescript
// Source: apps/api/src/trpc/routers/company.ts (current Phase 21 state)
// PROBLEMS: uses eq() (case-sensitive), no name/slug, no excludeProjectId
checkJobNumberAvailability: protectedProcedure
  .input(z.object({ jobNumber: z.string().min(1) }))
  .query(async ({ ctx, input }) => {
    const [existing] = await ctx.tenant.db
      .select({ id: ctx.tenant.schema.projects.id })
      .from(ctx.tenant.schema.projects)
      .where(eq(ctx.tenant.schema.projects.jobNumber, input.jobNumber))
      .limit(1);

    return {
      available: !existing,
      existingProjectId: existing?.id || null,
    };
  }),
```

### Existing: ilike usage (from search.ts — confirm the import pattern)

```typescript
// Source: apps/api/src/trpc/routers/search.ts lines 4, 32-33
import { ilike, or } from "drizzle-orm";
// ...
ilike(projects.name, searchPattern),
ilike(projects.jobNumber, searchPattern)
```

### Existing: validateJobNumberFormat (in API only — needs shared export)

```typescript
// Source: apps/api/src/utils/job-number.ts lines 96-102
export function validateJobNumberFormat(
  jobNumber: string,
  template: string
): boolean {
  const pattern = parseTemplatePattern(template);
  return pattern.test(jobNumber);
}
```

### Existing: previewJobNumber import in project-form.tsx

```typescript
// Source: apps/web/components/project/project-form.tsx line 7
import { createProjectSchema, DEFAULT_PROJECT_PHASES, previewJobNumber, createCustomerSchema } from "@construction/shared";
// After Phase 22 shared export, add:
import { ..., validateJobNumberFormat } from "@construction/shared";
```

### Existing: tRPC useUtils imperative fetch (from ROUTING-CONVENTIONS.md)

```typescript
// Source: apps/web/ROUTING-CONVENTIONS.md + utils pattern throughout codebase
const utils = trpc.useUtils();
// Imperative — NOT useQuery, NOT useEffect, just await in an event handler:
const result = await utils.company.checkJobNumberAvailability.fetch({ jobNumber: value });
```

---

## State of the Art

| Component | Phase 21 State | Phase 22 Target |
|-----------|---------------|-----------------|
| `checkJobNumberAvailability` | `eq()` exact match, returns `{ available, existingProjectId }` | `ilike()` case-insensitive, returns `{ available, existingProjectId, existingProjectName, existingProjectSlug }`, accepts `excludeProjectId` |
| `validateJobNumberFormat` | In API utils only | Exported from `@construction/shared` |
| `project-form.tsx` job number field | Plain input, no blur validation | Blur handler with format + duplicate checks, `form.setError`, loading state |
| Edit project page | Does not exist (404) | `/projects/[slug]/edit/page.tsx` with pre-populated form + blur validation |

---

## Open Questions

None. All questions from initial research have been resolved:

1. **Edit form location:** Confirmed — the edit dialog does NOT exist in `page.tsx` (read to line 919). The `/edit` route does not exist. Phase 22 must create `apps/web/app/(dashboard)/projects/[projectSlug]/edit/page.tsx`.

2. **`validateJobNumberFormat` client availability:** Confirmed NOT exported from `@construction/shared`. The function is pure (no server deps). Phase 22 must add the export before the web client can use it.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `apps/api/src/trpc/routers/company.ts` — `checkJobNumberAvailability` confirmed: uses `eq()`, returns only `id`, no `excludeProjectId`
- Direct codebase read — `apps/api/src/utils/job-number.ts` — `validateJobNumberFormat` + `parseTemplatePattern` confirmed to exist
- Direct codebase read — `packages/shared/src/index.ts` — confirmed `validateJobNumberFormat` is NOT exported (only `previewJobNumber`, `validateJobNumberTemplate`, `getAvailableTokens`)
- Direct codebase read — `apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx` lines 1–919 — confirmed NO edit project dialog rendered; only InviteUser dialog at end
- Direct codebase read — `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — confirmed link to `/projects/${project.slug}/edit`
- Direct codebase read — `apps/api/src/trpc/routers/search.ts` — `ilike` import and usage pattern confirmed
- Direct codebase read — `apps/web/package.json` — all library versions confirmed; `use-debounce ^10.1.0` confirmed installed
- Direct codebase read — `apps/web/components/project/project-form.tsx` — form structure with `useForm`, `zodResolver`, `trpc.useUtils()` confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions from package.json, all imports from actual code
- Architecture: HIGH — all patterns derived from existing codebase, zero assumptions
- Pitfalls: HIGH — all pitfalls confirmed by reading actual code; self-duplicate and missing export are certainties not possibilities
- Open questions: Fully resolved

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable codebase, pinned deps)
