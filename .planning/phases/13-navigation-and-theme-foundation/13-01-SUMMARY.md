---
phase: 13-navigation-and-theme-foundation
plan: 01
subsystem: theme
tags: [dark-mode, theming, ui, fouc-prevention]
completed: 2026-02-14
duration: 2 min

dependency_graph:
  requires: []
  provides:
    - "ThemeProvider with cookie-based storage"
    - "FOUC prevention via middleware"
    - "Theme toggle UI in Account Settings"
  affects:
    - "apps/web/app/layout.tsx"
    - "apps/web/middleware.ts"
    - "apps/web/app/providers.tsx"

tech_stack:
  added:
    - next-themes: "Cookie-based theme provider"
  patterns:
    - "Cookie storage for SSR compatibility"
    - "Middleware theme detection"
    - "Hydration-safe client components"

key_files:
  created:
    - "apps/web/components/providers/theme-provider.tsx"
    - "apps/web/components/settings/theme-toggle.tsx"
    - "apps/web/app/(dashboard)/settings/account/page.tsx"
  modified:
    - "apps/web/middleware.ts"
    - "apps/web/app/providers.tsx"

decisions:
  - decision: "Cookie-based theme storage over localStorage"
    rationale: "Prevents FOUC by ensuring server-rendered HTML matches client hydration from first paint"
    alternatives: ["localStorage (causes FOUC)", "server-side detection only (no persistence)"]

  - decision: "ThemeProvider wraps entire app before AuthProvider"
    rationale: "Theme must be applied before any content renders to prevent flash"

  - decision: "Mounted state check in ThemeToggle"
    rationale: "Prevents hydration mismatch during next-themes initialization"

metrics:
  lines_added: 147
  lines_modified: 15
  files_created: 3
  files_modified: 2
  tests_added: 0
---

# Phase 13 Plan 01: Dark Mode Foundation Summary

**One-liner:** Cookie-based dark mode with FOUC prevention using next-themes and middleware theme detection.

## What Was Built

Implemented dark mode foundation with three components:

1. **ThemeProvider** - Wraps next-themes with cookie storage configuration
2. **Middleware integration** - Reads theme cookie and sets x-theme header for SSR
3. **Theme toggle UI** - Account Settings page with Light/Dark/System options

The solution ensures zero flash of unstyled content (FOUC) by using cookies that are readable during server-side rendering, allowing the initial HTML to have the correct theme class before JavaScript hydration.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | ThemeProvider with cookie storage and middleware | dcc4b68 | theme-provider.tsx, middleware.ts, providers.tsx |
| 2 | Theme toggle UI in Account Settings | b8ccb42 | theme-toggle.tsx, settings/account/page.tsx |

## Key Implementation Details

### ThemeProvider Configuration

```tsx
<NextThemesProvider
  attribute="class"           // Matches tailwind.config.ts darkMode setting
  storageKey="theme"          // Cookie name
  defaultTheme="system"       // Respects OS preference by default
  enableSystem={true}         // Allows system theme detection
  disableTransitionOnChange={false} // Smooth theme transitions
>
```

### Middleware Theme Detection

Added to existing authentication middleware:

```typescript
const theme = request.cookies.get("theme")?.value;
if (theme && (theme === "dark" || theme === "light")) {
  response.headers.set("x-theme", theme);
}
```

This ensures the server knows the user's theme preference before rendering HTML.

### Theme Toggle UI

Created RadioGroup component with three options:
- **Light** - Forces light theme
- **Dark** - Forces dark theme
- **System** - Follows OS preference

Includes mounted state check to prevent hydration mismatch:

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <div className="h-32" />; // placeholder
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification Status

**Manual testing required:**

1. Navigate to http://localhost:3000/settings/account
2. Verify three theme options render correctly
3. Toggle between Light/Dark/System - verify instant theme change
4. Reload page - verify theme persists (no flash)
5. Check DevTools > Application > Cookies - verify "theme" cookie exists
6. Toggle system theme in OS settings - verify "System" option respects it

**Expected behavior:**
- No FOUC on page load
- Theme cookie updates on selection
- Smooth transitions between themes
- System preference detection works when "System" selected

## Next Steps

This plan provides the foundation for theming. Subsequent plans will:
- Add color scheme customization
- Implement brand color configuration
- Add per-user theme preferences in database
- Create theme preview components

## Self-Check: PASSED

**Created files verified:**
- ✓ apps/web/components/providers/theme-provider.tsx
- ✓ apps/web/components/settings/theme-toggle.tsx
- ✓ apps/web/app/(dashboard)/settings/account/page.tsx

**Modified files verified:**
- ✓ apps/web/middleware.ts
- ✓ apps/web/app/providers.tsx

**Commits verified:**
- ✓ dcc4b68: feat(13-01): add ThemeProvider with cookie-based FOUC prevention
- ✓ b8ccb42: feat(13-01): add theme toggle UI in Account Settings

All files exist and commits are in git history.
