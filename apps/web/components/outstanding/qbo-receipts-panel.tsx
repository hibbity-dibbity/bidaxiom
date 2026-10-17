"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils/format";

type Receipt = {
  id: string;
  status: string;
  txnDate: string;
  amount: number;
  remaining: number;
  qboType: string;
  qboCustomerName: string | null;
  customerName: string | null;
  customerId: string | null;
  memo: string | null;
  reference: string | null;
  auto: boolean;
  applications: Array<{ invoiceId: string; number: string; amount: number; source: string }>;
  candidates: Array<{ id: string; number: string; milestoneName: string; projectId: string; sentOn: string | null; amount: number; outstanding: number }>;
};

const money = (v: number) => Math.round(v * 100) / 100;

function AllocateDialog({ receipt, onClose, onDone }: { receipt: Receipt; onClose: () => void; onDone: () => void }) {
  // Start with the oldest invoices filled in, up to what is left of the deposit.
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    let left = receipt.remaining;
    const init: Record<string, string> = {};
    for (const c of [...receipt.candidates].sort((a, b) => (a.sentOn ?? "").localeCompare(b.sentOn ?? ""))) {
      const take = money(Math.min(left, c.outstanding));
      if (take > 0) {
        init[c.id] = take.toFixed(2);
        left = money(left - take);
      }
    }
    return init;
  });
  const total = money(Object.values(amounts).reduce((a, v) => a + (Number(v) || 0), 0));
  const over = total > receipt.remaining + 0.004;
  const allocate = trpc.outstanding.allocateReceipt.useMutation({
    onSuccess: () => {
      toast.success("Deposit applied");
      onDone();
    },
    onError: (e) => toast.error("Could not apply", { description: e.message }),
  });
  const rows = Object.entries(amounts).filter(([, v]) => Number(v) > 0).map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply {formatCurrency(receipt.remaining)} from {receipt.customerName ?? receipt.qboCustomerName}</DialogTitle>
          <DialogDescription>Received {receipt.txnDate}. Choose how much of it pays each invoice. Anything left stays open.</DialogDescription>
        </DialogHeader>
        {receipt.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sent invoices are waiting on this customer.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {receipt.candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{c.number}</div>
                  <div className="truncate text-muted-foreground">{c.milestoneName} · sent {c.sentOn ?? "?"} · {formatCurrency(c.outstanding)} outstanding</div>
                </div>
                <Input
                  className="w-28 text-right"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amounts[c.id] ?? ""}
                  onChange={(e) => setAmounts((p) => ({ ...p, [c.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
        <p className={`text-sm ${over ? "text-destructive" : "text-muted-foreground"}`}>
          Applying {formatCurrency(total)} of {formatCurrency(receipt.remaining)}{over ? " (more than the deposit)" : ""}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={rows.length === 0 || over || allocate.isPending} onClick={() => allocate.mutate({ receiptId: receipt.id, allocations: rows })}>
            {allocate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Deposits and payments QuickBooks reports, waiting to be applied to invoices (or already applied, with undo). */
export function QboReceiptsPanel() {
  const utils = trpc.useUtils();
  const { data } = trpc.outstanding.receipts.useQuery(undefined, { refetchOnWindowFocus: true });
  const [allocating, setAllocating] = useState<Receipt | null>(null);
  const refresh = () => {
    utils.outstanding.receipts.invalidate();
    utils.outstanding.overview.invalidate();
    utils.attention.list.invalidate();
  };
  const check = trpc.outstanding.checkReceiptsNow.useMutation({
    onSuccess: (r) => {
      toast.success("Checked QuickBooks", { description: `${r.read} new or changed, ${r.applied} applied automatically. Vendor bills: ${r.billsRead} new or changed, ${r.billsLinked} linked.` });
      refresh();
      utils.outstanding.bills.invalidate();
    },
    onError: (e) => toast.error("Could not check", { description: e.message }),
  });
  const undo = trpc.outstanding.undoReceipt.useMutation({ onSuccess: () => { toast.success("Undone"); refresh(); }, onError: (e) => toast.error("Could not undo", { description: e.message }) });
  const ignore = trpc.outstanding.ignoreReceipt.useMutation({ onSuccess: refresh, onError: (e) => toast.error("Could not update", { description: e.message }) });

  if (!data || !data.enabled) return null;
  const open = data.receipts.filter((r) => r.status === "open");
  const done = data.receipts.filter((r) => r.status === "applied");
  const ignored = data.receipts.filter((r) => r.status === "ignored");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Deposits from QuickBooks</CardTitle>
            <CardDescription>
              Money your bookkeeper recorded in QuickBooks. An exact match to one invoice is applied for you; anything else waits here for you to choose.
              {data.lastCheckAt ? ` Last checked ${new Date(data.lastCheckAt).toLocaleString()}.` : ""}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => check.mutate()} disabled={check.isPending}>
            {check.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Check now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {open.length === 0 && <p className="text-muted-foreground">Nothing is waiting to be applied.</p>}
        {open.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="font-medium">
                {formatCurrency(r.remaining)} <span className="font-normal text-muted-foreground">from {r.customerName ?? r.qboCustomerName}</span>
              </div>
              <div className="text-muted-foreground">
                {r.txnDate} · {r.qboType}
                {r.reference ? ` · ${r.reference}` : ""}
                {r.memo ? ` · ${r.memo}` : ""}
                {r.remaining < r.amount ? ` · ${formatCurrency(r.amount - r.remaining)} already applied` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setAllocating(r)}>Allocate</Button>
              <Button size="sm" variant="ghost" onClick={() => ignore.mutate({ receiptId: r.id, ignored: true })}>Set aside</Button>
            </div>
          </div>
        ))}

        {done.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Applied in the last 30 days</div>
            {done.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {formatCurrency(r.amount)} <span className="font-normal text-muted-foreground">from {r.customerName ?? r.qboCustomerName}</span>{" "}
                    {r.auto && <Badge variant="secondary">Matched automatically</Badge>}
                  </div>
                  <div className="text-muted-foreground">{r.txnDate} · paid {r.applications.map((a) => a.number).join(", ")}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => undo.mutate({ receiptId: r.id })} disabled={undo.isPending}>Undo</Button>
              </div>
            ))}
          </div>
        )}

        {ignored.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Set aside</div>
            {ignored.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{formatCurrency(r.amount)} from {r.customerName ?? r.qboCustomerName} · {r.txnDate}</span>
                <Button size="sm" variant="ghost" onClick={() => ignore.mutate({ receiptId: r.id, ignored: false })}>Restore</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {allocating && <AllocateDialog receipt={allocating} onClose={() => setAllocating(null)} onDone={() => { setAllocating(null); refresh(); }} />}
    </Card>
  );
}
