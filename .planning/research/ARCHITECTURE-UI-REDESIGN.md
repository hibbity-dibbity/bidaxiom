# Architecture Research: Enterprise UI/UX Redesign

**Domain:** Enterprise SaaS Navigation & Routing
**Researched:** 2026-02-14
**Confidence:** HIGH

## Executive Summary

Enterprise SaaS applications require sophisticated navigation architectures that balance persistent UI elements, dynamic content loading, and fast navigation. Next.js 14 App Router provides the foundational patterns (layouts, parallel routes, intercepting routes) that enable these requirements. The key architectural shift from the current implementation is moving from full-page navigation to **persistent layout with dynamic content injection**, using Next.js native features for state preservation and React Query for optimized data fetching.

The research confirms that modern enterprise patterns use:
1. **Top bar + contextual sidebar** (replacing current left sidebar)
2. **Nested layouts** for persistent project headers
3. **URL-based state** for search/filters (not global stores)
4. **Command palette (cmdk)** for global search
5. **CSS variables + next-themes** for dark mode
6. **Centralized Zod schemas** for form validation

All patterns integrate seamlessly with existing tRPC + React Query architecture.

## Standard Architecture for Enterprise SaaS Navigation

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Root Layout                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ThemeProvider (next-themes)                                │  │
│  │ AuthProvider (Clerk session)                               │  │
│  │ TrpcProvider (React Query)                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Dashboard Layout Group                        │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                      Top Bar (Fixed)                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │    │
│  │  │ Sidebar  │  │  Global  │  │ Company  │  │  User   │  │    │
│  │  │ Trigger  │  │  Search  │  │ Switcher │  │  Menu   │  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌──────────┐  ┌────────────────────────────────────────────┐    │
│  │Contextual│  │         Main Content Area                  │    │
│  │ Sidebar  │  │  ┌──────────────────────────────────────┐  │    │
│  │(Collapse)│  │  │  Persistent Project Header (Layout)  │  │    │
│  │          │  │  ├──────────────────────────────────────┤  │    │
│  │ Project  │  │  │  Dynamic Section Content (Page)      │  │    │
│  │   Nav    │  │  │                                      │  │    │
│  │          │  │  │  (Budget, Documents, etc.)           │  │    │
│  │          │  │  │                                      │  │    │
│  └──────────┘  └──┴──────────────────────────────────────┘  │    │
├─────────────────────────────────────────────────────────────────┤
│                      Global Command Palette                      │
│  (cmdk - Triggered by ⌘K, searches all entities)                │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Integration Point |
|-----------|----------------|-------------------|
| **Root Layout** | Theme provider, global providers, HTML structure | Existing `app/layout.tsx` - add ThemeProvider |
| **Dashboard Layout** | Top bar, sidebar provider, command palette | Existing `app/(dashboard)/layout.tsx` - modify AppShell |
| **Top Bar** | Global navigation, search trigger, org switcher, user menu | Existing `components/layout/top-bar.tsx` - add search trigger |
| **Contextual Sidebar** | Context-aware navigation (project sections, settings tabs) | NEW - replaces current AppSidebar |
| **Project Layout** | Persistent project header, breadcrumbs, tab navigation | NEW - `app/(dashboard)/projects/[projectId]/layout.tsx` |
| **Section Pages** | Dynamic content for each project section | Existing pages - minimal changes |
| **Command Palette** | Global search (jobs, projects, customers), quick actions | NEW - `components/search/command-palette.tsx` |
| **Theme Toggle** | Dark/light/system mode switcher | NEW - `components/layout/theme-toggle.tsx` |

## Recommended Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx                    # Root: Theme + Auth + tRPC providers
│   ├── providers.tsx                 # Modified: Add ThemeProvider wrapper
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Modified: New AppShell with top bar + contextual sidebar
│   │   ├── projects/
│   │   │   ├── [projectId]/
│   │   │   │   ├── layout.tsx        # NEW: Persistent project header + tabs
│   │   │   │   ├── page.tsx          # Overview (default tab)
│   │   │   │   ├── budget/
│   │   │   │   │   └── page.tsx      # Dynamic section content
│   │   │   │   ├── documents/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── ...               # Other sections
│   │   │   └── page.tsx              # Projects list
│   │   ├── settings/
│   │   │   ├── layout.tsx            # NEW: Settings sidebar navigation
│   │   │   ├── page.tsx              # General settings
│   │   │   ├── company/page.tsx
│   │   │   └── integrations/page.tsx
│   │   └── ...
│   └── api/                          # Existing API routes
├── components/
│   ├── ui/                           # shadcn primitives (existing)
│   ├── layout/
│   │   ├── app-shell.tsx             # Modified: New layout structure
│   │   ├── top-bar.tsx               # Modified: Add search trigger
│   │   ├── contextual-sidebar.tsx    # NEW: Replaces current sidebar
│   │   ├── project-nav.tsx           # NEW: Project-specific navigation
│   │   ├── settings-nav.tsx          # NEW: Settings navigation
│   │   ├── theme-toggle.tsx          # NEW: Dark mode toggle
│   │   └── breadcrumbs.tsx           # Modified: Enhanced breadcrumbs
│   ├── search/
│   │   ├── command-palette.tsx       # NEW: Global search (cmdk)
│   │   ├── project-search.tsx        # NEW: Project search results
│   │   ├── customer-search.tsx       # NEW: Customer search results
│   │   └── search-actions.tsx        # NEW: Quick actions in palette
│   ├── forms/                        # NEW: Centralized form components
│   │   ├── schemas/                  # NEW: Zod validation schemas
│   │   │   ├── project.ts
│   │   │   ├── customer.ts
│   │   │   └── ...
│   │   └── form-field.tsx            # NEW: Reusable form field wrapper
│   └── ...                           # Existing feature components
├── lib/
│   ├── theme.ts                      # NEW: Theme configuration
│   ├── search-index.ts               # NEW: Search indexing for cmdk
│   └── ...                           # Existing utilities
└── styles/
    └── globals.css                   # Modified: Add CSS variables for themes
```

### Structure Rationale

- **`app/(dashboard)/[resource]/[id]/layout.tsx`:** Enables persistent headers that don't unmount on section navigation (Next.js partial rendering)
- **`components/layout/contextual-sidebar.tsx`:** Single component that renders different navigation based on current route (project vs settings vs main)
- **`components/search/`:** Isolated search implementation with dedicated components for each entity type
- **`components/forms/schemas/`:** Centralized Zod schemas prevent duplication and ensure type safety across forms
- **Theme via CSS variables:** Avoids theme provider re-renders, works with SSR, respects system preferences

## Architectural Patterns

### Pattern 1: Persistent Layout with Dynamic Content

**What:** Use Next.js layout nesting to create persistent UI shells that don't re-render on navigation, with only the page content updating.

**When to use:** Any time you have a header/navigation that should remain stable across section changes (project headers, settings tabs, etc.)

**Trade-offs:**
- **Pro:** Instant navigation feel, state preservation in layouts, reduced re-fetching
- **Pro:** React component tree maintained, client state preserved
- **Con:** Layouts share state via URL params or context (can't use page-level state)
- **Con:** Must use `<Link>` for client-side navigation (full page reload breaks persistence)

**Example:**
```typescript
// app/(dashboard)/projects/[projectId]/layout.tsx
import { ProjectHeader } from '@/components/project/project-header';
import { ProjectNav } from '@/components/layout/project-nav';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  // This layout persists across /projects/[id]/budget, /projects/[id]/documents, etc.
  return (
    <div className="flex h-full">
      {/* Contextual sidebar for project */}
      <ProjectNav projectId={params.projectId} />

      <div className="flex-1 flex flex-col">
        {/* Persistent project header - doesn't re-render on tab changes */}
        <ProjectHeader projectId={params.projectId} />

        {/* Only this part changes when navigating between sections */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Pattern 2: URL-Based State for Search and Filters

**What:** Store search queries, filters, and UI state in URL search params instead of client state or global stores.

**When to use:** Any feature where state should be shareable/bookmarkable (search, filters, pagination, sort order)

**Trade-offs:**
- **Pro:** Bookmarkable, shareable URLs
- **Pro:** Browser back/forward works naturally
- **Pro:** State persists across page reloads
- **Con:** More complex than useState (requires URL parsing)
- **Con:** Limited to serializable data (no functions/objects)

**Example:**
```typescript
// Using Next.js 14 useSearchParams + useRouter
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function ProjectFilter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const status = searchParams.get('status') ?? 'all';

  function setStatus(newStatus: string) {
    const params = new URLSearchParams(searchParams);
    if (newStatus === 'all') {
      params.delete('status');
    } else {
      params.set('status', newStatus);
    }
    // Replaces URL without full page reload
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={status} onValueChange={setStatus}>
      {/* ... */}
    </Select>
  );
}

// Alternative: Use nuqs for type-safe search params
import { useQueryState } from 'nuqs';

export function ProjectFilterTypeSafe() {
  const [status, setStatus] = useQueryState('status', { defaultValue: 'all' });

  return (
    <Select value={status} onValueChange={setStatus}>
      {/* ... */}
    </Select>
  );
}
```

### Pattern 3: Command Palette for Global Search

**What:** Single keyboard-accessible interface (⌘K) for searching all entities and executing actions, using cmdk library.

**When to use:** Enterprise apps with many routes/features where discoverability is critical

**Trade-offs:**
- **Pro:** Power user efficiency, keyboard-first UX
- **Pro:** Single interface for search + actions + navigation
- **Pro:** Reduces cognitive load (don't need to remember where features live)
- **Con:** Requires maintaining search index
- **Con:** Mobile UX requires different approach (button trigger)

**Example:**
```typescript
// components/search/command-palette.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { trpc } from '@/lib/trpc';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Global keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const [search, setSearch] = useState('');

  // Debounced search across entities
  const { data: projectResults } = trpc.project.search.useQuery(
    { query: search },
    { enabled: search.length > 0 }
  );

  const { data: customerResults } = trpc.customer.search.useQuery(
    { query: search },
    { enabled: search.length > 0 }
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search projects, customers, or type a command..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {projectResults && projectResults.length > 0 && (
          <CommandGroup heading="Projects">
            {projectResults.map((project) => (
              <CommandItem
                key={project.id}
                onSelect={() => {
                  router.push(`/projects/${project.id}`);
                  setOpen(false);
                }}
              >
                {project.jobNumber && `${project.jobNumber} - `}
                {project.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {customerResults && customerResults.length > 0 && (
          <CommandGroup heading="Customers">
            {customerResults.map((customer) => (
              <CommandItem
                key={customer.id}
                onSelect={() => {
                  router.push(`/customers/${customer.id}`);
                  setOpen(false);
                }}
              >
                {customer.companyName || customer.contactName}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => {
            router.push('/projects/new');
            setOpen(false);
          }}>
            Create New Project
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

### Pattern 4: Theme Management with CSS Variables

**What:** Use next-themes library + CSS custom properties for dark mode, avoiding theme provider re-renders and FOUC (flash of unstyled content).

**When to use:** Any app requiring dark/light/system theme support

**Trade-offs:**
- **Pro:** No flash on load (theme applied before React hydration)
- **Pro:** Respects system preferences automatically
- **Pro:** No provider re-renders (CSS variables are reactive)
- **Con:** Requires CSS variable setup (initial configuration overhead)
- **Con:** Theme switching requires page-level className changes

**Example:**
```typescript
// app/providers.tsx
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}

// components/layout/theme-toggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// styles/globals.css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    /* ... other light theme variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    /* ... other dark theme variables */
  }
}
```

### Pattern 5: Centralized Form Validation with Zod Schemas

**What:** Define all form validation schemas in a centralized location using Zod, integrate with React Hook Form for type-safe forms.

**When to use:** Any form-heavy application where validation logic is reused

**Trade-offs:**
- **Pro:** Single source of truth for validation rules
- **Pro:** Automatic TypeScript types from schemas
- **Pro:** Reusable across client and server (tRPC uses same schemas)
- **Con:** Initial learning curve for Zod syntax
- **Con:** Schema files can grow large (mitigate with separate files per entity)

**Example:**
```typescript
// components/forms/schemas/project.ts
import { z } from 'zod';

export const projectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  jobNumber: z.string().max(50).nullable(),
  customerId: z.string().uuid('Valid customer is required'),
  description: z.string().max(2000).nullable(),
  location: z.string().max(500).nullable(),
  projectType: z.enum(['commercial', 'residential', 'infrastructure', 'industrial']),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  costCodes: z.array(z.number().int()).default([]),
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;

// components/project/project-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectFormSchema, type ProjectFormData } from '@/components/forms/schemas/project';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ProjectForm({ onSubmit }: { onSubmit: (data: ProjectFormData) => void }) {
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      customerId: '',
      projectType: 'commercial',
      status: 'active',
      costCodes: [],
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Other fields... */}
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Pattern 6: Slug-Based URLs for User-Friendly Routing

**What:** Use dynamic segments with slugs containing both ID and human-readable name (`/projects/123-main-street-renovation`).

**When to use:** Public-facing or shareable routes where URL readability matters

**Trade-offs:**
- **Pro:** SEO-friendly, readable URLs
- **Pro:** Shareable links are meaningful
- **Pro:** URL changes gracefully if name changes (ID is source of truth)
- **Con:** Requires parsing slug to extract ID
- **Con:** Potential for URL confusion if name contains special characters

**Example:**
```typescript
// lib/utils/slug.ts
export function createSlug(id: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${id}-${slug}`;
}

export function extractIdFromSlug(slug: string): string {
  // Extract UUID from slug (assumes format: "uuid-rest-of-slug")
  return slug.split('-')[0];
}

// Usage in component
import { createSlug } from '@/lib/utils/slug';
import Link from 'next/link';

export function ProjectCard({ project }: { project: Project }) {
  const slug = createSlug(project.id, project.name);

  return (
    <Link href={`/projects/${slug}`}>
      {project.name}
    </Link>
  );
}

// app/(dashboard)/projects/[projectId]/page.tsx
export default function ProjectPage({ params }: { params: { projectId: string } }) {
  const id = extractIdFromSlug(params.projectId);
  const { data: project } = trpc.project.getById.useQuery({ id });

  // Optionally: redirect if slug doesn't match current project name
  // This ensures URLs stay canonical even if project name changes

  return <div>{/* ... */}</div>;
}
```

## Data Flow

### Request Flow for Navigation

```
User clicks project section link
    ↓
Next.js <Link> (client-side navigation)
    ↓
App Router checks route change
    ↓
Layout remains mounted (React tree preserved)
    ↓
Only page component unmounts/remounts
    ↓
React Query checks cache for data
    ↓ (cache hit)          ↓ (cache miss)
Return cached data    Fetch from tRPC endpoint
    ↓                        ↓
Render page          Render loading state → Data arrives → Render
```

### State Management Flow

```
┌─────────────────────────────────────────────────────────┐
│                   State Categorization                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Server State (React Query/tRPC)                        │
│  ├─ Projects, customers, budgets, etc.                  │
│  ├─ Cached with 5min staleTime                          │
│  └─ Invalidated on mutations                            │
│                                                          │
│  URL State (useSearchParams)                            │
│  ├─ Search queries, filters, pagination                 │
│  ├─ Bookmarkable, shareable                             │
│  └─ Synced via router.replace()                         │
│                                                          │
│  Auth State (AuthContext)                               │
│  ├─ User, org, role, permissions                        │
│  ├─ Initialized from session                            │
│  └─ Consumed via useAuth() hook                         │
│                                                          │
│  Theme State (next-themes)                              │
│  ├─ Dark/light/system preference                        │
│  ├─ Persisted to localStorage                           │
│  └─ Applied via CSS class on <html>                     │
│                                                          │
│  Local UI State (useState/useReducer)                   │
│  ├─ Modal open/close, form state                        │
│  ├─ Scoped to component                                 │
│  └─ Not shared across routes                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Data Flows

1. **Global Search Flow:**
   - User presses ⌘K → CommandPalette opens
   - User types query → Debounced tRPC queries fire for each entity type
   - Results stream in → Displayed in grouped lists
   - User selects result → router.push() navigates, palette closes

2. **Theme Change Flow:**
   - User clicks theme toggle → setTheme() called
   - next-themes updates localStorage + HTML class
   - CSS variables react instantly (no component re-render)
   - User preference persisted for next visit

3. **Project Navigation Flow:**
   - User clicks project tab → Link triggers client-side navigation
   - URL changes, layout persists (no unmount)
   - Page component renders, React Query checks cache
   - If cached: instant display; if not: loading state → fetch → display

4. **Form Submission Flow:**
   - User fills form → React Hook Form validates with Zod schema
   - User submits → onSubmit receives typed data
   - tRPC mutation called → Server validates (same Zod schema)
   - On success → React Query invalidates relevant queries → UI updates
   - On error → Error displayed in form field

## Integration Points with Existing Architecture

### Modifications to Existing Files

| File | Current State | Required Changes | Reason |
|------|---------------|------------------|--------|
| `app/layout.tsx` | Root layout with providers | Wrap in `<ThemeProvider>` | Enable dark mode support |
| `app/providers.tsx` | tRPC + Auth providers | Add ThemeProvider import/wrapper | Theme context needs root-level access |
| `app/(dashboard)/layout.tsx` | Uses `<AppShell>` | Modify AppShell structure | New top bar + contextual sidebar pattern |
| `components/layout/app-shell.tsx` | Current sidebar + top bar | Restructure to top bar + contextual sidebar | Enterprise navigation pattern |
| `components/layout/top-bar.tsx` | Basic header with user menu | Add search trigger button, theme toggle | Global search + dark mode access |
| `components/layout/sidebar.tsx` | Left sidebar with nav | Replace with contextual sidebar | Context-aware navigation |

### New Files to Create

| File | Purpose | Dependencies |
|------|---------|--------------|
| `components/layout/contextual-sidebar.tsx` | Renders project/settings nav based on route | `usePathname()`, route detection logic |
| `components/layout/project-nav.tsx` | Project section navigation | tRPC project data |
| `components/layout/settings-nav.tsx` | Settings tabs | None (static) |
| `components/layout/theme-toggle.tsx` | Dark mode switcher | `next-themes` |
| `components/search/command-palette.tsx` | Global search with cmdk | `cmdk`, tRPC search endpoints |
| `app/(dashboard)/projects/[projectId]/layout.tsx` | Persistent project header | tRPC project query |
| `app/(dashboard)/settings/layout.tsx` | Persistent settings navigation | settings-nav component |
| `components/forms/schemas/*.ts` | Zod validation schemas | `zod` |
| `lib/utils/slug.ts` | Slug creation/parsing utilities | None |
| `lib/theme.ts` | Theme configuration constants | None |

### API Changes Required

Add to tRPC router:

```typescript
// apps/api/src/trpc/routers/search.ts (NEW)
export const searchRouter = router({
  global: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      // Search across projects, customers, etc.
      // Return unified results with type discriminator
    }),

  projects: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      // Search projects only
    }),

  customers: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      // Search customers only
    }),
});
```

No changes to existing tRPC endpoints required (data fetching patterns remain the same).

## Component Library Organization

Following shadcn/ui best practices for 2026:

```
components/
├── ui/                          # Raw shadcn primitives (never modify)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── command.tsx              # NEW: cmdk wrapper
│   └── ...
├── primitives/                  # NEW: Lightly modified shadcn components
│   ├── data-table.tsx           # Enhanced table with sorting/filtering
│   └── form-field.tsx           # Opinionated form field wrapper
├── layout/                      # Layout-level components
│   ├── app-shell.tsx
│   ├── top-bar.tsx
│   ├── contextual-sidebar.tsx
│   ├── project-nav.tsx
│   ├── settings-nav.tsx
│   ├── theme-toggle.tsx
│   └── breadcrumbs.tsx
├── search/                      # Search features
│   ├── command-palette.tsx
│   ├── search-result-item.tsx
│   └── quick-actions.tsx
├── forms/                       # Form infrastructure
│   ├── schemas/                 # Zod schemas
│   │   ├── project.ts
│   │   ├── customer.ts
│   │   └── ...
│   └── form-wrapper.tsx         # Common form wrapper
├── project/                     # Project feature components
│   ├── project-form.tsx
│   ├── project-header.tsx       # NEW: Persistent header
│   ├── project-card.tsx
│   └── ...
├── budget/                      # Budget feature components
├── change-order/                # Change order feature components
└── ...                          # Other domain components
```

**Organization principles:**
- **ui/**: Never modify after initial setup (upgrade path stays clean)
- **primitives/**: Opinionated wrappers around ui/ (modified for project needs)
- **Feature folders**: Group by domain (project, budget, etc.)
- **Shared infrastructure**: layout/, search/, forms/ for cross-cutting concerns

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 projects | Current architecture is sufficient. Use basic search with client-side filtering. |
| 100-1,000 projects | Implement server-side search (Postgres full-text search or pg_trgm). Add pagination to project lists. Consider virtual scrolling for long lists. |
| 1,000-10,000 projects | Add dedicated search index (ElasticSearch or Typesense). Implement result pagination in command palette. Consider parallel routes for split-panel views. |
| 10,000+ projects | Dedicated search service required. Implement search result caching. Consider GraphQL for more efficient data fetching if tRPC query complexity grows. |

### Scaling Priorities

1. **First bottleneck: Search performance**
   - **Symptom:** Command palette lags with >500 projects
   - **Fix:** Move to server-side fuzzy search with ILIKE or pg_trgm extension
   - **Timeline:** Implement when project count exceeds 500

2. **Second bottleneck: Initial page load**
   - **Symptom:** Slow time-to-interactive on project detail pages
   - **Fix:** Implement React Server Components for static data, use Suspense boundaries
   - **Timeline:** Next.js 15 upgrade (RSC patterns more mature)

3. **Third bottleneck: Real-time updates**
   - **Symptom:** Users want live collaboration features
   - **Fix:** Add WebSocket support (tRPC subscriptions or Pusher)
   - **Timeline:** Phase-specific feature, not core architecture

## Anti-Patterns

### Anti-Pattern 1: Global State for UI Toggles

**What people do:** Use Zustand or Redux for sidebar collapse state, modal open/close, etc.

**Why it's wrong:**
- Adds unnecessary complexity
- State doesn't need to be shared across components
- Breaks on page reload (unless persisted, which adds more complexity)

**Do this instead:**
Use URL params for shareable state (filters, search), useState for local UI state (modals, dropdowns). Only use global state for truly global data (auth, theme).

```typescript
// BAD: Global store for modal state
const useModalStore = create((set) => ({
  isOpen: false,
  setOpen: (open: boolean) => set({ isOpen: open }),
}));

// GOOD: Local component state
export function ProjectCard() {
  const [isModalOpen, setModalOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setModalOpen(true)}>Edit</Button>
      <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
        {/* ... */}
      </Dialog>
    </>
  );
}
```

### Anti-Pattern 2: Fetching Data in Layouts

**What people do:** Use tRPC queries in layout components to load data for headers.

**Why it's wrong:**
- Layouts can't be async in App Router (causes hydration errors)
- Data fetching in layouts blocks all child pages
- Violates separation of concerns (layouts should compose, pages should fetch)

**Do this instead:**
Fetch data in Server Components (pages) and pass to layout via slots, or use client components with useQuery in layout (non-blocking).

```typescript
// BAD: Async layout with data fetching
export default async function ProjectLayout({ params }) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, params.projectId) });
  return <ProjectHeader project={project} />;
}

// GOOD: Client component in layout, non-blocking fetch
export default function ProjectLayout({ children, params }) {
  return (
    <>
      <ProjectHeaderClient projectId={params.projectId} />
      {children}
    </>
  );
}

// components/project/project-header-client.tsx
'use client';
export function ProjectHeaderClient({ projectId }) {
  const { data: project } = trpc.project.getById.useQuery({ id: projectId });
  if (!project) return <Skeleton />;
  return <ProjectHeader project={project} />;
}
```

### Anti-Pattern 3: Overusing Parallel Routes

**What people do:** Create parallel routes for every UI section thinking it improves performance.

**Why it's wrong:**
- Adds routing complexity without clear benefit
- Each slot needs default.tsx (easy to miss, causes 404s)
- Most dashboards don't need independent loading states per section
- Harder to debug routing issues

**Do this instead:**
Use parallel routes only when you need truly independent sections with different loading/error states (e.g., dashboard with analytics panel + notification feed). For most cases, use standard layouts with Suspense boundaries.

```typescript
// BAD: Parallel routes for simple project sections
app/(dashboard)/projects/[id]/
  @overview/page.tsx
  @documents/page.tsx
  @budget/page.tsx
  layout.tsx  // Manages 3 slots

// GOOD: Standard routing with Suspense
app/(dashboard)/projects/[id]/
  layout.tsx           // Persistent header
  page.tsx             // Overview tab
  documents/page.tsx   // Documents tab
  budget/page.tsx      // Budget tab

// Use Suspense in layout for independent loading
export default function ProjectLayout({ children }) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <ProjectHeader />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        {children}
      </Suspense>
    </>
  );
}
```

### Anti-Pattern 4: Theme Context Re-Renders

**What people do:** Create custom theme context that toggles a state value, causing entire app to re-render on theme change.

**Why it's wrong:**
- Every component re-renders on theme toggle (performance hit)
- Causes visible re-layout during theme switch
- Doesn't respect system preferences on initial load

**Do this instead:**
Use next-themes + CSS variables. Theme applied via HTML class, CSS variables react instantly, no React re-renders.

```typescript
// BAD: Custom theme context
const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>
      <div className={theme}>{children}</div>
    </ThemeContext.Provider>
  );
}

// GOOD: next-themes with CSS variables
import { ThemeProvider } from 'next-themes';

export function Providers({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
```

## Build Order and Dependencies

Recommended implementation sequence based on architectural dependencies:

### Phase 1: Foundation (No dependencies)
1. **Theme infrastructure**
   - Add next-themes to providers
   - Define CSS variables for dark mode
   - Create theme toggle component
   - **Why first:** Independent of other changes, enables testing dark mode early

2. **Form schema migration**
   - Extract existing inline Zod schemas to `components/forms/schemas/`
   - Update forms to use centralized schemas
   - **Why first:** No architectural dependencies, improves type safety immediately

### Phase 2: Navigation Shell (Depends on Phase 1 theme)
3. **Top bar redesign**
   - Move user menu to right
   - Add theme toggle
   - Add search trigger button (non-functional initially)
   - **Depends on:** Theme toggle from Phase 1

4. **Contextual sidebar structure**
   - Create contextual-sidebar.tsx with route detection
   - Implement project-nav.tsx, settings-nav.tsx
   - Modify app-shell.tsx to use new sidebar
   - **Depends on:** Top bar structure

### Phase 3: Persistent Layouts (Depends on Phase 2 shell)
5. **Project layout implementation**
   - Create `app/(dashboard)/projects/[projectId]/layout.tsx`
   - Move project header + tabs to layout
   - Test navigation persistence
   - **Depends on:** Contextual sidebar for project nav

6. **Settings layout implementation**
   - Create `app/(dashboard)/settings/layout.tsx`
   - Move settings tabs to persistent layout
   - **Depends on:** Contextual sidebar for settings nav

### Phase 4: Global Search (Depends on Phase 2-3 for navigation context)
7. **tRPC search endpoints**
   - Add search router with global/projects/customers queries
   - Implement server-side search logic (ILIKE for MVP)
   - **Independent:** Can develop in parallel with UI

8. **Command palette UI**
   - Create command-palette.tsx with cmdk
   - Wire up search endpoints
   - Add keyboard shortcuts (⌘K)
   - **Depends on:** Search endpoints, top bar trigger button

### Phase 5: Polish (Depends on all previous phases)
9. **URL-based state for filters**
   - Convert existing filter state to useSearchParams
   - Update project list, customer list pages
   - **Depends on:** Layouts complete (state needs stable navigation)

10. **Slug-based URLs (optional)**
    - Add slug utility functions
    - Update Link components to use slugs
    - Add slug parsing to dynamic routes
    - **Independent:** Can defer if timeline is tight

### Dependency Graph

```
Phase 1 (Theme + Schemas)
    ↓
Phase 2 (Top Bar + Sidebar)
    ↓
Phase 3 (Persistent Layouts) ← Phase 4 (Search Endpoints)
    ↓                              ↓
Phase 4 (Command Palette) ←────────┘
    ↓
Phase 5 (URL State + Slugs)
```

**Critical path:** Theme → Top Bar → Layouts → Command Palette
**Parallel work possible:** Search endpoints can be developed while layouts are built

## Sources

Research informed by official documentation and 2026 best practices:

- [Next.js App Router Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) - Persistent layout patterns
- [Next.js Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) - Advanced routing patterns
- [Next.js Dynamic Routes 2026 Guide](https://thelinuxcode.com/nextjs-dynamic-route-segments-in-the-app-router-2026-guide/) - Slug-based routing
- [Next.js State Management with URL Parameters](https://medium.com/@roman_j/mastering-state-in-next-js-app-router-with-url-query-parameters-a-practical-guide-03939921d09c) - URL-based state
- [SaaS Navigation UX Best Practices](https://www.merveilleux.design/en/blog/article/comprehensive-guide-for-saas-products-on-ux-navigation-types) - Enterprise navigation patterns
- [SaaS Navigation Menu Design 2025](https://lollypop.design/blog/2025/december/saas-navigation-menu-design/) - Top bar + sidebar patterns
- [next-themes](https://github.com/pacocoursey/next-themes) - Dark mode implementation
- [Dark Mode with Next.js and CSS Variables](https://codimite.ai/blog/applying-dark-mode-in-next-js-using-css-variables/) - Theme architecture
- [cmdk Command Palette](https://github.com/dip/cmdk) - Global search implementation
- [shadcn/ui Command](https://www.shadcn.io/ui/command) - Command palette UI
- [React Hook Form with Zod](https://www.contentful.com/blog/react-hook-form-validation-zod/) - Form validation patterns
- [shadcn/ui Best Practices for 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44) - Component organization

---

*Architecture research for: Enterprise UI/UX Redesign*
*Researched: 2026-02-14*
*Confidence: HIGH (official Next.js docs + verified 2026 community patterns)*
