---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/components/project/folder-tree.tsx
autonomous: true
must_haves:
  truths:
    - "The project documents page no longer shows a 'New Folder' button"
    - "The project documents page still displays folders and 'All Documents' correctly"
  artifacts:
    - path: "apps/web/components/project/folder-tree.tsx"
      provides: "Folder tree sidebar without folder creation UI"
  key_links: []
---

<objective>
Remove the "New Folder" button and creation dialog from the project documents page folder tree sidebar.

Purpose: User does not want folder creation available from the documents page UI.
Output: Cleaned-up FolderTree component with no folder creation capability.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/web/components/project/folder-tree.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove New Folder button, dialog, and related logic from FolderTree</name>
  <files>apps/web/components/project/folder-tree.tsx</files>
  <action>
In `apps/web/components/project/folder-tree.tsx`:

1. Remove unused imports that are only needed by the folder creation feature:
   - Remove `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger` from the dialog import (line 6)
   - Remove `Input` import (line 7)
   - Remove `Label` import (line 8)
   - Remove `FolderPlus` from the lucide-react import (line 9, keep `Folder`)
   - Remove `Button` import (line 5) — verify it is not used elsewhere in the component first; it is only used by the dialog buttons, so remove it

2. Remove state variables (lines 20-21):
   - `const [createDialogOpen, setCreateDialogOpen] = useState(false);`
   - `const [newFolderName, setNewFolderName] = useState("");`
   - If `useState` is no longer used after removal, remove it from the React import as well

3. Remove the `createFolderMutation` hook (lines 29-39) and `handleCreateFolder` function (lines 41-51).

4. Remove the tRPC `useUtils()` call (line 23) since it is only used by the mutation's onSuccess invalidation. Verify it is not used elsewhere first.

5. Remove the entire "Create Folder Dialog" JSX block (lines 98-138): from `{/* Create Folder Dialog */}` through the closing `</Dialog>` tag.

6. Keep everything else intact: the loading skeleton, "All Documents" button, folder list rendering, and "No folders yet" message.

7. Verify the component still compiles: `npx tsc --noEmit -p apps/web/tsconfig.json` or simply build check.
  </action>
  <verify>
Run `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20` from the repo root to confirm no TypeScript errors.
Grep the file for "New Folder", "FolderPlus", "createFolder", "createDialogOpen" — all should return zero matches.
  </verify>
  <done>
The FolderTree component renders the folder sidebar without any "New Folder" button or creation dialog. No unused imports remain. TypeScript compiles cleanly.
  </done>
</task>

</tasks>

<verification>
- `grep -c "New Folder" apps/web/components/project/folder-tree.tsx` returns 0
- `grep -c "createFolder" apps/web/components/project/folder-tree.tsx` returns 0
- TypeScript compilation succeeds with no errors in the file
</verification>

<success_criteria>
- The "New Folder" button and dialog are completely removed from the folder tree
- No dead code or unused imports remain
- The component compiles without errors
- Existing folder browsing functionality is preserved
</success_criteria>

<output>
After completion, create `.planning/quick/2-remove-new-folder-option-from-project-do/2-SUMMARY.md`
</output>
