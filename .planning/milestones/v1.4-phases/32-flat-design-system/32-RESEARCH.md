# Phase 32: Flat Design System - Research

**Researched:** 2026-02-18
**Domain:** Tailwind CSS / shadcn-ui theming, CSS custom properties, component class overrides
**Confidence:** HIGH

---

## Summary

The goal is a flat, section-based visual language: every card and panel has sharp corners (border-radius 0), no visible border outline, and no drop shadow. The codebase uses shadcn/ui's `Card` component as the primary card primitive (59 files), plus a significant number of custom `<div>` panels that hand-code `rounded-lg border bg-card` or similar class strings.

The key architectural finding is that **`rounded-xl` in `card.tsx` is hardcoded and bypasses the CSS variable system**. The tailwind config maps `rounded-lg` → `var(--radius)`, `rounded-md` → `calc(var(--radius) - 2px)`, but does NOT map `rounded-xl`. That class resolves to Tailwind's default `0.75rem`, immune to any change in `--radius`. Therefore, setting `--radius: 0` alone will not flatten cards — the `Card` component class must also be changed directly.

Shadows present a two-tier problem: the `Card` component carries `shadow` in its base class, and additionally many call sites add `hover:shadow-md` or `hover:shadow-sm` inline. Both layers need to be removed from card containers (though hover shadow removal is a UX judgment call best treated as in-scope).

**Primary recommendation:** Change `card.tsx` to remove `rounded-xl`, `border`, and `shadow` from Card's base class. Then set `--radius: 0` in globals.css to affect `rounded-lg`/`rounded-md` panels. Finally, audit the ~20 custom panel divs listed below and remove their `rounded-*`, `border`, and `shadow-*` classes.

---

## 1. Current Card Component Classes (Exact)

File: `apps/web/components/ui/card.tsx`

| Sub-component | Current className |
|---------------|-------------------|
| `Card` | `"rounded-xl border bg-card text-card-foreground shadow"` |
| `CardHeader` | `"flex flex-col space-y-1.5 p-6"` |
| `CardTitle` | `"font-semibold leading-none tracking-tight"` |
| `CardDescription` | `"text-sm text-muted-foreground"` |
| `CardContent` | `"p-6 pt-0"` |
| `CardFooter` | `"flex items-center p-6 pt-0"` |

**Offending classes on `Card` root only:**
- `rounded-xl` — hardcoded Tailwind default (0.75rem), NOT linked to `--radius`
- `border` — uses `@apply border-border` from globals.css `*` selector; this makes a 1px border visible
- `shadow` — maps to `box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`

CardHeader, CardContent, and CardFooter carry **no rounding or shadow classes** — they are safe.

---

## 2. The `--radius` CSS Variable Situation

**File:** `apps/web/app/globals.css`

```css
/* Border radius - sharp corners (Procore style) */
--radius: 0.25rem; /* Minimal rounding (4px), was 0.5rem */
```

**File:** `apps/web/tailwind.config.ts`

```ts
borderRadius: {
  lg: 'var(--radius)',                    // rounded-lg → 0.25rem currently
  md: 'calc(var(--radius) - 2px)',        // rounded-md → 0.05rem currently
  sm: 'calc(var(--radius) - 4px)',        // rounded-sm → negative (browser clamps to 0)
  sharp: '0',
  'sharp-sm': '2px',
}
```

**Critical finding:** `rounded-xl` is NOT in the extended config — it falls through to Tailwind's built-in `xl` value (0.75rem). Changing `--radius` to `0` would affect `rounded-lg` and `rounded-md` usages but would leave Card's `rounded-xl` completely unchanged.

**Required action:** Two-pronged approach is mandatory:
1. Set `--radius: 0` in globals.css (affects all `rounded-lg` / `rounded-md` custom panels)
2. Remove `rounded-xl` directly from `card.tsx` Card component

---

## 3. Card Usage Count

**59 files** use `<Card` components across the app.

**Distribution by area:**

| Area | File count (approx.) |
|------|----------------------|
| Dashboard / KPIs | 1 (`kpi-card.tsx`) |
| Project pages | ~12 (`projects/[slug]/page.tsx`, budget, rfqs, documents, estimates, payment-apps, etc.) |
| Estimate workflow | ~8 (`WorkflowStepContainer`, `MarkupConfig`, `TemplateSelection`, `LaborRates`, `SOVBuilder`, `SOVLineItemCard`, `NextStepsPanel`, estimates page) |
| Settings pages | ~5 (`company`, `members`, `account`, `integrations`, `settings`) |
| Bidding / change orders | ~6 (`bid-comparison-table`, `change-order-detail`, `change-order-form`, `change-order-history`, `amendment-timeline`, `bid-card`) |
| Payment apps | ~5 (`g702-form`, `payment-app-list`, `aging-report-table`, `lien-waiver-tracker`, `retainage-summary`) |
| Budget | ~4 (`budget-summary-cards`, `commitment-list`, `commitment-form`, `forecast-metrics`) |
| Reports | ~4 (`report-list`, `report-templates`, `report-viewer`, `chart-preview`) |
| Customers / subcontractors | ~4 |
| Auth pages | ~4 (`sign-in`, `sign-up`, `verify-email`, `reset-password`) |
| Integrations | ~3 (`qbo-connection-card`, `calendar-connection-card`) |
| Workflow | ~2 (`workflow-detail`, `workflow-list`) |
| Documents | ~1 (`document-search`) |

Because the fix is in the `Card` component source file itself, all 59 call sites inherit the change automatically — **no per-file edits needed for Card usages**.

---

## 4. Custom Panel Patterns (Not via Card Component)

These are `<div>` elements with direct rounding/border/shadow classes that simulate card-like panels. They must be targeted individually.

### Tier A — Full card-like panels (background + padding + border, should be flattened)

| File | Line(s) | Current classes |
|------|---------|-----------------|
| `app/(dashboard)/loading.tsx` | 19, 33 | `rounded-lg border bg-card p-6` |
| `app/(dashboard)/settings/page.tsx` | 23, 36, 49, 62, 75 | `rounded-lg border bg-card p-6 hover:shadow-sm transition-shadow` |
| `app/(dashboard)/settings/activity/page.tsx` | 34 | `rounded-lg border bg-card p-6` |
| `components/company/custom-trades-list.tsx` | 163 | `rounded-lg border bg-card p-3` |
| `components/integrations/calendar-project-sync.tsx` | 65 | `rounded-lg border p-4 space-y-4` |

### Tier B — Data container borders (tables, list wrappers — borderless or keep border for data separation?)

| File | Current classes | Note |
|------|-----------------|-------|
| `app/(dashboard)/projects/components/projects-table.tsx` | `rounded-md border` | Table wrapper — border may be intentional for data grid |
| `components/estimates/line-items/EstimateLineItemsTable.tsx` | `rounded-md border` | Table wrapper |
| `components/payment-app/sov-editor.tsx` | `rounded-md border`, `border rounded-md` | Table wrappers |
| `components/budget/budget-line-item-table.tsx` | `border rounded-lg` | Table wrapper |
| `components/integrations/qbo-sync-status.tsx` | `rounded-md border` | List wrapper |
| `components/document/document-search.tsx` | `border rounded-lg` | List wrapper |
| `components/reports/report-viewer.tsx` | `rounded-md border` | Table wrapper |

### Tier C — Tooltip/floating overlays (should KEEP rounded + shadow — not card panels)

| File | Current classes | Why preserve |
|------|-----------------|--------------|
| `components/budget/budget-variance-chart.tsx` line 54 | `rounded-lg border bg-background p-3 shadow-lg` | Chart tooltip overlay — floating, not a panel |
| `components/reports/chart-preview.tsx` line 63 | `rounded-lg border bg-background p-3 shadow-md` | Chart tooltip overlay |

### Tier D — Form sub-panels / inline item rows (judgment call — likely keep slight rounding for usability)

| File | Current classes | Context |
|------|-----------------|---------|
| `app/(dashboard)/settings/company/page.tsx` | `rounded-md border p-4` | Form field rows (radio groups) |
| `components/settings/theme-toggle.tsx` | `rounded-md border p-4` | Toggle option rows |
| `components/budget/commitment-form.tsx` | `p-4 border rounded-lg space-y-4` | Repeating form sections |
| `components/change-order/change-order-form.tsx` | `p-4 border rounded-lg space-y-4` | Repeating form sections |
| `components/change-order/change-order-detail.tsx` | `border rounded-lg p-4 space-y-3` | Detail item rows |
| `components/payment-app/retainage-summary.tsx` | `p-4 border rounded-lg` (×4) | Summary stat boxes |
| `components/payment-app/aging-report-table.tsx` | `p-4 bg-muted/50 rounded-lg` | Summary stats header row |
| `app/(dashboard)/projects/[projectSlug]/page.tsx` line 784 | `rounded-lg border` | Phase list item row |
| `app/(dashboard)/projects/[projectSlug]/documents/page.tsx` line 382 | `rounded-lg border` | Version history item row |

### Tier E — Empty state placeholders (dashed borders — typically preserved for UX clarity)

Multiple files use `rounded-lg border-dashed` or `rounded-md border border-dashed` for empty state slots. These are distinct from data panels and typically should retain their appearance for UX feedback.

---

## 5. Shadow Usage Map

### Shadows on Card containers (REMOVE)

| Location | Class | What it does |
|----------|-------|--------------|
| `components/ui/card.tsx` (base) | `shadow` | Base shadow on every Card — remove from component |
| `components/dashboard/kpi-card.tsx` | `hover:shadow-sm` | Hover lift effect on clickable KPI cards |
| `components/reports/report-list.tsx` | `hover:shadow-md` | Hover on report cards |
| `app/(dashboard)/reports/templates/page.tsx` | `hover:shadow-md` | Hover on template cards |
| `app/(dashboard)/customers/[slug]/page.tsx` line 261 | `hover:shadow-md` | Hover on customer stat cards |
| `app/(dashboard)/settings/page.tsx` | `hover:shadow-sm` (×5) | Hover on settings nav cards |
| `components/bidding/bid-card.tsx` | `hover:shadow-md` | Hover on bid cards |

### Shadows on UI primitives (PRESERVE — not card panels)

| Location | Class | What it does |
|----------|-------|--------------|
| `components/ui/button.tsx` | `shadow`, `shadow-sm` | Button depth cues — keep |
| `components/ui/input.tsx` | `shadow-sm` | Input depth — keep |
| `components/ui/select.tsx` | `shadow-sm` | Select depth — keep |
| `components/ui/textarea.tsx` | `shadow-sm` | Textarea depth — keep |
| `components/ui/badge.tsx` | `shadow` | Badge emphasis — keep |
| `components/ui/checkbox.tsx` | `shadow` | Checkbox depth — keep |
| `components/ui/switch.tsx` | `shadow-sm`, `shadow-lg` | Switch track/thumb — keep |
| `components/ui/dropdown-menu.tsx` | `shadow-md` | Floating menu — keep |
| `components/ui/dialog.tsx` | (shadow in long class) | Modal overlay — keep |
| `components/ui/popover.tsx` | `shadow-md` | Popover float — keep |
| `components/ui/alert-dialog.tsx` | (shadow in long class) | Dialog — keep |
| `components/ui/sheet.tsx` | `shadow-lg` | Slide-in panel — keep |
| `components/ui/sonner.tsx` | `shadow-lg` | Toast notification — keep |
| `components/ui/tabs.tsx` | `shadow` | Active tab indicator — keep |
| `components/ui/radio-group.tsx` | `shadow` | Radio button depth — keep |
| `components/ui/sidebar.tsx` | `shadow` (floating variant only) | Floating sidebar variant — keep |
| `components/budget/budget-variance-chart.tsx` | `shadow-lg` | Chart tooltip — keep |
| `components/reports/chart-preview.tsx` | `shadow-md` | Chart tooltip — keep |

---

## 6. Interactive Elements to Protect

These components use rounding classes that must NOT be affected by any global change to `--radius` (because they use `rounded-md` which maps to `var(--radius) - 2px`). However, since we are setting `--radius: 0`, `rounded-md` will compute to `calc(0 - 2px)` = `-2px` which browsers clamp to `0` — so they will also become square.

**Important consideration:** Setting `--radius: 0` will also flatten buttons, inputs, badges, selects, and all other `rounded-md`/`rounded-lg` elements across the entire app. This may or may not be desired.

| Component | Current rounding class | Maps to |
|-----------|----------------------|---------|
| `Button` | `rounded-md` (base), `rounded-md` (sm/lg sizes) | `var(--radius) - 2px` |
| `Input` | `rounded-md` | `var(--radius) - 2px` |
| `Select` | `rounded-md` | `var(--radius) - 2px` |
| `Textarea` | `rounded-md` | `var(--radius) - 2px` |
| `Badge` | `rounded-md` | `var(--radius) - 2px` |
| `Checkbox` | `rounded-sm` | `var(--radius) - 4px` |
| `Dropdown Menu` | `rounded-md` | `var(--radius) - 2px` |
| `Tabs list` | `rounded-lg` | `var(--radius)` |
| `Tooltip` | `rounded-md` | `var(--radius) - 2px` |
| `Popover` | `rounded-md` | `var(--radius) - 2px` |

**The requirement (DESIGN-01) specifies only cards/panels.** If the goal is to preserve rounded buttons/inputs while only flattening cards, the approach must be surgical (change Card component class only) rather than via the global `--radius` variable.

---

## 7. CSS Variable Approach Analysis

### Option A: Set `--radius: 0` in globals.css only
- **Result:** `rounded-lg` → 0, `rounded-md` → 0, `rounded-sm` → 0
- **Flattens:** All custom panels using `rounded-lg`/`rounded-md` ✓
- **Does NOT flatten:** `Card` component's `rounded-xl` (bypasses CSS var) ✗
- **Side effect:** Also flattens buttons, inputs, badges, tabs, tooltips, dropdowns ✗
- **Verdict:** Insufficient alone. Creates undesired collateral flattening of interactive elements.

### Option B: Change `card.tsx` classes only (remove `rounded-xl border shadow`)
- **Result:** Card primitive becomes flat
- **Flattens:** All 59 Card usages automatically ✓
- **Does NOT flatten:** Custom `rounded-lg border bg-card` div panels ✗
- **Side effect:** None — surgical change ✓
- **Verdict:** Necessary but incomplete.

### Option C: Both A + B (global `--radius: 0` + card.tsx class change)
- **Result:** Everything flattened
- **Side effect:** Buttons, inputs, badges all become square corners
- **Verdict:** Correct if the design intent is "everything should be sharp" (consistent with Procore-style). The comment in globals.css already says "Sharp corners (Procore style)" — this appears to be the intended direction.

### Option D: Surgical — card.tsx class change + targeted custom panel class removal (no --radius change)
- **Result:** Cards and named panels become flat; buttons/inputs stay at 4px radius
- **Side effect:** Requires editing ~15 files for custom panels
- **Verdict:** Cleanest result matching DESIGN-01 literally ("cards and panels") without touching interactive elements. Higher edit count but zero risk of breaking buttons/inputs.

**Recommendation: Option D** — targeted surgical approach.

Rationale: DESIGN-01 explicitly calls out "card and panel components." The success criteria only mentions cards/panels, with explicit requirement #3 that "interactive elements (buttons, inputs, badges) that should retain their styling are unaffected." Option D satisfies all three success criteria. Option C would technically violate criterion #3 by also flattening buttons and inputs.

---

## 8. Recommended Implementation Approach

### Step 1: Fix the Card component source (1 file, highest impact)

**File:** `apps/web/components/ui/card.tsx`

Change Card base class from:
```
"rounded-xl border bg-card text-card-foreground shadow"
```
To:
```
"bg-card text-card-foreground"
```

This removes `rounded-xl` (corners), `border` (outline), and `shadow` (drop shadow) from all 59 Card usages simultaneously.

### Step 2: Fix custom Tier A panels (5 files, ~6 locations)

These are full card-equivalent panels that show as prominent sections:

| File | Action |
|------|--------|
| `app/(dashboard)/loading.tsx` lines 19, 33 | Remove `rounded-lg` from `rounded-lg border bg-card p-6` |
| `app/(dashboard)/settings/page.tsx` lines 23, 36, 49, 62, 75 | Remove `rounded-lg border` and `hover:shadow-sm transition-shadow` |
| `app/(dashboard)/settings/activity/page.tsx` line 34 | Remove `rounded-lg border` from `rounded-lg border bg-card p-6` |
| `components/company/custom-trades-list.tsx` line 163 | Remove `rounded-lg border` from `rounded-lg border bg-card p-3` |
| `components/integrations/calendar-project-sync.tsx` line 65 | Remove `rounded-lg border` from `rounded-lg border p-4 space-y-4` |

### Step 3: Remove hover shadow effects from Card call sites (7 locations)

These add shadow on hover, creating the visual "lift" that conflicts with flat design:

| File | Action |
|------|--------|
| `components/dashboard/kpi-card.tsx` line 36 | Remove `hover:shadow-sm transition-shadow` |
| `components/reports/report-list.tsx` line 157 | Remove `hover:shadow-md transition-shadow` |
| `app/(dashboard)/reports/templates/page.tsx` line 108 | Remove `hover:shadow-md transition-shadow` |
| `app/(dashboard)/customers/[slug]/page.tsx` line 261 | Remove `hover:shadow-md transition-shadow` |
| `app/(dashboard)/settings/page.tsx` lines 23,36,49,62,75 | Already covered in Step 2 |
| `components/bidding/bid-card.tsx` line 33 | Remove `hover:shadow-md transition-shadow` |

### Steps 4+ (optional / lower priority): Tier B and D panels

These affect table wrappers and form sub-panels. Strictly speaking they are outside DESIGN-01 scope ("cards and panels") but may need attention for visual consistency. Defer to planner decision.

---

## Files to Modify (Primary Scope)

**Mandatory for DESIGN-01 compliance:**

| File | Change type |
|------|-------------|
| `apps/web/components/ui/card.tsx` | Remove `rounded-xl border shadow` from Card base class |
| `apps/web/app/(dashboard)/loading.tsx` | Remove `rounded-lg` (lines 19, 33) |
| `apps/web/app/(dashboard)/settings/page.tsx` | Remove `rounded-lg border hover:shadow-sm transition-shadow` (5 instances) |
| `apps/web/app/(dashboard)/settings/activity/page.tsx` | Remove `rounded-lg border` (line 34) |
| `apps/web/components/company/custom-trades-list.tsx` | Remove `rounded-lg border` (line 163) |
| `apps/web/components/integrations/calendar-project-sync.tsx` | Remove `rounded-lg border` (line 65) |
| `apps/web/components/dashboard/kpi-card.tsx` | Remove `hover:shadow-sm transition-shadow` from onClick condition |
| `apps/web/components/reports/report-list.tsx` | Remove `hover:shadow-md transition-shadow` (line 157) |
| `apps/web/app/(dashboard)/reports/templates/page.tsx` | Remove `hover:shadow-md transition-shadow` (line 108) |
| `apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx` | Remove `hover:shadow-md transition-shadow` (line 261) |
| `apps/web/components/bidding/bid-card.tsx` | Remove `hover:shadow-md transition-shadow` (line 33) |

**Total: 11 files, ~20 class string edits.**

---

## Risk Assessment

### Low risk (safe changes)
- Removing `rounded-xl`, `border`, `shadow` from `card.tsx` — all 59 Card usages will become flat; no logic changes, only visual
- The Card component is the single source of truth; the change is atomic
- `CardHeader`, `CardContent`, `CardFooter` carry no rounding/shadow — no changes needed there

### Medium risk (verify visually)
- **`border` removal from Card:** The Card currently shows a 1px border. In areas where cards are on a white background (`--background: 0 0% 100%` and `--card: 0 0% 100%` are the same color), removing `border` makes sections defined only by proximity/spacing. This is exactly the flat section-based design intent, but confirm no Card is used on a non-card-background where the border provided contrast.
- **Hover shadow removal from KPI cards / bid cards / report cards:** These cards currently signal interactivity via hover shadow lift. With shadow removed, interactive cards need another hover cue (e.g., `hover:bg-muted/50`). The planner should decide whether to add a subtle background hover state.
- **Settings page Link panels:** These are `<Link>` elements styled as cards. Removing border+shadow means they rely on background color and spacing alone for visual separation. Currently `bg-card` on a `bg-background` background — both white — so they could visually merge with the page. May need a subtle `bg-muted/30` or similar to distinguish.

### Low-medium risk
- **`apps/(dashboard)/loading.tsx` panels:** These are skeleton loaders. Removing `rounded-lg border` makes them borderless rectangles; acceptable and matches Card behavior.
- **Tier B table wrappers:** The `rounded-md border` on table containers (`projects-table.tsx`, `budget-line-item-table.tsx`, etc.) are in scope of the "no border" requirement but were excluded from the primary plan. If left as-is, tables will have slight rounding while cards have none — visual inconsistency. The planner should decide if these are in DESIGN-01 scope.

### Not at risk (confirmed safe)
- `button.tsx` — uses `rounded-md` which will NOT change (we are not touching `--radius`)
- `input.tsx` — uses `rounded-md`, same
- `badge.tsx` — uses `rounded-md`, same
- `select.tsx` — uses `rounded-md`, same
- `textarea.tsx` — uses `rounded-md`, same
- `checkbox.tsx` — uses `rounded-sm`, same
- `dropdown-menu.tsx` — uses `rounded-md`, same
- Chart tooltips in `budget-variance-chart.tsx` and `chart-preview.tsx` — these are floating overlays, not panels; should keep `rounded-lg shadow`
- `sidebar.tsx` `floating` variant — only applies when sidebar variant is `floating` (not the default `sidebar` variant); low impact

---

## Architecture Patterns

### Pattern: Single-source component fix (preferred)
Modify the component definition once; all consumers inherit. This is the correct approach for `card.tsx` — do NOT add `rounded-none shadow-none border-none` overrides at each call site.

### Anti-patterns to avoid
- **Anti-pattern: Override at every call site** — adding `className="rounded-none shadow-none border-none"` to every `<Card>` usage. Creates 59 scattered edits instead of 1.
- **Anti-pattern: CSS `!important` in globals** — `div { border: none !important }` etc. Would break sidebar borders, table borders, form field borders.
- **Anti-pattern: Global `--radius: 0`** — Flattens interactive elements (buttons, inputs) that must retain their styling per success criterion 3.

### Pattern: Targeted class string editing for custom panels
For custom div panels, find-and-replace the specific class string. Each edit is isolated to one div's className prop.

---

## Code Examples

### Correct final Card classes
```tsx
// Source: apps/web/components/ui/card.tsx — after change
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("bg-card text-card-foreground", className)}
      {...props}
    />
  )
)
```

### Correct final settings panel (Link panel)
```tsx
// Source: apps/web/app/(dashboard)/settings/page.tsx — after change
<Link
  href="/settings/account"
  className="bg-card p-6 hover:bg-muted/50 transition-colors"
>
```
Note: `hover:bg-muted/50` added to preserve interactive affordance after shadow removal.

### Correct final loading skeleton panel
```tsx
// Source: apps/web/app/(dashboard)/loading.tsx — after change
<div key={i} className="bg-card p-6">
```

---

## Open Questions

1. **Should table wrappers also lose rounded corners?**
   - What we know: `rounded-md border` appears on ~8 table wrapper divs (projects-table, budget-line-item-table, sov-editor, etc.)
   - What's unclear: Whether "panels" in DESIGN-01 includes data table containers
   - Recommendation: Yes, for visual consistency — add these to scope. A data table with a `rounded-md` border frame looks inconsistent next to flat cards.

2. **Hover affordance for interactive cards**
   - What we know: KPI cards, bid cards, report cards, settings Link panels all use shadow-on-hover as their only hover cue
   - What's unclear: What the replacement hover state should be
   - Recommendation: Add `hover:bg-muted/50 transition-colors` to clickable cards/panels to preserve interactive feedback without shadow.

3. **Card-on-card-background contrast**
   - What we know: `--card` and `--background` are both `0 0% 100%` (pure white) in light mode
   - What's unclear: Whether removing the `border` from cards makes adjacent cards bleed together visually
   - Recommendation: Add a very subtle background color difference to the card token (e.g., `--card: 0 0% 99%`) or rely on spacing/grid layout for visual separation.

4. **Dark mode behavior**
   - What we know: In dark mode, `--card: 240 10% 3.9%` and `--background: 240 10% 3.9%` are also identical
   - What's unclear: Same concern as light mode — borderless cards on identical background
   - Recommendation: Same as question 3 — differentiate `--card` slightly from `--background`, or verify the layout uses sufficient spacing.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads from codebase — all class strings verified from source files
- `apps/web/components/ui/card.tsx` — exact current className values
- `apps/web/app/globals.css` — `--radius: 0.25rem` confirmed
- `apps/web/tailwind.config.ts` — border radius config mapping confirmed

### Secondary (MEDIUM confidence)
- Tailwind CSS documentation pattern: `rounded-xl` = 0.75rem, not configurable via `extend.borderRadius` overrides for `xl` key (the config only extends `lg`, `md`, `sm`, `sharp`, `sharp-sm`)

### Tertiary (LOW confidence)
- None — all findings are direct codebase reads

---

## Metadata

**Confidence breakdown:**
- Card component classes: HIGH — read directly from source
- `--radius` variable and Tailwind config mapping: HIGH — read directly from source
- Card usage count (59 files): HIGH — grep result
- Custom panel inventory: HIGH — exhaustive grep across both app/ and components/
- Shadow usage map: HIGH — exhaustive grep result
- Recommended approach (Option D surgical): HIGH — derived from success criterion 3 explicit requirement

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable codebase; no external dependencies)
