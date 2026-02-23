---
type: quick
num: 29
description: "Stepper checkmark color to text-primary bold + document as site-wide stepper"
files_modified:
  - apps/web/components/estimates/workflow/EstimateStepperBar.tsx
autonomous: true
---

<objective>
Change the done-step checkmark in EstimateStepperBar from text-primary-foreground (white on teal) to text-primary (teal, the brand color) with increased strokeWidth for a bold appearance. Since text-primary on a bg-primary circle would be invisible, change the done circle from filled (bg-primary) to outlined (bg-transparent border-primary) so the teal checkmark shows clearly. Document EstimateStepperBar as the canonical site-wide progress stepper in COMPONENT-ORGANIZATION.md.
</objective>

<task>
  <name>Task 1: Update checkmark visual style in EstimateStepperBar</name>
  <files>apps/web/components/estimates/workflow/EstimateStepperBar.tsx</files>
  <action>
In the done step circle button:
1. Change circle classes: from `bg-primary border-primary` → `bg-transparent border-primary` for done state (keep `bg-primary border-primary` for active state)
2. Change Check icon: from `text-primary-foreground` → `text-primary` and add `strokeWidth={2.5}` for bold weight

Current done/active class logic:
```tsx
(isDone || isActive)
  ? "bg-primary border-primary"
  : "bg-transparent border-muted-foreground/40"
```

New logic:
```tsx
isActive
  ? "bg-primary border-primary"
  : isDone
  ? "bg-transparent border-primary"
  : "bg-transparent border-muted-foreground/40"
```

Current Check:
```tsx
<Check className="h-4 w-4 text-primary-foreground" />
```

New Check:
```tsx
<Check className="h-4 w-4 text-primary" strokeWidth={2.5} />
```
  </action>
</task>

<task>
  <name>Task 2: Document as site-wide stepper in COMPONENT-ORGANIZATION.md</name>
  <files>apps/web/COMPONENT-ORGANIZATION.md</files>
  <action>
Read COMPONENT-ORGANIZATION.md. Find the section on shared/canonical components and add a note documenting EstimateStepperBar as the canonical site-wide progress stepper pattern to use for any future multi-step workflow page. If a "Progress Stepper" or "Workflow Navigation" section doesn't exist, add one under the appropriate heading.

Add content like:
```
### Progress Stepper (Multi-Step Workflow)
Component: `components/estimates/workflow/EstimateStepperBar.tsx`
Use for: Any page that requires a structured multi-step workflow with visible step progress.
Visual design:
- Done: outlined teal circle (border-primary, bg-transparent) + teal bold checkmark (text-primary, strokeWidth=2.5)
- Active: filled teal circle (bg-primary) + white step number (text-primary-foreground)
- Future: gray outlined circle (border-muted-foreground/40) + muted number (text-muted-foreground)
- Connecting lines: bg-primary for completed segments, bg-border for incomplete
- Label: only active step shows label (text-xs font-semibold uppercase tracking-wider text-muted-foreground)
State: Zustand (useWorkflowState) — adapt for other workflows by creating a parallel store
```
  </action>
</task>
