# Domain Pitfalls: v1.5 Project Lifecycle & Document Engine

**Domain:** Construction Project Management SaaS
**Version:** v1.5
**Researched:** 2026-02-18

---

## Critical Pitfalls (Rewrite-Level Risk)

Mistakes that cause major rework or data loss.

### Pitfall 1: Status-to-Phase Migration Mapping Loses Information

**What goes wrong:**
```
Old projects.status: 'active' | 'on_hold' | 'completed' | 'archived'
New project_lifecycle_state.currentPhase: pre_contract | design | bidding | execution | close_out | maintenance | archived

Mapping logic:
  'active' → 'execution'  ← Which active projects are really in design? Bidding?
  'on_hold' → ? ← Could be any phase paused (design held up by RFI, execution paused for weather)
  'completed' → 'archived' ← But closeout phase might take weeks; project not "archived" yet

Risk: Backfill mismap 30% of projects to wrong phase
Result: Phase-aware validations reject valid actions, admins confused, user frustration
```

**Why it happens:**
- Single status field can't represent which phase a project is in
- "on_hold" loses context (hold from what phase?)
- Legacy data doesn't have enough information to classify accurately

**Prevention:**
1. **Before migration:** Audit existing data
   - Query sample of 'on_hold' projects: examine related records (estimates submitted? bids awarded?)
   - Use heuristics: if estimates.submittedAt exists, probably in design/bidding
   - If bids exist, probably in execution
   - Document assumptions in migration script comments

2. **Data preservation:**
   ```sql
   -- Store original status in metadata before overwriting
   ALTER TABLE project_lifecycle_state ADD COLUMN metadata JSONB DEFAULT '{}';

   -- During backfill:
   UPDATE project_lifecycle_state SET metadata = jsonb_build_object(
     'originalStatus', projects.status,
     'mappingConfidence', 0.8  -- Admin review if <0.9
   )
   ```

3. **Admin review UI:**
   - Show "old status → proposed new phase" for all projects
   - Let admins correct mismatches before final migration
   - Export mismatch list for manual review

4. **Rollback plan:**
   - Keep projects.status column as read-only backup
   - If phase mapping wrong, revert to original status + re-run backfill

**Detection:**
- ⚠️ Post-migration: Query projects in 'on_hold' phase → count business logic errors
- ⚠️ Monitor audit logs for rejected phase transitions (sign of wrong mapping)
- ⚠️ User support tickets about "can't create estimate in this project" (phase lock too strict)

---

### Pitfall 2: PDF Field Mapping References Non-Existent Columns

**What goes wrong:**
```
Admin creates template:
  Field "Contract Sum" ← maps to → project.contractSum

But codebase uses project.budget, not project.contractSum

During PDF generation:
  SELECT contractSum FROM projects  ← NULL or column not found
  PDF renders: "Contract Sum: [BLANK]" or fails entirely

Risk: User receives unprofessional PDF with missing data
Result: Users reject feature ("PDFs don't work"), revert to manual documents
```

**Why it happens:**
- Field mapping syntax flexible (any column name)
- No validation that mapped field actually exists
- Admin uploads template without testing all fields
- Schema changes in future (column renamed) break old templates

**Prevention:**
1. **Template validation at save:**
   ```typescript
   function validateFieldMappings(
     mappings: Record<string, FieldMapping>,
     schema: TenantSchema
   ): ValidationError[] {
     const errors: ValidationError[] = [];

     for (const [field, mapping] of Object.entries(mappings)) {
       // Check source entity exists
       const sourceTable = entityTypeToTable(mapping.sourceEntity, schema);

       // Check field exists (using information_schema)
       const columnExists = await checkColumnExists(
         sourceTable,
         mapping.sourceField
       );

       if (!columnExists) {
         errors.push({
           field,
           error: `Column '${mapping.sourceField}' not found in ${mapping.sourceEntity} table`
         });
       }
     }

     return errors;
   }
   ```

2. **Test render before save:**
   ```typescript
   async function testTemplateRender(
     template: DocumentTemplate,
     sampleData: any
   ): Promise<{ success: boolean; errors: string[] }> {
     try {
       const pdf = await renderPDFWithTemplate(template, sampleData);
       return { success: true, errors: [] };
     } catch (error) {
       return { success: false, errors: [error.message] };
     }
   }
   ```

3. **Template versioning:**
   - Store schema version with template (e.g., "schema_v1.2")
   - On schema change, flag affected templates for review
   - Keep old PDFKit + template versions if rollback needed

4. **Fallback rendering:**
   ```typescript
   // If field missing, use placeholder instead of failing
   const value = mergedData[fieldName] ?? '[FIELD_MISSING]';
   pdf.text(`Field: ${value}`);

   // Log error for admin review
   await logMissingField({
     templateId,
     fieldName,
     documentId,
     timestamp: now(),
   });
   ```

**Detection:**
- ⚠️ Monitor logs for `[FIELD_MISSING]` placeholders in rendered PDFs
- ⚠️ Count PDF generation errors → investigate mapping issues
- ⚠️ User support: "PDF has blank sections"

---

### Pitfall 3: Document Type Backfill Misclassifies Thousands of Documents

**What goes wrong:**
```
Migration logic:
  IF folderId = "Pay Apps" folder THEN documentType = 'payment_app'
  ELSE IF category = 'payment_app' THEN documentType = 'payment_app'
  ELSE documentType = 'other'

Reality: Users throw random files in Pay Apps folder
  - A photo of a paid invoice (not an actual payment app)
  - A vendor's original invoice (not the company's payment app)
  - A change order PDF that happens to be in Pay Apps folder

Result: 20% of documents mislabeled
Consequence: User tries to regenerate payment app, gets wrong document; creates duplicate
```

**Why it happens:**
- Folder classification is ambiguous (folder = location, not type)
- category field inconsistently filled by users
- No validation when uploading to folder
- Historical data mixed (old folder structure, new category field)

**Prevention:**
1. **Inference confidence scoring:**
   ```typescript
   function inferDocumentType(
     document: Document,
     folder: Folder | null,
     category: string | null
   ): { type: string; confidence: number } {
     if (category && isValid(category)) {
       return { type: category, confidence: 0.95 }; // Trust category field
     }

     if (folder?.name.includes('Payment')) {
       return { type: 'payment_app', confidence: 0.7 }; // Low confidence
     }

     return { type: 'other', confidence: 0.3 }; // Very low
   }
   ```

2. **Manual review UI:**
   - Show documents with confidence < 0.8
   - Let admins correct before migration finalizes
   - Export list for spot-checking (sample 100 docs)

3. **Preserve original data:**
   ```sql
   -- Add originalCategory column before dropping folderId
   ALTER TABLE documents ADD COLUMN original_folder_name TEXT;

   UPDATE documents SET original_folder_name = (
     SELECT name FROM folders WHERE id = documents.folderId
   );

   -- Can always re-infer if needed
   ```

4. **Gradual migration:**
   - Add documentType column (nullable) without removing folderId
   - Backfill in batches, verify each batch
   - Only drop folderId after 100% confidence

**Detection:**
- ⚠️ Post-migration: Query documents WHERE documentType = 'other' → count
- ⚠️ Spot-check: sample 50 documents, verify type matches content
- ⚠️ User reports: "This document is categorized wrong"

---

### Pitfall 4: Sequence Counter Race Condition Loses Document Numbers

**What goes wrong:**
```
Two admins simultaneously generate payment app PDFs:

Admin 1: SELECT currentSequence FROM naming_convention WHERE type = 'payment_app'
         Result: currentSequence = 5
         (Admin 1 thinks next is 6)

Admin 2: SELECT currentSequence FROM naming_convention WHERE type = 'payment_app'
         Result: currentSequence = 5
         (Admin 2 thinks next is 6)

Admin 1: UPDATE naming_convention SET currentSequence = 6 WHERE type = 'payment_app'
         Creates document: "2024-001-PA-006"

Admin 2: UPDATE naming_convention SET currentSequence = 6 WHERE type = 'payment_app'
         Creates document: "2024-001-PA-006"  ← DUPLICATE!

Result: Two payment apps with same number, audit trail confused
```

**Why it happens:**
- SELECT + UPDATE is not atomic (race condition window)
- Multiple concurrent PDF generation requests
- Database doesn't prevent duplicate sequence values

**Prevention:**
1. **Use SELECT FOR UPDATE (PostgreSQL):**
   ```typescript
   async function getNextSequence(
     companyId: UUID,
     documentType: string,
     db: Database
   ): Promise<number> {
     return await db.transaction(async (tx) => {
       // Lock row to prevent concurrent access
       const [convention] = await tx
         .select()
         .from(schema.documentNamingConventions)
         .where(
           and(
             eq(schema.documentNamingConventions.companyId, companyId),
             eq(schema.documentNamingConventions.documentType, documentType)
           )
         )
         .for('update'); // PostgreSQL: SELECT FOR UPDATE

       if (!convention) throw new Error('Naming convention not found');

       const nextSeq = convention.currentSequence + 1;

       await tx
         .update(schema.documentNamingConventions)
         .set({ currentSequence: nextSeq })
         .where(eq(schema.documentNamingConventions.id, convention.id));

       return nextSeq; // Guaranteed unique
     });
   }
   ```

2. **Unique constraint (fallback):**
   - If SELECT FOR UPDATE fails, catch race condition error
   - Retry with exponential backoff

3. **Distributed lock (future):**
   - If multi-server setup, use Redis lock
   - But schema-per-tenant means low contention (one sequence per company per type)

**Detection:**
- ⚠️ Query for duplicate document names: `SELECT name, COUNT(*) FROM documents GROUP BY name HAVING COUNT(*) > 1`
- ⚠️ Monitor audit logs for concurrent phase transitions
- ⚠️ Check database logs for SELECT FOR UPDATE conflicts

---

## Moderate Pitfalls

Mistakes that cause bugs or workarounds, but not rewrites.

### Pitfall 5: Folder Permissions Don't Translate to Document Permissions

**What goes wrong:**
```
Old system: Documents in "Contracts" folder → inherit folder permissions
            folder_permissions table controls access

New system: Flat documents → document_permissions table
            But nobody migrated folder_permissions → document_permissions

Result: Users can't see documents they should have access to
        Admin grants access in old folder_permissions table (has no effect)
        User confused, support ticket
```

**Why it happens:**
- Two separate permission systems (folder vs document)
- Migration only adds metadata, doesn't migrate permissions
- Admin forgets to re-grant access in new system

**Prevention:**
1. **Migrate permissions explicitly:**
   ```sql
   -- Backfill document_permissions from folder_permissions
   INSERT INTO document_permissions (documentId, userId, permissionLevel, grantedBy, grantedAt)
   SELECT d.id, fp.userId, fp.permissionLevel, fp.grantedBy, fp.grantedAt
   FROM documents d
   JOIN folder_archive fa ON d.id = fa.documentId
   JOIN folders f ON fa.originalFolderId = f.id
   JOIN folder_permissions fp ON f.id = fp.folderId
   ON CONFLICT (documentId, userId) DO NOTHING;
   ```

2. **Deprecate folder_permissions UI:**
   - Show warning: "Folder permissions deprecated, use document permissions"
   - Redirect admins to migrate
   - Remove folder_permissions UI after 30 days

3. **Audit trail:**
   - Log all permission grants/revokes during migration
   - Flag any user who loses access (send email: "access removed in migration")

**Detection:**
- ⚠️ Post-migration: Query `SELECT * FROM folder_permissions WHERE userId NOT IN (SELECT userId FROM document_permissions)` → users missing access
- ⚠️ User reports: "I can't see documents I should"

---

### Pitfall 6: Phase Transition Breaks Related Records

**What goes wrong:**
```
Project advances from "design" to "bidding"
  ↓
System logic says: Lock all estimates (estimates only editable in design)
  ↓
But one estimate was accepted, now linked to project budget
  ↓
User tries to update estimate: ERROR "Estimate locked in bidding phase"
  ↓
User confused: "I need to update the budget estimate, why is it locked?"
```

**Why it happens:**
- Phase rules are too strict (lock estimates outside design)
- Doesn't account for accepted estimates that affect budget
- No "view-only" vs "locked" distinction

**Prevention:**
1. **Nuanced phase rules:**
   ```typescript
   // Not: "estimates locked in execution"
   // Instead:

   function canEditEstimate(estimate: Estimate, projectPhase: string): boolean {
     // Can edit if:
     // - In design phase, OR
     // - Estimate not accepted yet (status = 'draft'), OR
     // - User is estimator (not just viewer)

     if (projectPhase === 'design') return true;
     if (estimate.status !== 'accepted') return true;
     if (user.role === 'estimator') return true;

     return false;
   }
   ```

2. **Pre-flight checks before phase transition:**
   - Query all estimates in project
   - Verify state is compatible with new phase
   - Warn admin if inconsistency detected

3. **Audit trail:**
   - Log which records were locked/unlocked on phase transition
   - Let admin review and fix if needed

**Detection:**
- ⚠️ User reports: "Can't edit estimate after phase change"
- ⚠️ Audit logs show phase transitions but no corresponding estimate lock logs

---

### Pitfall 7: Custom Templates Break on Schema Changes

**What goes wrong:**
```
v1.5 ships with template:
  Change Order → field mapping: {
    "Project Name": { sourceEntity: 'project', sourceField: 'name' }
  }

v1.5.1 release: projects.name → projects.title (column rename for consistency)

Old templates still reference projects.name (doesn't exist)
PDF generation fails silently → rendered with [FIELD_MISSING]
Users see broken PDFs without warning
```

**Why it happens:**
- Templates are just JSONB configs, no schema versioning
- Column renames happen without template migration
- Fallback rendering hides the error (looks like missing data, not broken mapping)

**Prevention:**
1. **Template schema versioning:**
   ```sql
   ALTER TABLE document_templates ADD COLUMN schema_version TEXT DEFAULT 'v1.0';

   -- When schema changes, flag affected templates:
   UPDATE document_templates SET schema_version = 'v1.0-needs-migration'
   WHERE config->'fieldMappings'->>'sourceField' IN ('name')
   AND document_type = 'change_order';
   ```

2. **Migration script on version bump:**
   ```typescript
   // apps/api/src/db/migrations/migrate-v1.5.1-schema.ts

   async function updateTemplateFieldMappings() {
     const templates = await db
       .select()
       .from(schema.documentTemplates)
       .where(eq(schema.documentTemplates.schemaVersion, 'v1.0'));

     for (const template of templates) {
       const updated = template.config.fieldMappings;
       if (updated['projectName']?.sourceField === 'name') {
         updated['projectName'].sourceField = 'title'; // Apply migration
       }

       await db
         .update(schema.documentTemplates)
         .set({
           config: updated,
           schemaVersion: 'v1.1',
           updatedAt: now(),
         })
         .where(eq(schema.documentTemplates.id, template.id));
     }
   }
   ```

3. **Admin notification:**
   - Email admins: "Templates updated for v1.5.1 release, verify rendering"
   - Show warning UI: "Template uses schema v1.0, migrate to v1.1"

**Detection:**
- ⚠️ Query for templates with old schema_version
- ⚠️ Monitor logs for [FIELD_MISSING] → trigger migration
- ⚠️ Test all company templates on version bump

---

### Pitfall 8: Naming Convention Format Syntax Error Silently Fails

**What goes wrong:**
```
Admin sets naming convention:
  Format: "{jobNumber}-PA-{seq"  ← Typo: missing closing brace

System tries to parse: "{seq" → Not a recognized variable
Silently uses original name or falls back to default
Document created as "Untitled.pdf" instead of "2024-001-PA-005.pdf"

User confused: "Where's the auto-naming?"
```

**Why it happens:**
- Naming format is just a string with template variables
- No validation of brace matching or variable names
- Error handling is lenient (fail silently)

**Prevention:**
1. **Format validation:**
   ```typescript
   function validateNamingFormat(format: string): string[] {
     const errors: string[] = [];

     // Check for unmatched braces
     const openBraces = (format.match(/\{/g) || []).length;
     const closeBraces = (format.match(/\}/g) || []).length;
     if (openBraces !== closeBraces) {
       errors.push(`Unmatched braces: ${openBraces} open, ${closeBraces} close`);
     }

     // Check for invalid variable names
     const variables = format.match(/\{(\w+)\}/g) || [];
     const validVars = ['jobNumber', 'projectName', 'seq', 'date', 'year', 'month', 'day', 'entityNumber'];

     for (const varMatch of variables) {
       const varName = varMatch.slice(1, -1); // Remove { }
       if (!validVars.includes(varName)) {
         errors.push(`Unknown variable: ${varName}`);
       }
     }

     return errors;
   }
   ```

2. **Format preview:**
   - Show sample output: "Preview: 2024-001-PA-005.pdf"
   - Update live as admin types
   - Disable save if preview fails

3. **Error messaging:**
   - Don't silently fall back; show error modal
   - Prevent save if format invalid

**Detection:**
- ⚠️ Query naming_conventions, validate all formats
- ⚠️ User reports: "Auto-naming not working"
- ⚠️ Documents created with wrong names

---

## Minor Pitfalls

### Pitfall 9: Document List Pagination Gets Out of Sync

**What goes wrong:**
```
User on page 2 of 50 documents
Clicks "Create New Document"
Returns to page 2 → documents shifted (new one inserted at top)
User sees wrong documents
```

**Prevention:** Use cursor-based pagination or timestamp filters instead of offset

### Pitfall 10: Phase Transition Audit Log Incomplete

**What goes wrong:**
```
Admin advances phase, but side effect fails (email send)
Audit log says "phase advanced" but feature lock didn't apply
System in inconsistent state
```

**Prevention:** Use database transactions; if any side effect fails, rollback entire transaction

### Pitfall 11: Naming Convention Current Sequence Drifts

**What goes wrong:**
```
Sequence counter gets out of sync after errors/rollbacks
Next document is 007, but should be 008
Manual fixes required
```

**Prevention:** Validate sequence monotonicity on reads; alert if gap detected

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|---|---|---|
| **Phase 1 (Lifecycle)** | Status migration data loss | Audit before, admin review UI, rollback plan |
| **Phase 2 (Document Metadata)** | Type inference inaccuracy | Confidence scoring, manual review, preserve originals |
| **Phase 3 (PDF Generation)** | Template field mapping breaks | Validation at save, test render, fallback strategy, schema versioning |
| **Phase 4 (Integration)** | Phase rules too strict, break workflows | Pre-flight checks, nuanced rules, audit trail |

---

## Mitigation Checklist

Before shipping each phase:

### Phase 1
- [ ] Audit existing projects: sample 50 'on_hold' projects, verify phase mapping
- [ ] Create admin review UI for phase migration (show old → new)
- [ ] Write rollback procedure (restore projects.status)
- [ ] Test on staging: run full migration, verify no data loss
- [ ] Post-migration: query for "orphaned" phases, verify count

### Phase 2
- [ ] Inference accuracy test: backfill sample batch, manual review
- [ ] Check folder_archive preservation
- [ ] Verify document counts unchanged after migration
- [ ] Performance test: query 10K documents by type, measure latency

### Phase 3
- [ ] Template validation suite: test all company templates
- [ ] Field mapping audit: verify all fields exist in schema
- [ ] Fallback rendering test: delete a field, verify [FIELD_MISSING] works
- [ ] Schema versioning test: change column name, verify migration
- [ ] Load test: generate 100 PDFs concurrently, check for sequence collisions

### Phase 4
- [ ] Phase rule testing: test all invalid state transitions
- [ ] Feature lock testing: verify estimates locked in execution
- [ ] Pre-flight check testing: try to advance with failing checks
- [ ] End-to-end workflow: pre_contract → execution → closeout → archived
- [ ] Audit trail testing: verify all transitions logged

