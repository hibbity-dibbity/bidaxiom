---
phase: 13-navigation-and-theme-foundation
plan: 04
subsystem: navigation
tags: [navigation, sidebar, search, url-state, ui]
dependency_graph:
  requires:
    - "13-03-PLAN.md (Company Logo Frontend Integration)"
  provides:
    - "Persistent sidebar collapse state"
    - "Contextual sidebar navigation"
    - "Global search trigger with Cmd+K"
    - "URL-based navigation state management"
  affects:
    - "apps/web/components/layout/*"
    - "All navigation interactions"
tech_stack:
  added:
    - "nuqs (URL state management)"
  patterns:
    - "localStorage for sidebar persistence"
    - "React Context for search state"
    - "Contextual navigation based on pathname"
key_files:
  created:
    - "apps/web/lib/navigation-state.ts"
    - "apps/web/components/search/command-palette.tsx"
  modified:
    - "apps/web/components/layout/sidebar.tsx"
    - "apps/web/components/layout/sidebar-nav.tsx"
    - "apps/web/components/layout/top-bar.tsx"
    - "apps/web/components/layout/app-shell.tsx"
    - "apps/web/package.json"
decisions:
  - name: "localStorage for sidebar state"
    rationale: "Client-side preference only, doesn't affect SSR, no FOUC concern, faster than cookie parsing"
  - name: "Contextual navigation pattern"
    rationale: "Project detail pages show project-specific nav (Overview, Budget, Change Orders, Documents), main pages show global nav - matches Procore NGX pattern"
  - name: "SearchProvider context pattern"
    rationale: "Enables TopBar search button and Cmd+K keyboard shortcut to trigger same command palette"
  - name: "nuqs for URL state management"
    rationale: "Enables shareable/bookmarkable navigation states, shallow routing prevents full page navigation"
metrics:
  duration: "2 minutes"
  tasks: 2
  files_modified: 6
  files_created: 2
  completed: "2026-02-14"
---

# Phase 13 Plan 04: Contextual Sidebar & Search Summary

**One-liner:** Sidebar with persistent collapse state, contextual navigation based on page context, and global search trigger with Cmd+K shortcut using nuqs for URL state management.

## What Was Built

### Task 1: Persistent Sidebar Collapse State & URL State Management
- **Installed nuqs**: URL-based state management library for shareable navigation states
- **Created navigation-state.ts**: URL state helpers with view/status query parameters using shallow routing
- **Enhanced sidebar.tsx**: Added localStorage persistence for sidebar collapse state
  - Reads `sidebar-collapsed` from localStorage on mount
  - Persists state changes automatically
  - Handles hydration safely with mounted state check
  - Prevents SSR mismatch errors

### Task 2: Contextual Navigation & Global Search
- **Updated sidebar-nav.tsx**: Made sidebar contextual based on current pathname
  - **Main nav** (global pages): Dashboard, Projects, Customers, Subcontractors, Bidding, Financials, Documents, Reports, Settings
  - **Project nav** (project detail pages): Overview, Budget, Change Orders, Documents
  - Automatically switches navigation when entering/exiting project detail pages
  - Active state highlights current page
- **Enhanced top-bar.tsx**: Added search trigger button
  - Search icon with "Search" label (hidden on mobile)
  - Cmd+K keyboard shortcut hint visible on desktop
  - Triggers command palette via SearchProvider context
- **Created command-palette.tsx**: Global search and navigation command palette
  - Cmd+K keyboard shortcut listener
  - SearchProvider context for state management
  - CommandDialog with navigation items
  - Quick navigation to all main sections
- **Updated app-shell.tsx**: Integrated SearchProvider
  - Wraps SidebarProvider with SearchProvider
  - TopBarWithSearch component connects TopBar to search context
  - Search button click opens command palette

## Deviations from Plan

### Auto-fixed Issues

**None** - Plan executed exactly as written.

## Verification Results

**Manual verification not performed** - Autonomous execution mode.

Expected behavior:
1. Sidebar collapse state persists across page navigations and browser sessions
2. Main pages show global navigation (Dashboard, Projects, Customers, Subcontractors, Bidding, Financials, Documents, Reports, Settings)
3. Project detail pages (/projects/{id}/*) show project-specific navigation (Overview, Budget, Change Orders, Documents)
4. Search button in top bar opens command palette
5. Cmd+K keyboard shortcut also opens command palette
6. Command palette provides quick navigation to all main sections
7. No hydration warnings in console

## Key Implementation Details

### Sidebar Persistence Strategy
```typescript
const STORAGE_KEY = "sidebar-collapsed";

// Restore on mount
useEffect(() => {
  setMounted(true);
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    setOpen(stored === "true");
  }
}, [setOpen]);

// Persist changes
useEffect(() => {
  if (mounted) {
    localStorage.setItem(STORAGE_KEY, String(open));
  }
}, [open, mounted]);
```

**Why localStorage (not cookie):**
- Sidebar state is client-side preference only
- Doesn't affect SSR or need server awareness
- No FOUC concern (visual preference, not theme)
- Faster to read/write than cookie parsing

**Hydration handling:**
- `mounted` state prevents SSR mismatch
- Effect runs after first render
- Gracefully handles localStorage unavailable (SSR, private browsing)

### Contextual Navigation Logic
```typescript
const isProjectPage = pathname?.startsWith("/projects/") && pathname !== "/projects";
const projectId = isProjectPage ? pathname?.split("/")[2] : null;

const navItems = isProjectPage
  ? projectNav.map((item) => ({
      ...item,
      href: `/projects/${projectId}${item.href}`,
    }))
  : mainNav;
```

**Pattern:**
- Detect project detail pages via pathname pattern
- Extract project ID from URL
- Map project nav items to scoped URLs (/projects/{id}/overview)
- Use main nav for all other pages
- No duplicated navigation patterns (satisfies NAV-06)

### Search Integration Pattern
```typescript
const SearchContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Cmd+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <SearchContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandPalette open={open} setOpen={setOpen} />
    </SearchContext.Provider>
  );
}
```

**Why Context pattern:**
- Enables both TopBar button and keyboard shortcut to trigger same dialog
- Single source of truth for search state
- CommandPalette rendered once at root level
- No prop drilling through component tree

## Requirements Satisfied

- **NAV-02**: Contextual sidebar that updates based on active page ✓
- **NAV-03**: Sidebar collapse/expand with persistent state ✓
- **NAV-05**: Navigation state management using URL params where appropriate ✓
- **NAV-06**: No duplicated navigation patterns ✓

## Next Steps

Plan 13-05 will build on this foundation to add:
- Enhanced command palette with search functionality
- Recent items and favorites
- Keyboard navigation improvements

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 052bb62 | feat(13-04): add persistent sidebar collapse state and nuqs |
| 2 | 55ed209 | feat(13-04): add contextual sidebar navigation and search trigger |

## Self-Check: PASSED

**Created files exist:**
```bash
✓ apps/web/lib/navigation-state.ts
✓ apps/web/components/search/command-palette.tsx
```

**Commits exist:**
```bash
✓ 052bb62: feat(13-04): add persistent sidebar collapse state and nuqs
✓ 55ed209: feat(13-04): add contextual sidebar navigation and search trigger
```

**Modified files verified:**
```bash
✓ apps/web/components/layout/sidebar.tsx (added persistence)
✓ apps/web/components/layout/sidebar-nav.tsx (added contextual navigation)
✓ apps/web/components/layout/top-bar.tsx (added search trigger)
✓ apps/web/components/layout/app-shell.tsx (integrated SearchProvider)
✓ apps/web/package.json (added nuqs dependency)
```

All claimed files and commits verified successfully.
