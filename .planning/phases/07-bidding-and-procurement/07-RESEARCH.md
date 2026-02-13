# Phase 7: Bidding & Procurement - Research

**Researched:** 2026-02-12
**Domain:** Construction RFQ management, bid submission, procurement workflows, and subcontractor directory
**Confidence:** MEDIUM-HIGH

## Summary

Phase 7 implements the bidding and procurement foundation that enables general contractors to issue RFQs to subcontractors and manage the complete bid lifecycle from invitation through award and budget commitment conversion. Users must be able to create RFQs with detailed scope descriptions, issue invitations to both in-platform subcontractors and external vendors via email, receive and version bid submissions, compare bids side-by-side with scope leveling capabilities, maintain a searchable subcontractor directory with trade associations and past bid history, handle RFQ amendments with immutable audit trails, and convert awarded bids into budget commitments that integrate with Phase 4's cost tracking.

The implementation presents five key challenges: (1) external email invitations must allow guest access for non-platform subcontractors to submit bids without full account creation, (2) RFQ amendments must maintain immutable originals while tracking change history to prevent bid manipulation, (3) bid submissions must snapshot the RFQ state at submission time and notify bidders of upstream RFQ changes, (4) side-by-side bid comparison requires scope leveling to ensure apples-to-apples comparisons when line items differ, and (5) awarded bid conversion to commitments must preserve bid data while transitioning to execution phase. Research indicates that construction procurement follows industry-standard patterns of RFQ versioning with addenda, bid leveling for fair comparison, and prequalification-based vendor directories.

**Primary recommendation:** Use versioned RFQ tables with effective dating (similar to Phase 2 company config), implement guest user access with email-based magic link invitations for external bidders, store bid submissions as immutable snapshots with upstream change notifications via JSONB diff tracking, build bid comparison tables with flexible line item mapping for scope leveling, maintain a subcontractor directory with trade associations and qualification metadata, and implement one-click bid-to-commitment conversion that creates Phase 4 commitments from awarded bids while preserving the original bid record.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Current (0.45.1+) | RFQ schema, bid storage, subcontractor directory, versioning | Already in use; excellent PostgreSQL support with JSONB for flexible bid data |
| tRPC | Current (11.10.0+) | Type-safe RFQ CRUD, bid submission, award workflows | Already in use; end-to-end type safety with React Query integration |
| CASL | Current (6.8.0+) | RFQ access control, bid visibility permissions | Already in use; supports entity-level permissions for multi-company scenarios |
| Zod | Current (3.25.76+) | RFQ creation validation, bid submission schemas | Already in use; runtime validation with TypeScript inference |
| Nodemailer | ^6.x | Email invitations to external bidders | Industry standard for Node.js email sending; supports templates and attachments |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-email/components | ^0.0.x | React-based email templates | Professional RFQ invitation emails with consistent branding |
| Resend or SendGrid | API service | Transactional email delivery | Production email sending with deliverability tracking |
| React Table | ^8.x (TanStack Table) | Bid comparison tables with sorting, filtering | Already in use; powerful data table with column flexibility |
| date-fns | ^3.x | RFQ deadline calculations, bid submission timestamps | Already in use from Phase 3; lightweight date manipulation |
| fast-json-patch | ^3.x | RFQ change detection, upstream diff notifications | JSON Patch RFC 6902 standard for tracking document changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Magic link guest access | OAuth provider guest accounts (Google, Microsoft) | OAuth requires external account; magic links work with email-only |
| Versioned RFQ table | Separate amendments table | Amendments table is more normalized but complicates point-in-time queries |
| React Table | Custom data table, AG Grid | React Table is flexible and free; AG Grid has more features but costs for commercial use |
| fast-json-patch | Manual diff calculation | JSON Patch is RFC standard; manual diff is error-prone |
| Email invitations | In-platform notifications only | Email reaches external subs; in-platform limits network effects |

**Installation:**
```bash
# New dependencies for Phase 7
pnpm add nodemailer @react-email/components fast-json-patch
pnpm add -D @types/nodemailer

# Production email service (choose one)
pnpm add resend  # or @sendgrid/mail
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── db/schema/
│   └── tenant.ts              # Add rfqs, rfq_invitations, bids, bid_line_items, subcontractor_directory
├── trpc/routers/
│   ├── rfq.ts                 # RFQ CRUD, versioning, amendments, award
│   ├── bid.ts                 # Bid submission, revision, withdrawal
│   └── subcontractor.ts       # Directory management, qualification tracking
├── email/
│   ├── client.ts              # Email service client (Nodemailer + Resend/SendGrid)
│   ├── templates/
│   │   ├── rfq-invitation.tsx # React Email template for RFQ invitations
│   │   └── rfq-amendment.tsx  # Amendment notification template
│   └── send-invitation.ts     # RFQ invitation workflow
├── auth/
│   ├── abilities.ts           # UPDATED: Add RFQ and bid permissions
│   └── guest-token.ts         # Magic link token generation for external bidders
└── procurement/
    ├── scope-leveling.ts      # Bid line item comparison and normalization
    ├── award.ts               # Award workflow and commitment conversion
    └── amendments.ts          # RFQ amendment tracking and notification

apps/web/app/(dashboard)/
├── projects/
│   └── [projectId]/
│       └── procurement/
│           ├── rfqs/
│           │   ├── page.tsx           # RFQ list
│           │   ├── new/
│           │   │   └── page.tsx       # RFQ creation wizard
│           │   └── [rfqId]/
│           │       ├── page.tsx       # RFQ detail with bids
│           │       ├── edit/
│           │       │   └── page.tsx   # RFQ editing (creates amendment)
│           │       ├── compare/
│           │       │   └── page.tsx   # Bid comparison table with leveling
│           │       └── award/
│           │           └── page.tsx   # Award workflow
│           └── subcontractors/
│               ├── page.tsx           # Subcontractor directory
│               └── [subId]/
│                   └── page.tsx       # Subcontractor profile with bid history
└── (guest)/
    └── bid/
        └── [token]/
            └── page.tsx               # Guest bid submission page

apps/web/components/
└── procurement/
    ├── rfq-form.tsx           # RFQ creation/editing form
    ├── bid-submission-form.tsx # Bid submission with line items
    ├── bid-comparison-table.tsx # Side-by-side comparison with scope leveling
    ├── invitation-modal.tsx   # Select bidders from directory + external emails
    └── subcontractor-card.tsx # Directory entry with trades and past performance
```

### Pattern 1: Versioned RFQs with Immutable Amendments
**What:** Store RFQ versions with effective dating (similar to Phase 2 company profiles) where amendments create new versions while preserving original. Each bid submission snapshots the RFQ version it responded to.

**When to use:** All RFQ lifecycle management to maintain audit trail and prevent post-bid manipulation.

**Example:**
```typescript
// apps/api/src/db/schema/tenant.ts
export function createTenantSchema(schemaName: string) {
  const schema = pgSchema(schemaName);

  /**
   * RFQs (Request for Quotation) with versioning
   * Each amendment creates a new version; bids reference specific versions
   */
  const rfqs = schema.table("rfqs", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    rfqNumber: text("rfq_number").notNull(), // e.g., "RFQ-2026-001"
    title: text("title").notNull(),
    description: text("description"), // Detailed scope of work
    scopeOfWork: jsonb("scope_of_work").$type<{
      lineItems: Array<{
        id: string;
        description: string;
        quantity?: number;
        unit?: string;
        notes?: string;
      }>;
    }>(),
    csiDivisions: jsonb("csi_divisions").notNull().default([]).$type<number[]>(), // Trade filtering
    bidDeadline: timestamp("bid_deadline", { withTimezone: true }).notNull(),

    // Versioning fields (effective dating pattern)
    versionNumber: integer("version_number").notNull().default(1),
    isOriginal: boolean("is_original").notNull().default(true), // First version
    amendmentNotes: text("amendment_notes"), // Why this amendment was made
    validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }), // NULL = current version

    // Status tracking
    status: text("status").notNull().default("draft"), // draft, issued, closed, cancelled, awarded
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * RFQ invitations to subcontractors
   * Tracks who was invited (internal or external) and their response status
   */
  const rfqInvitations = schema.table("rfq_invitations", {
    id: uuid("id").primaryKey().defaultRandom(),
    rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),

    // Internal or external bidder
    subcontractorId: uuid("subcontractor_id").references(() => subcontractorDirectory.id, { onDelete: "set null" }),
    externalEmail: text("external_email"), // For non-platform subs
    externalCompanyName: text("external_company_name"),

    // Guest access for external bidders
    guestToken: text("guest_token").unique(), // Magic link token
    guestTokenExpiresAt: timestamp("guest_token_expires_at", { withTimezone: true }),

    // Response tracking
    status: text("status").notNull().default("sent"), // sent, viewed, bid_submitted, declined, expired
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    declineReason: text("decline_reason"),

    invitedBy: text("invited_by").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Bid submissions
   * Immutable snapshots of bid data referencing specific RFQ version
   */
  const bids = schema.table("bids", {
    id: uuid("id").primaryKey().defaultRandom(),
    rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),
    rfqVersionNumber: integer("rfq_version_number").notNull(), // Which RFQ version this bid responds to
    invitationId: uuid("invitation_id").notNull().references(() => rfqInvitations.id, { onDelete: "cascade" }),

    // Bidder identification
    subcontractorId: uuid("subcontractor_id").references(() => subcontractorDirectory.id, { onDelete: "set null" }),
    companyName: text("company_name").notNull(), // Stored for external bidders
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),

    // Bid snapshot data
    rfqSnapshot: jsonb("rfq_snapshot").notNull().$type<{
      title: string;
      description: string;
      scopeOfWork: unknown;
      bidDeadline: string;
    }>(), // Immutable copy of RFQ at time of submission

    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"), // Cover letter, exclusions, assumptions
    attachments: jsonb("attachments").default([]).$type<Array<{
      fileName: string;
      storageKey: string;
      uploadedAt: string;
    }>>(),

    // Versioning for bid revisions (if allowed before deadline)
    revisionNumber: integer("revision_number").notNull().default(1),
    supersededBy: uuid("superseded_by").references(() => bids.id),

    // Status
    status: text("status").notNull().default("submitted"), // submitted, withdrawn, under_review, awarded, rejected
    awardedAt: timestamp("awarded_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),

    // Upstream change notification
    upstreamChangesNotified: boolean("upstream_changes_notified").notNull().default(false),
    upstreamChangesSummary: jsonb("upstream_changes_summary").$type<Array<{
      amendmentVersion: number;
      amendmentDate: string;
      changeDescription: string;
    }>>(),

    submittedBy: text("submitted_by").notNull(), // User ID or "guest:{email}"
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Bid line items for detailed scope breakdown
   * Enables bid leveling and line-by-line comparison
   */
  const bidLineItems = schema.table("bid_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    bidId: uuid("bid_id").notNull().references(() => bids.id, { onDelete: "cascade" }),
    rfqLineItemId: text("rfq_line_item_id"), // References RFQ scope_of_work lineItems[].id
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 4 }),
    unit: text("unit"),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
    orderIndex: integer("order_index").notNull(), // Display order
  });

  /**
   * Subcontractor directory
   * Company's qualified vendor list with trade associations
   */
  const subcontractorDirectory = schema.table("subcontractor_directory", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),

    // Contact information
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    address: text("address"),
    website: text("website"),

    // Trade associations (CSI divisions)
    csiDivisions: jsonb("csi_divisions").notNull().default([]).$type<number[]>(),
    customTrades: jsonb("custom_trades").default([]).$type<string[]>(), // References company customTrades

    // Qualification metadata
    isPrequalified: boolean("is_prequalified").notNull().default(false),
    prequalifiedAt: timestamp("prequalified_at", { withTimezone: true }),
    qualificationNotes: text("qualification_notes"),
    insuranceCertificate: text("insurance_certificate"), // Storage key
    bondingCapacity: numeric("bonding_capacity", { precision: 15, scale: 2 }),

    // Performance tracking
    totalBidsReceived: integer("total_bids_received").notNull().default(0),
    totalBidsAwarded: integer("total_bids_awarded").notNull().default(0),
    lastBidDate: timestamp("last_bid_date", { withTimezone: true }),

    // Platform connection
    linkedCompanyId: text("linked_company_id"), // Clerk org ID if they're on platform

    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  return {
    schema,
    // ... existing tables
    rfqs,
    rfqInvitations,
    bids,
    bidLineItems,
    subcontractorDirectory,
  };
}
```

**Source:** Construction industry RFQ management patterns from [Procore Bid Leveling](https://www.procore.com/library/construction-bid-leveling), [Addendum Workflow](https://truebiddata.com/blog/addendum-construction-estimating-changes/)

### Pattern 2: Guest Access with Magic Link Invitations
**What:** Allow external subcontractors (not on platform) to submit bids via email invitation with time-limited magic link tokens. No full account creation required for one-time bid submission.

**When to use:** RFQ invitations to external vendors to maximize bid pool and network effects.

**Example:**
```typescript
// apps/api/src/auth/guest-token.ts
import { randomBytes } from "crypto";
import { addHours } from "date-fns";

export function generateGuestToken(): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = addHours(new Date(), 72); // 72-hour expiration
  return { token, expiresAt };
}

// apps/api/src/trpc/routers/rfq.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { sendRFQInvitation } from "../../email/send-invitation.js";

export const rfqRouter = router({
  sendInvitations: protectedProcedure
    .input(z.object({
      rfqId: z.string().uuid(),
      subcontractorIds: z.array(z.string().uuid()).default([]), // Internal platform subs
      externalInvites: z.array(z.object({
        email: z.string().email(),
        companyName: z.string().min(1),
        contactName: z.string().min(1),
      })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { rfqId, subcontractorIds, externalInvites } = input;

      // Get RFQ details
      const [rfq] = await ctx.tenant.db
        .select()
        .from(rfqs)
        .where(eq(rfqs.id, rfqId));

      if (!rfq) {
        throw new TRPCError({ code: "NOT_FOUND", message: "RFQ not found" });
      }

      // Verify project access
      ForbiddenError.from(ctx.abilities).throwUnlessCan("update", "Project", {
        projectId: rfq.projectId,
      });

      // Create invitations for internal subs
      for (const subId of subcontractorIds) {
        await ctx.tenant.db.insert(rfqInvitations).values({
          rfqId,
          subcontractorId: subId,
          invitedBy: ctx.userId,
        });

        // Send email notification (internal user flow)
        // ... send to subcontractor's registered email
      }

      // Create invitations for external subs with magic links
      for (const external of externalInvites) {
        const { token, expiresAt } = generateGuestToken();

        const [invitation] = await ctx.tenant.db.insert(rfqInvitations).values({
          rfqId,
          externalEmail: external.email,
          externalCompanyName: external.companyName,
          guestToken: token,
          guestTokenExpiresAt: expiresAt,
          invitedBy: ctx.userId,
        }).returning();

        // Send email with magic link
        const magicLink = `${process.env.APP_URL}/bid/${token}`;
        await sendRFQInvitation({
          to: external.email,
          companyName: external.companyName,
          contactName: external.contactName,
          rfq: {
            number: rfq.rfqNumber,
            title: rfq.title,
            deadline: rfq.bidDeadline,
          },
          magicLink,
        });
      }

      // Audit log
      await ctx.tenant.auditLog({
        entityType: "RFQ",
        entityId: rfqId,
        action: "send_invitations",
        actorId: ctx.userId,
        changes: {
          after: {
            internalCount: subcontractorIds.length,
            externalCount: externalInvites.length,
          },
        },
      });

      return { success: true };
    }),

  // Guest bid submission (no auth required, validates token)
  submitGuestBid: publicProcedure
    .input(z.object({
      guestToken: z.string(),
      bidData: z.object({
        companyName: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email(),
        contactPhone: z.string().optional(),
        totalAmount: z.number().positive(),
        lineItems: z.array(z.object({
          rfqLineItemId: z.string().optional(),
          description: z.string().min(1),
          quantity: z.number().optional(),
          unit: z.string().optional(),
          unitPrice: z.number().optional(),
          totalPrice: z.number().positive(),
        })),
        notes: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify guest token validity
      const [invitation] = await ctx.tenant.db
        .select()
        .from(rfqInvitations)
        .where(eq(rfqInvitations.guestToken, input.guestToken));

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invitation token" });
      }

      if (invitation.guestTokenExpiresAt && invitation.guestTokenExpiresAt < new Date()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invitation link has expired" });
      }

      // Get RFQ to snapshot
      const [rfq] = await ctx.tenant.db
        .select()
        .from(rfqs)
        .where(and(
          eq(rfqs.id, invitation.rfqId),
          isNull(rfqs.validTo) // Current version
        ));

      if (!rfq) {
        throw new TRPCError({ code: "NOT_FOUND", message: "RFQ not found or closed" });
      }

      // Check deadline
      if (rfq.bidDeadline < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bid deadline has passed" });
      }

      // Create bid submission
      const [bid] = await ctx.tenant.db.transaction(async (tx) => {
        const [newBid] = await tx.insert(bids).values({
          rfqId: invitation.rfqId,
          rfqVersionNumber: rfq.versionNumber,
          invitationId: invitation.id,
          companyName: input.bidData.companyName,
          contactName: input.bidData.contactName,
          contactEmail: input.bidData.contactEmail,
          contactPhone: input.bidData.contactPhone,
          totalAmount: input.bidData.totalAmount.toFixed(2),
          notes: input.bidData.notes,
          rfqSnapshot: {
            title: rfq.title,
            description: rfq.description,
            scopeOfWork: rfq.scopeOfWork,
            bidDeadline: rfq.bidDeadline.toISOString(),
          },
          submittedBy: `guest:${input.bidData.contactEmail}`,
        }).returning();

        // Create bid line items
        await tx.insert(bidLineItems).values(
          input.bidData.lineItems.map((item, idx) => ({
            bidId: newBid.id,
            rfqLineItemId: item.rfqLineItemId,
            description: item.description,
            quantity: item.quantity?.toString(),
            unit: item.unit,
            unitPrice: item.unitPrice?.toFixed(2),
            totalPrice: item.totalPrice.toFixed(2),
            orderIndex: idx,
          }))
        );

        // Update invitation status
        await tx.update(rfqInvitations)
          .set({ status: "bid_submitted" })
          .where(eq(rfqInvitations.id, invitation.id));

        return [newBid];
      });

      return { bidId: bid.id };
    }),
});
```

**Source:** Guest access patterns from [Auth0 B2B SaaS Onboarding](https://auth0.com/blog/user-onboarding-strategies-b2b-saas/), [PreconSuite Guest Bidding](https://preconsuite.com/)

### Pattern 3: Bid Snapshot with Upstream Change Notification
**What:** When a bid is submitted, snapshot the current RFQ state. If RFQ is amended after submission, detect changes using JSON diff and notify bidders with option to revise.

**When to use:** All bid submissions to ensure bidders respond to correct scope and are notified of changes.

**Example:**
```typescript
// apps/api/src/procurement/amendments.ts
import { compare } from "fast-json-patch";
import type { TenantSchema } from "../db/schema/tenant.js";

export async function createRFQAmendment(
  rfqId: string,
  amendments: {
    title?: string;
    description?: string;
    scopeOfWork?: unknown;
    bidDeadline?: Date;
    amendmentNotes: string;
  },
  tenantDb: TenantSchema["db"],
  userId: string
): Promise<void> {
  // Get current RFQ version
  const [currentRFQ] = await tenantDb
    .select()
    .from(rfqs)
    .where(and(
      eq(rfqs.id, rfqId),
      isNull(rfqs.validTo)
    ));

  if (!currentRFQ) {
    throw new Error("RFQ not found or closed");
  }

  // Calculate diff for change summary
  const oldDoc = {
    title: currentRFQ.title,
    description: currentRFQ.description,
    scopeOfWork: currentRFQ.scopeOfWork,
    bidDeadline: currentRFQ.bidDeadline.toISOString(),
  };

  const newDoc = {
    title: amendments.title ?? currentRFQ.title,
    description: amendments.description ?? currentRFQ.description,
    scopeOfWork: amendments.scopeOfWork ?? currentRFQ.scopeOfWork,
    bidDeadline: (amendments.bidDeadline ?? currentRFQ.bidDeadline).toISOString(),
  };

  const patch = compare(oldDoc, newDoc);

  if (patch.length === 0) {
    throw new Error("No changes detected");
  }

  const now = new Date();
  const newVersionNumber = currentRFQ.versionNumber + 1;

  await tenantDb.transaction(async (tx) => {
    // Close current version
    await tx.update(rfqs)
      .set({ validTo: now })
      .where(and(
        eq(rfqs.id, rfqId),
        isNull(rfqs.validTo)
      ));

    // Create new version (amendment)
    await tx.insert(rfqs).values({
      projectId: currentRFQ.projectId,
      rfqNumber: currentRFQ.rfqNumber,
      title: amendments.title ?? currentRFQ.title,
      description: amendments.description ?? currentRFQ.description,
      scopeOfWork: amendments.scopeOfWork ?? currentRFQ.scopeOfWork,
      csiDivisions: currentRFQ.csiDivisions,
      bidDeadline: amendments.bidDeadline ?? currentRFQ.bidDeadline,
      versionNumber: newVersionNumber,
      isOriginal: false,
      amendmentNotes: amendments.amendmentNotes,
      validFrom: now,
      validTo: null, // Current version
      status: currentRFQ.status,
      issuedAt: currentRFQ.issuedAt,
      createdBy: userId,
    });

    // Get all submitted bids for this RFQ
    const existingBids = await tx
      .select()
      .from(bids)
      .where(and(
        eq(bids.rfqId, rfqId),
        eq(bids.status, "submitted")
      ));

    // Mark existing bids with upstream change notification
    for (const bid of existingBids) {
      const currentChanges = (bid.upstreamChangesSummary as unknown[]) ?? [];
      await tx.update(bids)
        .set({
          upstreamChangesNotified: true,
          upstreamChangesSummary: [
            ...currentChanges,
            {
              amendmentVersion: newVersionNumber,
              amendmentDate: now.toISOString(),
              changeDescription: amendments.amendmentNotes,
            },
          ],
        })
        .where(eq(bids.id, bid.id));

      // Send email notification to bidder
      // ... notify bidder of changes, option to revise bid
    }
  });
}
```

**Source:** Construction addenda workflow from [Addendum Construction Estimating](https://truebiddata.com/blog/addendum-construction-estimating-changes/), JSON Patch RFC 6902

### Pattern 4: Bid Comparison with Scope Leveling
**What:** Display bids side-by-side in a comparison table with automatic line item mapping. Support manual adjustment when bidders structure scopes differently (scope leveling).

**When to use:** RFQ bid review process to enable fair apples-to-apples comparison.

**Example:**
```typescript
// apps/api/src/procurement/scope-leveling.ts
import type { TenantSchema } from "../db/schema/tenant.js";

interface LeveledBidComparison {
  rfqLineItemId: string;
  rfqDescription: string;
  bids: Record<string, {
    bidId: string;
    bidderName: string;
    lineItemId?: string;
    description?: string;
    quantity?: string;
    unit?: string;
    unitPrice?: string;
    totalPrice?: string;
    notes?: string;
    isManuallyMapped: boolean; // User adjusted mapping
  }>;
}

export async function generateBidComparison(
  rfqId: string,
  bidIds: string[],
  tenantDb: TenantSchema["db"]
): Promise<LeveledBidComparison[]> {
  // Get RFQ scope of work
  const [rfq] = await tenantDb
    .select()
    .from(rfqs)
    .where(and(
      eq(rfqs.id, rfqId),
      isNull(rfqs.validTo)
    ));

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  const scopeOfWork = (rfq.scopeOfWork as { lineItems?: Array<{ id: string; description: string }> }) ?? { lineItems: [] };
  const rfqLineItems = scopeOfWork.lineItems ?? [];

  // Get all bid line items
  const bidLineItemsResult = await tenantDb
    .select({
      bidId: bidLineItems.bidId,
      lineItemId: bidLineItems.id,
      rfqLineItemId: bidLineItems.rfqLineItemId,
      description: bidLineItems.description,
      quantity: bidLineItems.quantity,
      unit: bidLineItems.unit,
      unitPrice: bidLineItems.unitPrice,
      totalPrice: bidLineItems.totalPrice,
      notes: bidLineItems.notes,
      bidderName: bids.companyName,
    })
    .from(bidLineItems)
    .innerJoin(bids, eq(bids.id, bidLineItems.bidId))
    .where(inArray(bidLineItems.bidId, bidIds));

  // Build comparison matrix
  const comparison: LeveledBidComparison[] = rfqLineItems.map((rfqItem) => {
    const row: LeveledBidComparison = {
      rfqLineItemId: rfqItem.id,
      rfqDescription: rfqItem.description,
      bids: {},
    };

    // Match bid line items to RFQ line items
    for (const bidItem of bidLineItemsResult) {
      if (bidItem.rfqLineItemId === rfqItem.id) {
        row.bids[bidItem.bidId] = {
          bidId: bidItem.bidId,
          bidderName: bidItem.bidderName,
          lineItemId: bidItem.lineItemId,
          description: bidItem.description,
          quantity: bidItem.quantity ?? undefined,
          unit: bidItem.unit ?? undefined,
          unitPrice: bidItem.unitPrice ?? undefined,
          totalPrice: bidItem.totalPrice ?? undefined,
          notes: bidItem.notes ?? undefined,
          isManuallyMapped: false,
        };
      }
    }

    return row;
  });

  // Add unmapped bid line items (items bidders added that don't match RFQ)
  const mappedLineItemIds = new Set(
    bidLineItemsResult
      .filter(item => item.rfqLineItemId)
      .map(item => item.lineItemId)
  );

  const unmappedItems = bidLineItemsResult.filter(
    item => !item.rfqLineItemId && !mappedLineItemIds.has(item.lineItemId)
  );

  if (unmappedItems.length > 0) {
    const unmappedRow: LeveledBidComparison = {
      rfqLineItemId: "__unmapped__",
      rfqDescription: "Additional Items (Not in RFQ Scope)",
      bids: {},
    };

    for (const item of unmappedItems) {
      unmappedRow.bids[item.bidId] = {
        bidId: item.bidId,
        bidderName: item.bidderName,
        lineItemId: item.lineItemId,
        description: item.description,
        quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined,
        unitPrice: item.unitPrice ?? undefined,
        totalPrice: item.totalPrice ?? undefined,
        notes: item.notes ?? undefined,
        isManuallyMapped: false,
      };
    }

    comparison.push(unmappedRow);
  }

  return comparison;
}
```

**Source:** Bid leveling concepts from [RIB Bid Leveling](https://www.rib-software.com/en/blogs/construction-bid-leveling), [Procore Bid Leveling](https://www.procore.com/library/construction-bid-leveling)

### Pattern 5: Bid Award to Commitment Conversion
**What:** Convert an awarded bid into a Phase 4 commitment (subcontract) while preserving the original bid record. One-click workflow from procurement to execution.

**When to use:** Award workflow after bid selection to transition to budget tracking.

**Example:**
```typescript
// apps/api/src/procurement/award.ts
import type { TenantSchema } from "../db/schema/tenant.js";

export async function awardBidAndCreateCommitment(
  bidId: string,
  tenantDb: TenantSchema["db"],
  userId: string
): Promise<{ commitmentId: string }> {
  return await tenantDb.transaction(async (tx) => {
    // Get bid details
    const [bid] = await tx
      .select()
      .from(bids)
      .where(eq(bids.id, bidId));

    if (!bid) {
      throw new Error("Bid not found");
    }

    if (bid.status !== "submitted") {
      throw new Error("Only submitted bids can be awarded");
    }

    // Get RFQ to link to project
    const [rfq] = await tx
      .select()
      .from(rfqs)
      .where(eq(rfqs.id, bid.rfqId));

    if (!rfq) {
      throw new Error("RFQ not found");
    }

    // Get bid line items
    const lineItems = await tx
      .select()
      .from(bidLineItems)
      .where(eq(bidLineItems.bidId, bidId));

    // Create commitment (Phase 4 integration)
    const [commitment] = await tx.insert(commitments).values({
      projectId: rfq.projectId,
      type: "subcontract",
      vendorName: bid.companyName,
      contractNumber: `${rfq.rfqNumber}-${bid.companyName.replace(/\s+/g, "")}`,
      description: `Awarded from ${rfq.rfqNumber}: ${rfq.title}`,
      totalAmount: bid.totalAmount,
      status: "pending", // Will be approved separately
      createdBy: userId,
    }).returning();

    // Create commitment line items from bid line items
    await tx.insert(commitmentLineItems).values(
      lineItems.map((item) => ({
        commitmentId: commitment.id,
        budgetLineItemId: null, // Can be mapped later to budget
        costCodeId: 0, // Default; can be updated based on trade
        description: item.description,
        amount: item.totalPrice,
      }))
    );

    // Update bid status to awarded
    await tx.update(bids)
      .set({
        status: "awarded",
        awardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bids.id, bidId));

    // Reject other bids for this RFQ
    await tx.update(bids)
      .set({
        status: "rejected",
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(bids.rfqId, bid.rfqId),
        eq(bids.status, "submitted"),
        not(eq(bids.id, bidId))
      ));

    // Update RFQ status to awarded
    await tx.update(rfqs)
      .set({
        status: "awarded",
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(rfqs.id, bid.rfqId),
        isNull(rfqs.validTo) // Current version only
      ));

    // Audit log
    await tx.insert(auditLogs).values({
      entityType: "Bid",
      entityId: bidId,
      action: "award",
      actorId: userId,
      changes: {
        after: {
          commitmentId: commitment.id,
          status: "awarded",
        },
      },
    });

    return { commitmentId: commitment.id };
  });
}
```

**Source:** Award workflow from [Procore Award Bid](https://support.procore.com/products/online/user-guide/project-level/bidding/tutorials/award-a-winning-bid-and-convert-it-into-a-subcontract)

### Anti-Patterns to Avoid

- **Storing bids without RFQ snapshot:** Bid validity depends on RFQ state at submission time; always snapshot.
- **Allowing RFQ edits without versioning:** Breaks audit trail and creates disputes; use effective dating pattern.
- **Guest access with long-lived tokens:** Security risk; limit magic links to 72 hours or less.
- **Manual bid comparison without scope leveling:** Line items rarely match perfectly; support flexible mapping.
- **Deleting rejected bids:** Audit compliance requires full bid history; mark status instead.
- **Hard-coded email templates:** Use React Email components for maintainable, testable templates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending | Raw SMTP library | Nodemailer + Resend/SendGrid | Deliverability, bounce handling, and reputation management are complex |
| Email templates | String concatenation | React Email components | Type-safe, reusable, testable templates with preview |
| JSON diff detection | Manual object comparison | fast-json-patch (RFC 6902) | Edge cases, array handling, nested objects are error-prone |
| Magic link tokens | Sequential IDs or timestamps | Crypto-random tokens | Predictable tokens are security vulnerabilities |
| Bid comparison tables | Custom grid implementation | React Table (TanStack) | Sorting, filtering, column resizing already implemented |
| Date range validation | Manual date arithmetic | date-fns or dayjs | Timezone handling, edge cases, leap years |

**Key insight:** Construction bidding has standardized workflows (RFQ versioning with addenda, bid leveling, prequalification) that are implemented across all major platforms (Procore, BuildingConnected, PlanHub). Don't invent novel procurement patterns—follow the industry model of immutable RFQs with versioned amendments, guest access for external bidders, and bid-to-commitment conversion.

## Common Pitfalls

### Pitfall 1: Allowing RFQ Modifications Without Versioning
**What goes wrong:** GC edits RFQ after bids are submitted, changing scope or deadline. Bidders' original bids are now invalid, creating disputes about what was included.

**Why it happens:** Developer implements simple UPDATE statement without considering audit trail and fairness requirements.

**How to avoid:**
- Use effective dating pattern (validFrom, validTo) like Phase 2 company config
- Create new RFQ version on every edit after issuance
- Mark bids with rfqVersionNumber to track which version they respond to
- Notify all bidders when amendments are made with option to revise

**Warning signs:**
- RFQ table has UPDATE without INSERT of new version
- No amendment tracking in bid submission
- Bidders complain about scope changes after submission

**Source:** [Addendum Process Best Practices](https://truebiddata.com/blog/addendum-construction-estimating-changes/)

### Pitfall 2: Guest Tokens Without Expiration or Rate Limiting
**What goes wrong:** Magic link tokens never expire or can be used unlimited times, creating security vulnerabilities and spam abuse.

**Why it happens:** Developer focuses on happy path (successful bid submission) without considering security.

**How to avoid:**
- Set token expiration to 72 hours (standard for email-based auth)
- Mark token as used after first successful bid submission
- Implement rate limiting on guest bid submission endpoint (5 attempts per hour per IP)
- Log all guest access attempts for security monitoring

**Warning signs:**
- guestTokenExpiresAt is null or far in future
- No validation of token expiration before allowing submission
- Single email can generate unlimited tokens

**Source:** Security best practices from Auth0, OWASP authentication guidelines

### Pitfall 3: Bid Submissions Without RFQ Snapshot
**What goes wrong:** Bid references RFQ by ID only. If RFQ is later amended or deleted, bid becomes orphaned or validity cannot be determined.

**Why it happens:** Developer normalizes data to avoid duplication, not realizing bids must be immutable snapshots.

**How to avoid:**
- Store rfqSnapshot JSONB in bids table with full RFQ state at submission time
- Include rfqVersionNumber to link back to specific version
- Never allow deletion of RFQ versions that have associated bids
- Display snapshot data in bid review, not live RFQ data

**Warning signs:**
- Bids table has only rfqId FK without snapshot
- Bid validity cannot be determined after RFQ amendment
- "RFQ not found" errors when reviewing historical bids

**Source:** Event sourcing patterns, immutable data best practices

### Pitfall 4: No Scope Leveling Support in Bid Comparison
**What goes wrong:** Bid comparison shows total amounts only. When bidders structure line items differently (different granularity, bundling), GC cannot identify gaps or inclusions.

**Why it happens:** Developer builds simple sum() comparison without understanding construction bid leveling.

**How to avoid:**
- Store bid_line_items with mapping to RFQ scope_of_work lineItems
- Support unmapped line items (bidder added items not in RFQ)
- Build comparison table with rows = RFQ line items, columns = bids
- Allow manual mapping adjustments when auto-match fails
- Highlight missing items (RFQ line with no bid response)

**Warning signs:**
- Bid comparison shows only totalAmount without line item breakdown
- No way to identify scope gaps or exclusions
- Users complain they can't tell if bids are comparable

**Source:** [Bid Leveling Practices](https://www.rib-software.com/en/blogs/construction-bid-leveling), [Procore Bid Leveling](https://www.procore.com/library/construction-bid-leveling)

### Pitfall 5: Awarded Bid Doesn't Create Commitment
**What goes wrong:** GC awards bid but must manually re-enter all data into Phase 4 commitments table. Data entry errors, missed line items, version drift between bid and commitment.

**Why it happens:** Phases developed independently without integration workflow.

**How to avoid:**
- Build one-click award workflow that creates commitment from bid
- Copy bid line items to commitment_line_items automatically
- Link commitment back to original bid (metadata or FK)
- Set commitment status to "pending" (requires separate approval workflow)
- Preserve original bid record (don't mutate into commitment)

**Warning signs:**
- No award workflow between bid and commitment
- Users manually copy-paste bid data into commitment forms
- Bid amounts don't match commitment amounts
- Duplicate data entry complaints

**Source:** [Procore Bid Award Workflow](https://support.procore.com/products/online/user-guide/project-level/bidding/tutorials/award-a-winning-bid-and-convert-it-into-a-subcontract)

## Code Examples

Verified patterns from official sources:

### React Email Template for RFQ Invitation
```typescript
// apps/api/src/email/templates/rfq-invitation.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface RFQInvitationEmailProps {
  companyName: string;
  contactName: string;
  rfqNumber: string;
  rfqTitle: string;
  bidDeadline: string;
  magicLink: string;
}

export default function RFQInvitationEmail({
  companyName,
  contactName,
  rfqNumber,
  rfqTitle,
  bidDeadline,
  magicLink,
}: RFQInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You've been invited to bid on {rfqTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>RFQ Invitation: {rfqNumber}</Heading>
          <Text style={text}>
            Hello {contactName} from {companyName},
          </Text>
          <Text style={text}>
            You have been invited to submit a bid for the following project:
          </Text>
          <Section style={codeBox}>
            <Text style={codeText}>{rfqTitle}</Text>
          </Section>
          <Text style={text}>
            <strong>Bid Deadline:</strong> {new Date(bidDeadline).toLocaleString()}
          </Text>
          <Text style={text}>
            Click the button below to view the RFQ details and submit your bid. This link will expire in 72 hours.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={magicLink}>
              View RFQ & Submit Bid
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            This invitation was sent from [Your Company Name]. If you believe this was sent in error, please contact us.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
  textAlign: "center" as const,
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "16px 0",
};

const codeBox = {
  background: "#f4f4f4",
  borderRadius: "4px",
  margin: "16px 0",
  padding: "16px",
};

const codeText = {
  color: "#1f2937",
  fontSize: "18px",
  fontWeight: "600",
  margin: "0",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#3b82f6",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};
```

**Source:** [React Email Documentation](https://react.email/docs/introduction)

### Bid Comparison Table Component
```typescript
// apps/web/components/procurement/bid-comparison-table.tsx
"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { useMemo } from "react";

interface BidComparisonRow {
  rfqLineItemId: string;
  rfqDescription: string;
  bids: Record<string, {
    bidderName: string;
    totalPrice?: string;
    notes?: string;
  }>;
}

interface BidComparisonTableProps {
  data: BidComparisonRow[];
  bidderNames: string[];
}

export function BidComparisonTable({ data, bidderNames }: BidComparisonTableProps) {
  const columnHelper = createColumnHelper<BidComparisonRow>();

  const columns = useMemo(() => {
    // RFQ scope column
    const baseColumns = [
      columnHelper.accessor("rfqDescription", {
        header: "Scope Item",
        cell: (info) => (
          <div className="font-medium text-sm">{info.getValue()}</div>
        ),
      }),
    ];

    // Dynamic bidder columns
    const bidderColumns = bidderNames.map((bidderName, idx) =>
      columnHelper.display({
        id: `bidder_${idx}`,
        header: () => (
          <div className="text-center">
            <div className="font-semibold">{bidderName}</div>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const bidData = Object.values(row.bids).find(
            (b) => b.bidderName === bidderName
          );

          if (!bidData || !bidData.totalPrice) {
            return (
              <div className="text-center text-muted-foreground text-sm">
                Not included
              </div>
            );
          }

          return (
            <div className="text-right">
              <div className="font-mono font-semibold">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(Number(bidData.totalPrice))}
              </div>
              {bidData.notes && (
                <div className="text-xs text-muted-foreground mt-1">
                  {bidData.notes}
                </div>
              )}
            </div>
          );
        },
      })
    );

    return [...baseColumns, ...bidderColumns];
  }, [bidderNames, columnHelper]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Calculate totals
  const totals = useMemo(() => {
    const totalsMap: Record<string, number> = {};

    bidderNames.forEach((bidderName) => {
      const total = data.reduce((sum, row) => {
        const bidData = Object.values(row.bids).find(
          (b) => b.bidderName === bidderName
        );
        return sum + (bidData?.totalPrice ? Number(bidData.totalPrice) : 0);
      }, 0);
      totalsMap[bidderName] = total;
    });

    return totalsMap;
  }, [data, bidderNames]);

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-muted/50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-12 px-4 text-left align-middle font-medium"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-4 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {/* Total row */}
          <tr className="border-t-2 border-border bg-muted/30 font-semibold">
            <td className="p-4">Total</td>
            {bidderNames.map((bidderName, idx) => (
              <td key={idx} className="p-4 text-right font-mono">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(totals[bidderName] ?? 0)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

**Source:** [TanStack Table Documentation](https://tanstack.com/table/latest)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Paper RFQs and faxed bids | Digital RFQ platforms with online submission | ~2015 | Faster turnaround, audit trails, reduced errors |
| Email attachments for bid submission | Structured online forms with auto-save | ~2018 | Data standardization, easier comparison, version control |
| Manual bid comparison in Excel | Automated bid comparison tables with leveling | ~2020 | Fair apples-to-apples comparison, gap identification |
| Subcontractor lists in spreadsheets | Searchable vendor directories with prequalification | ~2022 | Trade filtering, qualification tracking, relationship management |
| RFQ amendments via email addenda | Versioned RFQs with upstream change notifications | ~2023 | Immutable audit trail, bidder awareness of changes |
| Manual bid-to-contract data entry | One-click award conversion to commitments | ~2024 | Reduced errors, faster execution, seamless workflow |

**Deprecated/outdated:**
- **Email-only RFQ distribution:** No audit trail of who received/viewed; use platform invitations with tracking
- **Single-version RFQ edits:** Breaks audit compliance; use effective dating with amendments
- **Closed bid platforms requiring all parties to have accounts:** Limits network effects; support guest access
- **Manual scope leveling in spreadsheets:** Error-prone and time-consuming; use structured line item comparison

## Open Questions

1. **Should bid revisions be allowed after submission?**
   - What we know: Some GCs allow bid revisions before deadline if RFQ is amended; others require new submission
   - What's unclear: Should platform support revision workflow or require withdrawal + resubmission?
   - Recommendation: For v1, support withdrawal + resubmission. Add revision workflow in later phase if users request it.

2. **How to handle bid bonds and insurance certificates?**
   - What we know: Large projects require bid bonds; insurance certificates are standard prequalification
   - What's unclear: Should platform enforce bond/insurance uploads or just track as optional attachments?
   - Recommendation: Optional attachments for v1. Add required documents workflow if compliance needs emerge.

3. **Should subcontractor directory be shared across projects or company-wide?**
   - What we know: Subcontractors work on multiple projects; prequalification is company-level decision
   - What's unclear: Should directory be scoped to company or allow project-specific vendor lists?
   - Recommendation: Company-wide directory with project-level favorite/preferred flags. Simplifies management.

4. **What level of bid confidentiality is required?**
   - What we know: Bid amounts are confidential until award; some GCs share bid ranges for transparency
   - What's unclear: Should platform prevent GC from seeing bid amounts before deadline (sealed bid)?
   - Recommendation: For v1, allow GC to see bids as submitted (private procurement). Add sealed bid option in later phase.

5. **How to handle multi-stage bidding (RFQ → RFP → Best and Final)?**
   - What we know: Large projects use multi-stage procurement (qualify, submit detailed bid, negotiate final)
   - What's unclear: Should v1 support multi-stage or just single-round RFQ?
   - Recommendation: Single-round RFQ for v1. Multi-stage adds significant workflow complexity.

## Sources

### Primary (HIGH confidence)
- [Procore Bid Leveling Guide](https://www.procore.com/library/construction-bid-leveling) - Industry standard bid comparison practices
- [Procore Award Workflow](https://support.procore.com/products/online/user-guide/project-level/bidding/tutorials/award-a-winning-bid-and-convert-it-into-a-subcontract) - Bid-to-commitment conversion
- [React Email Documentation](https://react.email/docs/introduction) - Email template components
- [TanStack Table Documentation](https://tanstack.com/table/latest) - Data table implementation
- [fast-json-patch RFC 6902](https://github.com/Starcounter-Jack/JSON-Patch) - JSON diff standard
- [Drizzle ORM JSONB Support](https://orm.drizzle.team/docs/column-types/pg) - JSONB type safety

### Secondary (MEDIUM confidence)
- [RIB Construction Bid Leveling](https://www.rib-software.com/en/blogs/construction-bid-leveling) - Scope leveling practices (2026)
- [Addendum Construction Estimating](https://truebiddata.com/blog/addendum-construction-estimating-changes/) - Amendment workflow (2026)
- [PreconSuite Guest Bidding](https://preconsuite.com/) - External bidder access patterns
- [4castplus RFP Management](https://4castplus.com/rfp-software/) - RFQ workflow features
- [Archdesk Subcontractor Bidding](https://archdesk.com/solutions/subcontractor-bidding) - Bid management capabilities
- [PlanHub Bidding Platform](https://planhub.com/) - Industry platform patterns
- [Downtobid AI Bidding](https://www.downtobid.com/) - Modern bidding software features
- [Auth0 B2B SaaS Onboarding](https://auth0.com/blog/user-onboarding-strategies-b2b-saas/) - Guest access patterns
- [Inventive.ai Tender Management](https://www.inventive.ai/blog-posts/tender-management-a-complete-guide) - Procurement best practices (2026)
- [ConWize Addendum Definition](https://conwize.io/glossary/addendum-a-document-that-outlines-changes-to-the-original-bid-documents/) - Addenda documentation

### Tertiary (LOW confidence - marked for validation)
- Various WebSearch results on construction bidding software, vendor management, and procurement workflows - Provides domain context but lacks technical implementation specifics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries (Drizzle, tRPC, CASL, Zod) already in use; Nodemailer is industry standard
- Architecture patterns: MEDIUM-HIGH - Versioned RFQs follow Phase 2 effective dating pattern (verified); guest access follows Auth0 B2B patterns (verified); bid comparison follows TanStack Table docs (verified)
- Procurement workflows: MEDIUM - Industry patterns verified from Procore and construction software vendors; specific implementation details are extrapolated
- Email integration: HIGH - React Email and Nodemailer are well-documented; transactional email services (Resend, SendGrid) are production-proven
- Pitfalls: MEDIUM - Based on construction industry best practices (MEDIUM), audit compliance requirements (HIGH), and general SaaS security patterns (HIGH)

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - procurement patterns are stable; email and table libraries are mature)
