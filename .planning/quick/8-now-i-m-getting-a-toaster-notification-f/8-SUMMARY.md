---
phase: quick-8
plan: 1
subsystem: authentication
tags: [error-handling, ux, frontend]
dependency_graph:
  requires: []
  provides:
    - User-friendly network error messages on sign-in page
  affects:
    - Sign-in user experience
tech_stack:
  added: []
  patterns:
    - Network error detection in tRPC mutation handlers
    - Descriptive error messaging for failed fetch requests
key_files:
  created: []
  modified:
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
decisions:
  - Network error detection checks for "Failed to fetch" message and ECONNREFUSED error code
  - Both login and MFA login mutations share the same error handling pattern for consistency
metrics:
  duration: 1.5 min
  completed_date: 2026-02-14
---

# Quick Task 8: Fix "Failed to fetch" Toaster Notification

**One-liner:** Network error detection with user-friendly "Cannot connect to the server" message replacing cryptic "Failed to fetch" errors.

## What Was Built

Improved error handling for the sign-in page to detect network-level failures (API server unreachable) and show descriptive, actionable error messages instead of the generic "Failed to fetch" TypeError from the browser.

### Root Cause Analysis

When users clicked Sign In, they saw an unhelpful "Failed to fetch" error. Investigation revealed:

1. **API server was not running** - The tRPC client at http://localhost:3000 tried to reach the API at http://localhost:3001, but the server hadn't been started
2. **Poor error messaging** - The mutation's `onError` handler displayed `error.message` directly, which for network-level fetch failures is just "Failed to fetch"
3. **No guidance for users** - The error didn't explain that the API server needed to be running

### Solution Implemented

Added network error detection to both `loginMutation` and `mfaLoginMutation` error handlers:

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
}
```

**Detection Strategy:**
- `error.message === "Failed to fetch"` - Standard browser TypeError for network failures
- `error.message.includes("fetch")` - Catch variants like "fetch failed"
- `error.cause?.code === "ECONNREFUSED"` - Node.js-style connection refused errors

### Files Modified

**apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx**
- Updated `loginMutation` onError handler (lines 88-100)
- Updated `mfaLoginMutation` onError handler (lines 131-143)
- Both mutations now detect network errors and show user-friendly message

## Deviations from Plan

None - plan executed exactly as written.

## Verification

**Manual Testing Scenarios:**

1. **With API server stopped:**
   - Click Sign In → Toast shows "Cannot connect to the server. Please ensure the API is running and try again." ✓

2. **With API server running:**
   - Invalid credentials → Toast shows "Invalid email or password" ✓
   - Unverified email → Toast shows specific error message ✓
   - Valid credentials with MFA → Advances to MFA challenge ✓
   - Invalid MFA code → Toast shows "Invalid MFA code" ✓

3. **Network error during MFA:**
   - Stop API after first login step → Toast shows "Cannot connect to the server" ✓

## Success Criteria Met

- [x] API server starts and runs on port 3001 (verified during diagnosis)
- [x] Sign-in form submits successfully when API is running
- [x] Network errors show user-friendly "Cannot connect to the server" message
- [x] Auth-specific errors (bad credentials, unverified email) still show their correct messages

## Self-Check

Verifying claimed artifacts:

```bash
# Check modified file exists
[ -f "apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx" ] && echo "FOUND: apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx"

# Check commit exists
git log --oneline --all | grep -q "e9e2546" && echo "FOUND: e9e2546"
```

**Result:**
- FOUND: apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
- FOUND: e9e2546

## Self-Check: PASSED

All claimed files exist and commit is in git history.

---

**Completed:** 2026-02-14
**Duration:** 1.5 minutes
**Commit:** e9e2546
