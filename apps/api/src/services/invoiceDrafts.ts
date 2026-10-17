import { eq, sql } from "drizzle-orm";
import { computeSchedule, formatDocNumber } from "@construction/shared";
import type { buildTenantContext } from "../tenant/context.js";

type Tenant = NonNullable<Awaited<ReturnType<typeof buildTenantContext>>>;
/** A database handle or a transaction on it. */
type Conn = Tenant["db"] | Parameters<Parameters<Tenant["db"]["transaction"]>[0]>[0];

const seqOf = (number: string) => Number(/-(\d+)$/.exec(number)?.[1] ?? 0);

/**
 * The highest invoice sequence a project has ever used: the larger of the numbers on its invoices now and the number
 * remembered when invoices were merged away. A number is never given out twice, even after its invoice is gone.
 */
export async function lastInvoiceSeq(db: Conn, schema: Tenant["schema"], projectId: string, numbers?: string[]): Promise<number> {
  const rows = numbers ?? (await db.select({ number: schema.invoices.number }).from(schema.invoices).where(eq(schema.invoices.projectId, projectId))).map((r) => r.number);
  const [p] = await db.select({ metadata: schema.projects.metadata }).from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  const remembered = Number((p?.metadata as Record<string, unknown> | undefined)?.invoiceSeq ?? 0) || 0;
  return Math.max(remembered, rows.reduce((a, n) => Math.max(a, seqOf(n)), 0));
}

/** Remember that this project has used invoice numbers up to `seq`. */
export async function rememberInvoiceSeq(db: Conn, schema: Tenant["schema"], projectId: string, seq: number): Promise<void> {
  await db
    .update(schema.projects)
    .set({ metadata: sql`jsonb_set(coalesce(${schema.projects.metadata}, '{}'::jsonb), '{invoiceSeq}', to_jsonb(greatest(coalesce((${schema.projects.metadata}->>'invoiceSeq')::int, 0), ${seq}::int)))` })
    .where(eq(schema.projects.id, projectId));
}

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
    roundToDollar?: boolean;
    milestones: Array<{ id: string; name: string; percent: number }>;
    paymentTerms: string | null;
    userId: string;
  }
) {
  const rows = computeSchedule(input.contractValueCents, input.milestones, input.roundToDollar === true);
  // Numbers continue from the project's last invoice, so change order invoices follow the proposal's.
  const existing = await db
    .select({ number: schema.invoices.number, sortOrder: schema.invoices.sortOrder })
    .from(schema.invoices)
    .where(eq(schema.invoices.projectId, input.projectId));
  const lastSeq = await lastInvoiceSeq(db, schema, input.projectId, existing.map((r) => r.number));
  const lastSort = existing.reduce((a, r) => Math.max(a, r.sortOrder), -1);
  const values = input.milestones.map((m, i) => ({
    projectId: input.projectId,
    estimateId: input.estimateId,
    milestoneId: m.id,
    number: formatDocNumber("INV", input.jobNumber, lastSeq + i + 1),
    milestoneName: m.name,
    percent: String(m.percent),
    amount: String((rows.find((r) => r.id === m.id)?.amount ?? 0) / 100),
    status: "draft",
    paymentTerms: input.paymentTerms,
    sortOrder: lastSort + i + 1,
    createdBy: input.userId,
  }));
  if (values.length === 0) return [];
  const made = await db.insert(schema.invoices).values(values).returning({ id: schema.invoices.id, number: schema.invoices.number });
  await rememberInvoiceSeq(db, schema, input.projectId, lastSeq + values.length);
  return made;
}
