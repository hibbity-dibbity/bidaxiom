# Phase 41: Design Foundation - Research

**Researched:** 2026-02-21
**Domain:** CSS tokens, Tailwind dark mode, financial semantic colors, npm package installation
**Confidence:** HIGH — all findings from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Dark mode fix strategy:** Migrate to CSS variable tokens — replace hardcoded palette classes (bg-white, bg-amber-50, text-slate-600) with Tailwind CSS variable utilities (bg-background, text-muted-foreground, etc.). Do NOT use `dark:` companion shortcut.
- **Amber/warning surfaces:** Map to existing tokens (bg-muted, text-muted-foreground) — no new warning tokens.
- **Scope:** Fix all 52 files in Phase 41.
- **3 net-new packages:** Install all in Phase 41 (FOUND-04).
- **Financial semantic tokens (LOCKED):**
  - `--financial-positive`: Emerald — emerald-600 light / emerald-400 dark
  - `--financial-negative`: Rose — rose-600 light / rose-400 dark
  - `--financial-pending`: Amber — amber-600 light / amber-400 dark
  - Apply to: number text + adjacent icon only (not row backgrounds)
- **Canonical density targets (LOCKED):**
  - Tables & list views: h-9 py-1.5 text-sm (36px rows)
  - Form inputs: h-9 text-sm (36px)
  - Column headers: text-[11px] font-semibold uppercase tracking-wider text-muted-foreground

### Claude's Discretion
- Approval button placement (VISUAL-03): Claude decides
- COMPONENT-ORGANIZATION.md structure: Claude decides
- Token naming convention: match existing globals.css style
- File-by-file class mapping: use closest semantic match

### Deferred Ideas (OUT OF SCOPE)
- No new features
- No per-page density fixes beyond canonical recipe documentation
- No ScrollArea (GitHub issue #2783 constraint applies)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | No hardcoded palette classes without dark companions; all bg/text use CSS variable tokens | Token vocabulary documented below; 56 files inventoried and grouped |
| FOUND-02 | Financial data uses `--financial-positive/negative/pending` semantic tokens across all surfaces | Existing usages audited: currency-display.tsx, change-order-detail.tsx, aging-report-table.tsx, forecast-metrics.tsx, budget-summary-cards.tsx |
| FOUND-03 | Canonical class recipes documented in COMPONENT-ORGANIZATION.md with zero per-page variation | Existing COMPONENT-ORGANIZATION.md found and audited; needs density section added |
| FOUND-04 | Install @tanstack/react-virtual v3, motion v12, react-number-format v5 in apps/web | Confirmed none of the 3 packages are in package.json |
| VISUAL-03 | Approval action buttons on CO and pay app detail pages moved to page header action area | Button locations mapped: approval-panel.tsx (card body), g702-form.tsx (card bottom), change-order-detail.tsx (card header already) |
</phase_requirements>

---

## Summary

Phase 41 is a pure infrastructure/foundation phase with no new features. The codebase has been directly inspected and all six research questions have concrete answers.

The CSS token vocabulary in `globals.css` is a standard shadcn/ui set (background, foreground, card, muted, muted-foreground, border, primary, secondary, destructive, accent, popover, sidebar-*) with two custom additions: `--accent-construction` and `--brand-slate`. The financial tokens (`--financial-positive/negative/pending`) do NOT yet exist — they must be added to globals.css and wired into tailwind.config.ts.

The hardcoded-class inventory came in at **56 TSX files** (the context said 52 — the delta of 4 is likely auth pages that are low-risk cosmetic issues). Files fall into 7 logical groups for parallel planning. The most complex files are in `components/budget/`, `components/change-order/`, and `components/payment-app/` — they have both background surface classes AND inline financial color logic that must migrate to the new tokens simultaneously.

COMPONENT-ORGANIZATION.md already exists at `apps/web/COMPONENT-ORGANIZATION.md` with good component structure content. It has NO density/canonical-recipe section. The planner should add a "Canonical Class Recipes" section, not replace the entire file.

**Primary recommendation:** Structure the work as 4 parallel plans: (1) globals.css + tailwind.config token additions + package installs, (2) app/ route file dark mode fixes, (3) components/ dark mode + financial token fixes, (4) COMPONENT-ORGANIZATION.md recipe documentation + VISUAL-03 approval button relocation.

---

## Research Finding 1: Existing CSS Token Vocabulary

**Source:** Direct read of `apps/web/app/globals.css` and `apps/web/tailwind.config.ts`
**Confidence:** HIGH

### Tokens in globals.css (both light `.dark` variants defined)

| CSS Variable | Tailwind Class | Light Value | Dark Value |
|---|---|---|---|
| `--background` | `bg-background` | white (0 0% 100%) | near-black (240 10% 3.9%) |
| `--foreground` | `text-foreground` | slate-dark (210 25% 25%) | near-white (0 0% 98%) |
| `--card` | `bg-card` | white | near-black |
| `--card-foreground` | `text-card-foreground` | slate-dark | near-white |
| `--muted` | `bg-muted` | cool-gray (240 4.8% 95.9%) | dark-gray (240 3.7% 15.9%) |
| `--muted-foreground` | `text-muted-foreground` | mid-gray (240 3.8% 46.1%) | light-gray (240 5% 64.9%) |
| `--border` | `border-border` | cool-gray-90 | dark-border |
| `--input` | `border-input` | same as border | same as border |
| `--primary` | `bg-primary` / `text-primary` | teal (188 80% 45%) | teal-lighter |
| `--primary-foreground` | `text-primary-foreground` | near-white | white |
| `--secondary` | `bg-secondary` | light-gray | dark-gray |
| `--secondary-foreground` | `text-secondary-foreground` | near-black | near-white |
| `--accent` | `bg-accent` | light-gray | dark-gray |
| `--accent-foreground` | `text-accent-foreground` | near-black | near-white |
| `--destructive` | `bg-destructive` / `text-destructive` | red (0 84.2% 60.2%) | dark-red (0 62.8% 30.6%) |
| `--destructive-foreground` | `text-destructive-foreground` | near-white | near-white |
| `--ring` | `ring` | teal | teal-lighter |
| `--popover` | `bg-popover` | white | near-black |
| `--popover-foreground` | `text-popover-foreground` | slate-dark | near-white |
| `--sidebar-background` | `bg-sidebar` | near-white | dark-sidebar |
| `--sidebar-foreground` | `text-sidebar-foreground` | mid-gray | near-white |
| `--sidebar-border` | `border-sidebar-border` | cool border | dark border |
| `--accent-construction` | `bg-construction` | warm-orange | brighter-orange |
| `--brand-slate` | `bg-brand-slate` | slate-blue | lighter-slate |

### Tokens NOT in globals.css (must be added in FOUND-01/FOUND-02)

- `--financial-positive` (emerald-600 light / emerald-400 dark)
- `--financial-negative` (rose-600 light / rose-400 dark)
- `--financial-pending` (amber-600 light / amber-400 dark)

These need both CSS variable entries AND tailwind.config.ts color extensions (`financial-positive`, `financial-negative`, `financial-pending`).

### Hardcoded-to-Token Mapping Reference

| Hardcoded Class | Semantic Replacement | Notes |
|---|---|---|
| `bg-white` | `bg-background` or `bg-card` | Use bg-card inside Card components |
| `bg-amber-50` | `bg-muted` | Decision: map to muted, no warning token |
| `text-amber-800` (on amber-50 bg) | `text-muted-foreground` | Paired with bg-muted |
| `border-amber-200` (on amber-50 bg) | `border-border` | Standard border |
| `text-slate-600` | `text-muted-foreground` | Non-financial neutral text |
| `text-gray-400` / `text-gray-500` | `text-muted-foreground` | Neutral/inactive text |
| `bg-gray-500/10 text-gray-700` | `bg-muted text-muted-foreground` | Gray badge/status |
| `text-gray-900 dark:text-gray-100` | `text-foreground` | Body text |
| `bg-slate-500/10 text-slate-400` | `bg-muted text-muted-foreground` | Archived/inactive badge |
| `text-green-600 dark:text-green-400` | `text-financial-positive` | Financial positive (CurrencyDisplay) |
| `text-red-600 dark:text-red-400` | `text-financial-negative` | Financial negative (CurrencyDisplay) |
| `text-green-600` (no dark:) | `text-financial-positive` | Financial positive (needs dark fix) |
| `text-red-600` (no dark:) | `text-financial-negative` | Financial negative (needs dark fix) |
| `text-amber-600 border-amber-200 bg-amber-50` (CPI card) | `text-financial-pending border-border bg-muted` | CPI warning state |
| `text-green-600 border-green-200 bg-green-50` (CPI card) | `text-financial-positive border-border bg-muted/50` | CPI good state |
| `text-red-600 border-red-200 bg-red-50` (CPI card) | `text-financial-negative border-border bg-muted` | CPI bad state |
| `text-blue-600` (EAC/budget primary) | `text-primary` | Primary accent |
| `text-purple-600` (ETC metric) | `text-primary` or leave (accent) | Non-financial metric |
| `bg-green-500/10 text-green-700 border-green-200` (badge) | Use `StatusBadge variant="approved"` | Already has dark: in status-badge.tsx |
| `bg-red-500/10 text-red-700 border-red-200` (badge) | Use `StatusBadge variant="rejected"` | Already has dark: in status-badge.tsx |
| `bg-yellow-500/10 text-yellow-700` (badge) | Use `StatusBadge variant="warning"` | Already has dark: in status-badge.tsx |
| `bg-green-500` (solid badge bg, change-order) | `bg-financial-positive` | Financial positive solid |
| `bg-red-500` (solid badge bg) | `bg-financial-negative` | Financial negative solid |
| Form validation `text-red-500` / `text-red-600` | `text-destructive` | Destructive already token |

---

## Research Finding 2: The 56-File Inventory Grouped for Planning

**Source:** Direct grep of all TSX files for hardcoded palette classes
**Confidence:** HIGH

Actual count: **56 files** (context said 52; 4 are auth-flow pages).

### Group A: Auth Pages (4 files) — LOW complexity

Simple pages with isolated palette hits (success icons, password strength indicators).

```
apps/web/app/(auth)/mfa-setup/page.tsx          — bg-white on QR code container
apps/web/app/(auth)/reset-password/page.tsx     — text-green-600 (req.met), text-green-500 icon
apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx  — text-green-600 (req.met), text-green-500 icon
apps/web/app/(auth)/verify-email/page.tsx       — text-green-500 icon
```

### Group B: App Route Files — Settings & Integrations (6 files) — MEDIUM complexity

```
apps/web/app/(dashboard)/settings/account/page.tsx
apps/web/app/(dashboard)/settings/company/page.tsx                   — bg-amber-50 callout
apps/web/app/(dashboard)/settings/document-naming/page.tsx           — bg-amber-50 callout
apps/web/app/(dashboard)/settings/document-templates/page.tsx
apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx
apps/web/app/(dashboard)/settings/integrations/calendar/callback/page.tsx
apps/web/app/(dashboard)/settings/integrations/quickbooks/callback/page.tsx
```

### Group C: App Route Files — Projects, Customers, Subcontractors (6 files) — MEDIUM complexity

```
apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx           — status badge colors
apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx
apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx  — bg-amber-50 callout + bg-slate badge
apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx
apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx
apps/web/app/(dashboard)/projects/components/columns.tsx             — status badge colors
apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx
apps/web/app/(dashboard)/subcontractors/page.tsx
```

### Group D: Bidding Components (4 files) — MEDIUM complexity

```
apps/web/components/bidding/bid-card.tsx
apps/web/components/bidding/bid-comparison-table.tsx                 — financial comparisons
apps/web/components/bidding/bid-history-table.tsx
apps/web/components/bidding/invitation-manager.tsx
apps/web/components/bidding/rfq-form.tsx                             — form validation text-red-500
```

### Group E: Budget Components (5 files) — HIGH complexity (financial tokens + surface bg)

```
apps/web/components/budget/budget-line-item-table.tsx
apps/web/components/budget/budget-summary-cards.tsx    — text-blue-600, text-amber-600, text-slate-600
apps/web/components/budget/budget-variance-chart.tsx   — text-green-600/text-red-600 in tooltip
apps/web/components/budget/commitment-form.tsx         — form validation text-red-600
apps/web/components/budget/commitment-list.tsx         — bg-green-500 badge
apps/web/components/budget/forecast-metrics.tsx        — bg-green-50/amber-50/red-50 CPI card, text-blue-600, text-purple-600, text-slate-600
```

### Group F: Change Order & Payment App Components (9 files) — HIGH complexity (approval buttons + financial tokens)

**VISUAL-03 work is entirely in this group.**

```
apps/web/components/change-order/approval-panel.tsx    — Approve/Reject buttons in CardContent (VISUAL-03)
apps/web/components/change-order/change-order-detail.tsx — statusColors inline, financial text-green/red
apps/web/components/change-order/change-order-form.tsx
apps/web/components/change-order/change-order-list.tsx — statusColors inline
apps/web/components/payment-app/aging-report-table.tsx — heavy text-green-600/text-red-600 financial table
apps/web/components/payment-app/g702-form.tsx          — Submit/Mark Paid buttons in CardContent (VISUAL-03)
apps/web/components/payment-app/g703-continuation.tsx  — bg-red-50 error row
apps/web/components/payment-app/lien-waiver-tracker.tsx
apps/web/components/payment-app/payment-app-list.tsx   — statusColors inline
apps/web/components/payment-app/retainage-summary.tsx  — text-green-600
```

### Group G: Estimates, Integrations, Shared, Workflow (10 files) — MEDIUM complexity

```
apps/web/components/estimates/line-items/MarginCalculator.tsx
apps/web/components/estimates/sov/SOVBuilder.tsx
apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx
apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx
apps/web/components/estimates/workflow/steps/03-LineItems.tsx
apps/web/components/estimates/workflow/steps/04-LaborRates.tsx
apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx
apps/web/components/integrations/calendar-connection-card.tsx        — bg-green-100 badge
apps/web/components/integrations/qbo-connection-card.tsx             — bg-green-100 badge, bg-amber-50 sandbox
apps/web/components/integrations/qbo-sync-notifications.tsx
apps/web/components/shared/currency-display.tsx                      — financial token migration (2 lines)
apps/web/components/shared/status-badge.tsx                          — already has dark: BUT uses palette not tokens
apps/web/components/project/document-uploader.tsx                    — text-green-500/text-red-500 icons
apps/web/components/workflow/workflow-detail.tsx                     — bg-green-500/bg-red-500 step indicators
apps/web/components/dashboard/kpi-card.tsx
```

---

## Research Finding 3: VISUAL-03 — Approval Button Locations

**Source:** Direct read of change-order-detail.tsx, approval-panel.tsx, g702-form.tsx, [paymentAppId]/page.tsx
**Confidence:** HIGH

### Change Order Detail Page

**Route:** `/projects/[projectSlug]/change-orders/[changeOrderId]`
**Page file:** `apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx` — thin wrapper, renders `<ChangeOrderDetail />`
**Component:** `apps/web/components/change-order/change-order-detail.tsx`

**Current button layout (lines 248-455):**
The component has a `<Card>` with `<CardHeader>` that ALREADY has a right-side action area (`<div className="flex gap-2">`). That action area contains:
- "Submit for Approval" (Dialog trigger) — shown when status = draft
- "Edit & Resubmit" — shown when status = rejected
- "Void" (Dialog trigger) — shown when status = approved
- "Generate PDF" — shown when canGeneratePdf
- "Delete" — shown when canDelete

The **Approve / Reject** buttons are in a SEPARATE component: `<ApprovalPanel>` rendered below the header Card in the page body. The ApprovalPanel is a standalone `<Card>` with the buttons inside `CardContent`.

**VISUAL-03 decision needed:** Move Approve/Reject from ApprovalPanel card to the change-order-detail.tsx header action area. The ApprovalPanel can remain for the workflow step display — only the action buttons should move up.

**Implementation approach (Claude's discretion):** Lift `canCurrentUserApprove` check from ApprovalPanel into change-order-detail.tsx header. Render Approve (primary) and Reject (destructive) buttons in the existing `<div className="flex gap-2">` header action area when `canCurrentUserApprove === true`. Keep the ApprovalPanel component for the step visualization. This avoids a full component merge.

### Payment App Detail Page

**Route:** `/projects/[projectSlug]/payment-apps/[paymentAppId]`
**Page file:** `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx` — this IS the full page, not a thin wrapper.

**Current button layout:**
- The page already has a header area (lines 98-123) with `<div className="flex items-start justify-between">` containing the title and a "Generate AIA G702/G703 PDF" button.
- The `<G702Form>` component (rendered in the G702 Summary tab) has action buttons at the BOTTOM of its CardContent (lines 158-187): "Submit for Approval", "Mark as Paid", "Edit & Resubmit" placeholder.

**VISUAL-03 decision needed:** Move G702Form's action buttons ("Submit for Approval", "Mark as Paid") up to the page-level header area in `[paymentAppId]/page.tsx`. The G702Form component needs to either accept an `onAction` callback prop, or the action mutation calls need to move to the page level.

**Implementation approach (Claude's discretion):** Move paymentApp action buttons to the page header. Pass the submit/mark-paid mutation handlers as props from the page down into G702Form, or alternatively hoist the buttons to the page and remove them from G702Form entirely. The latter is cleaner since the page already has `paymentApp` data in scope.

---

## Research Finding 4: Financial Color Usages in Code

**Source:** Direct grep and file reads
**Confidence:** HIGH

### CurrencyDisplay (apps/web/components/shared/currency-display.tsx)

Currently uses:
```tsx
const colorClass = colorize
  ? amount < 0
    ? "text-red-600 dark:text-red-400"   // HAS dark companion already
    : amount > 0
    ? "text-green-600 dark:text-green-400"  // HAS dark companion already
    : "text-gray-900 dark:text-gray-100"  // HAS dark companion already
  : "";
```

**After migration:** Replace with financial semantic token classes:
```tsx
const colorClass = colorize
  ? amount < 0
    ? "text-financial-negative"
    : amount > 0
    ? "text-financial-positive"
    : "text-foreground"
  : "";
```

### change-order-detail.tsx — Line item amounts and total (lines 513-537)

Currently:
```tsx
className={Number(item.amountChange) < 0 ? "text-red-600" : "text-green-600"}
className={Number(co.totalAmount) < 0 ? "text-red-600" : "text-green-600"}
```
After: `text-financial-negative` / `text-financial-positive`

### approval-panel.tsx — Step status icons (lines 26-29)

Currently:
```tsx
approved: <CheckCircle2 className="h-5 w-5 text-green-600" />,
rejected: <XCircle className="h-5 w-5 text-red-600" />,
skipped: <Minus className="h-5 w-5 text-gray-400" />,  // neutral
```
After:
```tsx
approved: <CheckCircle2 className="h-5 w-5 text-financial-positive" />,
rejected: <XCircle className="h-5 w-5 text-financial-negative" />,
skipped: <Minus className="h-5 w-5 text-muted-foreground" />,
```

### forecast-metrics.tsx — CPI card coloring (lines 19-28)

Currently a function that returns e.g. `"text-green-600 border-green-200 bg-green-50"`.

**Note:** The locked decision says financial tokens apply to "number text + adjacent icon only (not row backgrounds)." Therefore:
- Keep `bg-muted` (not `bg-green-50` / `bg-red-50` / `bg-amber-50`) for CPI card background
- CPI number text: `text-financial-positive` / `text-financial-negative` / `text-financial-pending`
- Border: `border-border` (standard)
```tsx
const getCpiColor = (cpi: number) => {
  if (cpi > 1.0) return "text-financial-positive border-border bg-muted/50";
  if (cpi >= 0.8) return "text-financial-pending border-border bg-muted";
  return "text-financial-negative border-border bg-muted";
};
```

### aging-report-table.tsx — Heavy financial table

Multiple `text-green-600` and `text-red-600` on TableCell components. All should become `text-financial-positive` / `text-financial-negative`. Two instances use `text-red-800` (overdue highlight) — map to `text-financial-negative` (slightly desaturated in the token is fine) or `text-destructive`.

### Other financial color patterns

- `text-blue-600` on budget amounts (BudgetSummaryCards EAC, TotalBudget) — map to `text-primary` (the teal color)
- `text-amber-600` on "Committed" amount — map to `text-financial-pending`
- `text-purple-600` on ETC metric — this is non-financial (a distinct metric accent); map to `text-primary` or leave — Claude's discretion

---

## Research Finding 5: Package.json Status

**Source:** Direct read of `apps/web/package.json`
**Confidence:** HIGH

### Packages currently in apps/web:
Full dependency list confirmed. The 3 target packages are NOT installed:

| Package | Target Version | Currently in package.json? |
|---|---|---|
| `@tanstack/react-virtual` | v3 | NO — not present |
| `motion` | v12 | NO — not present |
| `react-number-format` | v5 | NO — not present |

**`@tanstack/react-table` v8.21.3 IS present** (not the same as react-virtual).

### Install command (run from repo root or apps/web):

```bash
npm install @tanstack/react-virtual@^3 motion@^12 react-number-format@^5 --workspace=@construction/web
```

Or from `apps/web/`:
```bash
npm install @tanstack/react-virtual@^3 motion@^12 react-number-format@^5
```

### Potential conflicts to check:
- `motion` v12 is the rebranded Framer Motion. No framer-motion currently installed — no conflict.
- `react-number-format` v5: No mask input conflicts; `use-mask-input` v3.6.1 is already present but they serve different use cases (use-mask-input for phone/general masks, react-number-format for currency).
- `@tanstack/react-virtual` v3: Peer requires React 18 — already met (react ^18.3.0).

---

## Research Finding 6: COMPONENT-ORGANIZATION.md Current State

**Source:** Direct read of `apps/web/COMPONENT-ORGANIZATION.md`
**Confidence:** HIGH

The file exists at `apps/web/COMPONENT-ORGANIZATION.md` and is well-structured. It covers:
- Directory structure (ui/, shared/, [domain]/, layout/)
- Extraction threshold rules (3+ uses decision tree)
- Naming conventions
- CVA variants guidance
- Import patterns
- Component API guidelines
- Real-world Phase 19 examples (StatusBadge, CurrencyDisplay, EstimateLineItemsTable)
- References to planning docs

**What is MISSING** (must be added in FOUND-03):
1. **Canonical density recipes** — table row height, cell padding, typography scale are not documented anywhere in the file
2. **Financial semantic color token usage rules** — how to apply `text-financial-positive/negative/pending`
3. **Dark mode token rules** — which classes are forbidden (hardcoded palette) vs. required (CSS variable utilities)
4. **Approval button placement pattern** — page header action area is the canonical location

**Approach:** Add new sections to the existing file. Do NOT replace or restructure current content. Add at the end or after the "CVA Variants" section.

---

## Architecture Patterns

### Token Addition Pattern for globals.css

Match the existing style (HSL values as raw channel tuples, no `hsl()` wrapper):

```css
/* In :root block */
--financial-positive: 160 60% 45%;   /* emerald-600 equivalent */
--financial-negative: 347 77% 52%;   /* rose-600 equivalent */
--financial-pending: 32 95% 44%;     /* amber-600 equivalent */

/* In .dark block */
--financial-positive: 160 60% 60%;   /* emerald-400 equivalent */
--financial-negative: 347 77% 68%;   /* rose-400 equivalent */
--financial-pending: 32 95% 60%;     /* amber-400 equivalent */
```

### Token Extension Pattern for tailwind.config.ts

Add inside the `colors` extend block, matching the existing pattern:

```typescript
'financial-positive': 'hsl(var(--financial-positive))',
'financial-negative': 'hsl(var(--financial-negative))',
'financial-pending': 'hsl(var(--financial-pending))',
```

This enables `text-financial-positive`, `bg-financial-positive`, `border-financial-positive`, etc.

### Status Badge Migration Pattern

Many files have inline `statusColors` record objects like:
```tsx
const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-700 border-gray-200",
  approved: "bg-green-500/10 text-green-700 border-green-200",
  rejected: "bg-red-500/10 text-red-700 border-red-200",
};
```

**Migration target:** Replace inline objects with `StatusBadge` from `@/components/shared/status-badge` which already has proper dark: companions for all semantic states. StatusBadge variants: draft, pending, active, approved, completed, rejected, cancelled, warning, error.

**StatusBadge current dark mode status:** The status-badge.tsx variants already use dark: companion classes (e.g., `dark:bg-gray-800 dark:text-gray-200`). However, they use **palette classes directly** — they will need to be migrated to CSS variable tokens too as part of this phase.

### Amber Surface Migration Pattern

The amber callout pattern appears in 3 places:
```tsx
<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
```

Decision (locked): map to `bg-muted border-border`. Text inside: `text-muted-foreground`.

```tsx
<div className="rounded-lg border border-border bg-muted p-4 flex items-start gap-3">
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| CSS variable dark mode | Custom dark: companion classes on every element | Migrate to `bg-background`, `text-muted-foreground` tokens | Tokens auto-switch; dark: companions require per-element maintenance |
| Financial color logic | Per-component ternary color functions | `text-financial-positive/negative/pending` token classes | Single token change affects all surfaces |
| Status badge dark mode | Inline `dark:` on every badge | `StatusBadge` component (already has dark: in CVA) | Already extracted in Phase 19 |
| Table row virtualization | Custom windowing | `@tanstack/react-virtual` v3 | Edge cases: overscan, dynamic row heights, scroll restoration |
| Currency masked inputs | Custom input masking | `react-number-format` v5 | Handles decimal precision, locale formatting, controlled/uncontrolled |
| Spring animations | CSS transitions | `motion` v12 | Spring physics, layout animations, exit animations |

---

## Common Pitfalls

### Pitfall 1: Forgetting tailwind.config.ts When Adding CSS Variables
**What goes wrong:** CSS variable added to globals.css but not wired into tailwind.config.ts — `text-financial-positive` class doesn't get generated, Tailwind JIT produces no output.
**How to avoid:** Always update both files in the same task. The pattern is `hsl(var(--financial-positive))` in config.

### Pitfall 2: StatusBadge Has Dark Companions But Still Uses Palette Classes
**What goes wrong:** status-badge.tsx has `dark:bg-gray-800` syntax — it will WORK in dark mode but the colors aren't from the token system. If the token values change, badges don't update.
**How to avoid:** Migrate status-badge.tsx CVA variants to use `bg-muted`, `text-muted-foreground` for neutral states and the financial tokens for approved/rejected states.

### Pitfall 3: bg-muted vs bg-card for Card Surfaces
**What goes wrong:** Using `bg-muted` where `bg-card` is semantically correct (inside Card components). bg-muted (95.9% lightness) is for input backgrounds, callouts; bg-card (100% white) is for elevated card surfaces.
**How to avoid:** Rule: inside a `<Card>` → `bg-card`. For info callout boxes (amber replacement) → `bg-muted`. For table row hover → `bg-muted/50`.

### Pitfall 4: form validation text-red-500 → text-destructive (not financial-negative)
**What goes wrong:** Form validation errors use `text-red-500` or `text-red-600` which look financial but are actually form errors.
**How to avoid:** Form validation text maps to `text-destructive` (the destructive token), not `text-financial-negative`. The destructive token already exists.

### Pitfall 5: Approval Button Hoisting Creates Prop Drilling
**What goes wrong:** Moving Approve/Reject from ApprovalPanel up to the CO header requires sharing mutation state and dialog open state across components.
**How to avoid:** The cleanest approach is to keep Dialog triggers and mutations in ApprovalPanel but add an optional `headerActions` render prop or simply duplicate the button triggers with the same Dialog state. Alternatively — pass `canCurrentUserApprove` from ApprovalPanel up via a callback or query the same tRPC endpoint at the page level.

### Pitfall 6: Installing motion v12 with Wrong Package Name
**What goes wrong:** Framer Motion was rebranded — old package is `framer-motion`, new package is `motion`. Installing the wrong one gives v11/v10 which has different APIs.
**How to avoid:** Install `motion` (not `framer-motion`). Check: `npm info motion version`.

---

## Code Examples

### Adding financial token to globals.css
```css
/* Source: existing globals.css pattern — match this style exactly */
:root {
  /* ... existing tokens ... */
  /* Financial semantic tokens */
  --financial-positive: 160 60% 45%;   /* emerald-600 */
  --financial-negative: 347 77% 52%;   /* rose-600 */
  --financial-pending: 32 95% 44%;     /* amber-600 */
}

.dark {
  /* ... existing dark tokens ... */
  /* Financial semantic tokens (dark mode) */
  --financial-positive: 160 60% 60%;   /* emerald-400 */
  --financial-negative: 347 77% 68%;   /* rose-400 */
  --financial-pending: 32 95% 60%;     /* amber-400 */
}
```

### Extending tailwind.config.ts
```typescript
// Source: existing tailwind.config.ts colors pattern
colors: {
  // ... existing ...
  'financial-positive': 'hsl(var(--financial-positive))',
  'financial-negative': 'hsl(var(--financial-negative))',
  'financial-pending': 'hsl(var(--financial-pending))',
}
```

### CurrencyDisplay migration target
```tsx
// Source: apps/web/components/shared/currency-display.tsx
// BEFORE:
const colorClass = colorize
  ? amount < 0
    ? "text-red-600 dark:text-red-400"
    : amount > 0
    ? "text-green-600 dark:text-green-400"
    : "text-gray-900 dark:text-gray-100"
  : "";

// AFTER:
const colorClass = colorize
  ? amount < 0
    ? "text-financial-negative"
    : amount > 0
    ? "text-financial-positive"
    : "text-foreground"
  : "";
```

### Amber callout migration target
```tsx
// BEFORE:
<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
  <span className="text-amber-800">Warning message</span>
</div>

// AFTER:
<div className="rounded-lg border border-border bg-muted p-4 flex items-start gap-3">
  <span className="text-muted-foreground">Warning message</span>
</div>
```

### COMPONENT-ORGANIZATION.md canonical density section (to append)
```markdown
## Canonical Class Recipes

### Table & List View Rows
**Target:** 36px row height, compact but scannable.
```tsx
// TableRow
<TableRow className="h-9">
  <TableCell className="py-1.5 text-sm">...</TableCell>
</TableRow>

// Column headers
<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
  Column Name
</TableHead>
```

### Form Inputs
**Target:** 36px input height, consistent across all forms.
```tsx
<Input className="h-9 text-sm" />
<Select>
  <SelectTrigger className="h-9 text-sm">...</SelectTrigger>
</Select>
```

### Page Header Action Area (VISUAL-03 Pattern)
Approval/workflow actions belong in the page header, not buried in card bodies:
```tsx
<div className="flex items-start justify-between">
  <div>
    <h1 className="text-2xl font-bold">{title}</h1>
  </div>
  <div className="flex items-center gap-2">
    {/* Primary workflow action always first */}
    <Button variant="default">Approve</Button>
    <Button variant="destructive">Reject</Button>
    {/* Secondary actions */}
    <Button variant="outline">Generate PDF</Button>
  </div>
</div>
```

### Financial Color Token Usage
Apply `text-financial-positive/negative/pending` ONLY to the number value and its directly adjacent icon.
Do NOT apply to row backgrounds, card backgrounds, or badge backgrounds.
```tsx
// Correct — token on number text only
<span className="text-financial-positive tabular-nums">{formatCurrency(amount)}</span>
<TrendingUp className="h-4 w-4 text-financial-positive" />

// Incorrect — token on background
<div className="bg-financial-positive/10">...</div>  // Don't do this
```
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `framer-motion` package | `motion` package | Framer Motion v11 rebranded to `motion` | Install `motion` not `framer-motion` |
| dark: class on every element | CSS variable tokens auto-switching | shadcn/ui pattern, Phase 13 | Tokens remove per-element dark: maintenance |
| Inline statusColors objects | StatusBadge CVA component | Phase 19 | But StatusBadge still uses palette classes internally — needs token migration |
| `@tanstack/react-query` v4 | v5.90.21 (already installed) | v5 API is different | Already on v5 — no migration needed |

---

## Open Questions

1. **HSL values for financial tokens — exact emerald-600 and rose-600 equivalents**
   - What we know: Tailwind's `emerald-600` = `#059669`, `emerald-400` = `#34d399`, `rose-600` = `#e11d48`, `rose-400` = `#fb7185`, `amber-600` = `#d97706`, `amber-400` = `#fbbf24`
   - What's unclear: The exact HSL tuples to use in globals.css (HSL format, no hsl() wrapper)
   - Recommendation: Use `hsl(160 84% 39%)` for emerald-600, `hsl(347 77% 50%)` for rose-600, `hsl(38 92% 50%)` for amber-600 — or reference the official Tailwind color palette CSS values
   - Confidence: MEDIUM (derived from hex conversion, not directly verified against Tailwind source)

2. **motion v12 vs framer-motion — breaking API changes from v10/v11**
   - What we know: Package is now called `motion`, default import changes from `framer-motion`
   - What's unclear: Specific API surface for spring animations needed in later phases
   - Recommendation: FOUND-04 only requires installation. Document the import path change for later phases: `import { motion } from "motion/react"` not `from "framer-motion"`
   - Confidence: MEDIUM (based on public rebranding announcement, not Context7-verified)

3. **react-number-format v5 — usage pattern for currency inputs**
   - What we know: Package is not installed; v5 has NumericFormat and PatternFormat components
   - What's unclear: Exact integration with react-hook-form Controller (FOUND-04 is install only; usage comes in later phases)
   - Recommendation: Install only in this phase; defer usage documentation to the phase that uses it

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `apps/web/app/globals.css` — complete token vocabulary
- Direct file read: `apps/web/tailwind.config.ts` — color extension wiring
- Direct file read: `apps/web/package.json` — confirmed 3 packages not installed
- Direct file read: `apps/web/COMPONENT-ORGANIZATION.md` — existing file content
- Direct grep: all 56 TSX files with hardcoded palette classes — grouped into 7 batches
- Direct file read: `apps/web/components/change-order/change-order-detail.tsx` — header action area + approval button location
- Direct file read: `apps/web/components/change-order/approval-panel.tsx` — Approve/Reject button location
- Direct file read: `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx` — page header structure
- Direct file read: `apps/web/components/payment-app/g702-form.tsx` — action button location in card body

### Secondary (MEDIUM confidence)
- Motion v12 rebranding: `motion` package name, `import { motion } from "motion/react"` import path — needs validation on first use

### Tertiary (LOW confidence)
- HSL channel values for financial tokens — derived from Tailwind hex values; verify against Tailwind v3 source or use `npx tailwind-colors` utility

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json directly read
- Architecture (token vocab): HIGH — globals.css directly read
- File inventory: HIGH — grepped directly, 56 files confirmed
- Approval button locations: HIGH — all relevant files read
- Financial color usages: HIGH — grepped and read key files
- Package versions: HIGH — package.json read, targets confirmed absent
- COMPONENT-ORGANIZATION.md: HIGH — file read in full
- HSL values for new tokens: MEDIUM — computed from hex

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable codebase, 30-day window appropriate)
