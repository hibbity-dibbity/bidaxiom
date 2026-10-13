"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #proposal-doc, #proposal-doc * { visibility: visible !important; }
  #proposal-doc { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
}
`;

/**
 * Customer view: exactly what the customer receives. Hidden lines, costs, margins,
 * contingency and internal notes are never included (the API builds this from an allow-list).
 */
export default function ProposalPreviewPage({
  params,
}: {
  params: { projectSlug: string; estimateSlug: string };
}) {
  const { projectSlug, estimateSlug } = params;
  const utils = trpc.useUtils();
  const { data: estimate } = trpc.estimates.getBySlug.useQuery({ slug: estimateSlug });
  const estimateId = estimate?.id ?? "";
  const { data, isLoading, error } = trpc.proposal.customerView.useQuery(
    { estimateId },
    { enabled: !!estimateId, refetchOnMount: "always" }
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const send = trpc.proposal.send.useMutation({
    onSuccess: (r) => {
      toast.success(`Proposal marked as sent. Terms version ${r.termsVersion} saved with it.`);
      setConfirmOpen(false);
      utils.proposal.customerView.invalidate({ estimateId });
      utils.proposal.get.invalidate({ estimateId });
    },
    onError: (e) => {
      setConfirmOpen(false);
      toast.error("Could not send", { description: e.message });
    },
  });

  const builderHref = `/projects/${projectSlug}/estimates/${estimateSlug}`;

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-financial-negative">Could not load the customer view: {error.message}</p>
        <Button asChild variant="outline"><Link href={builderHref}>Back to builder</Link></Button>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const { view } = data;
  const customer = data.customerName ?? "the customer";
  const sent = data.status === "submitted";
  const dateLabel = new Date(data.sentAt ?? Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Customer view</h1>
            {sent && <StatusBadge variant="pending">Sent {new Date(data.sentAt!).toLocaleDateString()}</StatusBadge>}
          </div>
          <p className="text-muted-foreground">
            What {customer} receives. Hidden lines and cost details are not shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href={builderHref}>Back to builder</Link></Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>Download PDF</Button>
          {!sent && (
            <Button type="button" disabled={!!data.blocker || send.isPending} onClick={() => setConfirmOpen(true)}>
              Send to customer
            </Button>
          )}
        </div>
      </div>

      {data.blocker && !sent && (
        <div className="rounded-md border border-financial-pending/40 bg-muted px-4 py-3 text-sm print:hidden">
          <strong>Not ready to send.</strong> {data.blocker}
        </div>
      )}

      <div className="flex justify-center rounded-md border bg-muted p-6 print:border-0 print:bg-transparent print:p-0">
        <div id="proposal-doc" className="flex w-full max-w-[860px] flex-col gap-8 border bg-background px-16 py-14 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Proposal</div>
              <div className="text-[28px] font-bold leading-tight tracking-tight">{data.title}</div>
              <div className="text-sm text-muted-foreground">Prepared for {data.customerName ?? "[Customer]"}</div>
              {(data.projectName || data.projectAddress) && (
                <div className="text-sm text-muted-foreground">
                  {[data.projectName, data.projectAddress].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <div className="text-right text-[13px] leading-relaxed text-muted-foreground">
              {data.companyName}
              {data.proposalNumber && <><br />{data.proposalNumber}</>}
              <br />
              {dateLabel} · valid {data.validDays} days
              {data.revision > 1 && <><br />Revision {data.revision}</>}
            </div>
          </div>

          <section>
            <SectionHead left="Scope of work" right="Price" />
            {view.groups.map((g) => (
              <div key={g.id} className="flex flex-col gap-1.5 border-b py-3.5">
                <div className="flex justify-between text-[15px] font-semibold">
                  <span>{g.name}</span>
                  <span className="tabular-nums">{money(g.price)}</span>
                </div>
                {g.lines.length > 0 && (
                  <div className="flex flex-col gap-0.5 pl-5 text-sm text-muted-foreground">
                    {g.lines.map((l) => (
                      <div key={l.id} className="flex justify-between">
                        <span>{l.name}</span>
                        {l.mode === "price" && l.price !== null && (
                          <span className="tabular-nums italic">{money(l.price)} included above</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-col items-end gap-1.5 pb-2 pt-3.5">
              <TotalRow label="Subtotal" value={money(view.subtotal)} />
              <TotalRow label="Sales tax" value={money(view.tax)} />
              <div className="mt-1 flex w-[300px] justify-between border-t-2 border-foreground pt-2 text-lg font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(view.total)}</span>
              </div>
            </div>
          </section>

          {view.options.length > 0 && (
            <section>
              <SectionHead left="Optional items (not included in the total)" right="Price" />
              {view.options.map((o) => (
                <div key={o.id} className="flex flex-col gap-1.5 border-b py-3">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex-1 font-medium">{o.name}</span>
                    <span className="whitespace-nowrap text-[13px] text-muted-foreground">☐ Accept&nbsp;&nbsp;☐ Decline</span>
                    <span className="w-28 text-right font-semibold tabular-nums">{money(o.price)}</span>
                  </div>
                  {o.lines.length > 0 && (
                    <div className="flex flex-col gap-0.5 pl-5 text-[13px] text-muted-foreground">
                      {o.lines.map((l) => (
                        <div key={l.id} className="flex justify-between">
                          <span>{l.name}</span>
                          {l.mode === "price" && l.price !== null && (
                            <span className="tabular-nums italic">{money(l.price)} included above</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-2 text-xs text-muted-foreground">Sales tax is added to accepted material items.</div>
            </section>
          )}

          <section>
            <SectionHead left="Invoicing schedule" right={data.paymentTerms} />
            <div className="grid grid-cols-[1fr_64px_120px] gap-x-3 text-sm">
              {view.schedule.map((m) => (
                <React.Fragment key={m.id}>
                  <span className="border-b py-2.5">{m.name}</span>
                  <span className="border-b py-2.5 text-right tabular-nums">{m.percent}%</span>
                  <span className="border-b py-2.5 text-right tabular-nums">{money(m.amount)}</span>
                </React.Fragment>
              ))}
            </div>
            {view.options.length > 0 && (
              <div className="pt-2 text-xs text-muted-foreground">
                Amounts shown for the base proposal. Accepted options are invoiced on the same percentages.
              </div>
            )}
          </section>

          <section>
            <SectionHead left="Terms and conditions" right={`Master terms, version ${data.terms.version}`} />
            <div className="flex flex-col gap-3.5 pt-3.5 text-[13px] leading-relaxed text-muted-foreground">
              {data.terms.sections.map((s, i) => (
                <div key={s.id}>
                  <strong className="text-foreground">{i + 1}. {s.title}</strong>
                  {s.body && <div className="whitespace-pre-wrap">{s.body}</div>}
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-12 pt-4">
            <div className="min-w-[240px] flex-1 border-t border-foreground pt-2 text-xs text-muted-foreground">Accepted by (signature and date)</div>
            <div className="min-w-[240px] flex-1 border-t border-foreground pt-2 text-xs text-muted-foreground">{data.companyName} (signature and date)</div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this proposal as sent?</AlertDialogTitle>
            <AlertDialogDescription>
              The proposal is recorded as sent and locked, and keeps the current master terms (version {data.terms.version}).
              Later changes to your terms will not change it. To change it after sending, create a revision. Email delivery is not set up yet, so use Download PDF to send it to {customer}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); send.mutate({ estimateId }); }}>
              {send.isPending ? "Sending…" : "Mark as sent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionHead({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex justify-between border-b-2 border-foreground pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[300px] justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
