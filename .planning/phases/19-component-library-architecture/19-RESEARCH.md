# Phase 19: Component Library & Architecture - Research

**Researched:** 2026-02-16
**Domain:** Component organization, routing patterns, validation centralization
**Confidence:** HIGH

## Summary

Phase 19 consolidates the existing codebase into sustainable architectural patterns without adding new features. The research reveals that the project already uses industry-standard tools (Next.js 14 App Router, shadcn/ui components, Zod validation, tRPC) but needs organizational cleanup to prevent long-term maintainability issues.

Key findings indicate that the current implementation already follows many best practices (slug-based routing in `/projects/[projectSlug]`, hover prefetching in `ProjectTabs`, shared Zod schemas in `packages/shared`), but component organization suffers from typical growth pain: domain-specific components scattered across feature folders with potential duplication, no clear extraction threshold, and validation schemas split between local definitions and shared schemas without consistent patterns.

The recommended approach centers on consolidating existing patterns rather than introducing new ones: standardize on kebab-case filenames with PascalCase exports (already used in `components/ui/`), extract components only when used 3+ times (avoid premature abstraction), keep validation schemas in `packages/shared` for server-client sharing, and use CVA (class-variance-authority) for component variants to maintain design system cohesion.

**Primary recommendation:** Audit existing components for duplication, extract proven patterns (3+ uses) into shared locations, centralize all validation schemas in `packages/shared/src/schemas/`, and document component organization conventions—but do not over-engineer or prematurely extract rarely-used components.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Component Organization:**
- **Naming convention:** kebab-case files (button.tsx), PascalCase exports (Button) — Next.js app router style
- **File structure:** Claude has discretion to organize for maintainability (directory structure, categorization)
- **Domain components:** Claude decides when to extract based on actual usage patterns vs keeping components local
- **Import patterns:** Claude chooses approach that balances tree-shaking and maintainability

**Routing and Navigation:**
- **URL patterns:** All user-facing entity URLs use slugs — consistent `/projects/{job-number}-{name}` pattern everywhere
- **Dynamic sections:** Tabs with client-side content switching (budget, estimates, documents switch content without URL changes)
- **Prefetching:** Yes, prefetch data on link hover for instant perceived navigation
- **Scroll restoration:** Remember scroll position for list pages, reset to top for detail pages

**Validation Centralization:**
- **Error display:** Keep current pattern — inline errors below each field
- **Server vs client validation:** Server provides detailed context (for debugging), client simplifies messages (user-friendly)
- **Async validation:** On blur only (uniqueness checks, external validation) — validate when user leaves field
- **Schema location:** Claude decides optimal organization (shared package vs domain-specific)

**Reusability Boundaries:**
- **Extraction threshold:** Component must be used 3+ times before extracting — wait for pattern to emerge
- **Styling approach:** Consistent styling through controlled variants — prioritize design system consistency over flexibility
- **Component flexibility:** Claude balances configurability and simplicity based on use cases
- **When not to extract:** Claude evaluates coupling, complexity, and likelihood of divergence

### Claude's Discretion

- Component directory structure and categorization
- Import/export patterns (direct vs barrel exports)
- Domain component extraction decisions
- Validation schema organization
- Component API design (props, composition patterns)
- Decisions about when extraction adds unnecessary complexity

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | UI components are modular and reusable across pages | CVA pattern (class-variance-authority) enables controlled component variants; extraction threshold (3+ uses) prevents premature abstraction |
| ARCH-02 | Routing is clean with no unnecessary page refreshes | Next.js App Router with `scroll={false}` on tabs already implemented; dynamic segments via `[projectSlug]` pattern |
| ARCH-03 | Content loads dynamically without full page reloads where appropriate | Layout + children pattern already in use for project detail pages; tabs use client-side state while maintaining shareable URLs |
| ARCH-04 | URLs follow hygiene standards (slug-safe, descriptive, bookmarkable) | Current `/projects/[projectSlug]` pattern follows Next.js best practices; slug library already in dependencies |
| ARCH-05 | Reusable UI component system is centralized | shadcn/ui components in `components/ui/` provide foundation; domain components need audit for extraction opportunities |
| ARCH-06 | Validation layer is centralized and shared between client and server | Zod schemas in `packages/shared/src/schemas/` enable single source of truth; tRPC routers import shared schemas; needs consolidation of local schemas |
| ARCH-07 | Architecture maintains scalable SaaS multi-tenant structure | Existing monorepo with workspace organization supports code sharing; tenant-scoped database context already established |

</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.0 | App Router framework | Industry standard for React SSR/SSG; App Router is current recommended pattern |
| React | 18.3.0 | UI library | Latest stable with concurrent features |
| shadcn/ui | Latest | Component foundation | Copy-paste components built on Radix + Tailwind; ownership model prevents vendor lock-in |
| Radix UI | 1.x | Headless primitives | 130M+ monthly downloads; powers shadcn/ui; accessibility built-in |
| Tailwind CSS | 3.4.0 | Utility-first CSS | De facto standard for modern React apps |
| class-variance-authority | 0.7.1 | Component variants | Type-safe variant management for consistent design system |
| Zod | 3.25.76 | Validation & types | TypeScript-first validation with runtime safety and type inference |
| React Hook Form | 7.71.1 | Form state management | Minimal re-renders; integrates with Zod via `@hookform/resolvers` |
| tRPC | 11.10.0 | Type-safe API | End-to-end type safety; shares Zod schemas between client and server |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nuqs | 2.8.8 | URL state management | For shareable filter/tab state in URLs |
| slug | 11.0.1 | URL slug generation | Converting names to URL-safe slugs |
| next-themes | 0.4.6 | Theme management | Dark mode with SSR support and no FOUC |
| zustand | 5.0.11 | Client state | Lightweight alternative to Redux for local UI state |
| sonner | 2.0.7 | Toast notifications | Accessible, animated notifications |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui | MUI or Chakra UI | Pre-built components faster initially, but harder to customize and heavier bundles |
| CVA | styled-components | CSS-in-JS more flexible but worse performance and larger bundles |
| Zod | Yup or Joi | Yup has wider adoption historically, but Zod's TypeScript-first design is superior for type inference |
| Direct imports | Barrel exports | Barrel files simplify imports but can break tree-shaking and inflate bundles (1.5MB → 200KB in one case) |

**Installation:**

Already installed. No new dependencies required for this phase.

---

## Architecture Patterns

### Current Project Structure (apps/web)

```
apps/web/
├── app/
│   ├── (auth)/                    # Auth route group
│   ├── (dashboard)/               # Protected route group
│   │   ├── projects/
│   │   │   ├── [projectSlug]/    # Dynamic segment
│   │   │   │   ├── layout.tsx    # Persistent header + tabs
│   │   │   │   ├── page.tsx      # Overview tab
│   │   │   │   ├── budget/
│   │   │   │   ├── estimates/
│   │   │   │   └── components/   # Project-specific components
│   │   │   └── page.tsx
│   │   └── page.tsx               # Dashboard
│   └── layout.tsx
├── components/
│   ├── ui/                        # shadcn base components (kebab-case)
│   ├── bidding/                   # Domain: bidding features
│   ├── budget/                    # Domain: budget features
│   ├── estimates/                 # Domain: estimating workflow
│   ├── project/                   # Domain: project management
│   ├── layout/                    # Layout components (sidebar, topbar)
│   └── [other domains]/
└── lib/
    ├── trpc.ts                    # tRPC client
    └── utils.ts                   # cn() helper for class merging
```

### Recommended Component Organization

```
components/
├── ui/                            # Base design system (shadcn)
│   ├── button.tsx                # Kebab-case files
│   ├── form.tsx
│   ├── input.tsx
│   └── [base-components].tsx
├── shared/                        # Extracted domain-agnostic (3+ uses)
│   ├── data-table.tsx            # Generic table wrapper
│   ├── status-badge.tsx          # Status display
│   ├── currency-display.tsx      # Money formatting
│   └── [shared-patterns].tsx
├── [domain]/                      # Domain-specific components
│   ├── [feature]-form.tsx        # Domain forms
│   ├── [feature]-card.tsx        # Domain displays
│   └── [domain-components].tsx
└── layout/                        # App-wide layout
    ├── sidebar.tsx
    ├── topbar.tsx
    └── [layout-components].tsx
```

**Extraction Decision Tree:**

1. **Is it used 3+ times?** → Yes: Extract to `shared/` or `ui/`
2. **Is it domain-specific?** → Yes: Keep in `components/[domain]/`
3. **Will it diverge per use?** → Yes: Don't extract (accept duplication)
4. **Is it complex enough to warrant extraction?** → No: Keep inline

### Pattern 1: Slug-Based Routing (Already Implemented)

**What:** Dynamic route segments using URL-friendly slugs instead of UUIDs

**Current Implementation:**
```typescript
// apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
const { data: project } = trpc.project.getBySlug.useQuery({
  slug: projectSlug,
});

// URL: /projects/24001-main-street-renovation
// Parsed: { jobNumber: "24001", name: "Main Street Renovation" }
```

**Why it works:**
- SEO-friendly: descriptive URLs improve search rankings
- Bookmarkable: users can share meaningful links
- Self-documenting: job number + name visible in URL
- Already implemented: `slug` library in dependencies, `getBySlug` tRPC procedure exists

**Source:** [Next.js SEO URL Structure](https://nextjs.org/learn/seo/url-structure)

### Pattern 2: Hover Prefetch for Instant Navigation (Already Implemented)

**What:** Prefetch data when user hovers over link, not when link enters viewport

**Current Implementation:**
```typescript
// apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
<Link
  href={fullHref}
  scroll={false}
  onMouseEnter={prefetchHandler}  // Prefetch on hover
  className={...}
>
  {section.name}
</Link>
```

**Why it works:**
- Reduces unnecessary prefetching (only prefetch likely navigation)
- Makes navigation feel instant when user clicks
- Leverages tRPC's prefetch utilities
- Already working in production

**Source:** [Next.js Prefetching Guide](https://nextjs.org/docs/app/guides/prefetching)

### Pattern 3: Layout + Children for Persistent Headers

**What:** Persistent UI (header, tabs) in layout.tsx, dynamic content in page.tsx

**Current Implementation:**
```typescript
// apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
export default function ProjectLayout({ children, params }) {
  const { data: project } = trpc.project.getBySlug.useQuery({
    slug: params.projectSlug,
  });

  return (
    <div>
      <ProjectHeader project={project} />  {/* Never reloads */}
      <ProjectTabs projectSlug={params.projectSlug} />  {/* Never reloads */}
      <div>{children}</div>  {/* page.tsx renders here */}
    </div>
  );
}
```

**Why it works:**
- Header and tabs persist across tab navigation
- No full page reload when switching tabs
- Data fetched once in layout, cached by tRPC
- React Query staleTime keeps data fresh

**Source:** [Next.js Pages and Layouts](https://nextjs.org/docs/pages/building-your-application/routing/pages-and-layouts)

### Pattern 4: Centralized Validation with Zod (Partially Implemented)

**What:** Single Zod schema shared between client (React Hook Form) and server (tRPC)

**Current Implementation:**
```typescript
// packages/shared/src/schemas/estimates.ts
export const createEstimateSchema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string().uuid(),
  projectType: z.enum(["commercial", "residential", "infrastructure", "industrial"]),
});

// apps/api/src/trpc/routers/estimates.ts
import { createEstimateSchema } from "@construction/shared";

export const estimatesRouter = router({
  create: protectedProcedure
    .input(createEstimateSchema)  // Server validation
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});

// apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx (NEEDS CLEANUP)
const basicInfoSchema = z.object({  // ⚠️ Duplicate schema definition
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  projectType: z.enum(["residential", "commercial", "industrial", "institutional"]),
});

const form = useForm<BasicInfoFormValues>({
  resolver: zodResolver(basicInfoSchema),  // Should import from shared
});
```

**What needs fixing:**
- Some components define schemas locally instead of importing from `packages/shared`
- Phone and address schemas exist in `common.ts`, but not all forms use them
- Error messages sometimes defined in schema, sometimes in component

**Recommended pattern:**
```typescript
// packages/shared/src/schemas/common.ts
export const createEstimateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  projectId: z.string().uuid(),
  projectType: z.enum(["commercial", "residential", "infrastructure", "industrial"]),
});

// Client (apps/web)
import { createEstimateSchema } from "@construction/shared";

const form = useForm({
  resolver: zodResolver(createEstimateSchema),
});

// Server (apps/api)
import { createEstimateSchema } from "@construction/shared";

const estimatesRouter = router({
  create: protectedProcedure.input(createEstimateSchema).mutation(...),
});
```

**Source:** [Share Zod Validation Schema Between Server and Client](https://catalins.tech/share-zod-validation-schema-between-server-and-client/)

### Pattern 5: CVA for Component Variants (Already Implemented in UI)

**What:** Type-safe variant system for consistent component styling

**Current Implementation:**
```typescript
// apps/web/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 ...",  // Base styles
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground ...",
        destructive: "bg-destructive text-destructive-foreground ...",
        outline: "border border-input bg-background ...",
        secondary: "bg-secondary text-secondary-foreground ...",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
```

**Usage:**
```typescript
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="outline">Cancel</Button>
```

**Why it works:**
- Type-safe: TypeScript autocompletes variant options
- Consistent: All buttons use same variant names
- Composable: Can combine variants (destructive + sm)
- Maintainable: Change variant styles in one place

**Only 6 CVA usages found in current codebase** — opportunity to expand pattern to domain components.

**Source:** [Class Variance Authority Docs](https://cva.style/docs)

### Pattern 6: Scroll Restoration (Needs Implementation)

**What:** Remember scroll position on list pages, reset to top on detail pages

**Current State:** Next.js handles this automatically for most cases, but custom implementation needed for:
- Project list → project detail → back to list (should restore scroll)
- Tab navigation within project (should reset to top)

**Recommended Implementation:**
```typescript
// Use Next.js scroll prop on Link component
<Link href="/projects" scroll={true}>  {/* Scroll to top */}
<Link href="/projects" scroll={false}>  {/* Maintain position */}

// For complex cases, use sessionStorage
useEffect(() => {
  const handleScroll = () => {
    sessionStorage.setItem('projectListScroll', window.scrollY.toString());
  };
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

// Restore on mount
useEffect(() => {
  const savedScroll = sessionStorage.getItem('projectListScroll');
  if (savedScroll) {
    window.scrollTo(0, parseInt(savedScroll));
  }
}, []);
```

**Source:** [Next.js Scroll Restoration](https://www.restack.io/docs/nextjs-knowledge-nextjs-keep-scroll-position)

### Anti-Patterns to Avoid

- **Barrel exports for components:** Breaks tree-shaking, inflates bundles. One case: 1.5MB → 200KB after removing barrels.
- **Premature extraction:** Extracting component after 1-2 uses leads to over-abstraction and maintenance burden.
- **Flexible components:** Components with 10+ props become unmaintainable. Better to accept duplication or create focused variants.
- **Schema duplication:** Defining Zod schemas in both client and server leads to drift and validation bugs.
- **Global state abuse:** Using Zustand/Redux for form state or server cache duplicates React Query's capabilities.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component variants | Custom prop-to-class mapping | CVA (class-variance-authority) | Type safety, compound variants, default variants handled automatically |
| Form validation | Custom error state management | React Hook Form + Zod | Minimal re-renders, built-in error handling, schema reuse |
| Client-server types | Manual type definitions | tRPC + Zod inference | End-to-end type safety, runtime validation, schema = types |
| URL state | useState + router.push | nuqs (Next.js URL state) | SSR-safe, type-safe, shareable URLs |
| Accessible components | Custom ARIA implementation | Radix UI primitives | 130M+ downloads, battle-tested, full accessibility |
| Toast notifications | Custom notification system | sonner | Accessible, animated, simple API |
| Theme switching | Manual class toggling | next-themes | No FOUC, SSR-safe, cookie-based persistence |
| Slug generation | Custom regex/sanitization | slug library | Handles edge cases (Unicode, special chars, collisions) |

**Key insight:** Modern React ecosystem provides production-ready solutions for almost every common problem. Custom solutions introduce bugs, maintenance burden, and accessibility issues. The project already uses the right tools—this phase is about standardizing their usage.

---

## Common Pitfalls

### Pitfall 1: Barrel File Bundle Bloat

**What goes wrong:** Creating `components/index.ts` that re-exports all components causes bundler to include unused code.

**Why it happens:** Webpack/SWC can't tree-shake barrel files because static analysis can't determine which exports are actually used.

**How to avoid:**
- Use direct imports: `import { Button } from "@/components/ui/button"`
- NOT barrel imports: `import { Button } from "@/components/ui"`
- If using barrels, enable Next.js `optimizePackageImports` in `next.config.js`

**Warning signs:**
- First Load JS > 500KB in production build
- Build time increases with component count
- Unused components appear in bundle analyzer

**Real example:** Developer reduced First Load JS from 1.5MB to 200KB by removing barrel exports.

**Source:** [Why I Stopped Using Barrel Files in Next.js](https://javascript.plainenglish.io/why-i-stopped-using-barrel-files-in-next-js-and-cut-my-first-load-js-from-1-5-mb-to-200-kb-3afdf5f359fd)

### Pitfall 2: Schema Drift Between Client and Server

**What goes wrong:** Client-side validation passes, but server rejects request (or vice versa) due to different schemas.

**Why it happens:** Developers define validation in component (Zod schema) and separately in API (tRPC input), not realizing they need to match.

**How to avoid:**
- Define schema once in `packages/shared/src/schemas/`
- Import same schema in both client and server
- Use `z.infer<typeof schema>` for TypeScript types
- Never duplicate schema definitions

**Warning signs:**
- Form submits successfully in dev, fails in production
- "Unexpected error" messages without clear validation feedback
- TypeScript types don't match runtime validation

**Verification:** Grep for duplicate schema definitions (e.g., same field validation in multiple files).

### Pitfall 3: Over-Extraction (Premature Abstraction)

**What goes wrong:** Developer extracts component after 1-2 uses, adding unnecessary abstraction layer that makes simple changes complex.

**Why it happens:** "DRY" (Don't Repeat Yourself) drilled into developers without nuance about when repetition is acceptable.

**How to avoid:**
- Wait for 3+ uses before extracting
- Accept duplication for domain-specific logic that will diverge
- Extract when pattern is proven stable, not when you first notice repetition
- Consider maintenance cost of abstraction vs. cost of duplication

**Warning signs:**
- Component has 10+ props with complex conditional logic
- Every use case passes different prop combinations
- Changes to component require touching multiple unrelated features
- "Shared" component has feature-specific flags (e.g., `isProjectForm` prop)

**Source:** [React Pattern: Extract Child Components](https://www.linkedin.com/pulse/6-steps-effectively-extract-react-component-dawid-sibi%C5%84ski)

### Pitfall 4: Scroll Restoration Interference

**What goes wrong:** Next.js attempts to restore scroll position, but custom behavior conflicts, causing janky scrolling or scroll not restoring.

**Why it happens:** Mixing Next.js automatic scroll behavior with manual `scrollTo()` calls without understanding interaction.

**How to avoid:**
- Use `scroll={false}` prop on `<Link>` when managing scroll manually
- Store scroll position in `sessionStorage`, not component state
- Restore scroll in `useEffect` after content loads, not before
- Test with browser back button (scroll restoration behaves differently)

**Warning signs:**
- Page scrolls to top then jumps back to previous position
- Scroll restoration works in dev but not production
- Back button doesn't restore scroll position

**Source:** [Next.js Scroll Restoration Issues](https://github.com/vercel/next.js/discussions/33777)

### Pitfall 5: CVA Variant Explosion

**What goes wrong:** Adding too many variant combinations creates maintenance nightmare and large bundle.

**Why it happens:** Treating CVA like a styling Swiss Army knife instead of focused variant system.

**How to avoid:**
- Limit to 3-5 variant dimensions per component (e.g., variant, size, state)
- Use composition for complex cases (multiple components) instead of compound variants
- Keep base styles minimal, add variants for semantic differences only
- Document when to create new variant vs. new component

**Warning signs:**
- Component has 20+ variant combinations
- Variants encode business logic (e.g., `variant="userIsAdmin"`)
- Compound variants needed for basic styling

**Source:** [CVA Best Practices](https://cva.style/docs/getting-started/variants)

### Pitfall 6: Async Validation Race Conditions

**What goes wrong:** Async validation (e.g., checking username uniqueness) triggers on every keystroke, causing race conditions and poor UX.

**Why it happens:** Not understanding when validation should run (onChange vs. onBlur).

**How to avoid:**
- Use `onBlur` validation mode for async checks
- Debounce async validation (500ms minimum)
- Show loading state during validation
- Cache validation results to avoid redundant requests

**Pattern:**
```typescript
const form = useForm({
  mode: "onBlur",  // Not onChange for async
  resolver: zodResolver(schema),
});

// In schema
email: z.string().email().refine(
  async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  },
  { message: "Email already registered" }
);
```

**Warning signs:**
- Validation fires on every keystroke
- Multiple simultaneous validation requests
- Validation errors appear then disappear randomly

**Source:** [React Hook Form Advanced Usage](https://www.react-hook-form.com/advanced-usage/)

---

## Code Examples

Verified patterns from official sources:

### Component with CVA Variants

```typescript
// Source: shadcn/ui button component
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input hover:bg-accent",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3",
        lg: "h-12 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

**Source:** [shadcn/ui Button](https://ui.shadcn.com/docs/components/button)

### Shared Validation Schema

```typescript
// packages/shared/src/schemas/projects.ts
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  jobNumber: z.string().min(1).max(50),
  customerId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// apps/api/src/trpc/routers/project.ts
import { createProjectSchema } from "@construction/shared";

export const projectRouter = router({
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      // Server validation automatic via Zod schema
    }),
});

// apps/web/components/project/project-form.tsx
import { createProjectSchema } from "@construction/shared";
import { zodResolver } from "@hookform/resolvers/zod";

const form = useForm({
  resolver: zodResolver(createProjectSchema),  // Client validation
});
```

**Source:** [Zod with tRPC](https://stack.convex.dev/typescript-zod-function-validation)

### Hover Prefetch Pattern

```typescript
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
import { trpc } from "@/lib/trpc";
import Link from "next/link";

export function ProjectTabs({ projectSlug }: { projectSlug: string }) {
  const utils = trpc.useUtils();
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });

  const prefetchBudget = () => {
    if (!project?.id) return;
    utils.budget.getProjectSummary.prefetch({ projectId: project.id });
    utils.budget.getVarianceAlerts.prefetch({ projectId: project.id });
  };

  return (
    <Link
      href={`/projects/${projectSlug}/budget`}
      scroll={false}  // Don't scroll to top when navigating
      onMouseEnter={prefetchBudget}  // Prefetch on hover
    >
      Budget
    </Link>
  );
}
```

**Source:** [Next.js Prefetching](https://nextjs.org/docs/app/guides/prefetching)

### Form with Inline Error Display

```typescript
// Source: React Hook Form + shadcn/ui Form component
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/, "Format: (555) 123-4567"),
});

export function ContactForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur",  // Validate when user leaves field
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />  {/* Inline error below field */}
          </FormItem>
        )}
      />
    </Form>
  );
}
```

**Source:** [React Hook Form Error Display](https://www.react-hook-form.com/api/useformstate/errormessage/)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router | App Router | Next.js 13 (2023) | Layouts persist across navigation, React Server Components, streaming SSR |
| Barrel exports | Direct imports | Next.js 13.5 (2023) | `optimizePackageImports` auto-optimizes package imports; manual barrels still problematic |
| CSS Modules | Tailwind + CVA | 2021-2023 | Utility-first faster to write, CVA adds type safety without CSS-in-JS runtime cost |
| Yup validation | Zod validation | 2022-2024 | Zod's TypeScript-first design eliminates manual type definitions |
| Component libraries | shadcn/ui (copy-paste) | 2023-2026 | Code ownership prevents vendor lock-in, easier customization |
| Redux | Zustand + React Query | 2021-2024 | Less boilerplate for local state, React Query handles server state |

**Deprecated/outdated:**
- **Pages Router:** Still supported but App Router is recommended for new projects
- **getStaticProps/getServerSideProps:** Replaced by React Server Components and fetch with caching
- **Barrel exports without optimization:** Causes bundle bloat; use `optimizePackageImports` or avoid barrels
- **Client-side only validation:** Server validation required for security; client for UX

---

## Open Questions

1. **Component extraction audit scope**
   - What we know: Need to identify duplicate components across feature folders
   - What's unclear: Exact threshold for extraction (strict 3+ or case-by-case?)
   - Recommendation: Start with strict 3+ rule, document exceptions in ADR

2. **Validation schema organization**
   - What we know: Some schemas in `packages/shared`, some local to components
   - What's unclear: When to keep schema local vs. shared (e.g., one-off form vs. reusable entity)
   - Recommendation: Default to shared unless schema is truly page-specific and won't be reused

3. **Scroll restoration granularity**
   - What we know: Need to remember scroll on lists, reset on details
   - What's unclear: Should tabs within project detail maintain scroll or reset?
   - Recommendation: Test both, let UX decide; default to reset (simpler)

4. **Domain component boundaries**
   - What we know: Features organized by domain (bidding, budget, estimates)
   - What's unclear: When component is generic enough to move out of domain folder
   - Recommendation: If used in 3+ domains, move to `shared/`; otherwise keep in primary domain

---

## Sources

### Primary (HIGH confidence)

- [Next.js 14 App Router Documentation](https://nextjs.org/docs/app) - Official Next.js docs (2026)
- [shadcn/ui Component Library](https://ui.shadcn.com/) - Official shadcn/ui docs
- [Zod TypeScript Validation](https://zod.dev/) - Official Zod documentation
- [React Hook Form](https://www.react-hook-form.com/) - Official React Hook Form docs
- [Class Variance Authority](https://cva.style/docs) - Official CVA documentation
- [Radix UI](https://www.radix-ui.com/) - Official Radix primitives docs

### Secondary (MEDIUM confidence)

- [Next.js Prefetching Guide](https://nextjs.org/docs/app/guides/prefetching) - Verified with official Next.js docs
- [shadcn UI Complete Guide (2026)](https://designrevision.com/blog/shadcn-ui-guide) - Recent comprehensive guide
- [Share Zod Schema Between Server and Client](https://catalins.tech/share-zod-validation-schema-between-server-and-client/) - Practical implementation guide
- [Monorepo Best Practices Guide](https://jsdev.space/complete-monorepo-guide/) - Workspace organization patterns
- [Next.js Barrel File Optimization](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js) - Official Vercel blog
- [React Component Extraction Best Practices](https://www.linkedin.com/pulse/6-steps-effectively-extract-react-component-dawid-sibi%C5%84ski) - Industry patterns

### Tertiary (LOW confidence)

- [Why I Stopped Using Barrel Files](https://javascript.plainenglish.io/why-i-stopped-using-barrel-files-in-next-js-and-cut-my-first-load-js-from-1-5-mb-to-200-kb-3afdf5f359fd) - Anecdotal but validated by Vercel's official guidance
- [Next.js Scroll Restoration Discussion](https://github.com/vercel/next.js/discussions/33777) - Community discussion, needs official verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries currently in use, versions verified from package.json
- Architecture patterns: HIGH - Patterns extracted from existing codebase, verified with official docs
- Pitfalls: MEDIUM-HIGH - Mix of official guidance (barrel exports) and community patterns (extraction threshold)
- Component organization: MEDIUM - Based on community best practices; no single "correct" answer

**Research date:** 2026-02-16
**Valid until:** 60 days (stable technologies, Next.js 15 may introduce new patterns)

**Current codebase state:**
- Next.js 14.2.0 (App Router)
- 33 UI components in `components/ui/` (shadcn base)
- 19+ domain component folders
- 3 validation schemas in `packages/shared/src/schemas/`
- Hover prefetch already implemented in `ProjectTabs`
- Slug-based routing already implemented in `[projectSlug]`
- CVA used in 6 base components (opportunity to expand)

**Key takeaway:** This phase is consolidation and documentation, not greenfield development. The infrastructure is solid; execution is about standardizing what exists and eliminating duplication.
