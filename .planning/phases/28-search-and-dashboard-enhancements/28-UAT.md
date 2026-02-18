# Phase 28 UAT

**Status**: approved
**Date**: 2026-02-17
**Tester**: Human

## SRCH-01: Estimate search results

- [x] 1. Open browser at http://localhost:3000, sign in
- [x] 2. Press Cmd+K (or Ctrl+K) to open global search
- [x] 3. Type the name of a known estimate (e.g., part of an estimate name in your system)
- [x] 4. Confirm an "Estimates" group appears alongside "Projects" and "Customers"
- [x] 5. Confirm estimate result shows estimate name + parent project name as subtitle

**Result**: PASS

## SRCH-02: Type labels via CommandGroup headings

- [x] 6. With search open (same search as above)
- [x] 7. Confirm "Projects" heading appears above project results
- [x] 8. Confirm "Customers" heading appears above customer results
- [x] 9. Confirm "Estimates" heading appears above estimate results

**Result**: PASS

## Customer URL bug fix (SRCH-01 bonus)

- [x] 10. Type a customer name in the search palette
- [x] 11. Click a customer result
- [x] 12. Confirm URL is /customers/{slug} — NOT a UUID and NOT a 404

**Result**: PASS

## DASH-01: Dashboard widget navigation

- [x] 13. Navigate to http://localhost:3000 (dashboard)
- [x] 14. Click "Total Active Projects" — confirm URL becomes /projects?status=active
- [x] 15. Go back. Click "Revenue In Progress" — confirm /projects?status=active
- [x] 16. Go back. Click "Backlog" — confirm /projects?status=active
- [x] 17. Go back. Click "Company Open Bids" — confirm /projects
- [x] 18. Go back. Click "Pending Pay Apps" — confirm /projects
- [x] 19. Go back. Click "Bid Opportunities" — confirm /projects
- [x] 20. Go back. Click "My Active Projects" — confirm /projects?status=active&assignedUser={uuid}
- [x] 21. Go back. Click "My Open Bids" — confirm /projects

**Result**: PASS

## Summary

| Requirement | Status |
|-------------|--------|
| SRCH-01 | PASS |
| SRCH-02 | PASS |
| Customer URL bug | PASS |
| DASH-01 | PASS |

**Overall**: All requirements verified. Phase 28 approved.
