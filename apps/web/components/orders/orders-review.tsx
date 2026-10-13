"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { BlurNumber, BlurText, InsuranceWarning, OrderStatusBadge, dollars, fieldCls, signed } from "./order-ui";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@construction/api/src/trpc/router";
type Order = inferRouterOutputs<AppRouter>["order"]["listForEstimate"][number];

export function OrdersReview({ projectSlug, estimateSlug }: { projectSlug: string; estimateSlug: string }) {
  const { data: estimate } = trpc.estimates.getBySlug.useQuery({ slug: estimateSlug });
  const estimateId = estimate?.id ?? "";
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.order.listForEstimate.useQuery({ estimateId }, { enabled: !!estimateId });
  const { data: vendors } = trpc.order.vendorOptions.useQuery();
  const [picked, setPicked] = React.useState<Record<string, string[]>>({});

  const refresh = () => utils.order.listForEstimate.invalidate({ estimateId });
  const fail = (title: string) => (e: { message: string }) => toast.error(title, { description: e.message });
  const update = trpc.order.update.useMutation({ onSuccess: refresh, onError: fail("Could not update the order") });
  const updateLine = trpc.order.updateLine.useMutation({ onSuccess: refresh, onError: fail("Could not update the line") });
  const move = trpc.order.moveLines.useMutation({
    onSuccess: (r) => {
      toast.success(`Moved to ${r.number}`);
      setPicked({});
      refresh();
    },
    onError: fail("Could not move the lines"),
  });
  const merge = trpc.order.merge.useMutation({
    onSuccess: () => {
      toast.success("Orders merged");
      setPicked({});
      refresh();
    },
    onError: fail("Could not merge"),
  });
  const issue = trpc.order.issue.useMutation({
    onSuccess: () => {
      toast.success("Order issued");
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

  if (isLoading || !estimateId) return <Skeleton className="h-64 w-full" />;
  const list = orders ?? [];
  const budget = list.reduce((a, o) => a + o.budgetTotal, 0);
  const projected = list.reduce((a, o) => a + o.projectedTotal, 0);
  const drafts = list.filter((o) => o.status === "draft").length;
  const unassigned = list.filter((o) => o.status === "draft" && !o.vendorId).length;

  const groups = [
    { kind: "purchase" as const, title: "Purchase orders (materials and equipment)", noun: "PO" },
    { kind: "work" as const, title: "Work orders (labor and subcontract scope)", noun: "WO" },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href={`/projects/${projectSlug}/estimates/${estimateSlug}`} className="hover:underline">
          {estimate?.name ?? "Proposal"}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Review orders</span>
      </nav>
      <PageHeader
        title="Review draft orders"
        description="Orders were drafted from the accepted proposal and sorted by the vendor set in the builder. Pick the vendor for each order, split lines into separate orders if needed, then issue. The proposal and customer price do not change."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Cost budget", dollars(budget)],
          ["Projected cost", dollars(projected)],
          ["Projected vs budget", signed(projected - budget)],
          ["Drafts to issue", `${drafts}${unassigned ? ` (${unassigned} need a vendor)` : ""}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border bg-background px-3 py-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {groups.map((g) => {
        const rows = list.filter((o) => o.kind === g.kind);
        if (rows.length === 0) return null;
        return (
          <section key={g.kind} className="space-y-3">
            <h2 className="text-lg font-semibold">{g.title}</h2>
            {rows.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                noun={g.noun}
                projectSlug={projectSlug}
                siblings={rows.filter((r) => r.id !== o.id && r.status === "draft")}
                vendors={vendors ?? []}
                selected={picked[o.id] ?? []}
                setSelected={(ids) => setPicked((p) => ({ ...p, [o.id]: ids }))}
                busy={update.isPending || move.isPending || merge.isPending || issue.isPending || revise.isPending}
                onVendor={(vendorId) => update.mutate({ orderId: o.id, vendorId })}
                onProjected={(lineId, v) => updateLine.mutate({ lineId, projectedCost: v })}
                onExclusions={(lineId, v) => updateLine.mutate({ lineId, exclusions: v })}
                onSplit={(ids) => move.mutate({ lineIds: ids })}
                onMoveTo={(ids, toOrderId) => move.mutate({ lineIds: ids, toOrderId })}
                onMerge={(intoOrderId) => merge.mutate({ fromOrderId: o.id, intoOrderId })}
                onIssue={() => issue.mutate({ orderId: o.id })}
                onRevise={() => revise.mutate({ orderId: o.id })}
              />
            ))}
          </section>
        );
      })}

      <p className="max-w-3xl text-sm text-muted-foreground">
        An insurance warning on a work order does not stop you from issuing it. Issued orders are locked. To change one, revise it: the order
        reopens as a draft with the next revision, the earlier revision is kept, and a line moved to another vendor appears on a new order.
        Projected cost is what you expect to pay, for example from a vendor&apos;s quote. Budget is the cost on the proposal and never changes.
      </p>
    </div>
  );
}

function OrderCard(props: {
  order: Order;
  noun: string;
  projectSlug: string;
  siblings: Order[];
  vendors: Array<{ id: string; name: string; kind: string }>;
  selected: string[];
  setSelected: (ids: string[]) => void;
  busy: boolean;
  onVendor: (vendorId: string | null) => void;
  onProjected: (lineId: string, v: number) => void;
  onExclusions: (lineId: string, v: string | null) => void;
  onSplit: (ids: string[]) => void;
  onMoveTo: (ids: string[], toOrderId: string) => void;
  onMerge: (intoOrderId: string) => void;
  onIssue: () => void;
  onRevise: () => void;
}) {
  const { order: o, selected, setSelected } = props;
  const locked = o.status !== "draft";
  const isWork = o.kind === "work";
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const canSplit = selected.length > 0 && selected.length < o.lines.length;
  const cols = isWork ? "grid-cols-[28px_1fr_110px_130px_110px_1.2fr]" : "grid-cols-[28px_1fr_110px_130px_110px]";

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/projects/${props.projectSlug}/orders/${o.id}`} className="font-semibold hover:underline">
            {o.number}
          </Link>
          <OrderStatusBadge status={o.status} revision={o.revision} />
          <select
            aria-label={`Vendor for ${o.number}`}
            className={cn(fieldCls, "w-64", !o.vendorId && "text-financial-pending")}
            disabled={locked || props.busy}
            value={o.vendorId ?? ""}
            onChange={(e) => props.onVendor(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">{isWork ? "Select subcontractor" : "Select vendor"}</option>
            {props.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.kind})
              </option>
            ))}
          </select>
          <InsuranceWarning message={o.insurance.message} />
        </div>
        <div className="text-sm text-muted-foreground">{o.lines.length} lines</div>
      </div>

      <div className={cn("grid items-center gap-2 border-b px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", cols)}>
        <span />
        <span>{isWork ? "Scope line" : "Cost line"}</span>
        <span className="text-right">Budget</span>
        <span className="text-right">Projected</span>
        <span className="text-right">Difference</span>
        {isWork && <span>Exclusions</span>}
      </div>
      {o.lines.map((l) => (
        <div key={l.id} className={cn("grid items-center gap-2 border-b px-3 py-1.5 text-sm", cols)}>
          <input type="checkbox" aria-label={`Select ${l.description}`} disabled={locked} checked={selected.includes(l.id)} onChange={() => toggle(l.id)} />
          <div>
            {l.description}
            {l.category && <span className="ml-2 text-xs text-muted-foreground">{l.category}</span>}
          </div>
          <div className="text-right tabular-nums">{dollars(l.budgetCost)}</div>
          <BlurNumber label={`Projected cost for ${l.description}`} value={l.projectedCost} disabled={locked} onSave={(v) => props.onProjected(l.id, v)} />
          <div className="text-right tabular-nums text-muted-foreground">{signed(l.projectedCost - l.budgetCost)}</div>
          {isWork && (
            <BlurText label={`Exclusions for ${l.description}`} value={l.exclusions} disabled={locked} placeholder="Not included" onSave={(v) => props.onExclusions(l.id, v)} />
          )}
        </div>
      ))}
      <div className={cn("grid items-center gap-2 px-3 py-2 text-sm font-semibold", cols)}>
        <span />
        <span>Order total</span>
        <span className="text-right tabular-nums">{dollars(o.budgetTotal)}</span>
        <span className="text-right tabular-nums">{dollars(o.projectedTotal)}</span>
        <span className="text-right tabular-nums">{signed(o.projectedTotal - o.budgetTotal)}</span>
        {isWork && <span />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
        {locked ? (
          <span className="text-sm text-muted-foreground">Issued and locked.</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!canSplit || props.busy} onClick={() => props.onSplit(selected)}>
              Split selected into new {props.noun}
            </Button>
            {props.siblings.length > 0 && (
              <>
                <select
                  aria-label="Move selected lines to"
                  className={cn(fieldCls, "w-44")}
                  disabled={selected.length === 0 || props.busy}
                  value=""
                  onChange={(e) => e.target.value && props.onMoveTo(selected, e.target.value)}
                >
                  <option value="">Move selected to…</option>
                  {props.siblings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.number}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Merge into"
                  className={cn(fieldCls, "w-40")}
                  disabled={props.busy}
                  value=""
                  onChange={(e) => e.target.value && props.onMerge(e.target.value)}
                >
                  <option value="">Merge into…</option>
                  {props.siblings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.number}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/projects/${props.projectSlug}/orders/${o.id}`}>Details</Link>
          </Button>
          {locked ? (
            <Button type="button" size="sm" variant="outline" disabled={props.busy} onClick={props.onRevise}>
              Revise
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={!o.vendorId || o.lines.length === 0 || props.busy} onClick={props.onIssue} title={!o.vendorId ? "Assign a vendor first" : undefined}>
              Issue {o.number}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
