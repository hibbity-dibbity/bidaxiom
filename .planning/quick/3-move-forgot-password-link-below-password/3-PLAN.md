---
phase: quick
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
autonomous: true
must_haves:
  truths:
    - "Forgot password link appears below the password input field, not beside the label"
  artifacts:
    - path: "apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx"
      provides: "Sign-in page with repositioned forgot password link"
  key_links: []
---

<objective>
Move the "Forgot password?" link from its current position (inline with the Password label) to below the password input field on the sign-in page.

Purpose: Better UX flow - the forgot password action logically follows after seeing the password field, not before interacting with it.
Output: Updated sign-in page with repositioned link.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reposition forgot password link below password input</name>
  <files>apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx</files>
  <action>
In the sign-in form's password field section (lines 213-233), make these changes:

1. Remove the `<div className="flex items-center justify-between">` wrapper around the Label and Link (lines 214-222). Replace it with just the Label directly:
   ```
   <Label htmlFor="password">Password</Label>
   ```

2. After the password validation error message (the `{loginErrors.password && ...}` block on lines 230-232), add the forgot password link:
   ```tsx
   <Link
     href="/reset-password"
     className="text-sm text-muted-foreground hover:text-primary"
   >
     Forgot password?
   </Link>
   ```

The result should be: Label -> Input -> Error (if any) -> Forgot password link, all within the existing `<div className="space-y-2">` wrapper.
  </action>
  <verify>
Run `npx next build` from apps/web to confirm no build errors, OR visually inspect that the password section structure is: Label, then Input, then optional error, then "Forgot password?" link.
  </verify>
  <done>The "Forgot password?" link renders below the password input field instead of inline with the password label.</done>
</task>

</tasks>

<verification>
- Sign-in page renders without errors
- "Forgot password?" link is visually below the password input
- Link still navigates to /reset-password
- No other elements on the page are affected
</verification>

<success_criteria>
The forgot password link appears below the password field on the sign-in page.
</success_criteria>

<output>
After completion, create `.planning/quick/3-move-forgot-password-link-below-password/3-SUMMARY.md`
</output>
