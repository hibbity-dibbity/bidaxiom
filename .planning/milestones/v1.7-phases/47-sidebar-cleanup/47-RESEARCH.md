# Phase 47: Sidebar Cleanup - Research

**Researched:** 2026-02-23
**Domain:** Next.js sidebar navigation component
**Confidence:** HIGH

---

## Summary

The sidebar is implemented as two tightly coupled components: `AppSidebar` (renders the shell, group wrapper, and the "Navigation" heading label) and `SidebarNav` (renders the flat `mainNav` config array as menu items). All four sections to be removed — Bidding, Financials, Documents, Reports — are entries in a single static array in `sidebar-nav.tsx`. There are no conditionals, no role-based guards, and no server-side data involved. The "Navigation" heading lives in `sidebar.tsx` as a `<SidebarGroupLabel>` inside a `<SidebarGroup>`.

No test files exist for these components in the web app. The change is entirely a config-array edit plus a JSX label removal, making this a very low-risk, surgical operation.

**Primary recommendation:** Delete the four array entries from `mainNav` in `sidebar-nav.tsx`, remove the four now-unused Lucide icon imports from the same file, and remove the `<SidebarGroupLabel>Navigation</SidebarGroupLabel>` line from `sidebar.tsx`.

---

## 1. Sidebar Component File Paths

| File | Role |
|------|------|
| `apps/web/components/layout/sidebar.tsx` | Outer shell — renders `<ShadcnSidebar>`, `<SidebarHeader>` (logo), `<SidebarGroup>`, and the `<SidebarGroupLabel>Navigation</SidebarGroupLabel>` heading |
| `apps/web/components/layout/sidebar-nav.tsx` | Inner nav — defines `mainNav` array and renders each item as a `<SidebarMenuButton>` |
| `apps/web/components/layout/app-shell.tsx` | Composes `AppSidebar` + `TopBar` + content; no nav config here |
| `apps/web/app/(dashboard)/layout.tsx` | Next.js layout that mounts `AppShell`; no nav config here |

---

## 2. Current Sidebar Structure (all sections and items)

The sidebar has **one group** called "Navigation" containing a single flat list. There are no sub-groups or nested sections — every entry is a peer in the `mainNav` array.

### `mainNav` array — `apps/web/components/layout/sidebar-nav.tsx` lines 22–32

```typescript
const mainNav = [
  { href: "/",              label: "Dashboard",      icon: Home },         // line 23
  { href: "/projects",     label: "Projects",        icon: FolderKanban }, // line 24
  { href: "/customers",    label: "Customers",        icon: Users },        // line 25
  { href: "/subcontractors", label: "Subcontractors", icon: HardHat },      // line 26
  { href: "/bids",         label: "Bidding",          icon: Briefcase },    // line 27 — REMOVE
  { href: "/financials",   label: "Financials",       icon: DollarSign },   // line 28 — REMOVE
  { href: "/documents",    label: "Documents",        icon: FileText },     // line 29 — REMOVE
  { href: "/reports",      label: "Reports",          icon: BarChart },     // line 30 — REMOVE
  { href: "/settings",     label: "Settings",         icon: Settings },     // line 31
];
```

### Group heading — `apps/web/components/layout/sidebar.tsx` line 85

```tsx
<SidebarGroupLabel>Navigation</SidebarGroupLabel>   // line 85 — REMOVE
```

---

## 3. Sections / Items to REMOVE

### A. `apps/web/components/layout/sidebar-nav.tsx`

**Array entries to delete (lines 27–30):**

```typescript
  { href: "/bids",       label: "Bidding",   icon: Briefcase },  // NAV-01
  { href: "/financials", label: "Financials", icon: DollarSign }, // NAV-02
  { href: "/documents",  label: "Documents",  icon: FileText },   // NAV-03
  { href: "/reports",    label: "Reports",    icon: BarChart },   // NAV-04
```

**Lucide icon imports to remove (lines 8–9, 13–14) — all four are exclusively used by removed entries:**

```typescript
  DollarSign,   // line 8  — only used by Financials entry
  FileText,     // line 9  — only used by Documents entry
  BarChart,     // line 13 — only used by Reports entry
  Briefcase,    // line 14 — only used by Bidding entry
```

The import block currently spans lines 6–15. After removal, remaining icons are: `Home`, `FolderKanban`, `Users`, `HardHat`, `Settings`.

### B. `apps/web/components/layout/sidebar.tsx`

**JSX line to delete (line 85):**

```tsx
<SidebarGroupLabel>Navigation</SidebarGroupLabel>   // NAV-05
```

The `SidebarGroupLabel` import at line 10 can also be removed since it will no longer be used anywhere in `sidebar.tsx`. Verify no other usage exists in the file before removing (confirmed — it appears only on line 85).

---

## 4. Sections / Items to KEEP

All remaining entries stay untouched:

| Label | href | Icon | File Line |
|-------|------|------|-----------|
| Dashboard | `/` | `Home` | sidebar-nav.tsx line 23 |
| Projects | `/projects` | `FolderKanban` | sidebar-nav.tsx line 24 |
| Customers | `/customers` | `Users` | sidebar-nav.tsx line 25 |
| Subcontractors | `/subcontractors` | `HardHat` | sidebar-nav.tsx line 26 |
| Settings | `/settings` | `Settings` | sidebar-nav.tsx line 31 |

The `<SidebarGroup>` wrapper itself stays in `sidebar.tsx` (lines 84 and 87) — only the `<SidebarGroupLabel>` child is removed. The `<SidebarNav />` call stays as-is.

---

## 5. Architecture Notes

- **Pattern:** Single flat static config array (`mainNav`). No dynamic data, no API calls, no role-based conditionals, no feature flags. The array is iterated with `.map()` on every render.
- **No sub-groups:** All items are peers in a single `<SidebarGroup>`. There is no Bidding "section", Financials "section", etc. as separate groups — they are just individual array entries.
- **Active state:** Determined by `pathname === item.href` (exact match). Removing entries has no side-effect on active state detection for remaining items.
- **Collapsible sidebar:** The `AppSidebar` uses shadcn's `collapsible="icon"` variant. Nav items render icon + text in expanded mode, icon-only when collapsed. No special handling needed for removed items.
- **localStorage persistence:** Sidebar open/closed state is persisted under key `"sidebar-collapsed"`. Unrelated to nav items.
- **Routing:** The `/bids`, `/financials`, `/documents`, and `/reports` top-level route directories do NOT exist under `app/(dashboard)/` — only `/reports/` exists as a route directory. This means the nav entries were mostly dead links already (except Reports). Removing them from the nav does not break any existing routes.
- **`reports/` route exists:** The `/reports` directory with sub-pages exists at `app/(dashboard)/reports/`. Removing the sidebar link does not delete those pages; they remain accessible by direct URL. This is correct behavior for this cleanup.

---

## 6. Risk Areas and Special Handling

### Risk 1: Orphaned `SidebarGroupLabel` import in sidebar.tsx (LOW risk)
After removing `<SidebarGroupLabel>Navigation</SidebarGroupLabel>`, the `SidebarGroupLabel` named import on line 10 of `sidebar.tsx` becomes unused. It must be removed to avoid a TypeScript/lint warning. Confirm by checking that `SidebarGroupLabel` appears nowhere else in the file (confirmed — only on line 85).

### Risk 2: `breadcrumbs.tsx` has `bids` and `financials` labels (NO action needed for this phase)
`apps/web/components/layout/breadcrumbs.tsx` lines 20–21 contain:
```typescript
bids: "Bidding",
financials: "Financials",
```
These are segment label mappings for the `Breadcrumbs` component. Since there are no top-level `/bids` or `/financials` routes (those pages were never built), these mappings are already dead code. They are harmless and out of scope for this phase, but a future cleanup could remove them.

### Risk 3: Four icon imports become unused (LOW risk, must fix)
`DollarSign`, `FileText`, `BarChart`, and `Briefcase` are imported from `lucide-react` but used only by the removed entries. Leaving them causes a lint warning (and potentially a TypeScript error if `noUnusedLocals` is enabled). They must be removed in the same edit.

### Risk 4: Reports route pages still exist (NO risk)
The `/reports` directory and its sub-pages (`page.tsx`, `create/`, `templates/`, `[reportId]/`) still exist after removing the sidebar link. This is intentional — sidebar cleanup does not delete pages.

---

## 7. Test Files Affected

**None.** There are zero test files (`*.test.*`, `*.spec.*`) anywhere in `apps/web/`. No snapshot tests, no component tests. No test changes required.

---

## Sources

- Direct file read: `apps/web/components/layout/sidebar-nav.tsx` — confirmed full `mainNav` array contents
- Direct file read: `apps/web/components/layout/sidebar.tsx` — confirmed `<SidebarGroupLabel>Navigation</SidebarGroupLabel>` at line 85
- Direct file read: `apps/web/components/layout/app-shell.tsx` — confirmed no nav config in shell
- Direct file read: `apps/web/app/(dashboard)/layout.tsx` — confirmed no nav config in layout
- Direct file read: `apps/web/components/layout/breadcrumbs.tsx` — confirmed dead bids/financials entries, out of scope
- Directory scan: `apps/web/app/(dashboard)/` — confirmed no `/bids`, `/financials`, `/documents` top-level routes exist
- Grep scan: confirmed `Navigation` heading appears only once in `sidebar.tsx` (line 85); other "Navigation" mentions are JSX comments and a lib file, not visible UI headings
- Grep scan: confirmed `DollarSign`, `FileText`, `BarChart`, `Briefcase` are only used by the four removed entries

---

## Metadata

**Confidence breakdown:**
- Component locations: HIGH — read directly from filesystem
- Current sidebar structure: HIGH — read directly from source
- Items to remove: HIGH — confirmed by direct file read and grep verification
- Architecture (static array, no conditionals): HIGH — confirmed by reading full component code
- Test impact: HIGH — confirmed by filesystem scan returning zero app test files

**Research date:** 2026-02-23
**Valid until:** Until sidebar-nav.tsx or sidebar.tsx is modified
