---
type: quick
num: 30
description: "fix clickable phase badge on project pages — unreliable click handling"
files_modified:
  - apps/web/components/shared/status-badge.tsx
autonomous: true
---

<objective>
StatusBadge is used as the PopoverTrigger asChild target in lifecycle-phase-badge.tsx.
Radix's Slot (asChild) merges a ref onto the child for floating-ui anchor positioning.
StatusBadge was a plain function component with no forwardRef — the ref was silently dropped,
leaving floating-ui unable to compute popover position → popover opens off-screen → appears to "do nothing."
Fix: add React.forwardRef to StatusBadge so the ref reaches the span DOM node.
</objective>

<task>
  <name>Add React.forwardRef to StatusBadge</name>
  <files>apps/web/components/shared/status-badge.tsx</files>
  <action>
Wrap the StatusBadge component with React.forwardRef, forwarding the ref to the inner span.
Add React import. Set displayName. All call sites unchanged.
  </action>
</task>
