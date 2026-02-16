# Quick Task 15: Fix Next.js Dev Server EINVAL Readlink Error Summary

**Status:** Complete
**Completed:** 2026-02-16
**Duration:** 4 minutes

## One-liner

Cleared corrupted Next.js build directory and removed legacy ID-based routes that were blocking dev server startup after Phase 19-06 slug migration.

## What Was Done

### Task 1: Clear Next.js build directory and resolve routing conflicts

**Objective:** Fix Next.js dev server startup failure caused by corrupted symlink or file in .next directory.

**Actions taken:**
1. Verified no dev server running on port 3000
2. Removed corrupted .next directory completely: `rm -rf apps/web/.next`
3. Started dev server and discovered underlying routing conflicts (previously masked by EINVAL error)
4. Removed legacy ID-based dynamic routes conflicting with new slug-based routes:
   - `apps/web/app/(dashboard)/customers/[customerId]/page.tsx`
   - `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx`
   - `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/workflow/page.tsx`
   - `apps/web/app/(dashboard)/subcontractors/[subId]/page.tsx`
5. Verified dev server starts cleanly without EINVAL or routing errors

**Verification:**
- Dev server started successfully with "✓ Ready in 2.2s" message
- No EINVAL readlink errors in console output
- No Next.js routing conflicts (different slug names for same dynamic path)
- Application ready at http://localhost:3000

**Commit:** 75e55cf

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Removed legacy ID-based routes conflicting with slug-based routes**
- **Found during:** Task 1 - After clearing .next directory
- **Issue:** Phase 19-06 slug migration left both legacy ID-based routes ([customerId], [estimateId], [subId]) and new slug-based routes ([customerSlug], [estimateSlug], [subcontractorSlug]) in the codebase, causing Next.js routing conflicts
- **Root cause:** The EINVAL readlink error was masking these routing conflicts. Once .next was cleared, Next.js detected the conflicting dynamic routes during startup
- **Fix:** Removed all legacy ID-based dynamic route files to complete the Phase 19-06 migration
- **Files removed:**
  - `apps/web/app/(dashboard)/customers/[customerId]/page.tsx`
  - `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx`
  - `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/workflow/page.tsx`
  - `apps/web/app/(dashboard)/subcontractors/[subId]/page.tsx`
- **Commit:** 75e55cf

## Key Files

**Removed:**
- `apps/web/app/(dashboard)/customers/[customerId]/page.tsx` - Legacy customer detail route
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx` - Legacy estimate detail route
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/workflow/page.tsx` - Legacy estimate workflow route
- `apps/web/app/(dashboard)/subcontractors/[subId]/page.tsx` - Legacy subcontractor detail route

**Affected (regenerated):**
- `apps/web/.next/` - Build directory cleared and regenerated cleanly

## Decisions Made

None - straightforward fix following deviation Rule 3 (auto-fix blocking issues).

## Testing Notes

**Manual verification:**
1. Ran `npm run dev` from `apps/web` directory
2. Confirmed dev server starts without EINVAL readlink errors
3. Confirmed no Next.js routing conflicts in startup logs
4. Verified "✓ Ready in 2.2s" success message

## Technical Details

**Root cause:** Windows file system corruption in `.next/server/interception-route-rewrite-manifest.js` created invalid symlink that caused `EINVAL: invalid argument, readlink` error.

**Solution:** Complete removal of .next directory forces Next.js to regenerate all build artifacts from scratch. This is the standard fix for Windows symlink corruption in Next.js projects.

**Secondary issue:** Clearing .next revealed routing conflicts from incomplete Phase 19-06 slug migration. Next.js doesn't allow different slug names ([customerId] vs [customerSlug]) for the same dynamic path.

## Impact

**Positive:**
- Dev server can now start successfully
- Phase 19-06 slug migration fully completed (legacy routes removed)
- Clean build artifacts without corruption

**Dependencies:**
- Completes Phase 19-06 frontend slug migration cleanup
- Enables normal development workflow resumption

## Next Steps

None - task complete. Dev server is operational.

## Commit

- **75e55cf**: fix(quick-15): remove legacy ID-based routes blocking dev server startup

## Self-Check: PASSED

**Created files:** None (removal task only)

**Commits exist:**
```bash
$ git log --oneline --all | grep "75e55cf"
75e55cf fix(quick-15): remove legacy ID-based routes blocking dev server startup
```

All claimed work verified.
