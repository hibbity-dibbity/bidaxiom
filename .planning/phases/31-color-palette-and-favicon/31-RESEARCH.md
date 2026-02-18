# Phase 31: Color Palette & Favicon - Research

**Researched:** 2026-02-18
**Domain:** Tailwind CSS / CSS custom properties / Next.js 14 metadata API / brand color application
**Confidence:** HIGH

---

## Summary

The app uses a complete shadcn/ui CSS variable color system with HSL values defined in `globals.css`
and referenced via `hsl(var(--name))` in `tailwind.config.ts`. Both BIDAXIOM asset files exist in
`apps/web/public/`. The root layout's `metadata` object has no `icons` field set — meaning no favicon
is currently configured. Next.js 14 auto-detects `apps/web/app/icon.png` if it exists; it does not
look in `/public` automatically.

The BIDAXIOM logo has been visually analyzed. It contains two distinct colors: a dark slate-blue
for the wordmark text and a vivid cyan-teal for the circular icon. These map cleanly onto two palette
roles: `primary` (dark slate) and `accent` (cyan-teal). The current `primary` is a near-black
(`240 5.9% 10%`) and the current `accent` is a light grey — both are generic shadcn/ui defaults
with no brand identity.

**Primary recommendation:** Replace `--primary` with the BIDAXIOM slate-blue, `--accent` with the
BIDAXIOM cyan-teal, update both `:root` and `.dark` blocks, add `apps/web/app/icon.png` (copy of
`bidaxiom-icon.png`) for Next.js auto-detection, and add an explicit `icons` field to root layout
metadata as belt-and-suspenders.

**CRITICAL CONSTRAINT:** The human approval gate is a hard blocker. Phase 31 MUST be split into
two completely separate task groups: (1) extract and present palette, (2) apply palette after user
approval. No color changes are made in group 1.

---

## Visual Color Analysis

Both image files confirmed present and analyzed visually.

### `bidaxiom-logo.png` (848x195 px)
The wordmark "BIDAXIOM" uses a single dark slate-blue color for all letters. The circle behind the
checkmark uses a vivid cyan-teal. The checkmark itself uses the same dark slate-blue as the text.

### `bidaxiom-icon.png` (560x560 px)
A circle filled with the same vivid cyan-teal, containing a bold checkmark in the same dark
slate-blue. The background of the image is transparent.

### Extracted Colors (visual analysis — HIGH confidence)

| Swatch | Description | Estimated HSL | Estimated Hex |
|--------|-------------|---------------|---------------|
| Slate-blue (text/checkmark) | Dark cool blue-grey; very similar to dark navy with blue undertone | `210 25% 22%` | `~#2D3F52` |
| Cyan-teal (circle background) | Bright, saturated cyan leaning slightly teal | `188 85% 47%` | `~#0BBCD4` |

**Note on estimation:** These values are derived from visual analysis of the PNG. The user approval
checkpoint exists precisely because HSL estimates from visual inspection carry ~5-10% hue/saturation
error. The planner MUST encode a UAT gate here where these extracted values are presented to the user
and confirmed before any code is written.

---

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for phase 31. All decisions are Claude's discretion, constrained by the
requirements in STATE.md and the phase goal.

### Mandatory Human Checkpoint (from STATE.md)
> Phase 31 has a mandatory human checkpoint — the palette MUST be extracted and presented to the
> user for approval BEFORE any color is applied to the codebase.

This is an explicit architectural constraint on the plan structure — not optional.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | Already installed | Color utility generation | Already in use |
| CSS custom properties (HSL) | Native browser | Theme variables | Already in use (shadcn/ui pattern) |
| Next.js Metadata API | 14 (already in use) | Favicon/icon registration | Framework-native, no extra dep |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui conventions | Already installed | CSS variable naming contract | Must maintain for all UI components to work |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js icon auto-detection | `metadata.icons` only | Auto-detection is cleaner but both should be used |
| Visual color extraction | `sharp`/`jimp` programmatic | Sharp requires native build; visual extraction is sufficient with user approval gate |

---

## Current Color System (Exact Values)

**File:** `apps/web/app/globals.css`

### `:root` (light mode)

```css
--background: 0 0% 100%;              /* white */
--foreground: 240 10% 3.9%;           /* near-black */
--card: 0 0% 100%;
--card-foreground: 240 10% 3.9%;
--popover: 0 0% 100%;
--popover-foreground: 240 10% 3.9%;
--primary: 240 5.9% 10%;              /* CURRENT: near-black, NO brand color */
--primary-foreground: 0 0% 98%;       /* near-white */
--secondary: 240 4.8% 95.9%;         /* light grey */
--secondary-foreground: 240 5.9% 10%;
--muted: 240 4.8% 95.9%;
--muted-foreground: 240 3.8% 46.1%;
--accent: 240 4.8% 95.9%;            /* CURRENT: light grey, NO brand color */
--accent-foreground: 240 5.9% 10%;
--destructive: 0 84.2% 60.2%;        /* red */
--destructive-foreground: 0 0% 98%;
--border: 240 5.9% 90%;
--input: 240 5.9% 90%;
--ring: 240 5.9% 10%;

/* Custom sidebar tokens */
--sidebar-background: 0 0% 98%;
--sidebar-foreground: 240 5.3% 26.1%;
--sidebar-primary: 240 5.9% 10%;
--sidebar-primary-foreground: 0 0% 98%;
--sidebar-accent: 240 4.8% 95.9%;
--sidebar-accent-foreground: 240 5.9% 10%;
--sidebar-border: 220 13% 91%;
--sidebar-ring: 217.2 91.2% 59.8%;

/* Custom construction accent (already present) */
--accent-construction: 25 95% 53%;   /* warm orange - NOT from BIDAXIOM logo */
--accent-construction-foreground: 0 0% 100%;
```

### `.dark` (dark mode)

```css
--background: 240 10% 3.9%;
--foreground: 0 0% 98%;
--primary: 0 0% 98%;                  /* CURRENT: near-white (inverted) */
--primary-foreground: 240 5.9% 10%;
--secondary: 240 3.7% 15.9%;
--secondary-foreground: 0 0% 98%;
--muted: 240 3.7% 15.9%;
--muted-foreground: 240 5% 64.9%;
--accent: 240 3.7% 15.9%;            /* CURRENT: dark grey */
--accent-foreground: 0 0% 98%;
--destructive: 0 62.8% 30.6%;
--destructive-foreground: 0 0% 98%;
--border: 240 3.7% 15.9%;
--input: 240 3.7% 15.9%;
--ring: 240 4.9% 83.9%;

--sidebar-background: 240 5.9% 10%;
--sidebar-foreground: 240 4.8% 95.9%;
--sidebar-primary: 224.3 76.3% 48%;  /* blue sidebar active state in dark mode */
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 240 3.7% 15.9%;
--sidebar-accent-foreground: 240 4.8% 95.9%;
--sidebar-border: 240 3.7% 15.9%;
--sidebar-ring: 217.2 91.2% 59.8%;
```

**Key observation:** `--accent-construction: 25 95% 53%` (warm orange) is a pre-existing custom
variable that is NOT from the BIDAXIOM logo. It must remain untouched — it is a separate semantic
role (construction warnings/highlights). The logo does not use orange.

---

## Tailwind Config Color Mapping Pattern

**File:** `apps/web/tailwind.config.ts`

All colors reference CSS variables via `hsl(var(--name))` pattern. No hardcoded color values.

```ts
colors: {
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))'
  },
  accent: {
    DEFAULT: 'hsl(var(--accent))',
    foreground: 'hsl(var(--accent-foreground))'
  },
  // ... all follow same pattern
  construction: {
    DEFAULT: 'hsl(var(--accent-construction))',
    foreground: 'hsl(var(--accent-construction-foreground))'
  }
}
```

**Implication:** Updating `globals.css` CSS variables is the ONLY change needed to retheme all
Tailwind utility classes. `tailwind.config.ts` does NOT need modification.

---

## Favicon Current State

### What exists today
- `apps/web/public/bidaxiom-logo.png` — wordmark (848x195)
- `apps/web/public/bidaxiom-icon.png` — circular icon (560x560)
- `apps/web/app/layout.tsx` — has `metadata` object with `title` and `description` only
- No `icons` field in metadata
- No `icon.png`, `icon.ico`, `favicon.ico` anywhere in `apps/web/app/`
- No `favicon.ico` in `apps/web/public/`

### Result today
Browser tab shows default browser favicon (usually blank or browser default). No brand icon.

### How Next.js 14 Favicon Auto-Detection Works
Next.js 14 supports two complementary approaches (both should be used):

**Approach 1 — File-based (auto-detection):**
Place `icon.png` directly in `apps/web/app/`. Next.js automatically generates `<link rel="icon">`
metadata for any file named `icon.png`, `icon.jpg`, `icon.ico`, or `favicon.ico` placed in the
`app/` directory. The file does NOT go in `public/` — it goes in `app/`.

**Approach 2 — Metadata API:**
Add `icons` to the `metadata` export in `apps/web/app/layout.tsx`:
```ts
export const metadata: Metadata = {
  title: { ... },
  description: "...",
  icons: {
    icon: '/bidaxiom-icon.png',
    shortcut: '/bidaxiom-icon.png',
    apple: '/bidaxiom-icon.png',
  },
};
```

**Recommendation:** Use BOTH. Copy `bidaxiom-icon.png` to `apps/web/app/icon.png` (auto-detection
covers most cases) AND add `icons` to metadata (covers edge cases and PWA/bookmark scenarios).

---

## Recommended Palette Role Mapping

Based on visual analysis of the BIDAXIOM logo:

| CSS Variable | Current Value | Proposed Value | Rationale |
|---|---|---|---|
| `--primary` (light) | `240 5.9% 10%` | `210 25% 22%` | BIDAXIOM slate-blue (text/checkmark color) |
| `--primary-foreground` (light) | `0 0% 98%` | `0 0% 98%` | White on dark primary — keep |
| `--ring` (light) | `240 5.9% 10%` | `210 25% 22%` | Focus ring should match primary |
| `--sidebar-primary` (light) | `240 5.9% 10%` | `210 25% 22%` | Active nav item should match brand |
| `--primary` (dark) | `0 0% 98%` | `188 70% 65%` | Lighter cyan-teal for dark mode primary |
| `--sidebar-primary` (dark) | `224.3 76.3% 48%` | `188 85% 47%` | Brand cyan-teal for active nav in dark |
| `--accent` (light) | `240 4.8% 95.9%` | `188 30% 93%` | Very light cyan tint (not full cyan) |
| `--accent-foreground` (light) | `240 5.9% 10%` | `210 25% 22%` | Slate on light accent |

**Variables to leave unchanged:**
- `--background`, `--foreground` — neutral, intentionally brand-agnostic
- `--card`, `--popover` and their foregrounds — neutral
- `--secondary`, `--muted` — neutral supporting colors
- `--destructive` — semantic red, must not change
- `--accent-construction` — pre-existing orange accent for construction domain; NOT from logo

**Note:** These proposed values are estimates pending user approval. The user approval checkpoint
allows the user to confirm or adjust these values before any code is modified.

---

## Architecture Patterns

### Recommended Project Structure (no new folders needed)

The changes are confined to two existing files plus one new file:

```
apps/web/
├── app/
│   ├── globals.css          # MODIFY: CSS variable values in :root and .dark
│   ├── icon.png             # CREATE: copy of bidaxiom-icon.png for auto-detection
│   └── layout.tsx           # MODIFY: add icons field to metadata
└── public/
    ├── bidaxiom-logo.png    # READ ONLY: source for color extraction (no modification)
    └── bidaxiom-icon.png    # READ ONLY: source asset (copy to app/icon.png)
```

### Two-Phase Execution Pattern (CRITICAL)

**Phase A — Extract and present (no code changes):**
1. Read `bidaxiom-logo.png` visually
2. Identify dominant colors from the image
3. Map colors to HSL values
4. Identify palette roles for each color
5. Present proposed values to user in a clear table
6. WAIT for user approval — this is a hard stop

**Phase B — Apply (only after explicit approval):**
1. Update `apps/web/app/globals.css` — replace CSS variable values
2. Create `apps/web/app/icon.png` — copy `bidaxiom-icon.png`
3. Update `apps/web/app/layout.tsx` — add `icons` to metadata
4. Verify in browser: primary buttons render brand color, favicon shows in tab

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Favicon format conversion | Custom ICO converter | Next.js accepts PNG directly | Next.js 14 handles PNG favicons natively |
| Color variable inheritance | Custom CSS cascade | Existing shadcn/ui variable system | Already set up; just update values |
| Dark mode toggle | Custom system | `darkMode: ["class"]` already in tailwind.config | Already implemented via class strategy |
| Color palette generation | Custom algorithm | Visual analysis + user review | No image processing library needed |

**Key insight:** The entire retheme is accomplished by editing 8-12 CSS variable values in a single
file. The Tailwind config acts as a pure passthrough and never needs editing for color changes.

---

## Common Pitfalls

### Pitfall 1: Forgetting `.dark` block
**What goes wrong:** Only updating `:root` variables causes brand colors to disappear in dark mode
(dark mode has its own variable values that override `:root`).
**How to avoid:** Always update BOTH `:root` and `.dark` blocks.
**Warning signs:** Colors look wrong when toggling dark mode.

### Pitfall 2: Overwriting `--accent-construction`
**What goes wrong:** The pre-existing orange accent (`25 95% 53%`) is a domain-specific color for
construction workflow highlighting. Replacing it with cyan-teal breaks those visual signals.
**How to avoid:** Leave `--accent-construction` and `--accent-construction-foreground` unchanged.
**Warning signs:** Construction-specific status highlights lose their orange color.

### Pitfall 3: Favicon in wrong location
**What goes wrong:** Placing `icon.png` in `public/` instead of `app/` — Next.js file-based metadata
auto-detection only works from within the `app/` directory.
**How to avoid:** Put `icon.png` in `apps/web/app/icon.png`, not `apps/web/public/icon.png`.
**Warning signs:** Browser tab still shows no favicon after adding the file.

### Pitfall 4: Logo dark mode inversion breaks with brand colors
**What goes wrong:** `apps/web/components/layout/sidebar.tsx` uses `dark:invert` on the logo image.
`dark:invert` works correctly when the logo is dark-on-white but may look wrong if the logo has
transparent background with colored elements. The `bidaxiom-logo.png` is dark text on white
background — inversion makes it white text on dark background, which is acceptable.
**How to avoid:** Verify visually in dark mode after applying. Consider `dark:brightness-0 dark:invert`
if further refinement is needed.
**Warning signs:** Logo looks like a photographic negative instead of a white version in dark mode.

### Pitfall 5: Primary foreground contrast failure
**What goes wrong:** If the new `--primary` hue is not dark enough, white text on primary buttons
may fail WCAG AA contrast.
**How to avoid:** Verify contrast ratio for the chosen slate-blue against `--primary-foreground`
(`0 0% 98%` = near-white). The estimated `210 25% 22%` is dark enough (~4.5:1).
**Warning signs:** Text on primary buttons is hard to read.

### Pitfall 6: HSL values without the `/ alpha` format
**What goes wrong:** Writing `hsl(210, 25%, 22%)` in globals.css instead of `210 25% 22%`.
The Tailwind pattern is `hsl(var(--name))` which wraps space-separated values — commas break this.
**How to avoid:** Always use space-separated HSL format: `H S% L%` with no `hsl()` wrapper and no commas.
**Warning signs:** Tailwind color utilities render transparent or wrong color.

---

## Code Examples

### Adding `icons` to Next.js 14 metadata (Approach 2)
```typescript
// apps/web/app/layout.tsx
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata#icons
export const metadata: Metadata = {
  title: {
    template: "%s | BIDAXIOM",
    default: "BIDAXIOM",
  },
  description: "Construction management software for general contractors and subcontractors",
  icons: {
    icon: '/bidaxiom-icon.png',
    shortcut: '/bidaxiom-icon.png',
    apple: '/bidaxiom-icon.png',
  },
};
```

### CSS variable update pattern in globals.css
```css
/* BEFORE (shadcn default) */
--primary: 240 5.9% 10%;

/* AFTER (BIDAXIOM slate-blue) */
--primary: 210 25% 22%;
```

### File-based favicon (Approach 1)
Next.js 14 auto-detection: place `icon.png` in `apps/web/app/`. This is the recommended primary
approach. The file must be:
- Named exactly: `icon.png`, `icon.jpg`, `icon.jpeg`, or `favicon.ico`
- Located at: `apps/web/app/icon.png` (app root, not in a route segment folder)
- Format: PNG at any size; 560x560 is fine (Next.js will serve it as-is)

---

## Files to Modify (Exhaustive List)

| File | Change Type | What Changes |
|------|-------------|--------------|
| `apps/web/app/globals.css` | MODIFY | 8-12 CSS variable values in `:root` and `.dark` |
| `apps/web/app/layout.tsx` | MODIFY | Add `icons` field to `metadata` object |
| `apps/web/app/icon.png` | CREATE | Copy of `apps/web/public/bidaxiom-icon.png` |

**Files confirmed NOT to modify:**
- `apps/web/tailwind.config.ts` — passthrough; all colors via CSS vars, no changes needed
- `apps/web/public/bidaxiom-logo.png` — source asset, read-only
- `apps/web/public/bidaxiom-icon.png` — source asset, read-only
- Any component file — colors flow through CSS variables automatically
- `apps/web/components/layout/sidebar.tsx` — logo display handled; dark:invert is correct

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `favicon.ico` in `/public` | `app/icon.png` file-based metadata | Next.js 13 App Router | Auto-detection; no `<link>` tag needed in HTML |
| `<Head>` with `<link rel="icon">` | `metadata.icons` API | Next.js 13 | Type-safe, colocation with layout |
| Hardcoded hex in Tailwind | CSS variable + `hsl(var())` | shadcn/ui convention | Runtime theme switching, dark mode |

**Deprecated/outdated:**
- `pages/_app.tsx` + `<Head>` favicon: Pages Router pattern, not applicable here
- `public/favicon.ico` alone: Works in Next.js App Router but not the idiomatic approach

---

## Open Questions

1. **Exact HSL values of BIDAXIOM slate-blue**
   - What we know: Dark blue-grey, estimated `210 25% 22%`
   - What's unclear: Whether H=210 or H=215; saturation could be 20-30%
   - Recommendation: Present estimate to user, user confirms or adjusts before code is written

2. **Exact HSL values of BIDAXIOM cyan-teal**
   - What we know: Vivid bright cyan, estimated `188 85% 47%`
   - What's unclear: Whether it leans more cyan (H=185) or teal (H=195)
   - Recommendation: Present estimate to user, user confirms or adjusts before code is written

3. **`--accent` role: should it become cyan or stay neutral?**
   - What we know: `--accent` is currently light grey; used for hover states
   - What's unclear: Full cyan hover states may be too vivid for a dense data app
   - Recommendation: Use a very light cyan tint (`188 30% 93%`) rather than full cyan

4. **`dark:invert` on sidebar logo adequacy**
   - What we know: Used on `bidaxiom-logo.png` in sidebar and top-bar
   - What's unclear: Whether simple inversion produces acceptable white logo on dark background
   - Recommendation: Verify visually after applying; note as a known check in verification plan

---

## Sources

### Primary (HIGH confidence)
- Direct file inspection of `apps/web/app/globals.css` — full CSS variable inventory
- Direct file inspection of `apps/web/tailwind.config.ts` — color mapping pattern
- Direct file inspection of `apps/web/app/layout.tsx` — current metadata state
- Visual read of `apps/web/public/bidaxiom-logo.png` — color extraction
- Visual read of `apps/web/public/bidaxiom-icon.png` — color confirmation + dimensions
- PNG binary header read — exact dimensions (logo: 848x195, icon: 560x560)

### Secondary (MEDIUM confidence)
- Next.js 14 App Router favicon documentation (file-based: `app/icon.png`; metadata: `metadata.icons`)
- shadcn/ui CSS variable naming convention (confirmed via `components.json` and variable names)

---

## Metadata

**Confidence breakdown:**
- Current color system: HIGH — read directly from source files
- Logo color extraction: MEDIUM — visual analysis has ~5-10% HSL estimation error; user approval gate handles this
- Tailwind config pattern: HIGH — read directly from source file
- Favicon approach: HIGH — Next.js 14 App Router file-based metadata is well-documented
- Files to modify: HIGH — exhaustively verified from source files

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days; stable tech stack)
