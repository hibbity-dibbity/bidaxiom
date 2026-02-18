# Technology Stack — v1.5 Features (PDF Generation, Templates, Email, State Machine, Jobs)

**Project:** BIDAXIOM v1.5 (Project Lifecycle Redesign & Document Engine)
**Researched:** February 18, 2026
**Scope:** Stack additions ONLY for new v1.5 features (PDF generation, template import, document naming, state machine, background jobs)
**Confidence:** HIGH

## Executive Summary

This research identifies technology stack additions needed to implement v1.5 features: **custom PDF/Word/Excel template import with field mapping, server-side PDF generation, email delivery with custom domain, project state machine (9 statuses), and async job processing**.

**Key Finding:** Dual-stack PDF approach (Puppeteer + pdfmake) with BullMQ for async work, docxtemplater for template merging, and simple enum-based state transitions covers all requirements without architectural changes. Existing tRPC + Fastify + PostgreSQL + Redis stack fully supports these additions.

---

## 1. PDF Generation (Server-Side)

### Decision Matrix

| Library | Version | Use Case | Complexity | Integration |
|---------|---------|----------|-----------|-------------|
| **Puppeteer** | 24.37.3 | Custom template imports (HTML rendering) | High | Headless Chrome, memory-intensive |
| **pdfmake** | 0.3.4 | Generated documents (RFQs, forms) | Medium | Pure Node.js, lightweight |
| React-PDF | N/A | NOT RECOMMENDED | N/A | Client-side only |
| PDFKit | N/A | NOT RECOMMENDED | N/A | Low-level; tedious for complex layouts |

### Primary Recommendation: Puppeteer (v24.37.3)

**Purpose:** Convert custom imported HTML/PDF templates → render with live data → output PDF

**Why:**
- Renders complex HTML/CSS/JavaScript to pixel-perfect PDF
- Handles branded letterheads, conditional formatting, tables
- Ideal for proposals, change orders with custom template imports
- Robust for multi-page layouts

**Drawback:** Requires Chromium; ~50MB download on first run; 100-200MB RAM per instance

**Integration with Existing Stack:**
```typescript
// apps/api/src/services/pdf-generation.ts
import puppeteer from 'puppeteer';

export async function generatePDFFromTemplate(
  htmlContent: string,
  options?: PuppeteerLaunchOptions
): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(htmlContent);
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();
  return pdf;
}
```

**Fastify/tRPC Integration:**
- tRPC procedure → add to BullMQ queue (heavy operation)
- Worker process calls `generatePDFFromTemplate()`
- Return job ID to client; client polls progress
- Store result in MinIO (existing S3 storage)

**NOT Recommended Use:**
- Don't run synchronously in tRPC route (blocks event loop)
- Don't keep browser instance persistent (memory leak); launch/close per request or use worker pool

---

### Secondary: pdfmake (v0.3.4)

**Purpose:** Generate structured PDFs without templates (auto-generated RFQs, invoices, standard forms)

**Why:**
- Declarative JSON → PDF (no HTML parsing needed)
- Lightweight, fast, no browser overhead
- Good for data-driven documents with consistent structure
- Better performance for batch generation

**Example:**
```typescript
import PdfPrinter from 'pdfmake/build/pdfmake';

const docDefinition = {
  content: [
    { text: 'RFQ #123', fontSize: 18, bold: true },
    { text: `Date: ${formatDate(new Date())}`, margin: [0, 10] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 100, 100],
        body: items.map(i => [i.description, `$${i.price}`, `${i.qty}x`])
      }
    }
  ]
};

const pdf = await pdfPrinter.createPdf(docDefinition).getBase64();
```

**When to Use pdfmake:**
- RFQs with dynamic item tables
- Invoices with standardized layout
- Reports with charts/data visualization
- No custom template import needed

**Integration:**
- For lightweight, synchronous PDF generation in tRPC routes (safe for small docs)
- Can run in-process or queue if generation is slow

---

## 2. Document Template Parsing & Field Mapping

### Recommended Stack

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **docxtemplater** | 3.68.1 | DOCX/XLSX template merging with field substitution | Industry standard; handles loops, conditions, images |
| **officeparser** | 6.0.4 | Analyze uploaded templates; extract available fields | Produces AST; detects `{placeholders}` safely |

### Workflow

**Step 1: Upload Template**
```
User uploads template.docx / template.xlsx
  ↓
officeparser.parseFile() → extract structure & text
  ↓
Find all `{fieldName}` placeholders
  ↓
Store template + schema in MinIO + DB:
{
  templateId: "uuid",
  filename: "proposal-template.docx",
  requiredFields: ["projectName", "clientName", "totalCost"],
  optionalFields: ["discount", "notes"],
  format: "docx"
}
```

**Step 2: Validate & Display**
```
Frontend shows: "This template requires: projectName, clientName, totalCost"
User maps their data model to template fields
```

**Step 3: Generate Document**
```
docxtemplater.renderFile(
  template,
  {
    projectName: "Oak Street Renovation",
    clientName: "John Smith",
    totalCost: 125000,
    items: [
      { description: "Framing", cost: 45000 },
      { description: "Electrical", cost: 35000 }
    ]
  }
) → output.docx / output.xlsx
```

### Implementation Details

**officeparser Usage:**
```typescript
import officeparser from 'officeparser';

async function analyzeTemplate(file: File): Promise<TemplateSchema> {
  const data = await officeparser.parseBuffer(file.arrayBuffer());

  // Extract all text content
  const allText = data.toString();

  // Find placeholders via regex
  const fieldMatches = allText.matchAll(/\{(\w+)\}/g);
  const fields = Array.from(fieldMatches).map(m => m[1]);

  return {
    allFields: Array.from(new Set(fields)),
    content: data
  };
}
```

**docxtemplater Usage:**
```typescript
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

async function renderTemplate(
  templateBuffer: Buffer,
  data: Record<string, any>
): Promise<Buffer> {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    modules: [new XlsxModule()] // For Excel support
  });

  doc.render(data);
  return doc.getZip().generateAsync({ type: 'arraybuffer' });
}
```

### NOT Recommended

| Avoid | Reason |
|-------|--------|
| `xlsx-populate` alone | Older; docxtemplater covers DOCX + XLSX + PPTX |
| Manual regex field replacement | Loses formatting, doesn't handle nested loops |
| Simple string interpolation | Fragile; doesn't preserve document structure |

---

## 3. Email Sending (Custom Domain, No ESP)

### Recommendation: Nodemailer (v8.0.1)

**Purpose:** Send PDFs/documents via email to clients/team using custom domain SMTP

**Why:**
- Zero runtime dependencies
- Full SMTP protocol support (TLS, STARTTLS, DKIM)
- Works with any SMTP server (self-hosted, mail host, corporate mail)
- Supports attachments, HTML templates, retries
- Meets requirement: no third-party ESP (SendGrid, Mailgun, etc.)

### Configuration

**Environment Variables:**
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false  # true if port 465, false for 587 with STARTTLS
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=BIDAXIOM
```

**Setup:**
```typescript
// apps/api/src/services/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

export async function sendDocumentEmail(
  to: string,
  subject: string,
  pdfBuffer: Buffer,
  filename: string
) {
  return transporter.sendMail({
    from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html: '<p>Your document is attached.</p>',
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
}
```

### Integration with BullMQ (Recommended)

**Don't** send emails synchronously in tRPC routes. Queue them:

```typescript
// Queue in BullMQ for retries & monitoring
const emailQueue = new Queue('email', { connection: redis });

emailQueue.process(async (job) => {
  const { to, subject, pdfBuffer, filename } = job.data;

  try {
    await sendDocumentEmail(to, subject, pdfBuffer, filename);
    return { sent: true, timestamp: new Date() };
  } catch (error) {
    // Auto-retries via BullMQ config
    throw error;
  }
});

// tRPC mutation
export const sendProposalByEmail = protectedProcedure
  .input(z.object({ projectId: z.string(), recipientEmail: z.string().email() }))
  .mutation(async ({ ctx, input }) => {
    const pdf = await generateProposal(input.projectId);
    const job = await emailQueue.add({
      to: input.recipientEmail,
      subject: `Proposal - Project ${input.projectId}`,
      pdfBuffer: pdf,
      filename: `proposal-${input.projectId}.pdf`
    });
    return { jobId: job.id, status: 'queued' };
  });
```

### NOT Recommended

| Avoid | Reason |
|-------|--------|
| SendGrid, Mailgun, AWS SES | Violates "custom domain, no ESP" requirement |
| Building custom SMTP server | Operational complexity; Nodemailer abstracts this |
| Synchronous email in tRPC routes | Blocks requests if mail server is slow; no retry logic |

---

## 4. State Machine (9-State Project Lifecycle)

### Decision: Simple Enum + Transition Table (v1.5)

**Verdict:** For v1.5, simple TypeScript enum + transition table is **sufficient and recommended**. XState can be added in v2 if state complexity grows (parallel states, guards, actions).

**Rationale:**

The 9-state lifecycle (Draft → Proposal → Change Order → In Progress → Approval → Payment → Lien → Close → Archived) is mostly **linear** with limited branching. A state machine library adds complexity overhead not yet needed.

### Implementation

**Schema Definition (Drizzle):**
```typescript
// packages/shared/src/schema/project.ts
export const PROJECT_STATUSES = {
  DRAFT: 'draft',
  PROPOSAL: 'proposal',
  CHANGE_ORDER: 'change_order',
  IN_PROGRESS: 'in_progress',
  APPROVAL: 'approval',
  PAYMENT: 'payment',
  LIEN: 'lien',
  CLOSED: 'closed',
  ARCHIVED: 'archived'
} as const;

export type ProjectStatus = typeof PROJECT_STATUSES[keyof typeof PROJECT_STATUSES];

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey(),
  status: varchar('status')
    .notNull()
    .default(PROJECT_STATUSES.DRAFT)
    .$type<ProjectStatus>(),
  createdAt: timestamp('created_at').defaultNow()
});
```

**Transition Logic:**
```typescript
// packages/shared/src/lib/project-state-machine.ts
export const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: [PROJECT_STATUSES.PROPOSAL, PROJECT_STATUSES.ARCHIVED],
  proposal: [PROJECT_STATUSES.CHANGE_ORDER, PROJECT_STATUSES.IN_PROGRESS, PROJECT_STATUSES.DRAFT],
  change_order: [PROJECT_STATUSES.PROPOSAL, PROJECT_STATUSES.IN_PROGRESS],
  in_progress: [PROJECT_STATUSES.APPROVAL],
  approval: [PROJECT_STATUSES.PAYMENT, PROJECT_STATUSES.IN_PROGRESS],
  payment: [PROJECT_STATUSES.LIEN, PROJECT_STATUSES.CLOSED],
  lien: [PROJECT_STATUSES.CLOSED],
  closed: [PROJECT_STATUSES.ARCHIVED],
  archived: []
};

export function canTransition(
  from: ProjectStatus,
  to: ProjectStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAvailableTransitions(status: ProjectStatus): ProjectStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
```

**tRPC Integration:**
```typescript
export const updateProjectStatus = protectedProcedure
  .input(
    z.object({
      projectId: z.string().uuid(),
      newStatus: z.enum([
        'draft', 'proposal', 'change_order', 'in_progress',
        'approval', 'payment', 'lien', 'closed', 'archived'
      ])
    })
  )
  .mutation(async ({ ctx, input }) => {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId)
    });

    if (!project) throw new Error('Project not found');

    if (!canTransition(project.status, input.newStatus)) {
      throw new Error(
        `Cannot transition from ${project.status} to ${input.newStatus}`
      );
    }

    const updated = await db
      .update(projects)
      .set({ status: input.newStatus })
      .where(eq(projects.id, input.projectId))
      .returning();

    return updated[0];
  });
```

### When to Consider XState (v2+)

**Upgrade to XState v5.28.0 if:**
- Approval workflow needs parallel states (CSI approval + Owner approval simultaneously)
- Complex guards emerge ("can only close if budget reconciled AND all RFIs resolved")
- Visual state diagram needed for documentation/debugging
- Multiple teams managing different state paths

**Example (future):**
```typescript
import { createMachine, interpret } from 'xstate';

const projectMachine = createMachine({
  id: 'project',
  initial: 'draft',
  states: {
    draft: {
      on: {
        SUBMIT_PROPOSAL: 'proposal',
        ARCHIVE: 'archived'
      }
    },
    approval: {
      type: 'parallel',
      states: {
        csiReview: {
          initial: 'pending',
          states: {
            pending: { on: { APPROVE: 'approved' } },
            approved: {}
          }
        },
        ownerReview: {
          initial: 'pending',
          states: {
            pending: { on: { APPROVE: 'approved' } },
            approved: {}
          }
        }
      },
      on: {
        BOTH_APPROVED: 'payment'
      }
    }
    // ... other states
  }
});
```

For v1.5, **don't add XState.** The cost/benefit isn't justified yet.

---

## 5. Background Job Queue (Async PDF, Email, Reports)

### Recommendation: BullMQ (v5.67.3) + Redis

**Purpose:** Queue async work (PDF generation, email delivery, batch exports) with persistence, retries, monitoring

**Why:**
- Leverages existing Redis (already in stack)
- Modern TypeScript-first implementation (Bull is deprecated)
- Production-ready: used by millions of jobs globally
- Built-in monitoring via @bull-board/fastify dashboard
- Supports delayed jobs, rate limiting, priorities, retries

### Architecture

**Queue Definition:**
```typescript
// apps/api/src/queues/index.ts
import { Queue, Worker } from 'bullmq';
import redis from './redis';

// PDF Generation Queue
export const pdfQueue = new Queue('pdf-generation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Email Queue
export const emailQueue = new Queue('email', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Export Queue (large Excel/CSV generation)
export const exportQueue = new Queue('export', {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    timeout: 300000 // 5 minutes
  }
});
```

**Workers (separate process or thread):**
```typescript
// apps/api/src/workers/pdf-generation-worker.ts
import { Worker } from 'bullmq';
import redis from './redis';
import { generatePDFFromTemplate } from '../services/pdf-generation';

const pdfWorker = new Worker(
  'pdf-generation',
  async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);

    const { templateId, data, projectId } = job.data;

    // Report progress
    job.progress(25);

    const pdf = await generatePDFFromTemplate(templateId, data);

    job.progress(75);

    // Store in MinIO
    const key = `proposals/${projectId}/${Date.now()}.pdf`;
    await uploadToMinIO(key, pdf);

    job.progress(100);

    return {
      stored: true,
      minioKey: key,
      size: pdf.length
    };
  },
  {
    connection: redis,
    concurrency: 2 // Limit concurrent PDF generations (Puppeteer is memory-intensive)
  }
);

pdfWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

pdfWorker.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed: ${error.message}`);
});
```

**tRPC Integration (Queuing):**
```typescript
export const generateProposalAsync = protectedProcedure
  .input(
    z.object({
      projectId: z.string().uuid(),
      templateId: z.string().uuid(),
      data: z.record(z.any())
    })
  )
  .mutation(async ({ ctx, input }) => {
    const job = await pdfQueue.add(
      'render-proposal',
      {
        templateId: input.templateId,
        data: input.data,
        projectId: input.projectId
      },
      {
        jobId: `proposal-${input.projectId}-${Date.now()}`,
        priority: 10 // High priority
      }
    );

    return {
      jobId: job.id,
      status: 'queued',
      progress: 0
    };
  });

// Client polls progress
export const getJobStatus = protectedProcedure
  .input(z.object({ jobId: z.string() }))
  .query(async ({ input }) => {
    const job = await pdfQueue.getJob(input.jobId);

    if (!job) {
      return { status: 'not-found' };
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      status: state,
      progress,
      result: job.returnvalue
    };
  });
```

### Dashboard Monitoring

**Install:**
```bash
npm install @bull-board/api @bull-board/fastify
```

**Register in Fastify:**
```typescript
// apps/api/src/server.ts
import { createBullBoard } from '@bull-board/api';
import { FastifyAdapter } from '@bull-board/fastify';
import { pdfQueue, emailQueue, exportQueue } from './queues';

const bullBoard = createBullBoard({
  queues: [pdfQueue, emailQueue, exportQueue]
});

const adapter = new FastifyAdapter();
bullBoard.setAdapter(adapter);

fastify.register(adapter.register, {
  basePath: '/admin/queues'
});

// Access at: http://localhost:3001/admin/queues
```

### NOT Recommended

| Avoid | Reason |
|-------|--------|
| Bull (legacy) | Maintained in maintenance mode; BullMQ is the successor |
| Node.js `worker_threads` directly | No persistence, no monitoring, harder to scale |
| Synchronous PDF/email in tRPC | Blocks requests, timeouts, no retry logic |
| Separate job queue technology (RabbitMQ, etc.) | Unnecessary; Redis already in stack |

---

## Installation & Environment Setup

### Core Dependencies

```bash
# PDF generation
npm install puppeteer@24.37.3 pdfmake@0.3.4

# Document template handling
npm install docxtemplater@3.68.1 officeparser@6.0.4

# Email
npm install nodemailer@8.0.1

# Job queue (requires existing Redis)
npm install bullmq@5.67.3 @bull-board/api @bull-board/fastify
```

### Dev Dependencies

```bash
npm install -D @types/nodemailer
```

### Environment Variables

Create `.env.local`:

```env
# SMTP (custom domain email)
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=BIDAXIOM

# Redis (for BullMQ, existing)
REDIS_URL=redis://localhost:6379

# MinIO (existing)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=documents
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     BIDAXIOM v1.5 Architecture                  │
└─────────────────────────────────────────────────────────────────┘

User Action
  ↓
Fastify + tRPC Router
  ├─→ [Generate Proposal Button]
  │      └→ generateProposalAsync() mutation
  │         └→ pdfQueue.add({ templateId, data })
  │            └→ Return jobId to client
  │
  ├─→ [Send via Email Button]
  │      └→ sendDocumentByEmail() mutation
  │         └→ emailQueue.add({ recipientEmail, pdfBuffer })
  │            └→ Return jobId to client
  │
  ├─→ [Upload Template Button]
  │      └→ uploadTemplate() mutation
  │         └→ officeparser.parse() → extract fields
  │            └→ Store in MinIO + DB
  │
  ├─→ [Change Project Status Button]
  │      └→ updateProjectStatus() mutation
  │         └→ canTransition() validation
  │            └→ Update Drizzle schema
  │
  └─→ [Poll Job Status]
         └→ getJobStatus() query
            └→ Return { status, progress, result }

Async Workers (separate Node.js processes)
  ├─→ PDF Generation Worker
  │      pdfQueue → Puppeteer OR pdfmake
  │      → MinIO storage
  │      → Update job result
  │
  ├─→ Email Worker
  │      emailQueue → Nodemailer (SMTP)
  │      → Retry on failure (exponential backoff)
  │      → Update job result
  │
  └─→ Export Worker
         exportQueue → pdfmake/Excel generation
         → MinIO storage

Monitoring
  └─→ Bull Board Dashboard
         @bull-board/fastify
         /admin/queues → View queues, jobs, retries
```

---

## Integration Points with Existing Stack

### With Next.js 14 (apps/web)

**No changes needed.** tRPC calls are unchanged:
- `client.generateProposalAsync.mutate()` → mutation
- `client.getJobStatus.query()` → polling

### With Fastify (apps/api)

**Add job queues to Fastify server startup:**
```typescript
// apps/api/src/main.ts
import { fastify } from './server';
import { startWorkers } from './workers';

async function start() {
  await fastify.listen({ port: 3001 });
  await startWorkers(); // Start PDF, Email, Export workers
  console.log('Workers started');
}

start().catch(console.error);
```

### With Drizzle ORM (PostgreSQL)

**Add status column to projects table:**
```typescript
export const projects = pgTable('projects', {
  // ... existing columns
  status: varchar('status')
    .notNull()
    .default('draft')
    .$type<ProjectStatus>()
});
```

**Add templates table:**
```typescript
export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name').notNull(),
  format: varchar('format').notNull(), // 'docx', 'xlsx', 'pdf'
  minioKey: varchar('minio_key').notNull(),
  requiredFields: jsonb('required_fields').notNull(), // ['projectName', 'clientName']
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

### With Redis (Existing)

**No configuration changes needed.** BullMQ connects directly to existing Redis:
```typescript
import redis from 'redis';

const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

// Pass to BullMQ
const pdfQueue = new Queue('pdf-generation', {
  connection: redisClient
});
```

### With MinIO (Existing)

**PDFs stored in new prefix:**
```
documents/
├─ proposals/
│  └─ {projectId}/{timestamp}.pdf
├─ change-orders/
│  └─ {projectId}/{timestamp}.pdf
└─ templates/
   └─ {templateId}.docx
```

---

## What NOT to Add

| Technology | Reason | Use Instead |
|-----------|--------|------------|
| **React-PDF** | Client-side only; requires separate server wrapper | Puppeteer (server-side) |
| **PDFKit alone** | Low-level API; tedious for complex layouts | Puppeteer + pdfmake |
| **XState (v1.5)** | Overkill for linear 9-state lifecycle | Simple enum + transition table |
| **Bull (legacy)** | Deprecated; maintenance mode only | BullMQ (successor) |
| **SendGrid/Mailgun** | Violates "custom domain, no ESP" requirement | Nodemailer (self-hosted SMTP) |
| **Custom SMTP server** | Operational complexity | Nodemailer (abstracts protocol) |
| **Manual docx/xlsx parsing** | Fragile; loses formatting | docxtemplater + officeparser |
| **Node.js worker_threads** | No persistence, no monitoring, no scaling | BullMQ (Redis-backed) |
| **Puppeteer on every request** | Memory leak; blocks event loop | BullMQ queue + worker pool |

---

## Migration Path (No Breaking Changes)

### Phase 1: Infrastructure Setup (Week 1)
- Install BullMQ + @bull-board/fastify
- Configure SMTP credentials in .env
- Add job queue dashboard to Fastify
- **No user-facing changes yet**

### Phase 2: Template System (Week 2)
- Add `templates` table to Drizzle schema
- Implement `uploadTemplate()` tRPC mutation (officeparser)
- Test field extraction from sample .docx/.xlsx files

### Phase 3: PDF Generation (Week 3)
- Implement Puppeteer-based custom template rendering
- Implement pdfmake-based auto-generated RFQs
- Queue generation in BullMQ
- Add progress polling tRPC query
- **User feature: "Generate Proposal" button with async progress**

### Phase 4: Email Delivery (Week 4)
- Integrate Nodemailer with SMTP config
- Queue email delivery in BullMQ
- Implement email retry logic
- **User feature: "Send via Email" button**

### Phase 5: State Machine (Week 5)
- Add `status` column to projects table
- Implement transition validation
- Update tRPC `updateProjectStatus()` mutation
- **User feature: "Change Project Status" dropdown with validation**

### Phase 6: Monitoring & Polish (Week 6)
- Fine-tune BullMQ concurrency for Puppeteer (set to 2-3)
- Test failure scenarios (SMTP down, disk full, etc.)
- Monitor Bull Board dashboard for job queues
- Document state transitions in UI

---

## Version Compatibility

| Package | Version | Node.js | TypeScript | Notes |
|---------|---------|---------|-----------|-------|
| Puppeteer | 24.37.3 | 16+ | 4.5+ | Latest; full type safety |
| pdfmake | 0.3.4 | 12+ | 3.0+ | Stable; not beta |
| docxtemplater | 3.68.1 | 12+ | 3.0+ | Active maintenance; 208 projects use it |
| officeparser | 6.0.4 | 12+ | 3.0+ | Latest AST output (Dec 2025) |
| Nodemailer | 8.0.1 | 6+ | 3.0+ | No breaking changes; stable API |
| BullMQ | 5.67.3 | 14+ | 4.5+ | TypeScript-first; actively maintained |
| @bull-board/fastify | latest | 14+ | 4.5+ | Depends on Fastify 5+ |

---

## Sources

**PDF Generation:**
- [Puppeteer Official Documentation](https://pptr.dev/)
- [Puppeteer GitHub Releases](https://github.com/puppeteer/puppeteer/releases)
- [RisingStack: Puppeteer HTML to PDF Generation](https://blog.risingstack.com/pdf-from-html-node-js-puppeteer/)
- [LogRocket: Best HTML to PDF libraries for Node.js](https://blog.logrocket.com/best-html-pdf-libraries-node-js/)
- [Nutrient: Top JS PDF Libraries 2025](https://www.nutrient.io/blog/top-js-pdf-libraries/)
- [PDFMake Official Documentation](https://pdfmake.github.io/docs/0.1/getting-started/server-side/supported-nodejs-versions/)

**Document Parsing & Templates:**
- [OfficeParser GitHub](https://github.com/harshankur/officeParser)
- [OfficeParser Releases](https://github.com/harshankur/officeParser/releases)
- [Docxtemplater Official](https://docxtemplater.com/)
- [Docxtemplater Get Started](https://docxtemplater.com/docs/get-started-node/)
- [Docxtemplater XLSX Module](https://docxtemplater.com/modules/xlsx/)

**Email Sending:**
- [Nodemailer Official](https://nodemailer.com/)
- [Nodemailer SMTP Transport](https://nodemailer.com/smtp)
- [Nodemailer GitHub](https://github.com/nodemailer/nodemailer)

**Job Queue:**
- [BullMQ Official Documentation](https://docs.bullmq.io/)
- [BullMQ GitHub](https://github.com/taskforcesh/bullmq)
- [BullMQ Releases](https://github.com/taskforcesh/bullmq/releases)
- [Bull Board API](https://www.npmjs.com/package/@bull-board/api)
- [Bull Board Fastify Adapter](https://www.npmjs.com/package/@bull-board/fastify)

**State Machine:**
- [XState Official](https://xstate.js.org/)
- [XState GitHub](https://github.com/statelyai/xstate)
- [Kent C. Dodds: Implementing Simple State Machines](https://kentcdodds.com/blog/implementing-a-simple-state-machine-library-in-javascript/)
- [Kyle Shevlin: Guidelines for State Machines & XState](https://kyleshevlin.com/guidelines-for-state-machines-and-xstate/)

**Integration:**
- [tRPC Fastify Adapter](https://trpc.io/docs/server/adapters/fastify)
- [Fastify Routes Documentation](https://fastify.dev/docs/latest/Reference/Routes/)

---

**Stack Research for:** v1.5 Project Lifecycle Redesign & Document Engine
**Researched:** February 18, 2026
**Next Step:** Feed into roadmap creation (phase structure, technology dependencies)
