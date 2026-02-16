---
phase: 17-estimating-workflow-setup-core
created: 2026-02-15
status: ready_for_research
decisions_from: user_discussion
---

# Phase 17: Estimating Workflow - Setup & Core - Implementation Context

**Phase Goal**: User can create estimates using guided step-by-step workflow with cost code templates, labor rates, and SOV builder

This document captures implementation decisions gathered through user discussion. Downstream agents (researcher, planner, executor) should follow these decisions without re-asking the user.

---

## 1. Guided Workflow Step Progression & State

### Navigation Model
**Decision**: Smart progression (next unlocks after minimal data)
- Users can advance to next step with partial data
- Validation flags incomplete sections but doesn't block progress
- Steps unlock dynamically based on minimal required data

**Implication for Implementation**:
- Each step defines "minimum viable data" threshold (e.g., "estimate name + project type")
- Navigation sidebar shows which steps are accessible (unlocked) vs locked
- Users can navigate freely between unlocked steps

### Auto-Save Behavior
**Decision**: Auto-save on every change
- Draft persists automatically to database
- User can leave workflow at any time without data loss
- No manual "Save" button needed

**Implication for Implementation**:
- Debounced save on all form inputs (e.g., 500ms delay)
- tRPC mutation for incremental updates (not full estimate save each time)
- Visual indicator: "Saving..." → "Saved" in UI
- Handle optimistic updates with React Query

### Validation Strategy
**Decision**: Final submission blocking (warnings during, errors at end)
- Soft warnings during workflow (non-blocking)
- Hard validation only when marking estimate as "Complete" or "Submit"
- Users can work with incomplete data during draft phase

**Implication for Implementation**:
- Two validation modes:
  1. `validate({ mode: 'warning' })` - returns issues but doesn't block
  2. `validate({ mode: 'blocking' })` - returns errors and prevents submission
- Show warnings in UI as yellow alerts (not red errors)
- "Mark Complete" button triggers full blocking validation

### Progress Indicator
**Decision**: Sidebar with collapsible sections
- Vertical left navigation showing all steps
- Current step highlighted
- Can expand/collapse step groups
- Click any unlocked step to navigate

**Implication for Implementation**:
- Sidebar component with step state management
- Steps organized into logical groups (Setup, Cost Entry, Finalization)
- Active step gets visual highlight (border + background color)
- Locked steps show lock icon and are non-clickable

---

## 2. Template Application & Customization

### Template Organization
**Decision**: Company library + user personal templates
- Company-level template library (admin-managed)
- Users can save personal templates
- **Admin toggle**: Company admin can disable personal templates tenant-wide via company profile setting

**Implication for Implementation**:
- Database schema: `templates` table with `scope` enum: `'company' | 'personal'`
- Company profile setting: `allowPersonalTemplates: boolean` (defaults to `true`)
- UI: Hide "Save as personal template" option if setting is `false`
- Permission check: Only admins can create company templates

### Template Application Flow
**Decision**: Auto-populate with inline editing allowed
- Selecting template loads all line items as starting point
- User can add/remove/modify any line item for this specific estimate
- Changes to estimate don't affect original template

**Implication for Implementation**:
- Template selection triggers "Apply Template" mutation
- Copies template line items to estimate (deep clone, not reference)
- Estimate line items have `sourceTemplateId` (nullable) for tracking origin
- Template remains immutable - estimate is independent copy

### Labor Rate Template Relationship
**Decision**: Labor rates are separate selection (independent)
- Cost code template and labor rate template are two separate selections
- User picks cost code template → gets cost structure
- User picks labor rate template → applies rates to all labor line items
- Maximum flexibility for regional rate variations

**Implication for Implementation**:
- Two separate dropdowns in workflow:
  1. Step 1: "Select Cost Code Template" (optional)
  2. Step 2: "Select Labor Rate Template" (optional)
- Labor rate template schema: stores hourly rates by labor classification
- Application logic: Finds all line items with `type: 'labor'` and applies rates
- User can still manually override individual line item rates after template applied

### Template Customization During Estimate
**Decision**: Yes, customize and save as new template
- User modifies estimate (which started from template)
- At end of estimate creation, option to "Save as template"
- Saves to personal templates (or company library if user has permission)
- Builds institutional knowledge over time

**Implication for Implementation**:
- "Save as Template" button appears when estimate is based on modified template
- Modal dialog: Template name, description, scope (personal vs company if admin)
- Permission check: `canCreateCompanyTemplate` ability for company-scoped templates
- New template inherits structure from current estimate state

---

## 3. Margin Visibility & Markup Configuration

### Margin Display Locations
**Decision**: Multiple visibility points (selected all 3)
1. **Per line item** (inline in table)
2. **Section subtotals** (grouped by cost code)
3. **Overall estimate summary** (top or bottom)

**Implication for Implementation**:
- Estimate line item table: Add columns for "Margin $" and "Margin %"
- Section rows (subtotals): Calculate and display rolled-up margin for that division
- Sticky summary bar: Always shows total estimate margin ($ and %)
- Calculations update in real-time as user edits costs or markup

### Markup Configuration Logic
**Decision**: Tiered + custom (hybrid approach)
- Default markup tiers by cost type: labor, materials, equipment, subcontractors
- User can override markup % for specific cost codes
- Balanced flexibility between consistency and control

**Implication for Implementation**:
- Company profile stores default markup rates:
  ```typescript
  {
    laborMarkup: 20,      // %
    materialMarkup: 10,   // %
    equipmentMarkup: 15,  // %
    subcontractorMarkup: 12 // %
  }
  ```
- Estimate can override globally or per cost code
- UI: Markup settings panel with "Use defaults" toggle + custom overrides table
- Calculation: Check line item for custom markup → fall back to cost type tier → fall back to company default

### Markup Base Elements
**Decision**: Configurable by admin (tenant-wide setting)
- Company admin chooses what's included in markup base
- Options: Direct costs only, or Direct costs + overhead
- Applied to all estimates in that tenant

**Implication for Implementation**:
- Company profile setting: `markupBase: 'direct' | 'direct_plus_overhead'`
- Calculation engine checks setting before applying markup:
  - `'direct'`: markup on (labor + material + equipment + subs)
  - `'direct_plus_overhead'`: markup on (direct costs + overhead amount)
- Setting page: Company Settings → Estimating → Markup Base

### Overhead Handling
**Decision**: Both percentage and fixed (user chooses per estimate)
- Estimator selects: Use company overhead % OR enter custom $ amount for this job
- Flexibility for jobs with unusual overhead requirements

**Implication for Implementation**:
- Company profile stores default overhead percentage
- Estimate schema has:
  ```typescript
  {
    overheadType: 'percentage' | 'fixed',
    overheadValue: number,  // % or $
  }
  ```
- UI toggle: "Use company rate (8%)" vs "Enter fixed amount ($5,000)"
- Calculation adjusts based on `overheadType`

---

## 4. SOV Builder Interaction Model

### SOV Generation from Estimate
**Decision**: Smart grouping with manual adjustment
- System suggests grouped SOV lines based on estimate structure
- Estimator can split/merge/adjust before finalizing
- Balance of automation and control

**Implication for Implementation**:
- "Generate SOV" button in estimate workflow
- Algorithm groups estimate line items by cost code division or phase
- Preview modal shows proposed SOV structure
- User can:
  - Accept grouping as-is
  - Split a grouped line (break out specific items)
  - Merge lines (combine multiple into one)
  - Rename SOV line descriptions
- "Finalize SOV" locks it to estimate

### SOV Adjustment Flexibility
**Decision**: Yes, but amounts must match estimate total (can regroup only)
- Full flexibility to reorganize SOV lines
- Constraint: SOV total must equal estimate total
- Changes don't affect estimate itself

**Implication for Implementation**:
- SOV validation: `sum(sov_line_items.amount) === estimate.totalCost`
- UI shows running total + validation error if mismatch
- Users can split/merge/rename but amounts must reconcile
- "Finalize SOV" button disabled until totals match

### SOV Grouping/Sorting Options
**Decision**: Admin selects default method (tenant-wide)
- Options:
  1. By CSI division (standard construction hierarchy)
  2. By project phase or milestone
  3. By payment schedule timing
- Company admin chooses default for all estimates
- (Implicit: estimators can manually reorder after generation)

**Implication for Implementation**:
- Company profile setting: `sovGroupingMethod: 'csi' | 'phase' | 'payment_schedule'`
- Generation algorithm uses this setting to group estimate lines
- After generation, SOV line items have `sortOrder` field for manual drag-and-drop
- Setting page: Company Settings → Estimating → Default SOV Grouping

### SOV Sync with Estimate Changes
**Decision**: Conditional sync based on estimate status
- **If estimate is draft**: SOV shows warning but doesn't auto-update (manual sync button)
- **If estimate is submitted**: Changes require creating a revision (new version)
- **If estimate is under contract**: Changes require change order (SOV becomes contractual)

**Implication for Implementation**:
- Estimate status enum: `'draft' | 'submitted' | 'accepted' | 'under_contract'`
- When estimate changes:
  1. Draft: Show yellow banner "SOV is out of sync" + "Refresh SOV" button
  2. Submitted: Block edit with "Create Revision" flow (increments version)
  3. Under contract: Block edit with "Create Change Order" flow
- SOV versioning: Each estimate version has its own SOV snapshot
- Original SOV is immutable once estimate moves past draft

---

## 5. SOV Advanced Requirements (Deep Dive)

### SOV Permissions
**Decision**: Any project team member with estimating role
- Not limited to estimate creator
- Anyone with "Estimator" role on project can build/modify SOV
- (Implicit: Subject to status constraints above)

**Implication for Implementation**:
- CASL ability: `can('manage', 'SOV')` if user has `estimator` role on project
- SOV UI checks role before showing edit controls
- Audit log tracks who created/modified SOV

### SOV Versioning Strategy
**Decision**: SOV versions track with estimate revisions
- When estimate is revised (v1 → v2 → v3), each gets its own SOV version
- Once estimate is submitted, changes require revision
- Once under contract, original versions are locked (immutable)
- Change orders create new versions

**Implication for Implementation**:
- Database schema:
  ```typescript
  {
    estimateId: string,
    version: number,          // matches estimate version
    status: 'draft' | 'submitted' | 'accepted' | 'contractual',
    createdFromChangeOrder: string | null,
  }
  ```
- UI shows version history: SOV v1, SOV v2, etc.
- Can view old versions (read-only) but only edit current version (if status allows)
- Change order flow creates new SOV version with `createdFromChangeOrder` reference

### SOV Relationship to Payment Applications
**Decision**: SOV becomes the payment application template
- When estimate is won, SOV line items feed directly into G702/G703 pay apps
- No intermediate conversion - SOV structure is payment app structure
- Continuity from estimate → SOV → payment apps

**Implication for Implementation**:
- When project status changes to "Active" (won bid):
  - Copy SOV line items to payment application line items table
  - Link to project budget (estimate converts to budget)
- Payment app schema references SOV line items:
  ```typescript
  {
    sovLineItemId: string,
    scheduledValue: number,
    workCompletedThisPeriod: number,
    // ... G702/G703 fields
  }
  ```
- Payment app creation wizard pre-populates from SOV

### SOV Line Item Metadata
**Decision**: Capture multiple metadata fields (selected 3 of 4)
1. **CSI code or cost code reference** - link back to estimate cost codes
2. **Completion percentage tracking** - for progress billing
3. **Scheduled value by phase or month** - for cash flow planning

**Implication for Implementation**:
- SOV line item schema:
  ```typescript
  {
    id: string,
    description: string,
    amount: number,
    sortOrder: number,
    costCodeReferences: string[],  // Array of cost code IDs from estimate
    completionPercent: number,     // 0-100, tracks progress
    scheduledValues: {             // Optional breakdown by period
      phase?: string,
      month?: string,
      amount: number,
    }[],
  }
  ```
- UI:
  - Cost code column shows which codes this SOV line represents
  - Progress column for % complete (editable in pay app context)
  - Optional: Expand row to see scheduled value breakdown

---

## Scope Boundaries (NOT in Phase 17)

The following are explicitly OUT OF SCOPE for this phase:

- **Bid generation from estimate** (Phase 18)
- **Bid submission tracking** (Phase 18)
- **Won/Lost bid tracking** (Phase 18)
- **Conversion to active project** (Phase 18)
- **Payment application creation** (uses SOV, but pay app UI is Phase 6)
- **Spreadsheet mode for bulk entry** (mentioned in success criteria but defer if too complex)

Phase 17 focuses on:
- Estimate creation workflow (guided steps)
- Template management (cost codes + labor rates)
- Margin/markup configuration
- SOV builder

---

## Technical Constraints

### Existing System Integration Points

1. **Projects**: Estimates are created within project context
2. **Cost Codes**: Leverage existing CSI cost code structure (Phase 2, Phase 4)
3. **Budget**: Estimate converts to budget when project is won (Phase 4 schema)
4. **Payment Applications**: SOV feeds into existing pay app system (Phase 6)
5. **Company Profile**: Template settings, markup defaults, SOV grouping stored in company profile
6. **RBAC**: Use existing CASL abilities for estimate/SOV permissions

### Data Model Considerations

- Estimates are project-scoped (multi-tenant via project relationship)
- Templates are company-scoped OR user-scoped
- SOV versioning must align with estimate versioning
- Auto-save requires debounced mutations (avoid DB hammering)
- Margin calculations happen client-side (real-time) and server-side (validation)

### UI/UX Patterns

- **Sidebar navigation**: Consistent with Phase 13 navigation patterns
- **Form components**: Use Phase 14 standardized inputs
- **Table components**: Use Phase 16 TanStack Table patterns for estimate line items
- **Auto-save indicator**: Consistent with existing form patterns
- **Validation**: Follow Phase 14 Zod schema patterns

---

## Next Steps for Planning Agent

When creating the implementation plan, prioritize in this order:

1. **Database schema** (estimates, estimate_line_items, templates, labor_rate_templates, sov_line_items)
2. **Backend mutations** (CRUD for estimates, template application, SOV generation)
3. **Guided workflow UI** (sidebar navigation, step components, auto-save)
4. **Template management** (template library, application flow, save-as-template)
5. **Margin/markup calculator** (calculation engine, UI display)
6. **SOV builder** (generation algorithm, adjustment UI, versioning)

Ensure all decisions documented above are reflected in the plan without re-confirming with the user.
