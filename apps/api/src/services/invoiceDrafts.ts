import { computeSchedule, formatDocNumber } from "@construction/shared";
import type { buildTenantContext } from "../tenant/context.js";

type Tenant = NonNullable<Awaited<ReturnType<typeof buildTenantContext>>>;

/**
 * Create one draft invoice per invoicing-schedule milestone, numbered INV<job number>-01, -02 ...
 * Amounts follow the contract value; the last milestone absorbs rounding. Sent later by hand.
 */
export async function createInvoiceDrafts(
  db: Tenant["db"],
  schema: Tenant["schema"],
  input: {
    projectId: string;
    estimateId: string;
    jobNumber: string | null;
    contractValueCents: number;
    milestones: Array<{ id: string; name: string; percent: number }>;
    paymentTerms: string | null;
    userId: string;
  }
) {
  const rows = computeSchedule(input.contractValueCents, input.milestones);
  const values = input.milestones.map((m, i) => ({
    projectId: input.projectId,
    estimateId: input.estimateId,
    milestoneId: m.id,
    number: formatDocNumber("INV", input.jobNumber, i + 1),
    milestoneName: m.name,
    percent: String(m.percent),
    amount: String((rows.find((r) => r.id === m.id)?.amount ?? 0) / 100),
    status: "draft",
    paymentTerms: input.paymentTerms,
    sortOrder: i,
    createdBy: input.userId,
  }));
  if (values.length === 0) return [];
  return db.insert(schema.invoices).values(values).returning({ id: schema.invoices.id, number: schema.invoices.number });
}
