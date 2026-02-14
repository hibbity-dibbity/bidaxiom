---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/(dashboard)/settings/company/page.tsx
  - apps/api/src/trpc/routers/company.ts
autonomous: true
must_haves:
  truths:
    - "Admin can see Job Numbering section on Company Profile settings page"
    - "Admin can enable/disable automatic job numbering via toggle"
    - "Admin can set a job number template with date tokens and sequence patterns"
    - "Admin sees a live preview of what the next job number will look like"
    - "Saving company settings persists job number settings to the database"
    - "Job number settings survive page reload (loaded from getCurrent query)"
  artifacts:
    - path: "apps/web/app/(dashboard)/settings/company/page.tsx"
      provides: "Job numbering configuration UI section"
    - path: "apps/api/src/trpc/routers/company.ts"
      provides: "Persists jobNumberSettings in company update mutation"
  key_links:
    - from: "apps/web/app/(dashboard)/settings/company/page.tsx"
      to: "apps/api/src/trpc/routers/company.ts"
      via: "trpc.company.update mutation includes jobNumberSettings"
      pattern: "jobNumberSettings"
---

<objective>
Restore the custom job numbering configuration UI to the Company Profile settings page
and ensure the API update mutation persists job number settings.

Purpose: The backend schema (company_profiles.job_number_settings), shared types
(JobNumberSettings, jobNumberSettingsSchema), and utility functions (previewJobNumber,
validateJobNumberTemplate) all exist and are complete. The project creation form already
reads and uses these settings. However, the Company Profile settings page has no UI to
configure job numbering, and the company.update mutation does not include jobNumberSettings
in the INSERT values -- meaning any save overwrites job number settings with defaults.

Output: Working job numbering configuration section on company settings page.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key existing files (DO NOT recreate, only modify):
- apps/web/app/(dashboard)/settings/company/page.tsx (company settings page - ADD job numbering section)
- apps/api/src/trpc/routers/company.ts (company router - FIX update mutation)
- packages/shared/src/types/company.ts (JobNumberSettings type, previewJobNumber, validateJobNumberTemplate - ALREADY EXISTS, just import)
- apps/api/src/db/schema/tenant.ts (jobNumberSettings column on companyProfiles - ALREADY EXISTS)
- apps/web/components/ui/switch.tsx (Switch component - ALREADY EXISTS)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix company.update mutation to persist jobNumberSettings</name>
  <files>apps/api/src/trpc/routers/company.ts</files>
  <action>
In the company router's `update` mutation, the INSERT values (line 101-106) only include
`companyType` and `tradesConfig`. Add `jobNumberSettings: input.jobNumberSettings` to the
values object so job number settings are persisted when saving company configuration.

The `companyConfigSchema` (imported from @construction/shared) already includes
`jobNumberSettings` as a required field, so the input is already validated. The Drizzle
schema (`companyProfiles` table) already has a `jobNumberSettings` JSONB column. This is
a one-line fix.

Change the insert values from:
```
values({
  companyType: input.companyType,
  tradesConfig: input.tradesConfig,
  validFrom: new Date(),
  createdBy: userId,
})
```
to:
```
values({
  companyType: input.companyType,
  tradesConfig: input.tradesConfig,
  jobNumberSettings: input.jobNumberSettings,
  validFrom: new Date(),
  createdBy: userId,
})
```
  </action>
  <verify>Read the file and confirm jobNumberSettings is in the insert values.</verify>
  <done>Company update mutation persists jobNumberSettings alongside companyType and tradesConfig.</done>
</task>

<task type="auto">
  <name>Task 2: Add job numbering configuration UI to company settings page</name>
  <files>apps/web/app/(dashboard)/settings/company/page.tsx</files>
  <action>
Add a "Job Numbering" Card section to the company settings page, placed after the
"Custom Specialty Trades" card and before the Submit button.

1. Add imports at the top:
   - `import { Switch } from "@/components/ui/switch";`
   - `import { Input } from "@/components/ui/input";`
   - `import { previewJobNumber, validateJobNumberTemplate } from "@construction/shared";`
   - `import type { JobNumberSettings } from "@construction/shared";`

2. Update form defaultValues to include jobNumberSettings:
   ```
   jobNumberSettings: {
     enabled: false,
     template: "{YYYY}-{NNN}",
     nextSequenceNumber: 1,
     lastGeneratedFormat: null,
   },
   ```

3. Update the useEffect that populates form data (around line 52-59) to include
   jobNumberSettings from the loaded data:
   ```
   form.reset({
     companyType: data.companyType as "gc_only" | "sub_only" | "both",
     tradesConfig: data.tradesConfig,
     jobNumberSettings: data.jobNumberSettings ?? {
       enabled: false,
       template: "{YYYY}-{NNN}",
       nextSequenceNumber: 1,
       lastGeneratedFormat: null,
     },
   });
   ```

4. Add the Job Numbering Card section with these elements:
   - Header: "Job Numbering" with description "Configure automatic job number generation for new projects"
   - A Switch (from ui/switch.tsx) to enable/disable job numbering, controlled by
     `form.watch("jobNumberSettings.enabled")` and using
     `form.setValue("jobNumberSettings.enabled", checked)`. Disable when `!canManage`.
   - When enabled, show:
     a. Template input field bound to `form.watch("jobNumberSettings.template")`.
        Include a help text listing available tokens: {YYYY}, {YY}, {MM}, {DD}, {NNN...}
        Validate on blur that template contains {N+} pattern using validateJobNumberTemplate.
        Show error text if invalid. Disable when `!canManage`.
     b. Next sequence number input (type="number", min=1) bound to
        `form.watch("jobNumberSettings.nextSequenceNumber")`. Disable when `!canManage`.
     c. Live preview showing the result of
        `previewJobNumber(template, nextSequenceNumber)` in a muted background box
        with mono font, similar to how project-form.tsx displays it (line 420-426).
   - When disabled, show a brief note: "Enable to automatically assign job numbers to new projects"

5. Style consistently with existing Card sections on the page. Use the same spacing
   patterns (space-y-4 inside cards, p-6 padding).

Do NOT modify the companyConfigSchema or any shared types -- they already include
jobNumberSettings. The form submission already sends all form values to the update
mutation.
  </action>
  <verify>
Run `cd "C:/Users/erict/OneDrive - Thomson Enterprises/Documents/Claude Projects/Construction-Mgmt-Software/apps/web" && npx next build 2>&1 | head -30` to check for compilation errors. If build is slow, at minimum verify the file has no syntax errors by running `npx tsc --noEmit --pretty 2>&1 | head -50` from the apps/web directory.
  </verify>
  <done>
Company settings page shows a Job Numbering card with enable/disable toggle, template input,
sequence number input, and live preview. Settings are saved via the existing company.update
mutation and persist across page reloads.
  </done>
</task>

</tasks>

<verification>
1. Navigate to Settings > Company Profile
2. See the Job Numbering card section below Custom Specialty Trades
3. Toggle enable -- template and sequence inputs appear with live preview
4. Set template to `{YYYY}-{NNN}` and see preview like `2026-001`
5. Click Save Configuration -- toast confirms save
6. Reload page -- job numbering settings are still configured as saved
7. Navigate to Projects > New Project -- job number section shows with correct template
</verification>

<success_criteria>
- Job numbering configuration card visible on company settings page
- Enable/disable toggle works
- Template input with validation (must contain {N+} pattern)
- Live preview updates as template or sequence number changes
- Settings persist after save and page reload
- Non-admin users see read-only state
- No regression to existing company type and trades configuration
</success_criteria>

<output>
After completion, create `.planning/quick/5-restore-custom-job-numbering-setup-on-co/5-SUMMARY.md`
</output>
