# Phase 13: Navigation & Theme Foundation - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish navigation and theming foundation for v1.1 enterprise UX redesign:
- Unified top navigation bar (global search, primary modules, profile dropdown, settings)
- Contextual sidebar (updates based on active page, collapsible with persistent preference)
- Dark mode support (toggle from Account Settings, FOUC prevention via cookie-based theme)
- Company branding (logo upload, display in top nav/sidebar/sign-in)
- Procore-style visual system (compact spacing, sharp corners, consistent typography, construction accent color)

This phase is the foundation — all subsequent v1.1 phases depend on this navigation and theming infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User has delegated all implementation decisions to Claude, with guidance from research findings:

**Navigation architecture:**
- Implement Next.js App Router persistent layouts per research/ARCHITECTURE.md recommendations
- Top bar vs sidebar split following Procore NGX pattern from research/FEATURES.md
- Sidebar collapse state persistence via localStorage or cookie
- Navigation state management using URL params (nuqs) where appropriate

**Global search:**
- Command palette implementation using cmdk (already installed) with ⌘K shortcut per research/STACK.md
- Search endpoint using tRPC with debouncing and full-text search indexes per research/PITFALLS.md
- Keyboard navigation and instant results following enterprise UX patterns

**Dark mode:**
- next-themes with cookie-based storage for FOUC prevention (critical per research/PITFALLS.md)
- System preference detection with manual override
- CSS variable-based theming per research/ARCHITECTURE.md
- Transition style: instant or subtle (Claude decides)

**Company branding:**
- Logo upload using existing document storage patterns
- Display in top nav, sidebar (collapsed + expanded), sign-in page per requirements
- Fallback branding when no logo uploaded
- Accent color scope: Claude decides if just logo or full color customization

**Visual system:**
- Procore-style compact spacing values (Claude determines specific rem/px values)
- Sharp corners (border-radius: 0 or minimal per research)
- Typography scale following shadcn/ui foundation
- Subtle construction accent color (Claude chooses or allows customization)

</decisions>

<specifics>
## Specific Ideas

**Research-driven guidance:**
- Dark mode FOUC prevention is CRITICAL — must use cookie-based theme storage from day one (research/PITFALLS.md)
- Navigation foundation affects all pages — priority is correctness over speed (research/SUMMARY.md)
- Command palette (cmdk) is already installed and enterprise-standard for global search
- Next.js App Router persistent layouts enable instant-feel navigation
- TailwindCSS already configured for theming via CSS variables

**Requirements anchor:**
- 15 requirements total: NAV-01 through NAV-06, THEME-01 through THEME-09
- All must be satisfied per REQUIREMENTS.md traceability
- Success criteria from ROADMAP.md define observable outcomes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-navigation-and-theme-foundation*
*Context gathered: 2026-02-14*
