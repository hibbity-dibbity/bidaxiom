# Phase 53: New Project Form Cleanup + Schema - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the new project creation form: remove legacy sections and headings, reposition and condense the Project Number field, add Customer Budget and Building Dimensions fields, change the default address placeholder, and run the DB migration for the 5 new columns. The project list, detail pages, and other surfaces are out of scope — those are addressed in Phases 54-56.

</domain>

<decisions>
## Implementation Decisions

### Project Number display
- Auto-generated value renders as **plain text** below the "Project Number" label — no input box, no disabled input. Just the value as text (e.g., "BX-2026-001").
- The **"Manual Entry" button sits inline on the same row as the value**: `BX-2026-001   [Manual Entry]`
- When "Manual Entry" is clicked, the plain text transitions to an **inline edit** — a border appears around the existing value where it sits. No layout shift; the value stays in place.
- In manual entry mode, the button label changes to **"Use Auto-Generated"** — same button style as "Manual Entry" (consistent visual toggle, only label changes).
- Clicking "Use Auto-Generated" restores the auto-generated value and returns to the read-only plain text display.
- Project Number appears **above Project Name** on the form.

### Form structure after removals
- **"New Project" h1** at the top of the page — standard page heading consistent with other pages.
- **No "Set up a new construction project..." description text** — removed entirely.
- **No section headings** — "Basic Information", "Location", and any other group headings are removed. Claude decides on visual groupings/separators if needed.
- **Field order (top to bottom):**
  1. Project Number (condensed: label + plain text value + inline Manual Entry button)
  2. Project Name
  3. Customer (existing customer selector)
  4. Description
  5. Location (address sub-fields: street, city, state, zip — same AddressInput components, no "Location" heading above them)
  6. Building Dimensions (W/L/H row)
  7. Customer Budget
- **No Team Members, Project Phases, or CSI Cost Codes sections.**

### Building Dimensions layout
- **3 inputs in a single row** (side by side): Width | Length | Height
- Each field has a **"ft" unit label** (suffix or adjacent label) to make the unit explicit.
- A **live square footage preview** is displayed below the dimension row (e.g., "Sq ft: 12,500") that updates as the user types Width and Length values.
- Square footage = Width × Length (Height is stored but not used in the sq ft calculation).
- All three fields are optional.

### Customer Budget placement
- Customer Budget appears **after Building Dimensions** — physical details first, then financial.
- Applies **currency format on blur** ($X,XXX.XX) consistent with other currency fields in the app.

### Default address placeholder
- The default placeholder address across **all location fields in the application** (not just the new project form) is changed to: **8400 Kirby Dr, Houston, TX 77054**

### Claude's Discretion
- Whether to use subtle visual separators between logical field groups (e.g., a divider between Location and Dimensions)
- Exact spacing and sizing of the 3-column dimension row
- Button style for Manual Entry / Use Auto-Generated (should match existing form button styles — outline, ghost, etc.)
- How "Sq ft: X,XXX" preview is styled (muted label? badge? just text?)

</decisions>

<specifics>
## Specific Ideas

- The Project Number condensed layout goal is **compactness with clarity** — the number is immediately visible as a read-only value, manual override is one click away, and switching back is equally easy.
- Inline edit (border appears around value) avoids layout shift — the form doesn't reflow when entering manual mode.
- The live square footage preview gives the user immediate feedback that the dimensions are being registered correctly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 53-new-project-form-cleanup-schema*
*Context gathered: 2026-02-24*
