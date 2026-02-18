# Quick Task 27 Summary: Grouped Company Section in User Dropdown

**Status:** Complete
**Date:** 2026-02-18

## What Was Done

Reorganised the user dropdown menu to group all company-related items under a single "Company" section heading with one divider, instead of multiple separators fragmenting the list.

**Before:**
```
Name / Email
---
Account Settings
---
Thomson Enterprises ✓
Company 2
---
Create new company
---
Sign Out
```

**After:**
```
Name / Email
---
Account Settings
---
Company (heading)
Thomson Enterprises ✓
Company 2
Create new company
---
Sign Out
```

## Changes

| File | Change |
|------|--------|
| `apps/web/components/layout/user-menu.tsx` | Added `DropdownMenuLabel` "Company" heading above org list; removed separator between org list and "Create new company"; kept single separator before Sign Out |
