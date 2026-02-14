# Stack Research — Enterprise UI/UX Enhancement

**Domain:** Enterprise construction management SaaS UI/UX redesign
**Researched:** 2026-02-14
**Confidence:** HIGH

## Executive Summary

This research identifies stack additions needed to transform the existing Next.js 14 + Tailwind + shadcn/ui foundation into an enterprise-grade interface. The focus is on NEW capabilities: dark mode, advanced navigation patterns, global search, form standardization, and component sophistication.

**Key Finding:** The existing stack is already enterprise-ready. Strategic additions (not replacements) will unlock Procore-level UX without architectural changes. All additions integrate seamlessly with the current tRPC + PostgreSQL backend.

## Recommended Stack Additions

### Theme Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| next-themes | ^0.4.6 | Dark mode state management | Industry standard for Next.js 14 App Router. Zero-flash dark mode with system preference detection. Already in use (apps/web/package.json line 45). **HIGH confidence** — [official GitHub](https://github.com/pacocoursey/next-themes), [shadcn docs](https://ui.shadcn.com/docs/dark-mode/next) |

**Status:** Already installed. No action needed.

**Integration:** Works with existing Tailwind `dark:` classes. Add `suppressHydrationWarning` to `<html>` tag and wrap app with `ThemeProvider`.

### Form Validation & State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-hook-form | ^7.71.1 | Form state management | Already installed (line 49). Performant, minimal re-renders, excellent DX. **HIGH confidence** — [official docs](https://react-hook-form.com/docs/useform) |
| zod | ^4.3.5 (upgrade from ^3.25.76) | Runtime schema validation | Upgrade needed. Type-safe validation that works client + server. Industry standard with shadcn/ui. **HIGH confidence** — [resolver compatibility](https://github.com/react-hook-form/resolvers/releases) |
| @hookform/resolvers | ^5.2.2 | Bridge react-hook-form + zod | Already installed (line 18). Supports Zod v3.25+ and v4+. **HIGH confidence** — [GitHub releases](https://github.com/react-hook-form/resolvers) |

**Status:**
- react-hook-form: Installed ✓
- @hookform/resolvers: Installed ✓
- zod: **Upgrade needed** from 3.25.76 to 4.x for latest features

**Integration:** Use `zodResolver` to connect schemas to forms. Works seamlessly with Next.js Server Actions for consistent client/server validation.

### Global Search & Command Palette

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| cmdk | ^1.1.1 | Command palette framework | Already installed (line 40). Used by Linear, Raycast, Vercel. Fuzzy search, keyboard nav, instant filtering. **HIGH confidence** — [npm](https://www.npmjs.com/package/cmdk), [shadcn Command](https://ui.shadcn.com/docs/components/radix/command) |

**Status:** Already installed. No action needed.

**Integration:**
- shadcn/ui provides pre-built `<Command>` component wrapping cmdk
- **Breaking change in v1.0+**: Requires `<CommandList>` wrapper around `<CommandGroup>`
- Customize search with `filter` prop for multi-field search (not just `value`)

### URL State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nuqs | ^2.8.8 | Type-safe URL search params | **ADD THIS.** Replaces manual `useSearchParams` + `useRouter`. Type-safe `useState`-like API for URL state. Used by Sentry, Supabase, Vercel, Clerk. Supports Next.js 14.2+ App Router. **HIGH confidence** — [official docs](https://nuqs.dev/), [GitHub](https://github.com/47ng/nuqs) |

**Status:** **Not installed. Recommended addition.**

**Why:**
- Filtering, sorting, pagination, drawer state → persist in URL
- Built-in parsers (string, int, boolean, date, enum)
- Shallow routing built-in (no manual history API)
- 10K GitHub stars, 1M+ weekly downloads

**Integration:** Wrap app with `NuqsAdapter` in layout. Use `useQueryState` hook like `useState` but synced to URL.

### Data Tables

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @tanstack/react-table | ^8.21.3 | Headless table logic | **ADD THIS.** Industry-leading headless table library. Handles sorting, filtering, pagination, column visibility, row selection. TypeScript-first. Completely unstyled (you control markup). **HIGH confidence** — [official docs](https://tanstack.com/table/latest), [shadcn example](https://ui.shadcn.com/docs/components/radix/data-table) |

**Status:** **Not installed. Recommended addition for data-heavy views.**

**Why:**
- Budget tables, change order lists, payment app grids need enterprise-grade sorting/filtering
- Headless = style with existing Tailwind + shadcn/ui components
- Memoization built-in for performance with large datasets
- Works seamlessly with nuqs for URL-based filtering

**Alternative Considered:** Building custom table logic. **Rejected** because TanStack Table solves complex edge cases (column resizing, virtualization, server-side pagination) that would take weeks to implement correctly.

### Toast Notifications

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| sonner | ^2.0.7 | Toast notification system | Already installed (line 51). Modern, accessible, promise-based toasts. Auto-theming with next-themes. Used widely in shadcn/ui ecosystem. **HIGH confidence** — [GitHub](https://github.com/emilkowalski/sonner), [shadcn integration](https://ui.shadcn.com/docs/components/radix/sonner) |

**Status:** Already installed. No action needed.

**Integration:** Use `toast.promise()` for async operations (form submissions, API calls). Auto-stacks toasts, keyboard shortcuts built-in.

### Charts & Data Visualization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| recharts | ^3.7.0 | Chart library | Already installed (line 50). Declarative API, composable components. Good balance of power + simplicity. **MEDIUM confidence** — preferred over Tremor because Tremor is opinionated + limits low-level customization. [npm trends](https://npmtrends.com/@tremor/react-vs-recharts) shows Recharts has 67x more downloads |

**Status:** Already installed. No action needed.

**Alternative Considered:** Tremor. **Rejected** because Tremor is tightly coupled to Tailwind + provides high-level dashboard components that may not match Procore-style designs. Recharts gives more control.

### Modal & Drawer Patterns

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| vaul | latest (via shadcn) | Mobile-first drawer component | **ADD via shadcn CLI.** Powers shadcn/ui `<Drawer>` component. Gesture-responsive, snap points, native-feeling animations. Built by same author as Sonner. **HIGH confidence** — [shadcn Drawer](https://ui.shadcn.com/docs/components/radix/drawer), [vaul GitHub](https://github.com/emilkowalski/vaul) |

**Status:** **Not installed. Add via `npx shadcn-ui@latest add drawer`**

**Why:**
- Responsive patterns: Dialog on desktop, Drawer on mobile
- Change order details, document previews, filtering panels
- Physics-based animations, swipe-to-dismiss

### Date & Time Handling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| date-fns | ^2.30.0 (upgrade to ^4.1.0) | Date formatting & manipulation | Already installed (line 41). **Upgrade to v4** for better tree-shaking + performance. Functional API, extensive utilities (200+ functions). **HIGH confidence** — [official docs](https://date-fns.org/), [vs dayjs comparison](https://www.dhiwise.com/post/date-fns-vs-dayjs-the-battle-of-javascript-date-libraries) |
| date-fns-tz | ^3.2.0 | Timezone support | **ADD THIS.** Essential for multi-timezone construction projects. Works with date-fns v4. **MEDIUM confidence** — needed if users work across timezones |
| react-day-picker | ^9.13.2 | Calendar component | Already installed (line 47). Powers shadcn `<Calendar>` and `<DatePicker>`. v9 is latest with timezone support. **HIGH confidence** — [shadcn Calendar](https://ui.shadcn.com/docs/components/radix/calendar) |

**Status:**
- date-fns: Installed but **upgrade recommended** (v2 → v4)
- date-fns-tz: **Not installed. Recommended if timezone support needed**
- react-day-picker: Installed ✓

**Why date-fns over dayjs:**
- Better tree-shaking (date-fns imports individual functions, dayjs imports full library)
- More extensive functionality (200+ functions vs 40+)
- Larger ecosystem (used by shadcn/ui examples)

### Input Masking

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-imask | ^7.6.1 | Input masking (phone, currency, dates) | **ADD THIS.** Best masking library for React. Supports phone numbers, currency, percentage, dates. Works with react-hook-form. **MEDIUM confidence** — [official docs](https://imask.js.org/), [npm](https://www.npmjs.com/package/react-imask) |

**Status:** **Not installed. Recommended for bid amounts, phone numbers, percentages.**

**Why:**
- Bid forms need currency masking ($1,234,567.89)
- Contact forms need phone masking ((555) 123-4567)
- Change order percentages need decimal masking (15.5%)
- Works with `IMaskInput` component or `useIMask` hook

**Alternative Considered:** react-number-format. **Comparable** but IMask has broader pattern support (dates, regex masks).

### Icon System

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| lucide-react | ^0.460.0 | Icon library | Already installed (line 43). Tree-shakable SVG icons. Default for shadcn/ui. 1000+ icons, consistent design, accessible. **HIGH confidence** — [official docs](https://lucide.dev/guide/packages/lucide-react), [shadcn icons](https://www.shadcn.io/icons/lucide) |

**Status:** Already installed. No action needed.

**Best Practice:** Import icons individually (`import { FileText } from 'lucide-react'`). Never create dynamic icon loader (imports all icons, bloats bundle).

### Utility Libraries

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| clsx | ^2.1.0 | Conditional class names | Already installed (line 39). Tiny (228B), fast. **HIGH confidence** |
| tailwind-merge | ^2.6.0 | Merge Tailwind classes without conflicts | Already installed (line 52). Prevents `bg-red-500 bg-blue-500` conflicts. **HIGH confidence** — [docs](https://github.com/dcastil/tailwind-merge) |
| class-variance-authority | ^0.7.1 | Component variant system | Already installed (line 38). Powers shadcn/ui variants. Type-safe variant props. **HIGH confidence** — [docs](https://cva.style/docs) |

**Status:** All installed. No action needed.

**Pattern:** Combine in `cn()` helper:
```ts
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs) => twMerge(clsx(inputs))
```

### Animation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tw-animate-css | latest | Tailwind v4 animations | **MIGRATION NEEDED.** shadcn/ui deprecated `tailwindcss-animate` in favor of `tw-animate-css` for Tailwind v4 support. **HIGH confidence** — [shadcn Tailwind v4 guide](https://ui.shadcn.com/docs/tailwind-v4) |

**Status:** Currently using `tailwindcss-animate` (line 62). **Need to migrate when upgrading to Tailwind v4.**

**Migration Steps:**
1. Remove `tailwindcss-animate` from package.json
2. Remove `@plugin 'tailwindcss-animate'` from globals.css
3. Install `tw-animate-css` as dev dependency
4. Add `@import "tw-animate-css"` to globals.css

**Note:** Not urgent unless migrating to Tailwind v4.

## Installation Commands

### Immediate Additions (High Priority)
```bash
# Install missing core libraries
npm install nuqs@^2.8.8 @tanstack/react-table@^8.21.3

# Add shadcn drawer component
npx shadcn-ui@latest add drawer

# Optional: Input masking if needed
npm install react-imask@^7.6.1
```

### Recommended Upgrades
```bash
# Upgrade to Zod v4 for latest features
npm install zod@^4.3.5

# Upgrade date-fns to v4 for better tree-shaking
npm install date-fns@^4.1.0

# Optional: Timezone support
npm install date-fns-tz@^3.2.0
```

### Future Migration (Tailwind v4)
```bash
# When ready to migrate to Tailwind v4
npm uninstall tailwindcss-animate
npm install -D tw-animate-css
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| **URL State** | nuqs | Manual `useSearchParams` + `useRouter` | Too verbose, no type safety, easy to misuse (shallow routing, race conditions) |
| **Data Tables** | @tanstack/react-table | Custom table logic | Complex edge cases (column resizing, virtualization) solved by TanStack |
| **Charts** | recharts | Tremor | Tremor too opinionated, limits low-level customization, tightly coupled to Tailwind |
| **Date Formatting** | date-fns | dayjs | date-fns has better tree-shaking, more functions, larger ecosystem |
| **Input Masking** | react-imask | react-number-format | IMask has broader pattern support (dates, regex) |
| **Toast** | sonner | react-hot-toast | Sonner has better shadcn integration, promise API, auto-theming |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **moment.js** | Deprecated, huge bundle size (70KB), mutable API causes bugs | date-fns (tree-shakable, immutable) |
| **react-icons** | Imports all icon sets even if unused, bloats bundle | lucide-react (tree-shakable, shadcn default) |
| **Custom form validation** | Reinventing the wheel, missing edge cases, no type safety | react-hook-form + zod |
| **localStorage for theme** | Flash on page load, no SSR support, requires manual sync | next-themes (zero-flash, SSR-safe) |
| **Tremor charts** | Opinionated design system, limits customization | recharts (more control) |
| **Dynamic icon loading** | `icons[name]` pattern imports all icons, increases build time | Direct imports: `import { Icon } from 'lucide-react'` |

## Stack Patterns for This Project

### Pattern 1: Server + Client Validation
**Use for:** All forms (bid creation, change orders, payments)

```tsx
// schema.ts (shared)
export const bidSchema = z.object({
  amount: z.number().positive(),
  projectId: z.string().uuid()
})

// client component
const form = useForm({
  resolver: zodResolver(bidSchema)
})

// server action
export async function createBid(data: unknown) {
  const validated = bidSchema.parse(data) // Same schema!
  // ...
}
```

**Why:** Single source of truth. Client validation prevents bad UX, server validation prevents malicious data.

### Pattern 2: URL-Driven Filtering
**Use for:** Budget tables, change order lists, payment grids

```tsx
const [status, setStatus] = useQueryState('status', parseAsString.withDefault('all'))
const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('date'))

// URL: /budgets?status=approved&sort=date
// Shareable, bookmarkable, back-button works
```

**Why:** Enterprise apps need shareable filter states. URL state enables bookmarking, back button, deep linking.

### Pattern 3: Responsive Modal/Drawer
**Use for:** Change order details, document viewer, filter panels

```tsx
// Desktop: Dialog, Mobile: Drawer
const isMobile = useMediaQuery('(max-width: 768px)')

{isMobile ? (
  <Drawer>...</Drawer>
) : (
  <Dialog>...</Dialog>
)}
```

**Why:** Procore-style density on desktop, mobile-friendly on tablets/phones.

### Pattern 4: Optimistic Updates with Toast Feedback
**Use for:** Any mutation (create, update, delete)

```tsx
const mutation = useMutation({
  onMutate: async (newData) => {
    toast.promise(mutation.mutateAsync(newData), {
      loading: 'Saving...',
      success: 'Saved!',
      error: 'Failed to save'
    })
  }
})
```

**Why:** Immediate feedback. Promise-based toasts show loading → success/error automatically.

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| next-themes | ^0.4.6 | Next.js 14.x, React 18.x | Works with App Router |
| react-hook-form | ^7.71.1 | zod ^3.25 or ^4.x, @hookform/resolvers ^5.2 | v8 in beta (breaking changes) |
| zod | ^4.3.5 | @hookform/resolvers ^5.2+ | v4 requires resolver 5.2+ |
| @hookform/resolvers | ^5.2.2 | react-hook-form ^7.x, zod ^3.25+ or ^4.x | Auto-detects Zod v3 vs v4 |
| nuqs | ^2.8.8 | Next.js 14.2+, React 18+ | Requires `NuqsAdapter` in layout |
| @tanstack/react-table | ^8.21.3 | React 16.8, 17, 18, 19 | Headless, framework-agnostic |
| date-fns | ^4.1.0 | date-fns-tz ^3.2.0 | v4 has breaking changes from v2 |
| cmdk | ^1.1.1 | React 18+ | v1.0+ requires `<CommandList>` wrapper |
| sonner | ^2.0.7 | next-themes (auto-theming) | Works without next-themes but no dark mode |
| tailwindcss-animate | ^1.0.7 | Tailwind CSS 3.x | **Deprecated for Tailwind v4** → use tw-animate-css |

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 14 App Router                  │
│                     (Existing Foundation)                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│  Theme Layer   │   │  Form Layer     │   │  Data Layer    │
│                │   │                 │   │                │
│ next-themes    │   │ react-hook-form │   │ TanStack Table │
│ (dark mode)    │   │ zod (validation)│   │ (tables)       │
│                │   │ react-imask     │   │ recharts       │
│                │   │ (input masks)   │   │ (charts)       │
└────────────────┘   └─────────────────┘   └────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│  UI Layer      │   │ Navigation      │   │  State Layer   │
│                │   │                 │   │                │
│ shadcn/ui      │   │ cmdk (search)   │   │ nuqs (URL)     │
│ Radix UI       │   │ vaul (drawer)   │   │ React Query    │
│ lucide-react   │   │ breadcrumbs     │   │ (existing)     │
│ sonner (toast) │   │                 │   │                │
└────────────────┘   └─────────────────┘   └────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                ┌─────────────▼─────────────┐
                │   Tailwind CSS 3.x        │
                │   (Utility-first styling) │
                └───────────────────────────┘
                              │
                ┌─────────────▼─────────────┐
                │   tRPC + PostgreSQL       │
                │   (Existing Backend)      │
                └───────────────────────────┘
```

**Key Insight:** All additions are NON-BREAKING. They layer on top of existing Next.js/Tailwind/shadcn foundation without requiring architectural changes.

## Migration Strategy

### Phase 1: Install Core Additions (Week 1)
1. Install nuqs for URL state management
2. Install @tanstack/react-table for data tables
3. Add shadcn Drawer component
4. Add react-imask for input masking

### Phase 2: Upgrade Dependencies (Week 2)
1. Upgrade zod to v4
2. Upgrade date-fns to v4
3. Test form validation (zod v4 has type system changes)
4. Test date formatting (date-fns v4 has API changes)

### Phase 3: Future (When Ready for Tailwind v4)
1. Migrate tailwindcss-animate → tw-animate-css
2. Update Tailwind config to v4 format
3. Test animations

## Sources

### High Confidence (Official Documentation)
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) — Dark mode implementation
- [shadcn/ui Dark Mode Guide](https://ui.shadcn.com/docs/dark-mode/next) — Next.js integration
- [react-hook-form Documentation](https://react-hook-form.com/docs/useform) — Form state management
- [@hookform/resolvers GitHub](https://github.com/react-hook-form/resolvers) — Zod compatibility
- [nuqs Official Docs](https://nuqs.dev/) — URL state management
- [nuqs GitHub](https://github.com/47ng/nuqs) — Installation guide
- [TanStack Table Docs](https://tanstack.com/table/latest) — Table library
- [shadcn/ui Command](https://ui.shadcn.com/docs/components/radix/command) — cmdk integration
- [shadcn/ui Drawer](https://ui.shadcn.com/docs/components/radix/drawer) — Vaul integration
- [date-fns Official Docs](https://date-fns.org/) — Date formatting
- [lucide-react Guide](https://lucide.dev/guide/packages/lucide-react) — Icon usage
- [Class Variance Authority](https://cva.style/docs) — Component variants
- [shadcn Tailwind v4 Migration](https://ui.shadcn.com/docs/tailwind-v4) — Animation migration

### Medium Confidence (Community Resources, Web Search)
- [Managing Search Parameters in Next.js with nuqs - LogRocket](https://blog.logrocket.com/managing-search-parameters-next-js-nuqs/) — nuqs patterns
- [TanStack Table Guide - LogRocket](https://blog.logrocket.com/tanstack-table-formerly-react-table/) — Migration guide
- [date-fns vs dayjs Comparison](https://www.dhiwise.com/post/date-fns-vs-dayjs-the-battle-of-javascript-date-libraries) — Library comparison
- [Sonner Toast Notifications - Medium](https://medium.com/@rivainasution/shadcn-ui-react-series-part-19-sonner-modern-toast-notifications-done-right-903757c5681f) — Best practices
- [React Hook Form with Zod - Medium](https://medium.com/@techwithtwin/handling-forms-in-next-js-with-react-hook-form-zod-and-server-actions-e148d4dc6dc1) — Server Actions integration
- [react-imask Documentation](https://imask.js.org/) — Input masking patterns
- [cn() Utility Function Explained](https://thinkthroo.com/blog/cn-utility-function-in-shadcn-ui-ui) — Tailwind class merging

### Version Information (npm/GitHub)
- [next-themes npm](https://www.npmjs.com/package/next-themes) — v0.4.6
- [nuqs npm](https://www.npmjs.com/package/nuqs) — v2.8.8
- [cmdk npm](https://www.npmjs.com/package/cmdk) — v1.1.1
- [@tanstack/react-table npm](https://www.npmjs.com/package/@tanstack/react-table) — v8.21.3
- [Zod v4 Compatibility Issue](https://github.com/react-hook-form/react-hook-form/issues/12829) — resolver support

---

*Stack research for: Enterprise UI/UX Enhancement — Construction Management SaaS*
*Researched: 2026-02-14*
*Next Step: Feed into roadmap creation (phase structure, technology decisions)*
