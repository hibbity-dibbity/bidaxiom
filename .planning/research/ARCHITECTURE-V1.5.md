# Architecture: v1.5 Project Lifecycle Redesign & Document Engine

**Project:** Construction Management SaaS v1.5
**Researched:** 2026-02-18
**Mode:** Architecture Analysis
**Confidence:** HIGH (based on existing codebase review)

---

## Executive Summary

v1.5 introduces three interconnected architectural shifts:

1. **9-Phase Project Lifecycle** — Replace `projects.status` enum (active/on_hold/completed/archived) with a structured state machine (`project_lifecycle_state` table) tracking: pre_contract → design → bidding → execution → close_out → maintenance → archived

2. **Flat Document Metadata System** — Replace folder hierarchy navigation with metadata-based discovery (add `documentType`, `relatedEntityType`, `relatedEntityId` columns to existing documents table)

3. **PDF Generation + Custom Templates** — Implement server-side PDF rendering (PDFKit in Fastify API) with template configs (field mapping, naming conventions) stored in database

All three changes build on the existing tRPC+Drizzle+schema-per-tenant architecture with **zero breaking changes** to the API surface.

---

## Current Architecture Context

### Existing Stack (Verified from Codebase)
- **Frontend:** Next.js 14 App Router + React
- **API:** Fastify + tRPC middleware
- **ORM:** Drizzle ORM with PostgreSQL (hand-written migrations)
- **Multi-tenancy:** Schema-per-company (each tenant gets dedicated PostgreSQL schema named `tenant_*`)
- **Storage:** MinIO S3-compatible
- **Auth:** Clerk.js + manual org/role management

### Current Project Model
```typescript
// projects table
id (UUID) | name | jobNumber (unique per schema)
status: 'active' | 'on_hold' | 'completed' | 'archived'
customerId (FK) | slug | budget | costCodes | metadata (JSONB)

// project_phases table (separate concept)
id | projectId | name | orderIndex
status: 'pending' | 'in_progress' | 'completed'
// Used for construction phases (Pre-Construction, Mobilization, etc.)
// NOT tied to project.status
```

### Current Document Model
```typescript
// documents table
id | projectId | folderId (FK) | name | category (enum)
currentVersionId (FK) | contentType | fileSize

// folders table
id | projectId | parentId (self-referential) | name | orderIndex

// Problem: Category enum + folder structure creates UX friction
// Filtering "all payment applications" = navigate to Pay Apps folder
// OR filter by category + search by name
```

---

## 1. Project Lifecycle State Machine

### New Table: `project_lifecycle_state`

```sql
CREATE TABLE project_lifecycle_state (
  id UUID PRIMARY KEY,
  projectId UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

  -- Current state
  currentPhase TEXT NOT NULL,
  enteredPhaseAt TIMESTAMPTZ NOT NULL,

  -- Audit trail
  transitionHistory JSONB NOT NULL DEFAULT '[]',
  -- [{fromPhase, toPhase, triggeredBy, timestamp, reason}...]

  -- For future auto-transition features
  autoAdvanceEnabled BOOLEAN DEFAULT false,
  autoAdvanceConditions JSONB, -- {all_change_orders_approved: bool, ...}
  lastStatusCheckAt TIMESTAMPTZ,

  -- Timestamps
  createdAt TIMESTAMPTZ NOT NULL,
  updatedAt TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_project_lifecycle_state_projectId ON project_lifecycle_state(projectId);
CREATE INDEX idx_project_lifecycle_state_currentPhase ON project_lifecycle_state(currentPhase);
```

### 9-Phase Lifecycle Model

| Phase | Description | Typical Duration | Entry Trigger | Exit Condition |
|-------|---|---|---|---|
| **pre_contract** | Proposal/estimate phase before signed contract | Days-weeks | Project created | Contract signed |
| **design** | Design development, RFIs, submittals | Weeks-months | Contract signed | Design approved |
| **bidding** | Procurement phase, RFQ/bid evaluation | 2-4 weeks | Design approved | Bids awarded |
| **execution** | Active construction work | Months | Bids awarded | Punchlist complete |
| **close_out** | Final inspections, warranties, sign-off | Weeks | Punchlist complete | All docs signed |
| **maintenance** | Post-delivery support period | As needed | Closeout complete | Period ends (manual/auto) |
| **archived** | Historical reference, read-only | Indefinite | Manual action | N/A |

### Migration: Existing Projects

```sql
-- Step 1: Add project_lifecycle_state table (non-breaking)

-- Step 2: Backfill with mapping logic
INSERT INTO project_lifecycle_state (projectId, currentPhase, enteredPhaseAt, createdAt, updatedAt)
SELECT
  p.id,
  CASE p.status
    WHEN 'active' THEN 'execution'       -- Assume active = in execution
    WHEN 'on_hold' THEN 'execution'      -- Keep in same phase, use separate flag if needed
    WHEN 'completed' THEN 'close_out'   -- Completed projects in close_out or archived?
    WHEN 'archived' THEN 'archived'
  END,
  COALESCE(p.updatedAt, now()),  -- Use updatedAt as entered timestamp
  now(),
  now()
FROM projects p
ON CONFLICT (projectId) DO NOTHING;

-- Step 3: Keep projects.status as read-only (sync from lifecycle_state)
-- Add computed column or trigger to maintain backward compat

-- Step 4: Update project queries to read from lifecycle_state
-- Old: WHERE projects.status = 'active'
-- New: WHERE project_lifecycle_state.currentPhase = 'execution'
```

**Migration Risk:** Mapping is lossy — "on_hold" could be any phase paused. Mitigation:
- Store original status in metadata: `{oldStatus: 'on_hold', mappedPhase: 'execution'}`
- Create audit log entry for each project transition during migration
- Admin UI: show "old status → proposed new phase" for manual confirmation

### State Transitions: Implementation Pattern

**Use tRPC mutations, NOT DB triggers:**

```typescript
// apps/api/src/trpc/routers/project.ts

export const advanceProjectPhase = protectedProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    newPhase: z.enum(['design', 'bidding', 'execution', 'close_out', 'maintenance', 'archived']),
    triggerReason: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    if (!ctx.tenant) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    const { db, schema } = ctx.tenant;
    const userId = ctx.userId!;

    return await db.transaction(async (tx) => {
      // 1. Lock row to prevent race conditions
      const [current] = await tx
        .select()
        .from(schema.projectLifecycleState)
        .where(eq(schema.projectLifecycleState.projectId, input.projectId))
        .for('update'); // PostgreSQL: SELECT FOR UPDATE

      if (!current) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // 2. Validate transition is allowed
      const allowedNextPhases = getAllowedTransitions(current.currentPhase);
      if (!allowedNextPhases.includes(input.newPhase)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transition from ${current.currentPhase} to ${input.newPhase}`,
        });
      }

      // 3. Run pre-flight checks (entity-type specific)
      await runPreFlightChecks(input.newPhase, input.projectId, tx, schema);

      // 4. Audit log
      await tx.insert(schema.auditLogs).values({
        entityType: 'project_lifecycle_state',
        entityId: current.projectId,
        action: 'phase_transition',
        actorId: userId,
        changes: {
          fromPhase: current.currentPhase,
          toPhase: input.newPhase,
          reason: input.triggerReason,
        },
      });

      // 5. Update lifecycle state
      await tx
        .update(schema.projectLifecycleState)
        .set({
          currentPhase: input.newPhase,
          enteredPhaseAt: new Date(),
          transitionHistory: sql`array_append(
            transition_history,
            jsonb_build_object(
              'fromPhase', ${current.currentPhase},
              'toPhase', ${input.newPhase},
              'triggeredBy', ${userId},
              'timestamp', now(),
              'reason', ${input.triggerReason || null}
            )
          )`,
          updatedAt: new Date(),
        })
        .where(eq(schema.projectLifecycleState.projectId, input.projectId));

      // 6. Update projects.status for backward compat (read-only view)
      const mappedStatus = mapPhaseToStatus(input.newPhase);
      await tx
        .update(schema.projects)
        .set({ status: mappedStatus, updatedAt: new Date() })
        .where(eq(schema.projects.id, input.projectId));

      return {
        success: true,
        newPhase: input.newPhase,
        enteredAt: new Date(),
      };
    });
  });

// Helper: define valid transitions
function getAllowedTransitions(currentPhase: string): string[] {
  const transitions: Record<string, string[]> = {
    pre_contract: ['design', 'archived'],
    design: ['bidding', 'pre_contract'], // Can revert
    bidding: ['execution', 'design'],
    execution: ['close_out', 'bidding'],
    close_out: ['maintenance', 'archived', 'execution'],
    maintenance: ['archived'],
    archived: [], // Final state
  };
  return transitions[currentPhase] ?? [];
}

// Helper: pre-flight validations per phase
async function runPreFlightChecks(
  newPhase: string,
  projectId: string,
  tx: Transaction,
  schema: TenantSchema
) {
  if (newPhase === 'execution') {
    // Verify: all RFQs have bids awarded
    const unawarded = await tx
      .select({ count: count() })
      .from(schema.bids)
      .where(
        and(
          eq(schema.bids.projectId, projectId),
          ne(schema.bids.status, 'won')
        )
      );

    if (unawarded[0]?.count > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot advance: not all bids awarded',
      });
    }
  }

  if (newPhase === 'close_out') {
    // Verify: no open change orders
    const openCOs = await tx
      .select({ count: count() })
      .from(schema.changeOrders)
      .where(
        and(
          eq(schema.changeOrders.projectId, projectId),
          notInArray(schema.changeOrders.status, ['approved', 'void'])
        )
      );

    if (openCOs[0]?.count > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot advance: change orders pending approval',
      });
    }
  }
}
```

**Why mutations, not triggers?**
- Mutations have request context: `userId`, IP address, timing
- Visible in application logs (debuggable)
- Can call external services (webhooks, email notifications, QBO)
- Easier to test + rollback

**Why SELECT FOR UPDATE?**
- Prevents race condition if two users advance phase simultaneously
- PostgreSQL-native atomicity (no application locks)
- Lock released at transaction end

---

## 2. Document Metadata Redesign

### Current Problem

```
Folder structure creates UX/API friction:
projects/
├── Contracts/           ← User navigates folder tree
├── Drawings/
├── Change Orders/       ← Filter "all change orders" = know folder path
├── Pay Apps/
└── Miscellaneous/

Ideal: Flat list with metadata filtering
Documents with documentType='change_order' + relatedEntityId=coId
```

### New Columns: `documents` Table

```sql
ALTER TABLE documents ADD COLUMN (
  -- Metadata for flat discovery
  documentType TEXT,              -- 'contract', 'change_order', 'payment_app', etc.
  relatedEntityType TEXT,         -- 'change_order', 'payment_app', 'bid', null
  relatedEntityId UUID,           -- FK semantics: link to related entity

  -- Template tracking
  isTemplate BOOLEAN DEFAULT false,
  templateConfig JSONB,           -- Field mapping, naming convention

  -- External sync tracking
  externalSourceId TEXT,          -- QBO invoice ID, etc.
  externalSourceType TEXT         -- 'quickbooks'
);

CREATE INDEX idx_docs_projectId_type ON documents(projectId, documentType);
CREATE INDEX idx_docs_related ON documents(projectId, relatedEntityType, relatedEntityId);
CREATE INDEX idx_docs_template ON documents(projectId, isTemplate);

-- Optional: preserve folder mappings for audit
CREATE TABLE folder_archive (
  id UUID PRIMARY KEY,
  projectId UUID REFERENCES projects(id) ON DELETE CASCADE,
  documentId UUID UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  originalFolderId UUID,
  archivedAt TIMESTAMPTZ DEFAULT now()
);
```

### Document Type Taxonomy

| Type | Parent Entity | Example | Metadata |
|------|---|---|---|
| contract | null | Owner agreement | contractNumber, effectiveDate |
| drawing | null | Plans/specs | drawingNumber, discipline |
| submittal | null | Material submittal | submittedDate, approvedDate |
| rfi | null | Request for info | rfiNumber, dueDate |
| change_order | change_order | CO #001 document | coNumber, amount |
| payment_app | payment_app | AIA G702 | applicationNumber, period |
| invoice | commitment (optional) | Vendor invoice | vendor, invoiceNumber |
| closeout | null | Final sign-off | inspectionDate |
| photo | null | Progress photo | takenDate, location |
| other | null | Misc doc | none |

### Migration: Folder → Metadata

```sql
-- Non-breaking: add columns first
ALTER TABLE documents ADD COLUMN (
  documentType TEXT,
  relatedEntityType TEXT,
  relatedEntityId UUID
);

-- Backfill: infer types from existing category + folder structure
UPDATE documents SET documentType = CASE
  WHEN category = 'contract' THEN 'contract'
  WHEN category = 'change_order' THEN 'change_order'
  WHEN category = 'payment_app' THEN 'payment_app'
  WHEN category IN ('invoice', 'invoice') THEN 'invoice'
  ELSE 'other'
END;

-- Create archive: preserve folder-document mapping
INSERT INTO folder_archive (projectId, documentId, originalFolderId, archivedAt)
SELECT projectId, id, folderId, now()
FROM documents
WHERE folderId IS NOT NULL;

-- Future: DROP COLUMN folderId (gradual deprecation)
```

---

## 3. PDF Generation & Templates

### Architecture: In-API Rendering

```
User clicks "Generate Payment App PDF"
    ↓
tRPC: generatePaymentAppPDF({ paymentAppId })
    ↓
Fastify API:
  1. Load template config from document_templates
  2. Load payment app data + line items
  3. Merge template + data (field mapping)
  4. Render PDF using PDFKit
  5. Upload PDF buffer to MinIO
  6. Create document + document_version record
  7. Apply naming convention
  8. Return document metadata
    ↓
Frontend: Display document in library, download link
```

**Why in-API (not separate service)?**
- v1.5 volume: PDFKit is fine (simple form filling, not complex layouts)
- Avoids: extra container, service discovery, network hops
- Future: if PDF generation becomes bottleneck (>10 PDFs/sec), extract to Bull background job

### New Tables

**`document_templates`** (company/personal templates)
```sql
CREATE TABLE document_templates (
  id UUID PRIMARY KEY,
  companyId UUID NOT NULL, -- Tenant-scoped
  name TEXT NOT NULL,      -- "AIA G702 Payment App"
  documentType TEXT NOT NULL, -- payment_app, change_order, estimate
  sourceType TEXT NOT NULL,   -- 'pdf', 'html', 'word', 'excel'
  storageKey TEXT,         -- MinIO path to template file

  -- Config: field mapping, naming, layout
  config JSONB NOT NULL,

  isActive BOOLEAN DEFAULT true,
  createdBy TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT now(),
  updatedAt TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_templates_company_name ON document_templates(companyId, name);
CREATE INDEX idx_templates_type ON document_templates(companyId, documentType);
```

**Template Config Structure (JSONB)**
```typescript
interface DocumentTemplateConfig {
  // Field mapping for merge
  fieldMappings: {
    [templateField: string]: {
      sourceEntity: 'project' | 'change_order' | 'payment_app' | 'estimate';
      sourceField: string; // Column or JSONB path
      transform?: 'currency' | 'date' | 'number'; // Apply transform
      fallback?: string; // Default if null
    };
  };

  // Auto-naming rules
  namingConvention: {
    format: string; // "{jobNumber}-PA-{seq}"
    variables: string[]; // Available: {jobNumber}, {projectName}, {seq}, {date}, etc.
  };

  // Layout (for HTML rendering)
  layout?: {
    pageSize: 'letter' | 'a4';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number };
  };

  // Signature blocks
  signatureFields?: {
    [fieldName: string]: {
      role: 'project_manager' | 'owner' | 'gc';
      required: boolean;
      position?: { page: number; x: number; y: number };
    };
  };
}
```

**`document_naming_conventions`** (per-company, per-type)
```sql
CREATE TABLE document_naming_conventions (
  id UUID PRIMARY KEY,
  companyId UUID NOT NULL,
  documentType TEXT NOT NULL,      -- 'payment_app', 'change_order'
  namingFormat TEXT NOT NULL,      -- "{jobNumber}-PA-{seq}"
  sequenceFormat TEXT,             -- "NNN" = zero-padded 3-digit
  startingSequence INTEGER DEFAULT 1,
  currentSequence INTEGER DEFAULT 1,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_naming_company_type ON document_naming_conventions(companyId, documentType);
```

### Naming Convention Variables

```
{jobNumber}       — project.jobNumber ("2024-001")
{projectName}     — project.name (URL-safe or as-is)
{projectId}       — First 8 chars of project UUID
{date}            — YYYY-MM-DD
{year}            — 4-digit year
{month}           — 2-digit month (01-12)
{day}             — 2-digit day (01-31)
{seq}             — Sequence from naming convention (auto-increment)
{entityNumber}    — coNumber, applicationNumber, etc.
{year2}           — Last 2 digits of year
```

**Example configs:**
- Payment Apps: `{jobNumber}-PA-{seq}` → "2024-001-PA-005"
- Change Orders: `CO-{year}-{seq}` → "CO-2024-0012"
- Invoices: `{date}_{vendor}_{seq}` → "2024-02-18_Acme_001"

### PDF Generation Mutation

```typescript
export const generatePaymentAppPDF = protectedProcedure
  .input(z.object({
    paymentAppId: z.string().uuid(),
  }))
  .mutation(async ({ ctx, input }) => {
    if (!ctx.tenant) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    const { db, schema } = ctx.tenant;
    const userId = ctx.userId!;

    return await db.transaction(async (tx) => {
      // 1. Load payment app + related data
      const [paymentApp] = await tx
        .select()
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.id, input.paymentAppId));

      if (!paymentApp) throw new TRPCError({ code: 'NOT_FOUND' });

      // 2. Load project + template
      const [project] = await tx
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, paymentApp.projectId));

      const [template] = await tx
        .select()
        .from(schema.documentTemplates)
        .where(
          and(
            eq(schema.documentTemplates.documentType, 'payment_app'),
            eq(schema.documentTemplates.isActive, true)
          )
        )
        .limit(1); // Or use company default

      // 3. Merge data using field mappings
      const mergedData = mergeFieldMappings(
        template.config.fieldMappings,
        {
          project,
          payment_app: paymentApp,
          // ... other entities
        }
      );

      // 4. Render PDF
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await renderPDFWithTemplate(
          template.storageKey,
          mergedData,
          template.config
        );
      } catch (error) {
        // Fallback: basic PDF without template styling
        pdfBuffer = await renderBasicPDF('payment_app', mergedData);
        await logTemplateError(template.id, error);
      }

      // 5. Upload to MinIO
      const storageKey = `documents/payment-apps/${input.paymentAppId}/${Date.now()}.pdf`;
      await minioClient.putObject(
        'construction-bucket',
        storageKey,
        pdfBuffer
      );

      // 6. Apply naming convention
      const convention = await getDocumentNamingConvention(
        db,
        schema,
        'payment_app'
      );
      const docName = applyNamingConvention(convention.namingFormat, {
        jobNumber: project.jobNumber,
        projectName: sanitizeName(project.name),
        seq: convention.currentSequence,
        entityNumber: paymentApp.applicationNumber,
        date: format(new Date(), 'yyyy-MM-dd'),
      });

      // 7. Create document record
      const [doc] = await tx
        .insert(schema.documents)
        .values({
          projectId: paymentApp.projectId,
          name: `${docName}.pdf`,
          documentType: 'payment_app',
          relatedEntityType: 'payment_app',
          relatedEntityId: input.paymentAppId,
          contentType: 'application/pdf',
          fileSize: pdfBuffer.length,
          createdBy: userId,
        })
        .returning();

      // 8. Create version
      await tx.insert(schema.documentVersions).values({
        documentId: doc.id,
        versionNumber: 1,
        storageKey,
        fileSize: pdfBuffer.length,
        contentType: 'application/pdf',
        uploadedBy: userId,
      });

      // 9. Update documents.currentVersionId
      await tx
        .update(schema.documents)
        .set({ currentVersionId: /* version.id */ })
        .where(eq(schema.documents.id, doc.id));

      // 10. Increment sequence counter
      await tx
        .update(schema.documentNamingConventions)
        .set({ currentSequence: convention.currentSequence + 1 })
        .where(eq(schema.documentNamingConventions.id, convention.id));

      return {
        documentId: doc.id,
        storageKey,
        name: doc.name,
      };
    });
  });
```

---

## Data Flow Examples

### Flow 1: Phase Advancement

```
Admin clicks "Advance to Execution"
    ↓
User sees: "Verify before advancing"
- [ ] All RFQs have bids awarded
- [ ] All contracts signed
- [ ] Budget approved
    ↓
Admin confirms
    ↓
advanceProjectPhase({ projectId, newPhase: 'execution' })
    ↓
tRPC mutation:
  - SELECT FOR UPDATE (lock row)
  - Run pre-flight checks
  - Update project_lifecycle_state
  - Create audit log
  - Return new phase
    ↓
Frontend: Phase indicator updates, UI shows execution-phase features
    ↓
Backend (optional): Send webhook to QBO, send email notification
```

### Flow 2: Flat Document Discovery

```
User clicks "Project Documents" → "Change Orders"
    ↓
tRPC: listDocuments({
  projectId,
  documentType: 'change_order',
  relatedEntityType: 'change_order',
  limit: 50,
})
    ↓
SQL:
  SELECT * FROM documents
  WHERE projectId = ?
    AND documentType = 'change_order'
    AND relatedEntityType = 'change_order'
  ORDER BY createdAt DESC
  LIMIT 50
    ↓
Frontend: Flat list with:
  - Document name
  - Related entity link (CO #5)
  - Created date
  - Download link

(No folder tree navigation)
```

### Flow 3: PDF + Auto-Naming

```
Payment app status changes to 'approved'
    ↓
User clicks "Generate PDF"
    ↓
generatePaymentAppPDF({ paymentAppId })
    ↓
API:
  1. Load template config (AIA G702 mapping)
  2. Merge: {contractSum} ← project.budget
  3. Render PDF via PDFKit
  4. Upload to MinIO
  5. Apply naming: {jobNumber}-PA-{seq} → "2024-001-PA-003"
  6. Create document with metadata
    ↓
Document appears in library: "2024-001-PA-003.pdf"
User downloads
```

---

## Integration Points

### With Existing Features

| Feature | Change | Impact |
|---------|--------|--------|
| Change Orders | Phase transitions → CO validation | "No new COs after close_out phase" |
| Payment Apps | PDF generation creates document | New document_templates table |
| Estimates | Phase controls editability | Locked outside pre_contract/design |
| Project Phases | Separate from lifecycle phases | Calendar tracks both independently |
| Bids/RFQs | Phase context for auto-advance | "Advance to execution when all bids awarded" |
| QBO Sync | PDF document metadata | Invoice PDFs linked via relatedEntityType |
| Folder Permissions | Optional → document permissions | Existing doc_permissions table works as-is |

### New vs Modified Tables

| Table | Type | Details |
|-------|------|---------|
| `project_lifecycle_state` | NEW | Tracks 9-phase lifecycle |
| `documents.documentType` | NEW column | Metadata for flat discovery |
| `documents.relatedEntityType/Id` | NEW columns | Link to parent entity |
| `document_templates` | NEW | Template configs + field mapping |
| `document_naming_conventions` | NEW | Per-company naming rules |
| `folder_archive` | NEW | Optional: preserve folder history |
| `projects.status` | MODIFIED | Read-only, synced from lifecycle |
| `documents.folderId` | DEPRECATED | Migrate to metadata (keep as nullable for transition) |

---

## Migration Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Status mapping lossy** | "on_hold" → unclear phase | Store old status in metadata, admin review, audit log |
| **Folder-document loss** | Users relied on folder org | Create `folder_archive`, "View original structure" read-only option |
| **Template field mismatch** | PDF generation fails | Dry-run all templates pre-launch, fallback rendering, version schema |
| **PDF performance spike** | API overload if batch generation | Rate limit endpoint, async queue v1.6, cache rendered PDFs |
| **Circular relationships** | Document → Entity → Document | Limit relationships to 1 level, whitelist entity types |

---

## Build Order (4 Phases)

### Phase 1: Lifecycle Foundation (4-6 weeks)
- Create `project_lifecycle_state` table + indexes
- Implement mutations: advanceProjectPhase, revertProjectPhase
- Migration: map existing status → phases
- Update project router queries
- **Risk: MEDIUM** (backfill accuracy)

### Phase 2: Document Metadata (4-5 weeks)
- Add columns to documents table
- Create `document_naming_conventions` table
- Backfill `documentType` from category + folder context
- Update document endpoints: listDocumentsByType, filterByEntity
- **Risk: MEDIUM** (ambiguous document classification)

### Phase 3: PDF Generation (5-6 weeks)
- Create `document_templates` table
- Implement PDFKit + template rendering
- Add template import workflow (UI + API)
- Generate PDFs for payment apps, change orders
- **Risk: HIGH** (field mapping complexity, edge cases)

### Phase 4: Feature Integration (3-4 weeks)
- Lifecycle → Estimate workflow (lock outside pre_contract/design)
- Lifecycle → Change order workflow (phase-aware validation)
- Lifecycle → Payment app workflow (generate PDF on approval)
- Testing + stabilization
- **Risk: MEDIUM** (interdependency correctness)

---

## Technology Decisions

### PDF Rendering

| Tech | Pros | Cons | Recommendation |
|------|------|------|---|
| **PDFKit** | Lightweight, pure JS, good for forms | Limited CSS, manual positioning | ✅ v1.5 |
| React-PDF | React-friendly, layout engine | Requires Puppeteer, heavier | v1.6+ |
| Puppeteer | Full CSS/HTML | High CPU/memory | Only if PDFKit insufficient |

### Template Storage

| Option | Pros | Cons | Recommendation |
|--------|------|------|---|
| **MinIO** | Existing, versioning, CDN | Extra I/O call | ✅ Store template files |
| JSONB | Atomic, no extra I/O | Large templates bloat DB | Config only |
| Filesystem | Fast | No backup/multi-server | ❌ Not recommended |

### Sequence Counters

| Approach | Pros | Cons | Recommendation |
|----------|------|------|---|
| **App + SELECT FOR UPDATE** | Tenant-scoped, atomic | Race conditions without lock | ✅ v1.5 |
| PostgreSQL SEQUENCES | Built-in | Single-server, no multi-tenancy | Considered but rejected |
| Redis | Fast, distributed | Extra dependency | Future optimization |

---

## Confidence Assessment

| Area | Level | Notes |
|------|-------|-------|
| Lifecycle state machine | **HIGH** | Validates against codebase (project_phases exists, status enum used) |
| Document metadata | **HIGH** | Extensions only, non-breaking, indexes proven |
| PDF generation | **MEDIUM** | PDFKit straightforward, but template field mapping has unknowns |
| Migration strategy | **MEDIUM** | Data backfill accuracy depends on folder classification + category consistency |
| Phase transitions | **HIGH** | tRPC patterns proven in codebase (estimate lifecycle, bid lifecycle exist) |

---

## Summary

v1.5 architecture builds on proven patterns:
- tRPC mutations for state changes (existing estimate/bid lifecycle use this)
- JSONB configs for extensibility (existing templates use this)
- Audit logging for compliance (existing auditLogs table)
- Schema-per-tenant isolation (no changes needed)

**No novel technologies. No breaking changes. Clear migration path.**
