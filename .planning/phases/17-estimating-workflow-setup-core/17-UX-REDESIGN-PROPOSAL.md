# Estimating Workflow UX Redesign Proposal

**Status:** Deferred
**Phase:** Future (post-17)
**Priority:** High
**Captured:** 2026-02-16
**Source:** Phase 17 UAT user feedback

## Current State (Phase 17)

The current implementation follows traditional construction software patterns:
- **6-step wizard workflow** with sidebar navigation
- Separate pages for each step (Basic Info → Templates → Line Items → Labor → Markup → SOV)
- Based on AIA/CSI industry standards
- Mimics workflows from Procore, BuilderTrend, etc.

**User feedback:** "Too many clicks, too cumbersome, redundant steps"

## User's Proposed Flow

### Goal
- **Fewer clicks**
- **Fewer keystrokes**
- **Less time creating estimates**

### Proposed Single-Page Layout

```
┌─────────────────────────────────────────────────┐
│ ESTIMATE BUILDER (Single Page)                  │
├─────────────────────────────────────────────────┤
│                                                  │
│ [Basic Info Section - Compact]                  │
│   Name: _______________  (no Project Type)      │
│   Templates: [Cost Code ▼] [Labor Rate ▼]      │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│ [Estimate Line Items - Main Focus]              │
│                                                  │
│ ┌─ Division 01 - General Requirements ────┐    │
│ │  [Apply Markup to Section ▼]             │    │
│ │  Line Item 1                             │    │
│ │  Line Item 2                             │    │
│ │  Subtotal: $X,XXX                        │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ ┌─ Division 03 - Concrete ─────────────────┐    │
│ │  [Apply Markup to Section ▼]             │    │
│ │  Line Item 1                             │    │
│ │  Subtotal: $X,XXX                        │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ [+ Add Line Item]                               │
│                                                  │
├─────────────────────────────────────────────────┤
│ [STICKY FOOTER - Always Visible]                │
│                                                  │
│ Direct Cost:     $XX,XXX                        │
│ Overhead (10%):  $X,XXX                         │
│ Markup (15%):    $X,XXX                         │
│ Selling Price:   $XX,XXX                        │
│ Margin:          XX.X%                          │
│                                                  │
│ [Whole Estimate Override] [Generate SOV]        │
└─────────────────────────────────────────────────┘
```

## Specific Changes Requested

### 1. Remove Redundant Step: /estimates/new
**Current:** Separate page to create estimate → then redirects to workflow
**Proposed:** Go directly to workflow page, start Step 1 inline

**Rationale:** Eliminates extra page load and form duplication

---

### 2. Consolidate Multi-Step Wizard into Single Page
**Current:** 6 separate steps with sidebar navigation
**Proposed:** Single scrollable page with all sections visible

**Benefits:**
- See entire estimate at a glance
- No clicking between steps
- Faster data entry
- Natural scroll flow

---

### 3. Remove Project Type Field
**Current:** Captured in Basic Info (Step 1)
**Proposed:** Remove - already exists in project details

**Rationale:** Data duplication, unnecessary field

---

### 4. Templates as Dropdowns (Not Separate Step)
**Current:** Step 2 - dedicated page for template selection
**Proposed:** Dropdowns at top of page
- Cost Code Template: [Select ▼]
- Labor Rate Template: [Select ▼]

**Benefits:**
- Instant application
- No separate navigation
- Can change templates without losing work

---

### 5. Section-Level Markup Overrides
**Current:** Only individual line item markup in Step 3, separate Markup Config in Step 5
**Proposed:** Apply markup at both levels
- **Division level:** "Apply 15% markup to all Division 03 items"
- **Line item level:** Override individual items as needed

**User quote:** "On the estimate line items table, where you have the CSI groupings, let me apply a markup override to that entire section"

---

### 6. Sticky Totals Footer
**Current:** Margin summary only visible in Step 5
**Proposed:** Totals "glued" to bottom, always visible while scrolling

**Contents:**
- Direct Cost
- Overhead (with override controls)
- Markup (with override controls)
- Selling Price
- Margin %

**Rationale:** Immediate feedback on estimate profitability while building

---

### 7. Rethink SOV Builder
**Current:** Offers CSI/Phase/Payment Schedule grouping
**User feedback:** "Doesn't make sense because where is it pulling the scheduling from?"

**Issue:** No project scheduling data exists yet, so payment_schedule grouping is meaningless

**Proposed Approach:**
- Research traditional SOV creation process
- Stick to actual industry workflow (likely just CSI grouping)
- Remove confusing options that don't have data backing

---

## Implementation Considerations

### Phase Breakdown
This redesign could be split into:

**Phase A: Single-Page Consolidation**
- Merge 6 steps into single scrollable page
- Maintain existing functionality, just different layout
- Keep template selection inline

**Phase B: Enhanced Markup Controls**
- Add section-level markup overrides
- Sticky totals footer
- Whole-estimate override controls

**Phase C: SOV Simplification**
- Remove meaningless grouping options
- Align with actual AIA Schedule of Values practices
- Add payment period splitting (if needed)

### Technical Challenges

1. **State Management**
   - Current: Each step manages own state
   - Needed: Unified form state for entire estimate

2. **Auto-Save Strategy**
   - Current: Per-step debouncing
   - Needed: Intelligent batching for single-page

3. **Performance**
   - Large estimates (100+ line items) on single page
   - Virtual scrolling for line items table?

4. **Mobile Responsiveness**
   - Single page might be overwhelming on mobile
   - Consider responsive breakpoint: wizard on mobile, single-page on desktop?

### Migration Path

**Option 1: Replace Completely**
- Build new single-page builder
- Sunset old wizard
- Risk: Breaking change for users who learned current flow

**Option 2: Dual Mode**
- Offer both wizard and single-page
- User preference toggle
- More development work, but safer

**Recommendation:** Option 2 - Add single-page mode as alternative, keep wizard for users who prefer it

---

## User Research Needed

Before implementing, validate assumptions:

1. **Is this user's preference common?**
   - Survey other construction professionals
   - Watch real users create estimates
   - Identify pain points

2. **What's the typical estimate size?**
   - 10 line items? 100? 500?
   - Affects single-page feasibility

3. **What's the actual SOV workflow?**
   - Interview AIA billing experts
   - Review real Schedule of Values examples
   - Understand payment application process

---

## Success Metrics

If implemented, measure:
- **Time to create estimate** (target: 50% reduction)
- **Number of clicks** (target: 75% reduction)
- **User satisfaction** (target: 8+/10)
- **Estimate completion rate** (target: higher than wizard)
- **Error rate** (ensure simplification doesn't increase mistakes)

---

## Related Issues

- [Phase 17 UAT Test 15] - User feedback on workflow
- [Phase 17 Gap] - SOV line item splitting
- [Phase 17 Gap] - SOV locking after finalization

---

## Next Steps

1. **Research Phase** - Investigate AIA billing best practices
2. **Design Phase** - Create mockups/wireframes for single-page flow
3. **Prototype** - Build proof-of-concept with real data
4. **User Testing** - Validate with construction professionals
5. **Implementation** - Build as new optional mode
6. **Rollout** - Beta test → General availability

---

## Decision

**Defer to future phase** - Phase 17 core functionality is complete and working. This UX redesign is substantial enough to warrant its own dedicated phase with proper research and design work.

**Estimated Effort:** 2-3 weeks (research + design + implementation)
**Suggested Timing:** After Phase 18+ core features are complete
