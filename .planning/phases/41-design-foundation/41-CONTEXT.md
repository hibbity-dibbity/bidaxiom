# Phase 41: Design Foundation - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the CSS token system, dark mode compliance, and canonical Tailwind class recipes that every subsequent v1.6 redesign phase will build on. This phase fixes all existing dark mode violations, defines the financial semantic color token palette, documents the canonical class recipes in COMPONENT-ORGANIZATION.md, installs the 3 net-new npm packages, and moves approval action buttons to the page header on CO and pay app detail pages. No new features — foundation only.

</domain>

<decisions>
## Implementation Decisions

### Dark mode fix strategy
- Approach: **Migrate to CSS variable tokens** — replace hardcoded palette classes (bg-white, bg-amber-50, text-slate-600) with Tailwind CSS variable utilities (bg-background, text-muted-foreground, etc.). Do NOT use the `dark:` companion shortcut; token migration is the correct long-term approach.
- For amber/warning-tinted surfaces (bg-amber-50 callouts): map to existing tokens (bg-muted, text-muted-foreground) — do NOT create new --warning tokens; keep the token vocabulary small.
- **Scope: Fix all 52 files in Phase 41.** No files deferred to a later sweep. FOUND-01 requires complete compliance.
- 3 net-new packages (@tanstack/react-virtual v3, motion v12, react-number-format v5): **install all in Phase 41** (FOUND-04 requirement). Phases 42+ should be able to import immediately without package setup work.

### Financial semantic token colors
- `--financial-positive` (approved amounts, profit, positive variances): **Emerald** — `emerald-600` in light mode, `emerald-400` in dark mode.
- `--financial-negative` (rejected, over-budget, negative variance): **Rose** — `rose-600` in light mode, `rose-400` in dark mode.
- `--financial-pending` (submitted/pending approval, neutral values): **Amber** — `amber-600` in light mode, `amber-400` in dark mode.
- **Scope of application**: Color applies to **number text + adjacent icon** (trend arrows, checkmark/X icons). Does NOT apply to row background tints or status badges — those use the existing 4-tier badge system.

### Canonical density targets (COMPONENT-ORGANIZATION.md)
- **Financial data tables** (budget, SOV, change order line items, pay app SOV): `h-9 py-1.5 text-sm` — 36px rows. Balanced density; one step more relaxed than Procore's 32px but still enterprise-dense.
- **List views** (projects, customers, change orders, pay apps, estimates): same as financial tables — `h-9 py-1.5 text-sm` rows. Consistent density across all data surfaces.
- **Form inputs** (text fields, selects, date pickers): `h-9 text-sm` — 36px height. Matches row height for visual consistency in inline-edit and modal forms.
- **Table column headers**: Procore-style uppercase small caps — `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`. Strong visual hierarchy that clearly delineates header from data.

### Claude's Discretion
- Approval button placement on CO and pay app detail pages (VISUAL-03): Claude decides exact position in the header action area. Keep it prominent — not buried in menus.
- COMPONENT-ORGANIZATION.md content structure: Claude decides what sections and format work best as a reference document for future phases.
- Token naming for `--financial-positive`, `--financial-negative`, `--financial-pending`: Claude confirms naming convention is consistent with existing globals.css token style.
- Exact file-by-file mapping from hardcoded classes to tokens: Claude uses the closest semantic match from existing token set.

</decisions>

<specifics>
## Specific Ideas

- Canonical density is 36px (h-9), not 32px (h-8) — user explicitly chose balanced over maximum Procore-tight. Research recommendation was 32px but user prefers the slightly more relaxed variant.
- Financial colors complement the BIDAXIOM brand: emerald (warm green) pairs better with cyan-teal primary than classic green; rose (pink-red) is less harsh than pure red and suits the palette.
- All 52 dark mode files must be fixed — user does not want tech debt carried forward.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 41-design-foundation*
*Context gathered: 2026-02-21*
