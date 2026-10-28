"use client";

import * as React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { dollars } from "./order-ui";

/** Overview: money in from the invoicing schedule, money out on issued orders. */
export function CashFlow({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const { data: active } = trpc.proposal.activeForProject.useQuery({ projectId });
  const { data: summary } = trpc.order.projectSummary.useQuery({ projectId });
  const { data: invoices } = trpc.invoice.list.useQuery({ projectId });
  const statusFor = (milestoneId: string) => {
    const inv = invoices?.rows.find((r) => r.milestoneIds.includes(milestoneId));
    if (!inv || inv.status === "draft") return "Upcoming";
    if (inv.status === "paid") return "Collected";
    if (inv.overdue) return "Overdue";
    return inv.status === "partially_paid" ? "Partly collected" : "Billed";
  };

  if (!active && (!summary || summary.rows.length === 0)) return null;
  const issued = summary?.rows.filter((r) => r.issued) ?? [];
  const drafts = summary?.rows.filter((r) => !r.issued) ?? [];
  const schedule = active?.schedule ?? [];
  const scheduleTotal = schedule.reduce((a, m) => a + m.amount, 0);
  const changeOrders = active?.changeOrders ?? [];
  const path = (r: { kind: "purchase" | "work"; id: string }) => `/projects/${projectSlug}/orders/${r.id}`;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Cash flow</h2>
        <p className="text-sm text-muted-foreground">Money in from the invoicing schedule, money out on purchase orders and work orders.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {active && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cash in{active.accepted ? "" : " (proposal not accepted yet)"}
            </div>
            <div className="table-sheet"><table className="w-full rounded-md border bg-background text-sm">
              <thead>
                <tr className="border-b bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Milestone</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{m.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.percent}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{dollars(m.amount / 100)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{statusFor(m.id)}</td>
                  </tr>
                ))}
                {changeOrders.map((co) => (
                  <React.Fragment key={co.id}>
                    <tr className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <td className="px-3 py-1.5" colSpan={4}>
                        Change order {co.number}{co.revision > 0 ? ` Rev ${co.revision}` : ""}: {co.name}
                      </td>
                    </tr>
                    {co.schedule.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{m.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.percent}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{dollars(m.amount / 100)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{statusFor(m.id)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2">Contract value{changeOrders.length > 0 ? " (with change orders)" : ""}</td>
                  <td className="px-3 py-2 text-right" />
                  <td className="px-3 py-2 text-right tabular-nums">{dollars((scheduleTotal + changeOrders.reduce((a, co) => a + co.contractValue, 0)) / 100)}</td>
                  <td />
                </tr>
              </tbody>
            </table></div>
            {(active.acceptedOptionNames.length > 0 || active.declinedOptionNames.length > 0) && (
              <p className="text-xs text-muted-foreground">
                {active.acceptedOptionNames.length > 0 && <>Schedule includes the accepted option{active.acceptedOptionNames.length > 1 ? "s" : ""}: {active.acceptedOptionNames.join(", ")}. </>}
                {active.declinedOptionNames.length > 0 && <>Declined: {active.declinedOptionNames.join(", ")}.</>}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Status follows the invoices on the <Link href={`/projects/${projectSlug}/invoices`} className="underline underline-offset-2">Invoices</Link> tab.</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cash out</div>
          <div className="table-sheet"><table className="w-full rounded-md border bg-background text-sm">
            <thead>
              <tr className="border-b bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2 text-right">Issued</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {issued.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-muted-foreground">No issued orders yet.</td>
                </tr>
              )}
              {issued.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={path(r)} className="hover:underline">{r.number}</Link>
                  </td>
                  <td className="px-3 py-2">{r.vendorName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(r.projected)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(r.paid)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(r.outstanding)}</td>
                </tr>
              ))}
              {issued.length > 0 && (
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>Issued orders</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(issued.reduce((a, r) => a + r.projected, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(issued.reduce((a, r) => a + r.paid, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(issued.reduce((a, r) => a + r.outstanding, 0))}</td>
                </tr>
              )}
              {drafts.map((r) => (
                <tr key={r.id} className="border-t text-muted-foreground">
                  <td className="px-3 py-2">
                    <Link href={path(r)} className="hover:underline">{r.number}</Link>
                  </td>
                  <td className="px-3 py-2">Draft{r.vendorName ? `, ${r.vendorName}` : ", vendor not assigned"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(r.projected)}</td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right">—</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {drafts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Drafts total {dollars(drafts.reduce((a, r) => a + r.projected, 0))} and are not counted as outstanding until issued.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
