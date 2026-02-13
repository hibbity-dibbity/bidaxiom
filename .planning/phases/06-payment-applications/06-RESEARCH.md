# Phase 6: Payment Applications - Research

**Researched:** 2026-02-12
**Domain:** Construction payment applications, AIA G702/G703 billing, retainage, lien waivers, invoice tracking
**Confidence:** MEDIUM-HIGH

## Summary

Phase 6 implements construction payment application management following the AIA G702/G703 industry-standard format. Users must be able to create payment applications (also called "pay apps" or "progress billings") that track work completed during a billing period, stored materials on-site, retainage withheld, and the net amount due. Payment applications require configurable multi-party approval workflows (PM → superintendent → owner), lien waiver collection tracking, and automatic updates to budget actuals upon approval. The phase also includes AP/AR invoice tracking with aging reports to manage cash flow and identify overdue receivables/payables.

The research reveals five critical requirements: (1) Schedule of Values (SOV) must be established at project start and serve as the foundation for all payment applications, (2) payment calculations follow strict formulas (work completed this period = current percent complete minus previous percent complete times scheduled value, minus retainage), (3) stored materials can be billed if contract allows but must be tracked separately from installed work, (4) lien waivers come in four types (partial conditional, partial unconditional, final conditional, final unconditional) with state-specific requirements, and (5) retainage typically ranges from 5-10% with progressive release schedules (often reducing from 10% to 5% at 50% completion).

**Primary recommendation:** Build on Phase 5's approval workflow infrastructure to create payment applications that reference budget line items via SOV line items, implement retainage calculation with company-configurable rates and release schedules, track lien waivers separately by payment and type with state-aware validation, and generate AP/AR aging reports with 30-day buckets using PostgreSQL window functions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (existing) | Database schema for payment apps, SOV, retainage, lien waivers | Already project standard, supports complex aggregations and NUMERIC precision |
| PostgreSQL NUMERIC | Built-in | Exact decimal precision for payment amounts, retainage calculations | Required for financial accuracy, no floating-point errors |
| tRPC | (existing) | Type-safe payment app CRUD, approval workflow, aging reports | Already project standard, reuses existing patterns |
| Zod | (existing) | Payment app validation, SOV schema, lien waiver type discrimination | Already project standard, excellent for complex financial validation |
| CASL | (existing) | Payment app permissions, approval authorization | Already project standard, integrates with existing project-level permissions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts | ^2.15.0 | AP/AR aging charts, payment history visualization | Already in use from Phase 4, reuse for aging reports |
| date-fns | ^3.x | Date range calculations for aging buckets, payment period tracking | Already in use, lightweight date manipulation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate SOV table | Store SOV in JSONB on project | Separate table enables better querying, line-item-level history, and foreign key relationships to budget line items |
| Hardcoded retainage rates | Company-configurable progressive rates | Configurable rates support different company policies and project-specific requirements (e.g., 10% → 5% at 50% completion) |
| Single lien waiver type | Four lien waiver types (conditional/unconditional × partial/final) | Industry requires all four types; some states mandate specific types |
| Real-time aging calculation | Materialized view for aging reports | Real-time is simpler but slower for large datasets; materialized views trade freshness for performance |
| Separate invoice tracking system | Integrate with payment applications | Payment apps ARE the invoices in construction; separate tracking duplicates data |

**Installation:**
No new packages required—all dependencies already in monorepo from Phases 4 and 5.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── db/schema/
│   └── tenant.ts                   # Add payment_apps, sov_items, retainage_schedules, lien_waivers
├── trpc/routers/
│   ├── payment-app.ts              # Payment app CRUD, approval, submission
│   ├── sov.ts                      # Schedule of Values setup and management
│   └── invoice-tracking.ts         # AP/AR aging reports, payment status
├── calculations/
│   ├── payment-app.ts              # Calculate amount due, retainage, stored materials
│   ├── retainage.ts                # Progressive retainage calculation, release eligibility
│   └── aging.ts                    # AP/AR aging bucket calculations
└── services/
    └── lien-waiver.ts              # Lien waiver type determination, state validation

apps/web/app/(dashboard)/
├── projects/
│   └── [projectId]/
│       ├── payment-apps/
│       │   ├── page.tsx            # Payment app list with filters (pending, approved, paid)
│       │   ├── new/
│       │   │   └── page.tsx        # Create new payment app (select SOV items, enter % complete)
│       │   └── [paymentAppId]/
│       │       ├── page.tsx        # Payment app detail with G702/G703 view
│       │       └── approve/
│       │           └── page.tsx    # Approval panel (reuse from Phase 5 patterns)
│       ├── sov/
│       │   └── page.tsx            # Schedule of Values setup and editor
│       └── invoices/
│           ├── receivable/
│           │   └── page.tsx        # AR aging report with 30/60/90/120+ buckets
│           └── payable/
│               └── page.tsx        # AP aging report with vendor breakdown
└── components/payment-app/
    ├── g702-form.tsx               # AIA G702 Application for Payment form
    ├── g703-continuation.tsx       # AIA G703 Continuation Sheet (SOV detail)
    ├── retainage-calculator.tsx    # Retainage display and calculation preview
    ├── lien-waiver-tracker.tsx     # Lien waiver collection status checklist
    └── aging-report-table.tsx      # AP/AR aging table with expandable vendor rows
```

### Pattern 1: Schedule of Values as Foundation for Payment Applications

**What:** Establish SOV at project start by mapping budget line items to SOV line items with scheduled values (dollar allocations). All payment applications reference SOV line items and track percent complete against scheduled values.

**When to use:** All construction payment applications; industry-standard practice required by AIA forms.

**Example:**
```typescript
// DB Schema: Schedule of Values
const sovItems = schema.table("sov_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  budgetLineItemId: uuid("budget_line_item_id").references(() => budgetLineItems.id, { onDelete: "set null" }),
  itemNumber: text("item_number").notNull(), // e.g., "001", "002", sequential
  description: text("description").notNull(),
  scheduledValue: numeric("scheduled_value", { precision: 15, scale: 2 }).notNull(), // Dollar amount allocated
  orderIndex: integer("order_index").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Payment app line items reference SOV items
const paymentAppLineItems = schema.table("payment_app_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentAppId: uuid("payment_app_id").notNull().references(() => paymentApps.id, { onDelete: "cascade" }),
  sovItemId: uuid("sov_item_id").notNull().references(() => sovItems.id, { onDelete: "restrict" }),

  // Tracking cumulative progress
  previousPercentComplete: numeric("previous_percent_complete", { precision: 5, scale: 2 }).notNull().default("0"), // 0.00 to 100.00
  currentPercentComplete: numeric("current_percent_complete", { precision: 5, scale: 2 }).notNull(), // 0.00 to 100.00

  // Calculated values based on percent complete
  workCompletedThisPeriod: numeric("work_completed_this_period", { precision: 15, scale: 2 }).notNull(),
  materialsStoredThisPeriod: numeric("materials_stored_this_period", { precision: 15, scale: 2 }).notNull().default("0"),
  totalCompletedAndStored: numeric("total_completed_and_stored", { precision: 15, scale: 2 }).notNull(),

  // Retainage (calculated server-side based on company config)
  retainagePercent: numeric("retainage_percent", { precision: 5, scale: 2 }).notNull(),
  retainageAmount: numeric("retainage_amount", { precision: 15, scale: 2 }).notNull(),
});

// Calculation example
async function calculatePaymentAppLineItem(
  sovItem: SovItem,
  previousPercent: number,
  currentPercent: number,
  materialsStored: number,
  retainageRate: number
) {
  const scheduledValue = Number(sovItem.scheduledValue);

  // Work completed this period = (current % - previous %) × scheduled value
  const workThisPeriod = ((currentPercent - previousPercent) / 100) * scheduledValue;

  // Total completed and stored
  const totalCompletedAndStored = workThisPeriod + materialsStored;

  // Retainage = total × retainage rate
  const retainageAmount = totalCompletedAndStored * (retainageRate / 100);

  return {
    workCompletedThisPeriod: workThisPeriod.toFixed(2),
    materialsStoredThisPeriod: materialsStored.toFixed(2),
    totalCompletedAndStored: totalCompletedAndStored.toFixed(2),
    retainagePercent: retainageRate.toFixed(2),
    retainageAmount: retainageAmount.toFixed(2),
  };
}
```

**Source:** [Understanding SOV and Payment Applications](https://vertexeng.com/insights/understanding-sov-and-payment-applications/), [Schedule of Values Guide](https://www.mastt.com/guide/schedule-of-values)

### Pattern 2: Progressive Retainage with Configurable Release Schedule

**What:** Track retainage separately for each payment with company-configurable rates that can change based on project completion percentage (e.g., 10% until 50% complete, then 5%). Automatically calculate when retainage is eligible for release based on milestones.

**When to use:** All construction payment applications; retainage is industry standard for risk management.

**Example:**
```typescript
// Company-level retainage configuration (add to companyProfiles)
interface RetainageConfig {
  defaultRate: number; // e.g., 10 (percent)
  progressiveRates?: Array<{
    upToPercent: number; // e.g., 50 (project 50% complete)
    rate: number; // e.g., 10 (percent)
  }>;
  releaseConditions: {
    substantialCompletion: boolean; // Release at substantial completion?
    punchListComplete: boolean; // Release after punch list?
    finalAcceptance: boolean; // Release at final acceptance?
    lienWaiversRequired: boolean; // Require lien waivers before release?
  };
}

// Retainage tracking table
const retainageHeld = schema.table("retainage_held", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  paymentAppId: uuid("payment_app_id").notNull().references(() => paymentApps.id, { onDelete: "cascade" }),
  amountHeld: numeric("amount_held", { precision: 15, scale: 2 }).notNull(),
  retainageRate: numeric("retainage_rate", { precision: 5, scale: 2 }).notNull(), // Snapshot rate at time of payment
  status: text("status").notNull().default("held"), // held, eligible_for_release, released
  releasedAmount: numeric("released_amount", { precision: 15, scale: 2 }).default("0"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  releasedBy: text("released_by"),
  releaseNotes: text("release_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Calculate current retainage rate based on project completion
async function getCurrentRetainageRate(
  projectId: string,
  retainageConfig: RetainageConfig,
  tenantDb: Database
): Promise<number> {
  // Get project completion percentage (from SOV)
  const sovTotal = await tenantDb
    .select({ total: sql<number>`SUM(${sovItems.scheduledValue}::numeric)` })
    .from(sovItems)
    .where(eq(sovItems.projectId, projectId));

  const paymentTotal = await tenantDb
    .select({
      total: sql<number>`
        SUM((${paymentAppLineItems.currentPercentComplete}::numeric / 100) * ${sovItems.scheduledValue}::numeric)
      `
    })
    .from(paymentAppLineItems)
    .innerJoin(paymentApps, eq(paymentApps.id, paymentAppLineItems.paymentAppId))
    .innerJoin(sovItems, eq(sovItems.id, paymentAppLineItems.sovItemId))
    .where(
      and(
        eq(sovItems.projectId, projectId),
        eq(paymentApps.status, "approved")
      )
    );

  const completionPercent = Number(sovTotal[0].total) > 0
    ? (Number(paymentTotal[0].total) / Number(sovTotal[0].total)) * 100
    : 0;

  // Find applicable rate based on progressive schedule
  if (retainageConfig.progressiveRates) {
    for (const tier of retainageConfig.progressiveRates.sort((a, b) => a.upToPercent - b.upToPercent)) {
      if (completionPercent <= tier.upToPercent) {
        return tier.rate;
      }
    }
  }

  return retainageConfig.defaultRate;
}
```

**Source:** [Retainage in Construction Guide](https://www.netsuite.com/portal/resource/articles/accounting/retainage.shtml), [Construction Retainage Best Practices](https://constructioncoverage.com/glossary/retainage)

### Pattern 3: Four-Type Lien Waiver System with State Validation

**What:** Track lien waivers separately by payment application with four distinct types: partial conditional (most common during project), partial unconditional, final conditional (at substantial completion), and final unconditional (rare, only with payment in hand). Validate state-specific requirements (e.g., statutory forms for CA, TX, FL).

**When to use:** Always with payment applications; lien waivers protect owners from mechanic's liens.

**Example:**
```typescript
// Lien waiver types (discriminated union)
const lienWaiverTypeSchema = z.enum([
  "partial_conditional",    // Work in progress, waiver conditional on payment clearing
  "partial_unconditional",  // Work in progress, waiver effective immediately (risky for contractor)
  "final_conditional",      // Final payment, conditional on payment clearing
  "final_unconditional",    // Final payment, effective immediately (very risky)
]);

// Lien waiver tracking
const lienWaivers = schema.table("lien_waivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  paymentAppId: uuid("payment_app_id").notNull().references(() => paymentApps.id, { onDelete: "cascade" }),

  // Who is waiving lien rights
  waiverType: text("waiver_type").notNull(), // partial_conditional, partial_unconditional, final_conditional, final_unconditional
  partyName: text("party_name").notNull(), // Subcontractor or vendor name
  partyType: text("party_type").notNull(), // subcontractor, supplier, vendor

  // Waiver details
  throughDate: timestamp("through_date", { withTimezone: true }).notNull(), // Waiver covers work through this date
  amountWaived: numeric("amount_waived", { precision: 15, scale: 2 }).notNull(),

  // Collection tracking
  status: text("status").notNull().default("pending"), // pending, received, verified, stored
  receivedAt: timestamp("received_at", { withTimezone: true }),
  receivedBy: text("received_by"),

  // State-specific requirements
  requiresNotarization: boolean("requires_notarization").notNull().default(false),
  isNotarized: boolean("is_notarized").notNull().default(false),
  usesStatutoryForm: boolean("uses_statutory_form").notNull().default(false), // CA, TX, FL, etc.

  // Document storage
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }), // Link to stored PDF

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// State-specific requirements (seed data or company config)
const STATE_LIEN_WAIVER_REQUIREMENTS: Record<string, {
  requiresStatutoryForm: boolean;
  requiresNotarization: boolean;
}> = {
  CA: { requiresStatutoryForm: true, requiresNotarization: false },
  TX: { requiresStatutoryForm: true, requiresNotarization: false }, // After 2022, no notarization
  FL: { requiresStatutoryForm: true, requiresNotarization: false },
  AZ: { requiresStatutoryForm: true, requiresNotarization: false },
  // ... other states
};

// Validation logic
function validateLienWaiver(
  waiverType: string,
  projectState: string,
  isNotarized: boolean,
  usesStatutoryForm: boolean
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const stateReqs = STATE_LIEN_WAIVER_REQUIREMENTS[projectState];

  if (stateReqs?.requiresStatutoryForm && !usesStatutoryForm) {
    errors.push(`${projectState} requires statutory lien waiver form`);
  }

  if (stateReqs?.requiresNotarization && !isNotarized) {
    errors.push(`${projectState} requires notarized lien waiver`);
  }

  // Warning for risky unconditional waivers
  if (waiverType.includes("unconditional")) {
    errors.push("WARNING: Unconditional waiver waives rights immediately, even if payment doesn't clear");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Source:** [Lien Waiver Types](https://cofilending.com/the-4-main-types-of-lien-waivers/), [Lien Waiver State Requirements](https://getbuilt.com/lien-waivers/), [Procore Lien Waiver Guide](https://support.procore.com/products/online/user-guide/company-level/payments/faq/what-is-a-lien-waiver)

### Pattern 4: Approval Workflow Reusing Phase 5 Infrastructure

**What:** Reuse Phase 5's approval workflow pattern (database-driven steps, sequential/parallel approvers) for payment application approvals. Payment apps typically require PM → Superintendent → Owner sequential approval, with configurable thresholds (e.g., auto-approve under $5K).

**When to use:** All payment applications; multi-party approval is construction industry standard.

**Example:**
```typescript
// Reuse approval_workflow_steps table from Phase 5
// Payment app has similar workflow to change orders but simpler (no budget impact logic)

const paymentApps = schema.table("payment_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),

  // Payment app identification
  applicationNumber: text("application_number").notNull().unique(), // e.g., "PAY-2024-003"
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

  // Calculated totals (sum of line items)
  originalContractSum: numeric("original_contract_sum", { precision: 15, scale: 2 }).notNull(),
  netChangeByChangeOrders: numeric("net_change_by_change_orders", { precision: 15, scale: 2 }).default("0"),
  contractSumToDate: numeric("contract_sum_to_date", { precision: 15, scale: 2 }).notNull(),
  totalCompletedAndStored: numeric("total_completed_and_stored", { precision: 15, scale: 2 }).notNull(),
  retainageAmount: numeric("retainage_amount", { precision: 15, scale: 2 }).notNull(),
  totalEarnedLessRetainage: numeric("total_earned_less_retainage", { precision: 15, scale: 2 }).notNull(),
  previousPayments: numeric("previous_payments", { precision: 15, scale: 2 }).default("0"),
  currentPaymentDue: numeric("current_payment_due", { precision: 15, scale: 2 }).notNull(),
  balanceToFinish: numeric("balance_to_finish", { precision: 15, scale: 2 }).notNull(),

  // Approval workflow
  status: text("status").notNull().default("draft"), // draft, submitted, under_review, approved, rejected, paid
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  paidAt: timestamp("paid_at", { withTimezone: true }),

  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Reuse approval workflow steps from Phase 5
// apps/api/src/services/payment-app-approval.ts
async function initializePaymentAppWorkflow(
  paymentAppId: string,
  projectId: string,
  currentPaymentDue: number,
  tenantDb: Database
) {
  // Get company approval thresholds
  const companyProfile = await getCurrentCompanyProfile(tenantDb);
  const approvalConfig = companyProfile.paymentAppApprovalConfig; // Add to company schema

  // Auto-approve small amounts
  if (currentPaymentDue < approvalConfig.autoApproveThreshold) {
    await tenantDb.update(paymentApps)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(paymentApps.id, paymentAppId));
    return;
  }

  // Create sequential approval steps
  const steps = [];

  // Step 1: Project Manager (if not creator)
  steps.push({
    paymentAppId,
    stepOrder: 1,
    approverRole: "org:project_manager",
    requirementType: "any", // Any PM on project can approve
  });

  // Step 2: Superintendent (for large amounts)
  if (currentPaymentDue >= approvalConfig.superintendentThreshold) {
    steps.push({
      paymentAppId,
      stepOrder: 2,
      approverRole: "org:superintendent",
      requirementType: "any",
    });
  }

  // Step 3: Owner (for very large amounts)
  if (currentPaymentDue >= approvalConfig.ownerThreshold) {
    steps.push({
      paymentAppId,
      stepOrder: 3,
      approverRole: "org:admin", // Owner typically has admin role
      requirementType: "specific",
      approverUserId: approvalConfig.ownerId, // Specific owner user
    });
  }

  await tenantDb.insert(approvalWorkflowSteps).values(steps);
}
```

**Source:** [Payment Application Approval Workflows](https://planyard.com/construction-approval-workflows), [GCPay Payment Workflows](https://ww3.gcpay.com/)

### Pattern 5: AP/AR Aging Reports with 30-Day Buckets

**What:** Generate accounts receivable and accounts payable aging reports that categorize outstanding invoices into 30-day buckets (Current, 1-30, 31-60, 61-90, 90+). Use PostgreSQL window functions and CASE statements for efficient bucket calculation.

**When to use:** Financial reporting and cash flow management; identifies overdue receivables and payables.

**Example:**
```typescript
// Calculate AR aging report (money owed TO company)
async function generateARAgingReport(
  tenantDb: Database,
  asOfDate: Date = new Date()
): Promise<ARAgingReport> {
  const agingData = await tenantDb.execute(sql`
    WITH payment_app_aging AS (
      SELECT
        pa.id,
        pa.application_number,
        p.name AS project_name,
        pa.current_payment_due,
        pa.approved_at,
        pa.paid_at,
        EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) AS days_outstanding,
        CASE
          WHEN pa.paid_at IS NOT NULL THEN 0 -- Paid, not outstanding
          WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) <= 30 THEN 1
          WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) <= 60 THEN 2
          WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) <= 90 THEN 3
          WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - pa.approved_at)) <= 120 THEN 4
          ELSE 5
        END AS aging_bucket
      FROM payment_apps pa
      INNER JOIN projects p ON p.id = pa.project_id
      WHERE pa.status = 'approved' AND pa.paid_at IS NULL
    )
    SELECT
      aging_bucket,
      COUNT(*) AS invoice_count,
      SUM(current_payment_due) AS total_amount
    FROM payment_app_aging
    GROUP BY aging_bucket
    ORDER BY aging_bucket
  `);

  // Transform to report format
  return {
    asOfDate,
    current: agingData.find(d => d.aging_bucket === 1)?.total_amount ?? 0,
    days1_30: agingData.find(d => d.aging_bucket === 2)?.total_amount ?? 0,
    days31_60: agingData.find(d => d.aging_bucket === 3)?.total_amount ?? 0,
    days61_90: agingData.find(d => d.aging_bucket === 4)?.total_amount ?? 0,
    days90Plus: agingData.find(d => d.aging_bucket === 5)?.total_amount ?? 0,
  };
}

// Calculate AP aging report (money company OWES to vendors)
async function generateAPAgingReport(
  tenantDb: Database,
  asOfDate: Date = new Date()
): Promise<APAgingReport> {
  // Similar query but for commitments in "approved" status without payments
  const agingData = await tenantDb.execute(sql`
    WITH commitment_aging AS (
      SELECT
        c.id,
        c.vendor_name,
        c.total_amount,
        c.approved_at,
        EXTRACT(DAY FROM (${asOfDate}::timestamp - c.approved_at)) AS days_outstanding,
        CASE
          WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - c.approved_at)) <= 30 THEN 1
          WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - c.approved_at)) <= 60 THEN 2
          WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - c.approved_at)) <= 90 THEN 3
          WHEN EXTRACT(DAY FROM (${asOfDate}::timestamp - c.approved_at)) <= 120 THEN 4
          ELSE 5
        END AS aging_bucket
      FROM commitments c
      WHERE c.status = 'approved' AND c.paid_at IS NULL
    )
    SELECT
      vendor_name,
      aging_bucket,
      SUM(total_amount) AS total_amount
    FROM commitment_aging
    GROUP BY vendor_name, aging_bucket
    ORDER BY vendor_name, aging_bucket
  `);

  // Group by vendor for detailed breakdown
  const byVendor: Record<string, APAgingVendor> = {};

  for (const row of agingData) {
    if (!byVendor[row.vendor_name]) {
      byVendor[row.vendor_name] = {
        vendorName: row.vendor_name,
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        days90Plus: 0,
        total: 0,
      };
    }

    const vendor = byVendor[row.vendor_name];
    const amount = Number(row.total_amount);

    switch (row.aging_bucket) {
      case 1: vendor.current += amount; break;
      case 2: vendor.days1_30 += amount; break;
      case 3: vendor.days31_60 += amount; break;
      case 4: vendor.days61_90 += amount; break;
      case 5: vendor.days90Plus += amount; break;
    }

    vendor.total += amount;
  }

  return {
    asOfDate,
    vendors: Object.values(byVendor),
  };
}
```

**Source:** [Accounts Receivable Aging Report](https://quickbooks.intuit.com/r/payments/accounts-receivable-aging-report/), [Construction AR Explained](https://planyard.com/blog/construction-accounts-receivable-explained), [AP Aging Report Guide](https://tipalti.com/resources/learn/accounts-payable-aging-report/)

### Anti-Patterns to Avoid

- **Storing percent complete as integer (0-100):** Use NUMERIC(5,2) to support fractional percentages like 47.5%. Integer percentages lose precision and cause rounding errors over many line items.
- **Allowing payment app submission without SOV setup:** Payment apps are meaningless without SOV foundation. Block payment app creation if project has no SOV items.
- **Hard-coding AIA G702/G703 form layout in code:** Store form data generically and use PDF generation library to render forms. Hard-coded layouts break when AIA updates forms.
- **Single retainage rate for entire project:** Use progressive retainage (10% → 5% at milestones) to align with industry practice and improve subcontractor cash flow.
- **Ignoring lien waiver state requirements:** CA, TX, FL have statutory forms. Don't let users submit non-compliant waivers—validate based on project state.
- **Calculating aging buckets in JavaScript:** Use SQL CASE statements and window functions. Database is orders of magnitude faster for date arithmetic across thousands of invoices.
- **Approving payment apps without lien waiver verification:** If company policy requires lien waivers before payment, enforce in approval workflow (block approval if waivers pending).
- **Updating budget actuals before payment app approval:** Only approved payment apps should update budget actuals. Draft/rejected apps must not affect budgets.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AIA form PDF generation | Custom PDF layout engine | PDF generation library (e.g., PDFKit, React-PDF) with templates | AIA forms have precise layouts, tables, and calculations. PDF libraries handle pagination, table wrapping, and font metrics correctly. |
| Retainage calculation engine | Custom progressive rate calculator | Database-driven configuration with helper functions | Retainage rules vary by company, project, and contract. Configuration-driven approach supports all variations without code changes. |
| Aging report bucket logic | JavaScript date loops | PostgreSQL EXTRACT and CASE statements | SQL date arithmetic is optimized; JavaScript loops over thousands of invoices are 100x slower. |
| Lien waiver state validation | Manual state-by-state if/else | Database table or JSONB config with state requirements | 50 states with different rules; configuration is maintainable, code is not. |
| Payment app numbering | MAX + 1 pattern | SELECT FOR UPDATE pattern from Phase 5 | Race conditions cause duplicate numbers. Reuse Phase 5's proven sequential numbering. |

**Key insight:** Payment applications are highly standardized by AIA forms and state lien waiver laws. Don't invent novel billing formats or waiver types—follow AIA G702/G703 exactly and support the four standard lien waiver types. The complexity is in the calculations (percent complete, retainage, stored materials) and approval workflows, not in inventing new document formats.

## Common Pitfalls

### Pitfall 1: Stored Materials Billed Without Contract Authorization

**What goes wrong:** Contractor bills for $50K of materials stored on-site, but contract doesn't allow payment for stored materials. Owner rejects payment app, causing cash flow crisis for contractor.

**Why it happens:** Not validating contract terms before allowing stored materials line items; assuming all contracts permit stored materials billing.

**How to avoid:**
- Add `allowStoredMaterialsBilling` boolean to project metadata (set during project creation based on contract review)
- Block stored materials input in payment app form if not allowed by contract
- Show warning in SOV setup: "Contract does not permit stored materials billing"
- Require supporting documentation for stored materials (photos, delivery receipts) even when allowed

**Warning signs:**
- Payment app line items have materials_stored values but no validation
- No contract term tracking in project setup
- Users can enter stored materials for any project without restriction

**Source:** [About Stored Materials on Payment Applications](https://support.procore.com/products/online/user-guide/project-level/invoicing/tutorials/about-stored-materials-on-invoices)

### Pitfall 2: Retainage Not Reduced at Milestones Leading to Cash Flow Issues

**What goes wrong:** Subcontractors expect retainage to drop from 10% to 5% at 50% completion per contract, but system continues withholding 10%, causing disputes and delayed subcontractor payments.

**Why it happens:** Hard-coded retainage rate instead of progressive schedule; no logic to check project completion percentage.

**How to avoid:**
- Store retainage schedule in company_profiles or project metadata: `[{ upToPercent: 50, rate: 10 }, { upToPercent: 100, rate: 5 }]`
- Calculate current retainage rate dynamically based on project percent complete (from SOV cumulative totals)
- Show retainage rate in payment app UI with explanation: "Current rate: 5% (reduced from 10% at 50% completion)"
- Audit log retainage rate changes for transparency

**Warning signs:**
- Single `retainageRate` field without schedule support
- Retainage calculation doesn't reference project completion percentage
- Subcontractors complain about retainage not reducing per contract terms

**Source:** [Retainage in Construction Guide](https://www.netsuite.com/portal/resource/articles/accounting/retainage.shtml)

### Pitfall 3: Lien Waivers Collected After Payment Instead of Before

**What goes wrong:** Owner pays contractor $100K, then realizes lien waivers weren't collected. Subcontractor files mechanic's lien for unpaid work, owner is liable for double payment.

**Why it happens:** Approval workflow doesn't enforce lien waiver collection; payment happens before waiver verification.

**How to avoid:**
- Add approval workflow step: "Verify lien waivers collected" before final approval
- Block payment app approval if lien waiver status is "pending" for any required party
- Use conditional lien waivers (most common type) that become effective when payment clears
- Dashboard shows lien waiver collection status prominently: "3/5 waivers received"

**Warning signs:**
- Lien waiver tracking is separate from payment app approval workflow
- No validation that lien waivers are complete before approval
- Users can mark payment app as "paid" without waiver verification

**Source:** [How Lien Waivers and Payment Are Connected](https://getbuilt.com/blog/how-are-lien-waivers-and-payment-connected-in-the-construction-industry/)

### Pitfall 4: Budget Actuals Updated on Payment App Submission Instead of Approval

**What goes wrong:** User submits payment app for $50K, budget shows $50K actual cost, then payment app is rejected. Budget actuals are now wrong and don't match approved payments.

**Why it happens:** Updating budget in wrong event handler; confusion between "submitted" and "approved" status.

**How to avoid:**
- Only update budget actuals in `approvePaymentApp` mutation, not in `submitPaymentApp`
- Use database transaction to ensure budget update and approval are atomic
- Requirement PYMT-06 explicitly states: "Approved pay applications update committed cost actuals"
- Wrap budget update in same transaction as status change to "approved"

**Warning signs:**
- Budget actuals change when payment app is submitted (should be approval)
- Budget totals don't match sum of approved payment apps
- Rejected payment apps leave incorrect budget actuals behind

**Source:** Existing project pattern from Phase 4 budget locking and Phase 5 change order budget updates

### Pitfall 5: AR/AP Aging Reports Show Incorrect Days Outstanding

**What goes wrong:** Aging report shows invoice is 45 days old (should be in 31-60 bucket), but displays in 1-30 bucket. Overdue receivables are hidden, cash flow forecasting is wrong.

**Why it happens:** Using `created_at` instead of `approved_at` for age calculation; timezone issues causing off-by-one errors; BETWEEN operator with wrong boundary logic.

**How to avoid:**
- Calculate days from `approved_at` (when invoice is due), not `created_at` (when draft was started)
- Use PostgreSQL `EXTRACT(DAY FROM (now() - approved_at))` for exact day count
- CASE statement boundaries: `<= 30` (not `< 30`) to avoid fence-post errors
- Test aging report with known test data across all buckets
- Show actual days outstanding in detailed view for debugging

**Warning signs:**
- Aging buckets have inconsistent counts compared to manual count
- Invoices appear in wrong bucket when manually calculating days
- Timezone-sensitive (report looks different in different timezones)

**Source:** [Accounts Receivable Aging Report](https://www.constructioncostaccounting.com/post/what-is-an-accounts-receivable-aging-report-in-the-construction-industry), [AR Aging Definition](https://www.netsuite.com/portal/resource/articles/accounting/accounts-receivable-aging.shtml)

## Code Examples

Verified patterns from research:

### Payment App Calculation (G702 Totals)

```typescript
// apps/api/src/calculations/payment-app.ts
interface PaymentAppCalculation {
  originalContractSum: number;
  netChangeByChangeOrders: number;
  contractSumToDate: number;
  totalCompletedAndStored: number;
  retainage: number;
  totalEarnedLessRetainage: number;
  lessRevisionsAndPreviousPayments: number;
  currentPaymentDue: number;
  balanceToFinish: number;
}

async function calculatePaymentAppTotals(
  projectId: string,
  lineItems: PaymentAppLineItemInput[],
  tenantDb: Database
): Promise<PaymentAppCalculation> {
  // Get original contract sum from SOV
  const sovTotalResult = await tenantDb
    .select({ total: sql<number>`SUM(${sovItems.scheduledValue}::numeric)` })
    .from(sovItems)
    .where(eq(sovItems.projectId, projectId));

  const originalContractSum = Number(sovTotalResult[0].total);

  // Get net change from approved change orders (Phase 5 integration)
  const changeOrderTotalResult = await tenantDb
    .select({ total: sql<number>`COALESCE(SUM(${changeOrders.totalAmount}::numeric), 0)` })
    .from(changeOrders)
    .where(
      and(
        eq(changeOrders.projectId, projectId),
        eq(changeOrders.status, "approved")
      )
    );

  const netChangeByChangeOrders = Number(changeOrderTotalResult[0].total);

  // Contract sum to date = original + change orders
  const contractSumToDate = originalContractSum + netChangeByChangeOrders;

  // Sum all line items for this payment app
  const totalCompletedAndStored = lineItems.reduce(
    (sum, item) => sum + Number(item.totalCompletedAndStored),
    0
  );

  const retainage = lineItems.reduce(
    (sum, item) => sum + Number(item.retainageAmount),
    0
  );

  const totalEarnedLessRetainage = totalCompletedAndStored - retainage;

  // Get previous approved payment apps
  const previousPaymentsResult = await tenantDb
    .select({
      total: sql<number>`COALESCE(SUM(${paymentApps.currentPaymentDue}::numeric), 0)`
    })
    .from(paymentApps)
    .where(
      and(
        eq(paymentApps.projectId, projectId),
        eq(paymentApps.status, "approved")
      )
    );

  const lessRevisionsAndPreviousPayments = Number(previousPaymentsResult[0].total);

  // Current payment due = earned less retainage - previous payments
  const currentPaymentDue = totalEarnedLessRetainage - lessRevisionsAndPreviousPayments;

  // Balance to finish = contract sum - total earned (including retainage)
  const balanceToFinish = contractSumToDate - totalCompletedAndStored;

  return {
    originalContractSum,
    netChangeByChangeOrders,
    contractSumToDate,
    totalCompletedAndStored,
    retainage,
    totalEarnedLessRetainage,
    lessRevisionsAndPreviousPayments,
    currentPaymentDue,
    balanceToFinish,
  };
}
```

**Source:** [AIA G702 Application for Payment Guide](https://www.procore.com/library/aia-g702-application-for-payment), [Payment Application Complete Filing Guide](https://www.constructioncostaccounting.com/post/construction-application-for-payment-aia-g702-g703-complete-filing-guide)

### Sequential Payment App Numbering (Reuse Phase 5 Pattern)

```typescript
// apps/api/src/utils/sequential-number.ts
// Extend Phase 5's sequential numbering for payment apps

async function getNextPaymentAppNumber(
  db: NodePgDatabase,
  schema: string,
  projectId: string,
  year: number
): Promise<string> {
  return await db.transaction(async (tx) => {
    const [counter] = await tx
      .select()
      .from(paymentAppCounters)
      .where(
        and(
          eq(paymentAppCounters.projectId, projectId),
          eq(paymentAppCounters.year, year)
        )
      )
      .for("update"); // SELECT FOR UPDATE prevents race conditions

    let nextNumber: number;
    if (!counter) {
      await tx.insert(paymentAppCounters).values({
        projectId,
        year,
        lastNumber: 1,
      });
      nextNumber = 1;
    } else {
      nextNumber = counter.lastNumber + 1;
      await tx
        .update(paymentAppCounters)
        .set({ lastNumber: nextNumber })
        .where(eq(paymentAppCounters.id, counter.id));
    }

    return `PAY-${year}-${String(nextNumber).padStart(3, "0")}`;
  }, { isolationLevel: "serializable" });
}
```

**Source:** Phase 5 change order sequential numbering pattern (verified in codebase)

### Lien Waiver Collection Checklist Component

```typescript
// apps/web/components/payment-app/lien-waiver-tracker.tsx
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface LienWaiverTrackerProps {
  paymentAppId: string;
  projectId: string;
}

export function LienWaiverTracker({ paymentAppId, projectId }: LienWaiverTrackerProps) {
  const { data: waivers, refetch } = trpc.paymentApp.getLienWaivers.useQuery({ paymentAppId });
  const markReceived = trpc.paymentApp.markLienWaiverReceived.useMutation({
    onSuccess: () => refetch(),
  });

  const totalRequired = waivers?.length ?? 0;
  const totalReceived = waivers?.filter(w => w.status === "received").length ?? 0;
  const allReceived = totalRequired > 0 && totalReceived === totalRequired;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Lien Waiver Collection</h3>
        <Badge variant={allReceived ? "success" : "warning"}>
          {totalReceived} / {totalRequired} Received
        </Badge>
      </div>

      {waivers?.map((waiver) => (
        <div key={waiver.id} className="flex items-start gap-3 p-3 border rounded">
          <Checkbox
            checked={waiver.status === "received"}
            onCheckedChange={(checked) => {
              if (checked) {
                markReceived.mutate({ waiverId: waiver.id });
              }
            }}
          />
          <div className="flex-1">
            <div className="font-medium">{waiver.partyName}</div>
            <div className="text-sm text-muted-foreground">
              {waiver.waiverType.replace("_", " ").toUpperCase()} •
              Through {new Date(waiver.throughDate).toLocaleDateString()} •
              ${Number(waiver.amountWaived).toLocaleString()}
            </div>
            {waiver.requiresNotarization && (
              <Badge variant="outline" className="mt-1">Requires Notarization</Badge>
            )}
            {waiver.usesStatutoryForm && (
              <Badge variant="outline" className="mt-1">Statutory Form Required</Badge>
            )}
          </div>
          {waiver.status === "received" && (
            <div className="text-sm text-muted-foreground">
              Received {new Date(waiver.receivedAt!).toLocaleDateString()}
            </div>
          )}
        </div>
      ))}

      {!allReceived && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
          ⚠️ All lien waivers must be received before payment app can be approved.
        </div>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Paper AIA forms with manual calculation | Digital payment apps with auto-calculation | ~2020 (COVID accelerated) | Eliminates arithmetic errors, speeds approval by 50% |
| Single retainage rate (10%) throughout project | Progressive retainage (10% → 5% at milestones) | ~2022 industry shift | Improves subcontractor cash flow, reduces disputes |
| Physical lien waiver collection (mail/fax) | Electronic lien waiver portals | ~2023 | Reduces collection time from weeks to days |
| Monthly AR aging reports via Excel | Real-time aging dashboards | ~2024 | Proactive collection vs reactive, identifies issues before 90+ days |
| Separate invoice tracking from payment apps | Unified payment app = invoice system | ~2025 | Single source of truth, eliminates duplicate entry |
| Hard-coded approval workflows | Database-driven configurable workflows | ~2026 (enterprise tools) | Companies can adjust approval chains without code deployment |

**Deprecated/outdated:**
- **Paper AIA forms:** While still legally valid, digital forms are now standard. PDFs with embedded calculations prevent arithmetic errors.
- **Unconditional lien waivers as default:** Industry shifted to conditional waivers to protect contractors from non-payment.
- **Single retainage rate:** Progressive retainage is now best practice per CFMA guidelines.
- **Manual stored materials tracking:** Modern software requires photos and delivery receipts for stored materials billing.

## Open Questions

1. **Should payment apps support partial approvals (approve some line items, reject others)?**
   - What we know: Some owners want to approve completed work but hold payment on disputed line items
   - What's unclear: Does this complexity belong in v1, or should approvals be all-or-nothing?
   - Recommendation: All-or-nothing for v1. Partial approval requires line-item-level approval workflow, significantly increasing complexity. Users can revise and resubmit if items are disputed.

2. **How should stored materials be verified (photos, delivery receipts)?**
   - What we know: Stored materials billing is fraud risk; requires documentation
   - What's unclear: Should system enforce photo/receipt upload, or just recommend it?
   - Recommendation: Add `requireStoredMaterialsDocumentation` boolean to company config. If enabled, block stored materials billing without attached document IDs. If disabled, show warning only. Start permissive, tighten if needed.

3. **Should retainage release be automatic or manual approval?**
   - What we know: Retainage releases at substantial completion, punch list completion, or final acceptance
   - What's unclear: Should system auto-release when conditions met, or require manual approval?
   - Recommendation: Manual approval with eligibility calculation. Show "Eligible for release: $X" in UI but require explicit "Release Retainage" action by authorized user. Too risky to auto-release funds.

4. **What about subcontractor payment tracking (tier 2 payments)?**
   - What we know: GCs track which subcontractors have been paid from each payment app
   - What's unclear: Is sub payment tracking in scope for Phase 6, or defer to later?
   - Recommendation: Defer to Phase 6.5 or Phase 7. Add `subPaymentTracking` JSONB field to payment_apps for future use, but don't build UI yet. Core payment app functionality is complex enough for v1.

5. **Should payment app PDFs be generated server-side or client-side?**
   - What we know: G702/G703 forms need precise PDF layout matching AIA templates
   - What's unclear: Generate on server (consistent, slower) or client (faster, browser-dependent)?
   - Recommendation: Server-side using PDFKit or similar. Ensures consistent output across all users, supports email attachments, and avoids browser PDF rendering quirks. Accept slightly slower generation for reliability.

## Sources

### Primary (HIGH confidence)
- [PostgreSQL NUMERIC Documentation](https://www.postgresql.org/docs/current/datatype-numeric.html) - Decimal precision for financial calculations
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions) - Transaction isolation for payment app approval
- Existing codebase patterns:
  - Phase 4 budget line item locking and NUMERIC usage
  - Phase 5 approval workflow infrastructure (reusable for payment apps)
  - Phase 5 sequential numbering with SELECT FOR UPDATE

### Secondary (MEDIUM confidence)
- [AIA G702/G703 Forms Guide 2026](https://archdesk.com/blog/2026-guide-to-aia-billing) - AIA billing format and calculations
- [Construction Payment Applications Guide](https://www.procore.com/library/construction-payment-applications) - Industry payment app practices
- [Schedule of Values Guide](https://www.mastt.com/guide/schedule-of-values) - SOV setup and tracking (2026)
- [Understanding SOV and Payment Applications](https://vertexeng.com/insights/understanding-sov-and-payment-applications/) - SOV-to-payment-app relationship
- [Retainage in Construction Guide](https://www.netsuite.com/portal/resource/articles/accounting/retainage.shtml) - Retainage calculation and release
- [Retainage Best Practices](https://constructioncoverage.com/glossary/retainage) - Progressive retainage schedules
- [Lien Waiver Types](https://cofilending.com/the-4-main-types-of-lien-waivers/) - Four lien waiver types explained
- [Lien Waiver Management](https://getbuilt.com/lien-waivers/) - State-specific requirements
- [Procore Lien Waiver Guide](https://support.procore.com/products/online/user-guide/company-level/payments/faq/what-is-a-lien-waiver) - Industry software lien waiver patterns
- [Stored Materials Billing](https://support.procore.com/products/online/user-guide/project-level/invoicing/tutorials/about-stored-materials-on-invoices) - Stored materials requirements
- [Accounts Receivable Aging Report](https://quickbooks.intuit.com/r/payments/accounts-receivable-aging-report/) - AR aging bucket structure
- [Construction AR Explained](https://planyard.com/blog/construction-accounts-receivable-explained) - Construction-specific AR patterns
- [AP Aging Report Guide](https://tipalti.com/resources/learn/accounts-payable-aging-report/) - AP aging calculation
- [Percentage of Completion Method](https://www.procore.com/library/percentage-of-completion) - Work-in-place calculation formulas
- [Progress Payments Guide](https://www.procore.com/library/progress-payments) - Payment period tracking

### Tertiary (LOW confidence - marked for validation)
- Various construction payment software vendor blogs (GCPay, Payapps, Bauwise) - Provide feature ideas but lack technical implementation details
- General workflow approval software comparisons - Not construction-specific, limited applicability

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already in project (PostgreSQL NUMERIC, Drizzle, tRPC, Zod, CASL)
- Architecture patterns: MEDIUM-HIGH - AIA G702/G703 format verified from authoritative sources; lien waiver types industry-standard; SOV patterns verified from multiple construction sources; retainage calculations based on NetSuite and Construction Coverage guides
- Pitfalls: MEDIUM - Based on Procore best practices (MEDIUM), existing project patterns from Phases 4-5 (HIGH), and general construction industry knowledge
- Integration points: HIGH - Phase 4 budget actuals update, Phase 5 approval workflow reuse verified from existing codebase

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days for stable technologies; construction billing standards change slowly, PostgreSQL and existing stack are mature)
