"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlurNumber, BlurText, InsuranceWarning, OrderStatusBadge, dollars, fieldCls, signed } from "./order-ui";
import { cn } from "@/lib/utils";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@construction/api/src/trpc/router";

export type CardOrder = inferRouterOutputs<AppRouter>["order"]["listCards"][number];

export function OrderCard(props: {
  order: CardOrder;
  noun: string;
  projectSlug: string;
  siblings: CardOrder[];
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
  onMarkPaid: () => void;
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
          <span className="text-sm text-muted-foreground">
            Issued and locked. Paid {dollars(o.paid)} · Outstanding {dollars(o.outstanding ?? 0)}
          </span>
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
          {locked && o.status !== "paid" && (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${props.projectSlug}/orders/${o.id}#payments`}>Partial payment</Link>
              </Button>
              <Button type="button" size="sm" disabled={props.busy || (o.outstanding ?? 0) <= 0} onClick={props.onMarkPaid}>
                Mark paid
              </Button>
            </>
          )}
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
