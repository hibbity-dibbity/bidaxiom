# Phase 19: Component Library & Architecture - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Architectural consolidation and UI system organization. This phase delivers a well-organized, maintainable codebase with reusable components, clean routing patterns, and centralized validation. It organizes what exists into sustainable patterns — no new features, just structural improvements.

</domain>

<decisions>
## Implementation Decisions

### Component Organization
- **Naming convention:** kebab-case files (button.tsx), PascalCase exports (Button) — Next.js app router style
- **File structure:** Claude has discretion to organize for maintainability (directory structure, categorization)
- **Domain components:** Claude decides when to extract based on actual usage patterns vs keeping components local
- **Import patterns:** Claude chooses approach that balances tree-shaking and maintainability

### Routing and Navigation
- **URL patterns:** All user-facing entity URLs use slugs — consistent `/projects/{job-number}-{name}` pattern everywhere
- **Dynamic sections:** Tabs with client-side content switching (budget, estimates, documents switch content without URL changes)
- **Prefetching:** Yes, prefetch data on link hover for instant perceived navigation
- **Scroll restoration:** Remember scroll position for list pages, reset to top for detail pages

### Validation Centralization
- **Error display:** Keep current pattern — inline errors below each field
- **Server vs client validation:** Server provides detailed context (for debugging), client simplifies messages (user-friendly)
- **Async validation:** On blur only (uniqueness checks, external validation) — validate when user leaves field
- **Schema location:** Claude decides optimal organization (shared package vs domain-specific)

### Reusability Boundaries
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

</decisions>

<specifics>
## Specific Ideas

- **Consistent styling is priority** — design system cohesion matters more than per-use-case flexibility
- **Slug-based URLs everywhere** — user-friendly, bookmarkable paths for all main entities
- **Instant navigation feel** — hover prefetch makes app feel snappy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-component-library-architecture*
*Context gathered: 2026-02-16*
