"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/format";

/** Vendor bills QuickBooks holds, waiting to be tied to a purchase or work order (or already linked, with undo). */
export function QboBillsPanel() {
  const utils = trpc.useUtils();
  const { data } = trpc.outstanding.bills.useQuery(undefined, { refetchOnWindowFocus: true });
  const [pick, setPick] = useState<Record<string, string>>({});
  const refresh = () => {
    utils.outstanding.bills.invalidate();
    utils.outstanding.overview.invalidate();
    utils.attention.list.invalidate();
  };
  const fail = (title: string) => (e: { message: string }) => toast.error(title, { description: e.message });
  const link = trpc.outstanding.linkBill.useMutation({ onSuccess: () => { toast.success("Bill linked"); refresh(); }, onError: fail("Could not link") });
  const unlink = trpc.outstanding.unlinkBill.useMutation({ onSuccess: () => { toast.success("Unlinked"); refresh(); }, onError: fail("Could not unlink") });
  const ignore = trpc.outstanding.ignoreBill.useMutation({ onSuccess: refresh, onError: fail("Could not update") });

  if (!data || !data.enabled) return null;
  const open = data.bills.filter((b) => b.status === "open");
  const linked = data.bills.filter((b) => b.status === "linked");
  const ignored = data.bills.filter((b) => b.status === "ignored");
  if (data.bills.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor bills from QuickBooks</CardTitle>
        <CardDescription>
          Bills your bookkeeper entered in QuickBooks. Put the order number (like PO2026-001-01) in the bill&apos;s Ref no., or tag the bill to the job, and it links by itself. Payments made in QuickBooks then show on the order.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {open.length === 0 && <p className="text-muted-foreground">No bills are waiting to be linked.</p>}
        {open.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="font-medium">
                {formatCurrency(b.total)} <span className="font-normal text-muted-foreground">from {b.vendorName ?? "a vendor"}</span>
              </div>
              <div className="text-muted-foreground">
                {b.txnDate}
                {b.docNumber ? ` · Ref ${b.docNumber}` : ""}
                {b.balance < b.total ? ` · ${formatCurrency(b.total - b.balance)} paid` : ""}
                {b.memo ? ` · ${b.memo}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 max-w-[22rem] rounded-md border bg-background px-2 text-sm"
                value={pick[b.id] ?? ""}
                onChange={(e) => setPick((p) => ({ ...p, [b.id]: e.target.value }))}
              >
                <option value="">{b.candidates.length ? "Choose an order…" : "No matching issued orders"}</option>
                {b.candidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <Button size="sm" disabled={!pick[b.id] || link.isPending} onClick={() => link.mutate({ billId: b.id, orderId: pick[b.id]! })}>Link</Button>
              <Button size="sm" variant="ghost" onClick={() => ignore.mutate({ billId: b.id, ignored: true })}>Not for a job</Button>
            </div>
          </div>
        ))}

        {linked.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked in the last 30 days</div>
            {linked.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {formatCurrency(b.total)} <span className="font-normal text-muted-foreground">from {b.vendorName ?? "a vendor"}</span>{" "}
                    {b.auto && <Badge variant="secondary">Linked automatically</Badge>}
                  </div>
                  <div className="text-muted-foreground">
                    {b.txnDate} · {b.orderNumber}{b.projectName ? ` · ${b.projectName}` : ""} · {b.balance > 0.004 ? `${formatCurrency(b.balance)} still unpaid in QuickBooks` : "paid in QuickBooks"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => unlink.mutate({ billId: b.id })} disabled={unlink.isPending}>Unlink</Button>
              </div>
            ))}
          </div>
        )}

        {ignored.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Set aside</div>
            {ignored.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{formatCurrency(b.total)} from {b.vendorName ?? "a vendor"} · {b.txnDate}</span>
                <Button size="sm" variant="ghost" onClick={() => ignore.mutate({ billId: b.id, ignored: false })}>Restore</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
