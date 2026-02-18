# Technology Stack for v1.5

**Project:** Construction Management SaaS v1.5
**Focus:** Project Lifecycle Redesign & Document Engine
**Researched:** 2026-02-18

---

## Recommended Stack

### Core Framework (No Changes)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **Next.js** | 14 (App Router) | Frontend framework | Existing proven setup, no change needed |
| **Fastify** | 5.x | API server | Existing proven setup, lightweight |
| **tRPC** | 10.x | RPC framework | Existing proven setup, end-to-end type safety |
| **Drizzle ORM** | 0.29+ | Database access | Existing proven setup, excellent TypeScript support |
| **PostgreSQL** | 14+ | Database | Existing proven setup, schema-per-tenant ready |

### Database (Extensions Only)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **PostgreSQL** | 14+ (existing) | Project lifecycle state storage | Supports JSONB for transition history, SELECT FOR UPDATE for atomicity |
| **pg_cron** | (optional) | Scheduled auto-transitions | For future: auto-advance maintenance→archived when period ends |

### File Storage (No Changes)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **MinIO** | 2023+ | PDF + template storage | Already in use, S3-compatible, versioning support |

### PDF Generation (New)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **PDFKit** | 0.13+ | Server-side PDF rendering | Lightweight, pure Node.js, excellent for form filling + templated documents |
| **pdf-parse** | 1.1+ | PDF field extraction (optional) | For parsing uploaded PDF templates to auto-detect fields |

### Type Safety & Validation (No Changes)
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **Zod** | 3.x | Schema validation | Existing proven setup, excellent for tRPC + Drizzle |

---

## Decision: PDF Rendering Technology

### Comparison

| Technology | PDFKit | React-PDF | Puppeteer + HTML | Wkhtmltopdf |
|---|---|---|---|---|
| **Setup Complexity** | ⭐ Very Simple | ⭐⭐ Simple | ⭐⭐⭐⭐ Complex | ⭐⭐⭐ Medium |
| **Performance** | ⭐⭐⭐⭐⭐ Fast | ⭐⭐⭐ Medium | ⭐⭐ Slow | ⭐⭐⭐ Medium |
| **CSS Support** | ⭐ None | ⭐⭐ Limited | ⭐⭐⭐⭐⭐ Full | ⭐⭐⭐⭐ Good |
| **Layout Control** | ⭐⭐ Manual | ⭐⭐⭐ Component-based | ⭐⭐⭐⭐⭐ Full CSS | ⭐⭐⭐⭐ CSS |
| **Dependencies** | ⭐⭐⭐⭐⭐ Minimal | ⭐⭐⭐ React required | ⭐ Heavy (Chrome) | ⭐⭐ System binary |
| **v1.5 Suitability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

### Recommendation: PDFKit

**Why PDFKit for v1.5:**
- ✅ Simplicity: No external service, no Chrome dependency
- ✅ Performance: Renders AIA G702 in <500ms
- ✅ Cost: No additional infrastructure
- ✅ v1.5 use cases: Payment apps, change orders, estimates (form-based, not complex layouts)

**Upgrade path for v1.6+:**
- If we need complex layouts (cover pages, multi-column content), migrate to React-PDF or Puppeteer
- Recommendation: Move to React-PDF (better than Puppeteer for performance)
- Timeline: Q3 2026 if customer demand exists

**Implementation:**
```typescript
// Fastify endpoint
import PDFDocument from 'pdfkit';

app.post('/api/documents/generate-pdf', async (request, reply) => {
  const { templateId, mergedData } = request.body;

  // 1. Load template config from database
  const template = await db.query.document_templates.findFirst(...)

  // 2. Create PDF document
  const pdf = new PDFDocument();

  // 3. Render using field mappings
  pdf.fontSize(12)
     .text(`Project: ${mergedData.projectName}`)
     .text(`Amount: ${formatCurrency(mergedData.amount)}`)
     // ... etc

  // 4. Pipe to MinIO
  const buffer = await pdf.toBuffer();
  await minioClient.putObject('bucket', storageKey, buffer);

  return { storageKey };
});
```

---

## Database Schema Extensions

### New Tables

```typescript
// 1. Project Lifecycle State
interface ProjectLifecycleState {
  id: UUID;
  projectId: UUID;
  currentPhase: 'pre_contract' | 'design' | 'bidding' | 'execution' | 'close_out' | 'maintenance' | 'archived';
  enteredPhaseAt: Date;
  transitionHistory: {
    fromPhase: string;
    toPhase: string;
    triggeredBy: string;
    timestamp: Date;
    reason?: string;
  }[];
  autoAdvanceEnabled: boolean;
  autoAdvanceConditions?: Record<string, unknown>;
  lastStatusCheckAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Document Templates
interface DocumentTemplate {
  id: UUID;
  companyId: UUID;
  name: string; // "AIA G702 Payment Application"
  documentType: string; // 'payment_app' | 'change_order' | 'estimate'
  sourceType: 'pdf' | 'html' | 'word' | 'excel';
  storageKey: string; // MinIO path
  config: {
    fieldMappings: Record<string, FieldMapping>;
    namingConvention: NamingConvention;
    layout?: Layout;
    signatureFields?: Record<string, SignatureField>;
  };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// 3. Naming Conventions
interface DocumentNamingConvention {
  id: UUID;
  companyId: UUID;
  documentType: string;
  namingFormat: string; // "{jobNumber}-PA-{seq}"
  sequenceFormat: string; // "NNN" | "N"
  startingSequence: number;
  currentSequence: number;
  isActive: boolean;
  createdAt: Date;
}

// 4. Document Metadata (columns added to existing documents table)
interface DocumentsExtension {
  documentType?: string;
  relatedEntityType?: string;
  relatedEntityId?: UUID;
  isTemplate?: boolean;
  templateConfig?: Record<string, unknown>;
  externalSourceId?: string;
  externalSourceType?: string;
}
```

### Updated Tables

```typescript
// projects table: adds backward-compat read-only view
// (projects.status synced from project_lifecycle_state.currentPhase)

// documents table: adds metadata columns for flat discovery
// (optional: documents.folderId kept nullable for gradual migration)

// audit_logs table: unchanged, records all phase transitions
```

---

## Dependencies to Add

### npm Packages

```json
{
  "dependencies": {
    "pdfkit": "^0.13.0",
    "pdf-parse": "^1.1.0"  // Optional: for parsing templates
  },
  "devDependencies": {
    "@types/pdfkit": "^0.12.0"
  }
}
```

### Installation

```bash
npm install pdfkit pdf-parse
npm install -D @types/pdfkit
```

### Zero New Dependencies (Existing Stack)

- Fastify (already in use)
- tRPC (already in use)
- Drizzle ORM (already in use)
- PostgreSQL (already in use)
- Zod (already in use)
- MinIO (already in use)

---

## Migration: Database Schema

### Step-by-Step Migration

```sql
-- 1. Add project_lifecycle_state table (non-breaking)
CREATE TABLE project_lifecycle_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projectId UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  currentPhase TEXT NOT NULL DEFAULT 'execution',
  enteredPhaseAt TIMESTAMPTZ NOT NULL DEFAULT now(),
  transitionHistory JSONB NOT NULL DEFAULT '[]',
  autoAdvanceEnabled BOOLEAN DEFAULT false,
  autoAdvanceConditions JSONB,
  lastStatusCheckAt TIMESTAMPTZ,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatedAt TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_lifecycle_projectId ON project_lifecycle_state(projectId);
CREATE INDEX idx_project_lifecycle_phase ON project_lifecycle_state(currentPhase);

-- 2. Add metadata columns to documents (non-breaking)
ALTER TABLE documents ADD COLUMN (
  documentType TEXT,
  relatedEntityType TEXT,
  relatedEntityId UUID,
  isTemplate BOOLEAN DEFAULT false,
  templateConfig JSONB,
  externalSourceId TEXT,
  externalSourceType TEXT
);

CREATE INDEX idx_documents_type ON documents(projectId, documentType);
CREATE INDEX idx_documents_related ON documents(projectId, relatedEntityType, relatedEntityId);
CREATE INDEX idx_documents_template ON documents(projectId, isTemplate);

-- 3. Add document_naming_conventions table
CREATE TABLE document_naming_conventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companyId UUID NOT NULL,
  documentType TEXT NOT NULL,
  namingFormat TEXT NOT NULL,
  sequenceFormat TEXT DEFAULT 'NNN',
  startingSequence INTEGER DEFAULT 1,
  currentSequence INTEGER DEFAULT 1,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(companyId, documentType)
);

CREATE INDEX idx_naming_company ON document_naming_conventions(companyId);

-- 4. Add document_templates table
CREATE TABLE document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companyId UUID NOT NULL,
  name TEXT NOT NULL,
  documentType TEXT NOT NULL,
  sourceType TEXT NOT NULL,
  storageKey TEXT,
  config JSONB NOT NULL,
  isActive BOOLEAN DEFAULT true,
  createdBy TEXT NOT NULL,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatedAt TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(companyId, name)
);

CREATE INDEX idx_templates_company ON document_templates(companyId);
CREATE INDEX idx_templates_type ON document_templates(companyId, documentType);

-- 5. Optional: folder_archive for backward compat
CREATE TABLE folder_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projectId UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  documentId UUID UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  originalFolderId UUID,
  archivedAt TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_folder_archive_project ON folder_archive(projectId);
```

### Data Backfill

```sql
-- Backfill project_lifecycle_state from existing projects
INSERT INTO project_lifecycle_state (
  projectId,
  currentPhase,
  enteredPhaseAt,
  createdAt,
  updatedAt
)
SELECT
  p.id,
  CASE p.status
    WHEN 'active' THEN 'execution'
    WHEN 'on_hold' THEN 'execution'
    WHEN 'completed' THEN 'archived'
    WHEN 'archived' THEN 'archived'
    ELSE 'execution'
  END,
  p.updatedAt,
  now(),
  now()
FROM projects p
ON CONFLICT (projectId) DO NOTHING;

-- Backfill documentType from existing category
UPDATE documents
SET documentType = CASE
  WHEN category = 'contract' THEN 'contract'
  WHEN category = 'change_order' THEN 'change_order'
  WHEN category = 'payment_app' THEN 'payment_app'
  WHEN category = 'invoice' THEN 'invoice'
  WHEN category = 'drawing' THEN 'drawing'
  WHEN category = 'specification' THEN 'submittal'
  WHEN category = 'rfi' THEN 'rfi'
  WHEN category = 'photo' THEN 'photo'
  WHEN category = 'closeout' THEN 'closeout'
  ELSE 'other'
END
WHERE documentType IS NULL;

-- Backfill folder_archive
INSERT INTO folder_archive (projectId, documentId, originalFolderId, archivedAt)
SELECT projectId, id, folderId, now()
FROM documents
WHERE folderId IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

## Performance Considerations

### Index Strategy

| Index | Table | Columns | Use Case |
|-------|-------|---------|----------|
| Primary | project_lifecycle_state | (projectId) | Fast lookup by project |
| Secondary | project_lifecycle_state | (currentPhase) | Filter by phase |
| Primary | documents | (projectId, documentType) | List docs by type |
| Secondary | documents | (projectId, relatedEntityType, relatedEntityId) | Filter by entity |
| Primary | document_templates | (companyId, name) | Unique constraint |
| Secondary | document_templates | (companyId, documentType) | Find templates by type |

### Caching Strategy

```typescript
// Cache compiled templates in memory
const templateCache = new Map<UUID, DocumentTemplate>();

async function getTemplateWithCache(id: UUID): Promise<DocumentTemplate> {
  if (templateCache.has(id)) {
    return templateCache.get(id)!;
  }

  const template = await db.query.document_templates.findFirst(
    where: eq(id, schema.document_templates.id)
  );

  if (template) {
    templateCache.set(id, template);
  }

  return template;
}

// Invalidate on template update
async function updateTemplate(id: UUID, updates: Partial<DocumentTemplate>) {
  await db.update(schema.document_templates).set(updates).where(eq(id, schema.document_templates.id));
  templateCache.delete(id); // Invalidate cache
}
```

---

## Deployment Checklist

- [ ] Add PDFKit + @types/pdfkit to package.json
- [ ] Run `npm install` on all environments
- [ ] Create database migrations (schema + data backfill)
- [ ] Test migrations on staging environment
- [ ] Create rollback migration (in case needed)
- [ ] Deploy migrations to production (during low-traffic window)
- [ ] Deploy new API code
- [ ] Run data validation queries post-deployment
- [ ] Monitor logs for errors during first 24 hours
- [ ] Test end-to-end: phase advancement, PDF generation, document discovery

---

## Version Constraints

### Minimum Versions

- Node.js: 18.x (for native fetch, async/await)
- PostgreSQL: 14.x (for JSON operators, performance)
- npm: 9.x

### Compatible Versions

- Next.js 14.x App Router
- Fastify 5.x
- tRPC 10.x
- Drizzle 0.29+
- Zod 3.x
- PDFKit 0.13+

---

## Future Upgrade Path

### v1.6 Enhancements (Planned)

| Feature | Technology | Rationale |
|---------|---|---|
| Async PDF generation | Bull + Redis | If PDF generation > 500ms per request |
| React component templates | React-PDF | If custom layouts needed for PDFs |
| Template versioning | Drizzle + JSONB | Track template config changes |
| e-Signature integration | DocuSign API | For signature workflows |

### Dependency Upgrade Path

- **PDFKit**: Stay on 0.13+ unless critical bug fix needed
- **PostgreSQL**: Plan upgrade to 15+ in 2026 Q3 (security + performance)
- **Node.js**: Follow LTS releases (20.x, 22.x, 24.x timeline)

---

## Cost Implications

### Infrastructure (Minimal Changes)

- **Compute:** No change (PDF rendering in-process, modest CPU usage)
- **Memory:** +~50MB per API instance (PDFKit library + template cache)
- **Storage:** +~500MB per 10,000 templates (MinIO already handles versioning)
- **Database:** +~100MB for new tables at scale (schema-per-tenant isolates growth)

### Licensing

- **All open-source:** PDFKit (MIT), pdf-parse (MIT), PostgreSQL (PostgreSQL license)
- **No new proprietary dependencies**

---

## Summary

**v1.5 technology stack builds on existing proven technologies with minimal new dependencies:**

- ✅ PDFKit for PDF generation (lightweight, performant, no external service)
- ✅ Existing PostgreSQL, Fastify, tRPC, Drizzle stack (no changes)
- ✅ MinIO for template + PDF storage (already in use)
- ✅ JSONB configs for flexibility (already pattern in codebase)

**Confidence: HIGH** — All recommendations align with existing architecture and proven patterns.

