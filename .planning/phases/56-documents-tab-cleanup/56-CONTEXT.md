# Phase 56: Documents Tab Cleanup - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Overhaul the Documents tab table: add inline row editing for document Name and Category, restructure columns (Name without extension, new auto-derived Type column for file format, rename existing Type → Category, remove Status column and filter), and replace individual action buttons with a 3-dot overflow menu per row.

</domain>

<decisions>
## Implementation Decisions

### Edit interaction
- Inline editing (not a dialog): clicking "Edit" in the 3-dot menu switches the row to editable state
- Only one row can be in edit mode at a time — opening a new edit closes any open one first
- Save/Cancel buttons appear in the row while editing; Enter also saves, Escape also cancels
- Only Name and Category fields become editable — Type (file format) stays read-only

### Column structure
- **Name**: display name without file extension (e.g., "Project Proposal" not "Project Proposal.pdf")
- **Type** (new column): auto-derived read-only file format badge — PDF, XLSX, DOCX, etc., from the stored file extension
- **Category** (renamed from current "Type"): the document category — RFI, Submittal, Transmittal, Proposal, Change Order, Payment App, RFQ, File — column header renamed to "Category"
- **Status**: removed from the table entirely; status filter control removed from the filter bar

### Document type / Category editing
- Category field in edit mode is a fixed dropdown with the existing document category values
- The new Type column (file format) is read-only and not part of the edit form

### Name field behavior
- Saving a renamed document updates the stored filename (not just a display label)
- Duplicate name validation: if another document in the project already has the same name, block save and show an inline error
- Name is stored/displayed without extension; extension is preserved in storage

### Row actions layout
- Each row gets a 3-dot overflow menu (⋮) replacing individual action buttons
- Menu contains: **Edit**, **View/Preview**, **Download**, **Delete** (in that order)
- View/Preview opens the document in a new browser tab (direct file URL)
- Note: standardizing row action patterns across all tables is deferred to a future milestone

### Claude's Discretion
- Exact placement and styling of Save/Cancel buttons in the inline edit row
- How to surface the duplicate name error (inline under the field vs toast)
- Loading/saving state indicators during the save API call
- How existing `name` column in the DB maps to the new "without extension" display — whether to strip extension on read or store separately

</decisions>

<specifics>
## Specific Ideas

- The user explicitly wants a consistent 3-dot menu standard across all tables — this phase establishes the pattern for Documents; the broader standardization is a future milestone discussion
- "Type" in the new sense (PDF, XLSX) is purely a read-only display derived from the file extension — no editing, no dropdown
- The file extension is stripped from the Name display but must be preserved in storage so the file remains downloadable/viewable

</specifics>

<deferred>
## Deferred Ideas

- **Standardize row action patterns across all tables** — the 3-dot menu introduced here should be the app-wide standard; full rollout is a future milestone discussion

</deferred>

---

*Phase: 56-documents-tab-cleanup*
*Context gathered: 2026-02-25*
