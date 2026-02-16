---
phase: quick-15
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  truths:
    - "Dev server starts without EINVAL readlink error"
    - "Application loads in browser at http://localhost:3000"
  artifacts:
    - path: "apps/web/.next/"
      provides: "Clean Next.js build directory"
      state: "regenerated from scratch"
  key_links:
    - from: "Next.js dev server"
      to: "apps/web/.next/"
      via: "File system readlink"
      pattern: "No EINVAL errors in startup logs"
---

<objective>
Fix Next.js dev server startup failure caused by corrupted symlink or file in .next directory.

Purpose: Restore dev server functionality by clearing corrupted build artifacts.
Output: Clean .next directory allowing successful dev server startup.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

Error indicates corrupted symlink or file preventing readlink operation:
```
Error: EINVAL: invalid argument, readlink 'C:\...\apps\web\.next\server\interception-route-rewrite-manifest.js'
```

Windows file system issue - likely stale symlink or permission problem.
</context>

<tasks>

<task type="auto">
  <name>Clear Next.js build directory</name>
  <files>apps/web/.next/</files>
  <action>
    1. Stop Next.js dev server if running (check for process on port 3000):
       ```bash
       netstat -ano | findstr :3000 | findstr LISTENING
       # If found: powershell "Stop-Process -Id <PID> -Force"
       ```

    2. Remove entire .next directory to clear corrupted build artifacts:
       ```bash
       rm -rf "apps/web/.next"
       ```

    3. Verify directory is removed:
       ```bash
       ls apps/web/.next 2>&1
       # Should return "No such file or directory"
       ```

    4. Start dev server from apps/web directory:
       ```bash
       cd apps/web && npm run dev
       ```

    5. Verify dev server starts without EINVAL error (should see "Ready in X ms" output)

    Why this works: Windows symlink corruption requires full build directory removal. Next.js will regenerate .next/ cleanly on startup.
  </action>
  <verify>
    1. No .next directory exists after removal: `ls apps/web/.next` returns error
    2. Dev server starts successfully without EINVAL readlink error
    3. Dev server outputs "Ready on http://localhost:3000" or similar
  </verify>
  <done>
    Dev server starts cleanly, no EINVAL readlink errors in console output.
  </done>
</task>

</tasks>

<verification>
Navigate to http://localhost:3000 in browser - application should load normally.
</verification>

<success_criteria>
- Next.js dev server starts without EINVAL errors
- Application loads in browser
- No corrupted symlink errors in console
</success_criteria>

<output>
After completion, create `.planning/quick/15-fix-next-js-dev-server-einval-readlink-e/15-SUMMARY.md`
</output>
