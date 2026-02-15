---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/api/auth/switch-org/route.ts
  - apps/web/lib/auth.ts
  - apps/web/app/(dashboard)/onboarding/page.tsx
  - apps/web/app/layout.tsx
  - apps/web/app/(dashboard)/page.tsx
autonomous: true
must_haves:
  truths:
    - "Every step in the org-loading flow produces a console.log visible in browser or server console"
    - "Developer can trace exactly where orgId flow breaks by reading log output"
  artifacts:
    - path: "apps/web/app/api/auth/switch-org/route.ts"
      provides: "Server-side logging for switch-org API route"
      contains: "console.log"
    - path: "apps/web/lib/auth.ts"
      provides: "Server-side logging for setActiveOrg and getSessionData"
      contains: "console.log"
    - path: "apps/web/app/(dashboard)/onboarding/page.tsx"
      provides: "Client-side logging for org creation and switch-org call"
      contains: "console.log"
    - path: "apps/web/app/layout.tsx"
      provides: "Server-side logging for initial session loading"
      contains: "console.log"
    - path: "apps/web/app/(dashboard)/page.tsx"
      provides: "Client-side logging for dashboard safety net"
      contains: "console.log"
  key_links:
    - from: "apps/web/app/(dashboard)/onboarding/page.tsx"
      to: "apps/web/app/api/auth/switch-org/route.ts"
      via: "fetch POST /api/auth/switch-org"
      pattern: "fetch.*switch-org"
    - from: "apps/web/app/api/auth/switch-org/route.ts"
      to: "apps/web/lib/auth.ts"
      via: "setActiveOrg() call"
      pattern: "setActiveOrg"
    - from: "apps/web/app/layout.tsx"
      to: "apps/web/lib/auth.ts"
      via: "getSessionData() call"
      pattern: "getSessionData"
---

<objective>
Add comprehensive debug logging to the entire organization loading flow to diagnose why orgId is not being set in session after onboarding.

Purpose: Trace exactly where the flow breaks — from org creation through switch-org API call, session update, redirect, and dashboard rendering — so the root cause of the null orgId can be identified from console output.

Output: All 5 files instrumented with [DEBUG ORG-FLOW] prefixed console.log statements at every critical step.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/web/app/api/auth/switch-org/route.ts
@apps/web/lib/auth.ts
@apps/web/app/(dashboard)/onboarding/page.tsx
@apps/web/app/layout.tsx
@apps/web/app/(dashboard)/page.tsx
@apps/web/lib/auth-context.tsx
@apps/web/lib/session.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add debug logging to all 5 files in the org-loading flow</name>
  <files>
    apps/web/app/api/auth/switch-org/route.ts
    apps/web/lib/auth.ts
    apps/web/app/(dashboard)/onboarding/page.tsx
    apps/web/app/layout.tsx
    apps/web/app/(dashboard)/page.tsx
  </files>
  <action>
Add `console.log` statements prefixed with `[DEBUG ORG-FLOW]` and a step number to every critical point. All logs should use this exact prefix so they can be easily grep'd and later removed.

**File 1: `apps/web/app/api/auth/switch-org/route.ts`** (server-side, visible in terminal)

Add logging at these points:
- Line ~5 (after parsing request body): `console.log("[DEBUG ORG-FLOW] 3a. switch-org route called with organizationId:", organizationId);`
- Line ~9 (after getting access token): `console.log("[DEBUG ORG-FLOW] 3b. Got access token for backend call:", token ? "yes (length: " + token.length + ")" : "NO TOKEN");`
- Line ~18 (after fetch response): `console.log("[DEBUG ORG-FLOW] 3c. Backend response status:", response.status, "ok:", response.ok);`
- Line ~24 (after parsing response data): `console.log("[DEBUG ORG-FLOW] 3d. Parsed tRPC response - result:", JSON.stringify(result));`
- Line ~27 (before calling setActiveOrg, inside the `if (result)` block): `console.log("[DEBUG ORG-FLOW] 3e. Calling setActiveOrg with org:", JSON.stringify(result.org), "accessToken length:", result.accessToken?.length);`
- Line ~28 (after setActiveOrg returns): `console.log("[DEBUG ORG-FLOW] 3f. setActiveOrg completed successfully");`
- Line ~32 (in the else/error branch at bottom): `console.log("[DEBUG ORG-FLOW] 3g. ERROR: result was falsy, raw data:", JSON.stringify(data));`

**File 2: `apps/web/lib/auth.ts`** (server-side, visible in terminal)

In `setActiveOrg` function (line ~113):
- Before setting session fields: `console.log("[DEBUG ORG-FLOW] 4a. setActiveOrg called - org:", JSON.stringify(org), "accessToken length:", accessToken?.length);`
- After setting the 4 fields but before `session.save()`: `console.log("[DEBUG ORG-FLOW] 4b. Session fields set - orgId:", session.orgId, "orgRole:", session.orgRole, "orgName:", session.orgName);`
- After `session.save()`: `console.log("[DEBUG ORG-FLOW] 4c. session.save() completed");`

In `getSessionData` function (line ~125):
- Before the return: `console.log("[DEBUG ORG-FLOW] 6. getSessionData returning - userId:", session.userId, "orgId:", session.orgId, "orgName:", session.orgName);`

**File 3: `apps/web/app/(dashboard)/onboarding/page.tsx`** (client-side, visible in browser console)

In the `createOrgMutation` `onSuccess` callback (line ~33):
- At the very top of `onSuccess`: `console.log("[DEBUG ORG-FLOW] 1. Org created successfully, data:", JSON.stringify(data));`
- Before calling fetch switch-org (line ~38): `console.log("[DEBUG ORG-FLOW] 2. Calling /api/auth/switch-org with organizationId:", data.id);`
- After getting response (line ~44): `console.log("[DEBUG ORG-FLOW] 5a. switch-org response status:", response.status, "ok:", response.ok);`
- If response.ok, before redirect: `console.log("[DEBUG ORG-FLOW] 5b. switch-org succeeded, response body:", await response.clone().json(), "- redirecting to /");`
- If !response.ok: `console.log("[DEBUG ORG-FLOW] 5c. ERROR: switch-org failed, status:", response.status, "body:", await response.clone().text());`
- In catch block: `console.log("[DEBUG ORG-FLOW] 5d. ERROR: switch-org fetch threw:", error);`

**File 4: `apps/web/app/layout.tsx`** (server-side, visible in terminal)

After `getSessionData()` call (line ~20):
- `console.log("[DEBUG ORG-FLOW] 7. RootLayout getSessionData - userId:", initialSession.userId, "orgId:", initialSession.orgId, "orgName:", initialSession.orgName);`

**File 5: `apps/web/app/(dashboard)/page.tsx`** (client-side, visible in browser console)

At the top of the DashboardPage component (line ~25, after the hooks):
- `console.log("[DEBUG ORG-FLOW] 8. Dashboard render - orgId:", orgId, "orgName:", orgName);`

In the safety net useEffect (line ~41, inside the if block before switchOrg call):
- `console.log("[DEBUG ORG-FLOW] 9a. Safety net triggered - orgId is null, organizations:", organizations?.length, "switching to:", organizations?.[0]?.id);`

After the switchOrg call in the safety net:
- `console.log("[DEBUG ORG-FLOW] 9b. Safety net switchOrg called");`

Also add logging to `apps/web/lib/auth-context.tsx` `switchOrg` callback (line ~40):
- At the top: `console.log("[DEBUG ORG-FLOW] SWITCH-ORG (context) called for orgId:", orgId);`
- After response.ok check (line ~50): `console.log("[DEBUG ORG-FLOW] SWITCH-ORG (context) response ok, data:", data);`
- In catch: `console.log("[DEBUG ORG-FLOW] SWITCH-ORG (context) ERROR:", err);`

NOTE: This adds auth-context.tsx as a 6th file. Update files_modified if needed — it is part of the flow.

The numbered sequence represents the expected order of execution:
1. Org created (onboarding client)
2. Calling switch-org (onboarding client)
3a-3g. switch-org route processing (server)
4a-4c. setActiveOrg session update (server)
5a-5d. switch-org response received (onboarding client)
6. getSessionData called (server, on page reload)
7. RootLayout reads session (server)
8. Dashboard renders (client)
9a-9b. Safety net if needed (client)
  </action>
  <verify>
Run `npx tsc --noEmit` from `apps/web/` to confirm no TypeScript errors. Then search all modified files for "[DEBUG ORG-FLOW]" to confirm logging is present — should find entries in all 6 files.
  </verify>
  <done>
All 6 files in the org-loading flow contain [DEBUG ORG-FLOW] prefixed console.log statements. The numbered sequence covers: org creation response, switch-org request, switch-org backend processing, session update, switch-org response, session read on reload, root layout session, dashboard render, and safety net activation. A developer can read the browser console + server terminal output to trace exactly where orgId gets lost.
  </done>
</task>

</tasks>

<verification>
1. Search all modified files for `[DEBUG ORG-FLOW]` — should find logs in all 6 files
2. TypeScript compilation passes without errors
3. The numbered log sequence covers every handoff in the flow
</verification>

<success_criteria>
- All 6 files instrumented with [DEBUG ORG-FLOW] logging
- No TypeScript errors introduced
- Every critical handoff point in the org-loading flow has a log statement
- Logs include the actual values (orgId, response status, session fields) needed for diagnosis
</success_criteria>

<output>
After completion, create `.planning/quick/12-add-debug-logging-to-organization-loadin/12-SUMMARY.md`
</output>
