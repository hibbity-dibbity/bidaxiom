"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePdfDownload } from "@/lib/pdf-download";
import { EmailDocumentDialog } from "@/components/shared/email-document-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge, dollars, shortDate } from "@/components/invoices/invoice-ui";
import { dueDateFor } from "@construction/shared";

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #invoice-doc, #invoice-doc * { visibility: visible !important; }
  #invoice-doc { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
}
`;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const field = "h-9 rounded-md border bg-background px-2 text-sm";

/** Invoice as the customer receives it, with the actions to send it and record payments. */
export default function InvoicePage({ params }: { params: { projectSlug: string; invoiceId: string } }) {
  const { projectSlug, invoiceId } = params;
  const pdf = usePdfDownload();
  const [emailOpen, setEmailOpen] = React.useState(false);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.invoice.get.useQuery({ invoiceId }, { refetchOnMount: "always" });
  const [sentOn, setSentOn] = React.useState(today());
  const [dueOn, setDueOn] = React.useState("");
  const [dueTouched, setDueTouched] = React.useState(false);
  const [pay, setPay] = React.useState({ amount: "", date: today(), reference: "" });

  const refresh = () => {
    utils.invoice.get.invalidate({ invoiceId });
    utils.invoice.list.invalidate();
  };
  const fail = (title: string) => (e: { message: string }) => toast.error(title, { description: e.message });
  const send = trpc.invoice.send.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as sent");
      refresh();
    },
    onError: fail("Could not send"),
  });
  const notes = trpc.invoice.updateNotes.useMutation({ onSuccess: refresh, onError: fail("Could not save the note") });
  const record = trpc.invoice.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded");
      setPay({ amount: "", date: today(), reference: "" });
      refresh();
    },
    onError: fail("Could not record the payment"),
  });
  const [sendingPaid, setSendingPaid] = React.useState(false);
  const remove = trpc.invoice.deletePayment.useMutation({ onSuccess: refresh, onError: fail("Could not delete the payment") });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const inv = data.invoice;
  const draft = inv.status === "draft";
  const computedDue = dueDateFor(sentOn, inv.paymentTerms);
  const effectiveDue = dueTouched && dueOn ? dueOn : computedDue;
  const sendAndPay = async () => {
    setSendingPaid(true);
    try {
      await send.mutateAsync({ invoiceId, sentOn, dueOn: effectiveDue });
      await record.mutateAsync({ invoiceId, amount: inv.amount, receivedAt: today(), reference: null });
    } catch {
      /* the mutation handlers already show the error */
    } finally {
      setSendingPaid(false);
      refresh();
    }
  };
  const heading = [data.projectNumber, data.projectName].filter(Boolean).join(" - ") || "Invoice";

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>
      <EmailDocumentDialog kind="invoice" id={invoiceId} open={emailOpen} onOpenChange={setEmailOpen} onSent={() => { utils.invoice.get.invalidate({ invoiceId }); utils.invoice.list.invalidate(); }} />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{inv.number}</h1>
          <InvoiceStatusBadge status={inv.status} overdue={inv.overdue} amount={inv.amount} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/projects/${projectSlug}/invoices`}>Back to invoices</Link>
          </Button>
          <Button type="button" variant="outline" disabled={pdf.pending} onClick={() => pdf.download("invoice", invoiceId)}>
            {pdf.pending ? "Making PDF..." : "Download PDF"}
          </Button>
          <Button type="button" variant="outline" disabled={inv.amount === 0} onClick={() => setEmailOpen(true)}>
            {inv.status === "draft" ? "Email to customer" : "Email again"}
          </Button>
        </div>
      </div>

      {draft && (
        <div className="space-y-3 rounded-md border bg-muted px-4 py-3 text-sm print:hidden">
          <div>
            <strong>Draft.</strong> Sending is a separate step. It sets the date sent and the due date and locks the invoice. Email delivery is not set up yet, so use Download PDF to send it to {data.customerName ?? "the customer"}.
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">Date sent</span>
              <input type="date" className={field} value={sentOn} onChange={(e) => setSentOn(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">Due date{inv.paymentTerms ? ` (${inv.paymentTerms})` : ""}</span>
              <input
                type="date"
                className={field}
                value={effectiveDue}
                onChange={(e) => {
                  setDueTouched(true);
                  setDueOn(e.target.value);
                }}
              />
            </label>
            <Button type="button" disabled={send.isPending || inv.amount === 0} onClick={() => send.mutate({ invoiceId, sentOn, dueOn: effectiveDue })}>
              Send {inv.number}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={sendingPaid || send.isPending || inv.amount === 0}
              onClick={sendAndPay}
            >
              Send and mark paid in full
            </Button>
          </div>
          <label className="block space-y-1">
            <span className="block text-xs uppercase tracking-wider text-muted-foreground">Note printed on the invoice (optional)</span>
            <textarea
              key={inv.notes ?? ""}
              rows={2}
              defaultValue={inv.notes ?? ""}
              className="w-full rounded-md border bg-background p-2 text-sm"
              onBlur={(e) => e.target.value !== (inv.notes ?? "") && notes.mutate({ invoiceId, notes: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </label>
        </div>
      )}

      <div className="flex justify-center rounded-md border bg-muted p-6 print:border-0 print:bg-transparent print:p-0">
        <div id="invoice-doc" className="flex w-full max-w-[860px] flex-col gap-8 border bg-background px-16 py-14 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Invoice {inv.number}</div>
              <div className="text-[28px] font-bold leading-tight tracking-tight">{heading}</div>
              <div className="text-sm text-muted-foreground">Bill to {data.customerName ?? "[Customer]"}</div>
              {data.projectAddress && <div className="text-sm text-muted-foreground">{data.projectAddress}</div>}
            </div>
            <div className="text-right text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{data.companyName}</span>
              {data.companyContact.map((line) => (
                <React.Fragment key={line}>
                  <br />
                  {line}
                </React.Fragment>
              ))}
              <br />
              {draft ? "Draft" : `Date sent ${shortDate(inv.sentOn)}`}
              {!draft && (
                <>
                  <br />
                  Due {shortDate(inv.dueOn)}
                  {inv.paymentTerms ? ` · ${inv.paymentTerms}` : ""}
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {data.items.length > 0 ? "Billing milestones" : "Billing milestone"}
            </div>
            <div className="border-y">
              {data.items.length > 0 ? (
                data.items.map((x) => (
                  <div key={x.id} className="grid grid-cols-[1fr_auto] gap-x-8 border-b py-3 text-sm last:border-0">
                    <div>
                      <div className="font-semibold">{x.label}</div>
                      <div className="text-muted-foreground">
                        {x.percent > 0 ? `${x.percent}% of ` : ""}{x.sourceLabel}, per its invoicing schedule.
                      </div>
                    </div>
                    <div className="text-right text-base font-semibold tabular-nums">{dollars(x.amount)}</div>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-[1fr_auto] gap-x-8 py-3 text-sm">
                  <div>
                    <div className="font-semibold">{inv.milestoneName}</div>
                    <div className="text-muted-foreground">
                      {inv.percent}% of {data.source?.kind === "change_order" ? `change order ${data.source.label}` : `the contract value, per the invoicing schedule in the proposal${data.source && data.source.revision > 0 ? ` (Rev ${data.source.revision})` : ""}`}
                      {data.source?.kind === "change_order" ? ", per its invoicing schedule" : ""}.
                    </div>
                  </div>
                  <div className="text-right text-base font-semibold tabular-nums">{dollars(inv.amount)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto w-full max-w-sm space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Contract value{data.hasChangeOrders ? " (with change orders)" : ""}</span><span className="tabular-nums">{dollars(data.contractValue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">This invoice{data.items.length === 0 ? ` (${inv.milestoneName})` : ""}</span><span className="tabular-nums">{dollars(inv.amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Billed through this invoice</span><span className="tabular-nums">{dollars(data.billedThroughThis)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Remaining to bill</span><span className="tabular-nums">{dollars(data.balanceAfterThis)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Amount due</span><span className="tabular-nums">{dollars(inv.amount)}</span></div>
          </div>

          {inv.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{inv.notes}</p>}
          {inv.paymentTerms && <p className="text-xs text-muted-foreground">Payment terms: {inv.paymentTerms}.</p>}
        </div>
      </div>

      {!draft && (
        <section id="payments" className="space-y-2 print:hidden">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Payments received</h2>
            <span className="text-sm text-muted-foreground">
              Received {dollars(data.received)} · Outstanding {dollars(data.outstanding ?? 0)}
            </span>
          </div>
          <ul className="divide-y rounded-md border bg-background text-sm">
            {data.payments.length === 0 && <li className="px-3 py-2 text-muted-foreground">No payments recorded.</li>}
            {data.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {shortDate(p.receivedAt)}
                  {p.reference && <span className="ml-2 text-muted-foreground">{p.reference}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{dollars(p.amount)}</span>
                  <button type="button" aria-label="Delete payment" className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate({ paymentId: p.id })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {inv.status !== "paid" && (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const amount = Number(pay.amount);
                if (Number.isFinite(amount) && amount > 0) record.mutate({ invoiceId, amount, receivedAt: pay.date, reference: pay.reference.trim() || null });
              }}
            >
              <input aria-label="Payment amount" type="number" step="0.01" min={0} placeholder="Amount" className={field + " w-36 text-right"} value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} />
              <input aria-label="Date received" type="date" className={field + " w-40"} value={pay.date} onChange={(e) => setPay((p) => ({ ...p, date: e.target.value }))} />
              <input aria-label="Payment reference" placeholder="Check or ACH reference" className={field + " max-w-xs"} value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} />
              <Button type="submit" size="sm" disabled={record.isPending}>Record payment</Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={record.isPending || (data.outstanding ?? 0) <= 0}
                onClick={() => record.mutate({ invoiceId, amount: data.outstanding ?? 0, receivedAt: pay.date, reference: pay.reference.trim() || null })}
              >
                Mark paid in full ({dollars(data.outstanding ?? 0)})
              </Button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
