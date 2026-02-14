---
phase: quick-8
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
autonomous: true
must_haves:
  truths:
    - "User can click Sign In and see a meaningful error if the API is unreachable"
    - "User can successfully sign in when the API server is running and reachable"
  artifacts:
    - path: "apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx"
      provides: "Sign-in page with improved error handling for network failures"
  key_links:
    - from: "apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx"
      to: "http://localhost:3001/trpc/auth.login"
      via: "trpc.auth.login.useMutation"
      pattern: "loginMutation"
---

<objective>
Fix "Failed to fetch" toaster notification when clicking Sign In.

Purpose: The sign-in page shows an unhelpful "Failed to fetch" error when the tRPC client
cannot reach the API server at http://localhost:3001. This occurs because the tRPC mutation's
onError handler displays `error.message` directly, and when the browser's fetch() fails at
the network level (API not running, CORS blocked, etc.), the error message is the generic
"Failed to fetch" TypeError.

The root cause is almost certainly that the API server (port 3001) is not running. The fix has
two parts: (1) diagnose and resolve why the API server isn't running, and (2) improve error
handling so future network failures show a useful message.

Output: Working sign-in flow with descriptive network error messages.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
@apps/web/app/providers.tsx
@apps/api/src/server.ts
@apps/api/src/trpc/routers/auth.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnose and fix API server connectivity</name>
  <files>apps/api/src/server.ts</files>
  <action>
    1. Check if the API server can start successfully:
       - Run `cd apps/api && npx tsx src/server.ts` and observe output
       - If it crashes, check the error. Most likely causes:
         a. Database not running (Docker PostgreSQL on port 5432) - check with `netstat -ano | findstr :5432`
         b. `provisionAuthTables` failing because it tries to create `organizations` table with FK to `tenants`,
            but `tenants` table might not exist yet (process.exit(1) on failure is fatal)
         c. Redis not running (port 6379) - this should be non-fatal (workers have try/catch)
         d. Missing env vars in .env.local

    2. If the database is running but provisionAuthTables fails:
       - The `organizations` table has `REFERENCES tenants(id)` but `tenants` might not exist
       - Check if the tenants table exists: `SELECT to_regclass('public.tenants')`
       - If not, the auth table provisioning should create tenants first, OR remove the FK constraint
         from the CREATE TABLE IF NOT EXISTS statement for organizations

    3. If the server starts successfully, the issue might be that the user simply hasn't started
       the API server. In that case, the fix is purely in Task 2 (better error messages).

    4. If `provisionAuthTables` is the issue: The organizations CREATE TABLE statement at line 52-63
       of apps/api/src/tenant/provision.ts references `tenants(id)` as a FK. But if this is a
       fresh DB or the tenants table was dropped, the CREATE TABLE IF NOT EXISTS will fail because
       the referenced table doesn't exist. Fix by ensuring the tenants table is created before
       the organizations table in `provisionAuthTables`. Add a CREATE TABLE IF NOT EXISTS for
       tenants at the beginning of the function, BEFORE the organizations table.

    Do NOT modify the provision.ts file unless the server actually fails to start due to the
    tenants FK issue. The goal is diagnosis first, then minimal fix.
  </action>
  <verify>
    Run `cd apps/api && npx tsx src/server.ts` and confirm it outputs "API server running at http://localhost:3001"
    without crashing. If it was already running, verify with `netstat -ano | findstr :3001 | findstr LISTENING`.
  </verify>
  <done>API server starts successfully and listens on port 3001</done>
</task>

<task type="auto">
  <name>Task 2: Improve sign-in error handling for network failures</name>
  <files>apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx</files>
  <action>
    Update the `onError` handlers for both `loginMutation` and `mfaLoginMutation` to detect
    network-level errors and show a more descriptive message.

    In the sign-in page (apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx):

    1. Update the loginMutation onError (line 88-91):
       ```typescript
       onError: (error) => {
         // Detect network errors (API server unreachable)
         const isNetworkError = error.message === "Failed to fetch" ||
           error.message.includes("fetch") ||
           error.cause?.code === "ECONNREFUSED";

         if (isNetworkError) {
           toast.error("Cannot connect to the server. Please ensure the API is running and try again.");
         } else {
           toast.error(error.message || "Login failed");
         }
         setIsLoading(false);
       },
       ```

    2. Apply the same pattern to the mfaLoginMutation onError (line 122-125):
       ```typescript
       onError: (error) => {
         const isNetworkError = error.message === "Failed to fetch" ||
           error.message.includes("fetch") ||
           error.cause?.code === "ECONNREFUSED";

         if (isNetworkError) {
           toast.error("Cannot connect to the server. Please ensure the API is running and try again.");
         } else {
           toast.error(error.message || "Invalid MFA code");
         }
         setIsLoading(false);
       },
       ```

    This ensures users see "Cannot connect to the server" instead of the cryptic "Failed to fetch".
  </action>
  <verify>
    1. With API server stopped: click Sign In and verify toast shows "Cannot connect to the server. Please ensure the API is running and try again."
    2. With API server running: click Sign In with invalid credentials and verify toast shows the actual error message (e.g., "Invalid email or password")
  </verify>
  <done>
    Network errors show descriptive "Cannot connect to the server" message instead of "Failed to fetch".
    Normal auth errors (invalid credentials, unverified email, etc.) still show their specific messages.
  </done>
</task>

</tasks>

<verification>
1. Start the API server: `cd apps/api && npx tsx src/server.ts` - should start without errors
2. Start the web app: `cd apps/web && npm run dev`
3. Navigate to http://localhost:3000/sign-in
4. Enter valid credentials and click Sign In - should either succeed or show meaningful error
5. Stop the API server and try again - should show "Cannot connect to the server" message
</verification>

<success_criteria>
- API server starts and runs on port 3001
- Sign-in form submits successfully when API is running
- Network errors show user-friendly "Cannot connect to the server" message
- Auth-specific errors (bad credentials, unverified email) still show their correct messages
</success_criteria>

<output>
After completion, create `.planning/quick/8-now-i-m-getting-a-toaster-notification-f/8-SUMMARY.md`
</output>
