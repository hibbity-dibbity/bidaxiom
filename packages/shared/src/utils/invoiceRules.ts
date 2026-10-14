/**
 * Customer invoice rules. Pure, so the API and the screens agree.
 *
 * - One draft invoice per invoicing-schedule milestone is created when a proposal is accepted.
 * - Sending is a separate manual action; it sets the date sent and the due date (from payment terms).
 * - Sent invoices never change. If the contract value changes later, only invoices not yet sent
 *   are re-amounted so the schedule still adds up to the new contract value.
 * - Status follows what the customer has paid against the invoice.
 */

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid";

export function isSent(status: string): boolean {
  return status === "sent" || status === "partially_paid" || status === "paid";
}

/** Days until due for the payment terms offered in the proposal builder. */
export function termsDays(terms: string | null | undefined): number {
  const t = (terms ?? "").trim().toLowerCase();
  if (t === "" || t === "due on receipt") return 0;
  const m = /^net\s+(\d{1,3})$/.exec(t);
  return m ? Number(m[1]) : 0;
}

/** Add days to a YYYY-MM-DD date and return YYYY-MM-DD (UTC math, so no time zone drift). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function dueDateFor(sentOn: string, terms: string | null | undefined): string {
  return addDays(sentOn, termsDays(terms));
}

/** Status after sending or a payment change. Amounts are in dollars. */
export function statusAfterReceipts(received: number, amount: number): "sent" | "partially_paid" | "paid" {
  if (received <= 0) return "sent";
  return received + 0.005 >= amount ? "paid" : "partially_paid";
}

/** A sent invoice with money still owed and a due date before today. */
export function isOverdue(status: string, dueOn: string | null, today: string): boolean {
  return (status === "sent" || status === "partially_paid") && !!dueOn && dueOn < today;
}

export interface DraftInvoiceInput {
  id: string;
  percent: number;
  /** cents */
  amountCents: number;
  sent: boolean;
}

/**
 * After the contract value changes, re-amount the invoices that have not been sent so everything
 * adds up to the new contract value. Sent invoices keep their amounts. Unsent amounts are split in
 * proportion to their schedule percents; the last one absorbs rounding. If nothing is left to
 * invoice (or sent invoices already exceed the contract), unsent invoices get 0 and the
 * difference is returned as leftoverCents so the caller can surface it.
 */
export function rebalanceUnsent(
  contractValueCents: number,
  invoices: DraftInvoiceInput[]
): { rows: Array<{ id: string; amountCents: number }>; leftoverCents: number } {
  const sentTotal = invoices.filter((i) => i.sent).reduce((a, i) => a + i.amountCents, 0);
  const unsent = invoices.filter((i) => !i.sent);
  const remaining = contractValueCents - sentTotal;
  if (unsent.length === 0) return { rows: [], leftoverCents: remaining };
  if (remaining <= 0) return { rows: unsent.map((i) => ({ id: i.id, amountCents: 0 })), leftoverCents: remaining };
  const weight = unsent.reduce((a, i) => a + Math.max(i.percent, 0), 0);
  const rows = unsent.map((i) => ({
    id: i.id,
    amountCents: Math.round(weight > 0 ? (remaining * Math.max(i.percent, 0)) / weight : remaining / unsent.length),
  }));
  rows[rows.length - 1].amountCents += remaining - rows.reduce((a, r) => a + r.amountCents, 0);
  return { rows, leftoverCents: 0 };
}
