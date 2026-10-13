"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/shared/status-badge";

const dollars = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Read-only summary of the orders created when the proposal was accepted. */
export function DraftOrdersPanel({ estimateId }: { estimateId: string }) {
  const { data, isLoading } = trpc.order.listForEstimate.useQuery({ estimateId });
  if (isLoading || !data || data.length === 0) return null;

  const groups = [
    { kind: "purchase" as const, title: "Purchase orders" },
    { kind: "work" as const, title: "Work orders" },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Orders created from this proposal</h2>
        <p className="text-sm text-muted-foreground">
          Drafts, grouped by vendor. Budget is the proposal cost and does not change. Reviewing and issuing orders comes next.
        </p>
      </div>
      {groups.map((g) => {
        const orders = data.filter((o) => o.kind === g.kind);
        if (orders.length === 0) return null;
        return (
          <div key={g.kind} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {orders.map((o) => (
                <div key={o.id} className="rounded-md border bg-background">
                  <div className="flex items-center justify-between gap-2 border-b bg-muted px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{o.number}</span>
                      <span className={o.vendorName ? "" : "text-financial-pending"}>{o.vendorName ?? "Unassigned"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge variant="draft">Draft</StatusBadge>
                      <span className="font-semibold tabular-nums">{dollars(o.budgetTotal)}</span>
                    </div>
                  </div>
                  <ul className="divide-y text-sm">
                    {o.lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-3 px-3 py-1.5">
                        <span>{l.description}{l.category ? <span className="ml-2 text-xs text-muted-foreground">{l.category}</span> : null}</span>
                        <span className="tabular-nums text-muted-foreground">{dollars(l.budgetCost)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
