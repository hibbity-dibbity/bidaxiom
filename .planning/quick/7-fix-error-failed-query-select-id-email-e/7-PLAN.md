---
phase: quick-7
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/server.ts
autonomous: true
must_haves:
  truths:
    - "Sign-in form submits credentials and receives a valid response (token or error) without crashing"
    - "Auth tables (users, organizations, etc.) exist in the public schema before any auth query runs"
  artifacts:
    - path: "apps/api/src/server.ts"
      provides: "Auto-provisioning of auth tables on server startup"
      contains: "provisionAuthTables"
  key_links:
    - from: "apps/api/src/server.ts"
      to: "apps/api/src/tenant/provision.ts"
      via: "provisionAuthTables import and call"
      pattern: "provisionAuthTables"
---

<objective>
Fix "Failed query: select ... from users" error at sign-in by ensuring auth tables exist in the database.

Purpose: The Phase 12 custom auth migration created a `provisionAuthTables()` function that creates users, organizations, refresh_tokens, and other auth tables in the public schema. However, this function is only callable via a standalone script (`provision-auth.ts`) that must be run manually. If the tables don't exist, every auth query (login, register, etc.) fails with a raw SQL error. The server should auto-provision auth tables on startup, matching the existing pattern used for S3 bucket initialization.

Output: Server auto-provisions auth tables on startup; sign-in works without manual migration steps.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/api/src/server.ts
@apps/api/src/tenant/provision.ts (provisionAuthTables function - lines 16-176)
@apps/api/src/trpc/routers/auth.ts (auth router that queries users table)
@apps/api/src/db/client.ts (getPool/getDb)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auto-provision auth tables on server startup</name>
  <files>apps/api/src/server.ts</files>
  <action>
Add auth table provisioning to server startup, immediately after the S3 bucket initialization block (around line 70) and before the QBO sync worker start.

1. Import `provisionAuthTables` from `./tenant/provision.js` at the top of the file with the other imports.
2. Import `getPool` from `./db/client.js` (note: `pool` is already imported but it's the deprecated proxy; `getPool()` is preferred for new code per the codebase conventions, BUT since `pool` proxy already works via `Reflect.get`, just use the existing `pool` import to keep it simple).
3. Add a try/catch block after the S3 bucket initialization that calls `provisionAuthTables(pool)`. Pattern it after the existing S3 bucket try/catch:

```typescript
// Ensure auth tables exist in public schema (idempotent - uses CREATE IF NOT EXISTS)
try {
  await provisionAuthTables(pool);
} catch (err) {
  console.error("Auth table provisioning failed:", err);
  // This is fatal - auth won't work without these tables
  process.exit(1);
}
```

Note: Unlike the S3 bucket initialization (which just warns on failure), auth table provisioning should be FATAL on failure because the entire auth system depends on these tables. Without them, login/register/refresh all fail. Use `process.exit(1)` not just a warning.

Also remove the debug console.log statements from the auth router register mutation (lines 82-93 of auth.ts have verbose debugging logs like "Querying users table for email:" and "Database query error - full details:"). These were left over from debugging and should be cleaned up. Keep the `throw error` in the catch block but remove the console.error spam. The try/catch itself can be simplified -- the query doesn't need a try/catch wrapper at all since tRPC handles errors globally. Simplify the register mutation's email check back to just:

```typescript
const existing = await getAuthDb().query.users.findFirst({
  where: eq(users.email, input.email.toLowerCase()),
});
```

(Remove the try/catch wrapper and all the console.log/console.error debug statements around it.)
  </action>
  <verify>
1. Run `cd apps/api && npx tsx src/server.ts` and confirm "Auth tables provisioned successfully" appears in startup logs (from provision.ts line 172).
2. Attempt sign-in via the web app at http://localhost:3000/sign-in - should get a proper auth error (e.g., "Invalid email or password") instead of a raw SQL query failure.
  </verify>
  <done>
Server starts successfully with auth tables provisioned. Sign-in attempts produce proper auth responses (success with tokens for valid credentials, or "Invalid email or password" for invalid credentials) instead of "Failed query: select ... from users" errors.
  </done>
</task>

</tasks>

<verification>
- Server startup logs show "Auth tables provisioned successfully" (or "already exist" messages from CREATE IF NOT EXISTS)
- `curl -X POST http://localhost:3001/trpc/auth.login -H "Content-Type: application/json" -d '{"json":{"email":"test@test.com","password":"Test1234"}}'` returns a proper UNAUTHORIZED error, not a database query failure
- No debug console.log statements in auth router register mutation
</verification>

<success_criteria>
- Auth tables are auto-provisioned on every server start (idempotent via IF NOT EXISTS)
- Sign-in form no longer crashes with raw SQL error
- Debug logging removed from auth router
</success_criteria>

<output>
After completion, create `.planning/quick/7-fix-error-failed-query-select-id-email-e/7-SUMMARY.md`
</output>
