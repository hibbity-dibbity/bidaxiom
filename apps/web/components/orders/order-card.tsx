"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlurNumber, BlurText, InsuranceWarning, OrderStatusBadge, dollars, fieldCls, signed } from "./order-ui";
import { cn } from "@/lib/utils";
import type { inferRouterOutputs } from "@trpc/server";
import { ConfirmIssueButton } from "./confirm-issue";
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
  // Phones: description on top, the three amounts side by side under it. md and up: one row per line.
  const cols = isWork ? "grid-cols-[28px_1fr_1fr_1fr] md:grid-cols-[28px_1fr_110px_130px_110px_1.2fr]" : "grid-cols-[28px_1fr_1fr_1fr] md:grid-cols-[28px_1fr_110px_130px_110px]";
  const lbl = "block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden";
  const under = "col-start-2 md:col-start-auto";

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted px-3 py-2">
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <Link href={`/projects/${props.projectSlug}/orders/${o.id}`} className="font-semibold hover:underline">
            {o.number}
          </Link>
          <OrderStatusBadge status={o.status} revision={o.revision} />
          <select
            aria-label={`Vendor for ${o.number}`}
            className={cn(fieldCls, "w-full sm:w-64", !o.vendorId && "text-financial-pending")}
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

      <div className={cn("hidden items-center gap-2 border-b px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid", cols)}>
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
          <div className="col-span-3 md:col-span-1">
            {l.description}
            {l.category && <span className="ml-2 text-xs text-muted-foreground">{l.category}</span>}
          </div>
          <div className={cn("tabular-nums md:text-right", under)}><span className={lbl}>Budget</span>{dollars(l.budgetCost)}</div>
          <div><span className={lbl}>Projected</span><BlurNumber label={`Projected cost for ${l.description}`} value={l.projectedCost} disabled={locked} onSave={(v) => props.onProjected(l.id, v)} /></div>
          <div className="tabular-nums text-muted-foreground md:text-right"><span className={lbl}>Difference</span>{signed(l.projectedCost - l.budgetCost)}</div>
          {isWork && (
            <div className="col-span-3 col-start-2 md:col-span-1 md:col-start-auto"><span className={lbl}>Exclusions</span><BlurText label={`Exclusions for ${l.description}`} value={l.exclusions} disabled={locked} placeholder="Not included" onSave={(v) => props.onExclusions(l.id, v)} /></div>
          )}
        </div>
      ))}
      <div className={cn("grid items-center gap-2 px-3 py-2 text-sm font-semibold", cols)}>
        <span className="hidden md:block" />
        <span className="col-span-4 md:col-span-1">Order total</span>
        <span className={cn("tabular-nums md:text-right", under)}><span className={lbl}>Budget</span>{dollars(o.budgetTotal)}</span>
        <span className="tabular-nums md:text-right"><span className={lbl}>Projected</span>{dollars(o.projectedTotal)}</span>
        <span className="tabular-nums md:text-right"><span className={lbl}>Difference</span>{signed(o.projectedTotal - o.budgetTotal)}</span>
        {isWork && <span className="hidden md:block" />}
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
                  className={cn(fieldCls, "w-full sm:w-44")}
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
                  className={cn(fieldCls, "w-full sm:w-40")}
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
            <ConfirmIssueButton
              size="sm"
              number={o.number}
              isWork={isWork}
              vendorName={props.vendors.find((v) => v.id === o.vendorId)?.name ?? null}
              disabled={!o.vendorId || o.lines.length === 0 || props.busy}
              title={!o.vendorId ? "Assign a vendor first" : undefined}
              onConfirm={props.onIssue}
            />
          )}
        </div>
      </div>
    </div>
  );
}
