"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { BlurNumber, BlurText, InsuranceWarning, OrderStatusBadge, dollars, fieldCls, signed } from "./order-ui";
import { revisionLabel } from "@construction/shared";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";

const TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 45"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function OrderDetail({ projectSlug, orderId }: { projectSlug: string; orderId: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.order.get.useQuery({ orderId });
  const { data: vendors } = trpc.order.vendorOptions.useQuery();
  const [reason, setReason] = React.useState("");

  const refresh = () => {
    utils.order.get.invalidate({ orderId });
    utils.order.listForEstimate.invalidate();
  };
  const fail = (title: string) => (e: { message: string }) => toast.error(title, { description: e.message });
  const update = trpc.order.update.useMutation({ onSuccess: refresh, onError: fail("Could not save") });
  const updateLine = trpc.order.updateLine.useMutation({ onSuccess: refresh, onError: fail("Could not save the line") });
  const issue = trpc.order.issue.useMutation({
    onSuccess: () => {
      toast.success("Order issued");
      setReason("");
      refresh();
    },
    onError: fail("Could not issue"),
  });
  const revise = trpc.order.revise.useMutation({
    onSuccess: (r) => {
      toast.success(`Reopened as Rev ${r.revision} draft`);
      refresh();
    },
    onError: fail("Could not revise"),
  });

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const { order: o } = data;
  const isWork = o.kind === "work";
  const locked = !data.canEdit;
  const noun = isWork ? "Work order" : "Purchase order";
  const vendorName = data.vendor?.name ?? (isWork ? "subcontractor not assigned" : "vendor not assigned");
  const pickable = vendors ?? [];
  const reviewHref = data.estimate ? `/projects/${projectSlug}/estimates/${data.estimate.slug}/orders` : `/projects/${projectSlug}/estimates`;
  const save = (patch: Record<string, unknown>) => update.mutate({ orderId, ...patch } as never);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href={reviewHref} className="hover:underline">
          Review orders
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{o.number}</span>
      </nav>
      <PageHeader
        title={`${o.number}, ${vendorName}`}
        description={
          isWork
            ? "Scope sent to the subcontractor to confirm it matches yours."
            : "Materials ordered from one vendor. Choose the vendor you will send this to, which can differ from the vendor you priced with."
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={reviewHref}>Back to review</Link>
            </Button>
            {locked ? (
              data.canRevise && (
                <Button type="button" disabled={revise.isPending} onClick={() => revise.mutate({ orderId })}>
                  Revise {o.number}
                </Button>
              )
            ) : (
              <Button
                type="button"
                disabled={data.blockers.length > 0 || issue.isPending}
                title={data.blockers[0]}
                onClick={() => issue.mutate({ orderId, reason: reason.trim() || undefined })}
              >
                Issue {o.number}
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <OrderStatusBadge status={o.status} revision={o.revision} />
        <span className="text-sm text-muted-foreground">
          {data.project ? `${data.project.jobNumber ?? ""} ${data.project.name ?? ""}`.trim() : ""}
        </span>
        <InsuranceWarning message={data.insurance.message} />
        {!locked && data.blockers.length > 0 && <span className="text-sm text-financial-pending">{data.blockers[0]}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-md border bg-background">
            <div className="grid grid-cols-[1fr_110px_130px_110px_1.2fr] items-center gap-2 border-b bg-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{isWork ? "Scope line" : "Item"}</span>
              <span className="text-right">Budget</span>
              <span className="text-right">Projected</span>
              <span className="text-right">Difference</span>
              <span>{isWork ? "Exclusions" : "Category"}</span>
            </div>
            {data.lines.map((l) => (
              <div key={l.id} className="grid grid-cols-[1fr_110px_130px_110px_1.2fr] items-center gap-2 border-b px-3 py-1.5 text-sm">
                <div>{l.description}</div>
                <div className="text-right tabular-nums">{dollars(l.budgetCost)}</div>
                <BlurNumber label={`Projected cost for ${l.description}`} value={l.projectedCost} disabled={locked} onSave={(v) => updateLine.mutate({ lineId: l.id, projectedCost: v })} />
                <div className="text-right tabular-nums text-muted-foreground">{signed(l.projectedCost - l.budgetCost)}</div>
                {isWork ? (
                  <BlurText label={`Exclusions for ${l.description}`} value={l.exclusions} disabled={locked} placeholder="Not included" onSave={(v) => updateLine.mutate({ lineId: l.id, exclusions: v })} />
                ) : (
                  <div className="text-xs text-muted-foreground">{l.category}</div>
                )}
              </div>
            ))}
            <div className="grid grid-cols-[1fr_110px_130px_110px_1.2fr] items-center gap-2 px-3 py-2 text-sm font-semibold">
              <span>Order total</span>
              <span className="text-right tabular-nums">{dollars(data.budgetTotal)}</span>
              <span className="text-right tabular-nums">{dollars(data.projectedTotal)}</span>
              <span className="text-right tabular-nums">{signed(data.projectedTotal - data.budgetTotal)}</span>
              <span />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">{isWork ? "Scope notes and assumptions" : "Order notes"}</h2>
            <textarea
              key={o.notes ?? ""}
              aria-label="Notes"
              disabled={locked}
              defaultValue={o.notes ?? ""}
              rows={4}
              className="w-full rounded-md border bg-background p-2 text-sm disabled:opacity-70"
              onBlur={(e) => e.target.value !== (o.notes ?? "") && save({ notes: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Revision history</h2>
            <ul className="divide-y rounded-md border bg-background text-sm">
              {!locked && (
                <li className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    <strong>{revisionLabel(o.revision)}</strong> <span className="text-muted-foreground">
                      {o.revision === 0 ? "Draft created from the accepted proposal" : "Draft, not yet issued"}
                    </span>
                  </span>
                  {o.revision > 0 && (
                    <input
                      aria-label="Reason for this revision"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for this revision"
                      className={fieldCls + " max-w-xs"}
                    />
                  )}
                </li>
              )}
              {data.revisions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    <strong>{revisionLabel(r.revision)}</strong> <span className="text-muted-foreground">{r.reason ?? "Issued"}</span>
                  </span>
                  <span className="text-muted-foreground">{format(new Date(r.createdAt), "MMM d, yyyy")}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              After issue, a change creates the next revision. The earlier revision stays on record, and a line moved to another {isWork ? "subcontractor" : "vendor"} appears on a new order.
            </p>
          </section>
        </div>

        <aside className="space-y-4 rounded-md border bg-background p-4">
          <h2 className="text-sm font-semibold">Order details</h2>
          <Field label={isWork ? "Subcontractor" : "Vendor"}>
            <select
              className={fieldCls}
              disabled={locked}
              value={o.vendorId ?? ""}
              onChange={(e) => save({ vendorId: e.target.value === "" ? null : e.target.value })}
            >
              <option value="">{isWork ? "Select subcontractor" : "Select vendor"}</option>
              {pickable.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.kind})
                </option>
              ))}
            </select>
          </Field>
          {!isWork ? (
            <>
              <Field label="Order date">
                <input type="date" className={fieldCls} disabled={locked} value={o.orderDate ?? ""} onChange={(e) => save({ orderDate: e.target.value || null })} />
              </Field>
              <Field label="Delivery date">
                <input type="date" className={fieldCls} disabled={locked} value={o.deliveryDate ?? ""} onChange={(e) => save({ deliveryDate: e.target.value || null })} />
              </Field>
              <Field label="Ship to">
                <BlurText label="Ship to" value={o.shipTo} disabled={locked} onSave={(v) => save({ shipTo: v })} />
              </Field>
              <Field label="Shipping">
                <select className={fieldCls} disabled={locked} value={o.shipping ?? ""} onChange={(e) => save({ shipping: e.target.value === "" ? null : e.target.value })}>
                  <option value="">Not set</option>
                  <option value="delivered">Delivered</option>
                  <option value="will_call">Will call</option>
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Start date">
                <input type="date" className={fieldCls} disabled={locked} value={o.startDate ?? ""} onChange={(e) => save({ startDate: e.target.value || null })} />
              </Field>
              <Field label="Finish date">
                <input type="date" className={fieldCls} disabled={locked} value={o.finishDate ?? ""} onChange={(e) => save({ finishDate: e.target.value || null })} />
              </Field>
            </>
          )}
          <Field label="Payment terms">
            <select className={fieldCls} disabled={locked} value={o.paymentTerms ?? ""} onChange={(e) => save({ paymentTerms: e.target.value === "" ? null : e.target.value })}>
              <option value="">{data.vendor?.paymentTerms ? `Vendor default: ${data.vendor.paymentTerms}` : "Not set"}</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          {isWork && (
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" disabled={locked} checked={o.insuranceRequired} onChange={(e) => save({ insuranceRequired: e.target.checked })} />
                Certificate of insurance required
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" disabled={locked} checked={o.lienWaiverRequired} onChange={(e) => save({ lienWaiverRequired: e.target.checked })} />
                Lien waiver required with each invoice
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Attachments will be added later.</p>
        </aside>
      </div>
    </div>
  );
}
