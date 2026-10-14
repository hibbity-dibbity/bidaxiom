"use client";

import * as React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePdfDownload } from "@/lib/pdf-download";
import { EmailDocumentDialog } from "@/components/shared/email-document-dialog";
import { dollars, shortDate } from "@/components/invoices/invoice-ui";
import { revisionLabel } from "@construction/shared";

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #order-doc, #order-doc * { visibility: visible !important; }
  #order-doc { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
}
`;

/**
 * Purchase or work order as the vendor receives it. Shows the projected cost per line (never the
 * proposal budget or the customer price).
 */
export default function OrderDocumentPage({ params }: { params: { projectSlug: string; orderId: string } }) {
  const { projectSlug, orderId } = params;
  const { data, isLoading, error } = trpc.order.get.useQuery({ orderId });
  const pdf = usePdfDownload();
  const [emailOpen, setEmailOpen] = React.useState(false);

  if (error) return <p className="text-sm text-financial-negative">Could not load the order: {error.message}</p>;
  if (isLoading || !data) return <Skeleton className="h-[600px] w-full" />;

  const o = data.order;
  const isWork = o.kind === "work";
  const title = isWork ? "Work Order" : "Purchase Order";
  const draft = o.status === "draft";
  const lineLabel = isWork ? "Scope of work" : "Item";

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{o.number} {o.revision > 0 ? `(${revisionLabel(o.revision)})` : ""}</h1>
          <p className="text-sm text-muted-foreground">What {data.vendor?.name ?? "the vendor"} receives.{draft ? " This order is still a draft." : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href={`/projects/${projectSlug}/orders/${orderId}`}>Back to order</Link></Button>
          <Button type="button" variant="outline" disabled={pdf.pending} onClick={() => pdf.download("order", orderId)}>
            {pdf.pending ? "Making PDF..." : "Download PDF"}
          </Button>
          <Button type="button" disabled={draft} title={draft ? "Issue the order first" : undefined} onClick={() => setEmailOpen(true)}>
            Email to vendor
          </Button>
        </div>
      </div>

      <EmailDocumentDialog kind="order" id={orderId} open={emailOpen} onOpenChange={setEmailOpen} />

      <div className="flex justify-center rounded-md border bg-muted p-6 print:border-0 print:bg-transparent print:p-0">
        <div id="order-doc" className="flex w-full max-w-[860px] flex-col gap-8 border bg-background px-16 py-14 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {title} {o.number}{o.revision > 0 ? ` · ${revisionLabel(o.revision)}` : ""}
              </div>
              <div className="text-[28px] font-bold leading-tight tracking-tight">{data.project?.name ?? title}</div>
              <div className="text-sm text-muted-foreground">To {data.vendor?.name ?? "[Vendor]"}</div>
              {data.project?.jobNumber && <div className="text-sm text-muted-foreground">Project {data.project.jobNumber}</div>}
            </div>
            <div className="text-right text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{data.companyName}</span>
              {data.companyContact.map((line) => (
                <React.Fragment key={line}><br />{line}</React.Fragment>
              ))}
              <br />
              {draft ? "Draft" : `Issued ${o.issuedAt ? new Date(o.issuedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}`}
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {o.orderDate && <div><span className="text-muted-foreground">Order date </span>{shortDate(o.orderDate)}</div>}
            {!isWork && o.deliveryDate && <div><span className="text-muted-foreground">Delivery date </span>{shortDate(o.deliveryDate)}</div>}
            {!isWork && o.shipTo && <div className="sm:col-span-2"><span className="text-muted-foreground">Ship to </span>{o.shipTo}</div>}
            {isWork && o.startDate && <div><span className="text-muted-foreground">Start </span>{shortDate(o.startDate)}</div>}
            {isWork && o.finishDate && <div><span className="text-muted-foreground">Finish </span>{shortDate(o.finishDate)}</div>}
            {o.paymentTerms && <div><span className="text-muted-foreground">Payment terms </span>{o.paymentTerms}</div>}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{lineLabel}</div>
            <div className="border-y">
              {data.lines.map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_auto] gap-x-8 border-b py-3 text-sm last:border-0">
                  <div>
                    <div className="font-semibold">{l.description}</div>
                    {isWork && l.exclusions && <div className="text-muted-foreground">Excludes: {l.exclusions}</div>}
                  </div>
                  <div className="text-right text-base font-semibold tabular-nums">{dollars(l.projectedCost)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ml-auto w-full max-w-sm space-y-1.5 text-sm">
            {!isWork && o.shipping && Number(o.shipping) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="tabular-nums">{dollars(Number(o.shipping))}</span></div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Order total</span>
              <span className="tabular-nums">{dollars(data.projectedTotal + (!isWork && o.shipping ? Number(o.shipping) : 0))}</span>
            </div>
          </div>

          {(o.insuranceRequired || o.lienWaiverRequired) && (
            <p className="text-sm text-muted-foreground">
              {[o.insuranceRequired ? "Current certificate of insurance required." : null, o.lienWaiverRequired ? "Lien waiver required with each payment request." : null].filter(Boolean).join(" ")}
            </p>
          )}
          {o.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{o.notes}</p>}
        </div>
      </div>
    </div>
  );
}
