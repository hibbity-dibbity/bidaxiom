---
phase: quick-19
plan: 19
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/public/bidaxiom-logo.png
  - apps/web/public/bidaxiom-icon.png
autonomous: false
requirements: []

must_haves:
  truths:
    - "User provides new logo files"
    - "New logos replace existing files at same paths"
    - "Application displays updated logos immediately"
  artifacts:
    - path: "apps/web/public/bidaxiom-logo.png"
      provides: "Full BidAxiom logo for expanded sidebar and login"
      min_lines: 0
    - path: "apps/web/public/bidaxiom-icon.png"
      provides: "Icon-only logo for collapsed sidebar"
      min_lines: 0
  key_links: []
---

<objective>
Replace the BidAxiom logo files that were previously set up in quick tasks 17-18.

Purpose: Update branding with new logo assets provided by user.
Output: Updated logo files at existing paths, immediately visible in application.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Logo Locations

The application currently uses two logo files:
- **apps/web/public/bidaxiom-logo.png** - Full logo (used in expanded sidebar, login page)
- **apps/web/public/bidaxiom-icon.png** - Icon only (used in collapsed sidebar)

These files were set up in quick task 17 and optimized in quick task 18.
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Checkpoint: Receive new logo files from user</name>
  <files>none</files>
  <action>
    User must provide two new logo files:

    1. **Full logo** (bidaxiom-logo.png)
       - For expanded sidebar header and login page
       - Recommended: Wide aspect ratio (e.g., 200x60px or similar)

    2. **Icon logo** (bidaxiom-icon.png)
       - For collapsed sidebar
       - Recommended: Square aspect ratio (e.g., 40x40px or similar)

    Please provide the new logo files, and I'll replace the existing ones at:
    - apps/web/public/bidaxiom-logo.png
    - apps/web/public/bidaxiom-icon.png
  </action>
  <verify>echo "Waiting for user to provide logo files"</verify>
  <done>User has provided new logo files or file paths</done>
</task>

<task type="auto">
  <name>Task 1: Replace logo files</name>
  <files>
    apps/web/public/bidaxiom-logo.png
    apps/web/public/bidaxiom-icon.png
  </files>
  <action>
    Replace the existing logo files with the new files provided by the user:

    1. Copy new full logo to apps/web/public/bidaxiom-logo.png (overwrite existing)
    2. Copy new icon logo to apps/web/public/bidaxiom-icon.png (overwrite existing)

    The filenames and paths remain identical to maintain compatibility with existing code that references these assets.

    No code changes required - Next.js public folder assets are served statically and will be immediately available after replacement.
  </action>
  <verify>
    1. Verify both files exist: `ls apps/web/public/bidaxiom-*.png`
    2. Check file sizes are reasonable (not 0 bytes): `ls -lh apps/web/public/bidaxiom-*.png`
  </verify>
  <done>
    - Both logo files replaced at existing paths
    - Files are valid PNG images with non-zero size
    - No code changes needed (paths unchanged)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint: Verify logos display correctly</name>
  <files>none</files>
  <action>
    Human verification of replaced logo files displaying correctly throughout the application.

    What was built: Replaced BidAxiom logo files with new assets provided by user.

    Steps to verify:
    1. Start the Next.js dev server if not running: `cd apps/web && npm run dev`
    2. Visit http://localhost:3000
    3. Check the expanded sidebar - should show new full logo
    4. Click the collapse button to minimize sidebar - should show new icon logo
    5. Sign out and check the login page - should show new full logo

    Expected result: All logo displays should show the new branding immediately (browser may need hard refresh: Ctrl+Shift+R or Cmd+Shift+R).
  </action>
  <verify>echo "Visual verification in browser required"</verify>
  <done>User confirms logos display correctly in all UI locations (sidebar expanded, sidebar collapsed, login page)</done>
</task>

</tasks>

<verification>
1. Both logo files exist at expected paths
2. Files are valid PNG images
3. Application displays new logos in all locations (sidebar expanded, sidebar collapsed, login page)
4. No browser errors or 404s for logo assets
</verification>

<success_criteria>
- New bidaxiom-logo.png replaces old file at apps/web/public/bidaxiom-logo.png
- New bidaxiom-icon.png replaces old file at apps/web/public/bidaxiom-icon.png
- Application displays updated logos without code changes
- User confirms logos appear correctly in all UI locations
</success_criteria>

<output>
After completion, create `.planning/quick/19-replace-the-logos-again-same-paths-as-be/19-SUMMARY.md`
</output>
