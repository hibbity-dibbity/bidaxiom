"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type Acct = { id: string; name: string };
type Key = "material" | "equipment" | "labor";
const SLOTS: Array<{ key: Key; label: string; hint: string; guess: RegExp }> = [
  { key: "material", label: "Material lines (COGS: Materials)", hint: "Proposal lines of type Material", guess: /material/i },
  { key: "equipment", label: "Equipment lines (COGS: Rentals)", hint: "Proposal lines of type Equipment", guess: /rental|equipment/i },
  { key: "labor", label: "Work order lines (COGS: Subcontract Labor)", hint: "Proposal lines of type Labor or Subcontractor", guess: /subcontract|labor/i },
];

/** Per-company choice to create each issued purchase and work order in QuickBooks as a Purchase Order. */
export function QboOrderSyncCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.quickbooks.getOrderSync.useQuery();
  const [enabled, setEnabled] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [accounts, setAccounts] = useState<Partial<Record<Key, Acct>>>({});
  const [options, setOptions] = useState<Array<Acct & { type: string }>>([]);

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setStartDate(data.startDate ?? "");
      setAccounts(data.accounts as Partial<Record<Key, Acct>>);
    }
  }, [data]);

  const load = trpc.quickbooks.listExpenseAccounts.useMutation({
    onSuccess: (rows) => {
      setOptions(rows);
      // Fill any empty slot with the account whose name fits.
      setAccounts((cur) => {
        const next = { ...cur };
        for (const s of SLOTS) {
          if (!next[s.key]?.id) {
            const hit = rows.find((r) => s.guess.test(r.name) && (s.key !== "labor" || /cost of goods/i.test(r.type) || /cogs/i.test(r.name)) ) ?? rows.find((r) => s.guess.test(r.name));
            if (hit) next[s.key] = { id: hit.id, name: hit.name };
          }
        }
        return next;
      });
      if (rows.length === 0) toast.message("QuickBooks has no active expense accounts.");
    },
    onError: (e) => toast.error("Could not read QuickBooks", { description: e.message }),
  });
  const save = trpc.quickbooks.setOrderSync.useMutation({
    onSuccess: () => {
      toast.success("Order sync saved");
      utils.quickbooks.getOrderSync.invalidate();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  const saved = (data?.accounts ?? {}) as Partial<Record<Key, Acct>>;
  const dirty = data ? enabled !== data.enabled || startDate !== (data.startDate ?? "") || SLOTS.some((s) => (accounts[s.key]?.id ?? "") !== (saved[s.key]?.id ?? "")) : false;
  const choices = (key: Key) => {
    const list = options.map((o) => ({ id: o.id, name: o.name }));
    const cur = accounts[key];
    if (cur?.id && !list.some((o) => o.id === cur.id)) list.unshift(cur);
    return list;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase and work orders in QuickBooks</CardTitle>
        <CardDescription>
          Create each purchase order and work order in QuickBooks when you issue it, as a Purchase Order under the project&apos;s job. It does not post to your books. Your bookkeeper turns it into a bill with Copy to bill, and BidAxiom then matches the bill and its payments to the order exactly. Needs QuickBooks Plus or Advanced with Purchase Orders turned on (Settings, Account and settings, Expenses).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} id="qbo-order-push" />
          <div>
            <Label htmlFor="qbo-order-push">Send orders to QuickBooks</Label>
            <p className="text-sm text-muted-foreground">Vendors are matched by name or created in QuickBooks. Revised orders update the same Purchase Order while it is still open.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qbo-order-from">Send orders issued on or after</Label>
          <Input id="qbo-order-from" type="date" className="max-w-xs" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <p className="text-xs text-muted-foreground">Orders issued before this date are never sent, so nothing already entered is duplicated.</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Post order lines to</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => load.mutate()} disabled={load.isPending}>
              {load.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load accounts
            </Button>
          </div>
          {SLOTS.map((s) => (
            <div key={s.key} className="grid items-center gap-2 sm:grid-cols-2">
              <div>
                <div className="text-sm">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.hint}</div>
              </div>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={accounts[s.key]?.id ?? ""}
                onChange={(e) => {
                  const hit = choices(s.key).find((o) => o.id === e.target.value);
                  setAccounts((p) => ({ ...p, [s.key]: hit ? { id: hit.id, name: hit.name } : undefined }));
                }}
              >
                <option value="">Choose a QuickBooks account…</option>
                {choices(s.key).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <Button
          onClick={() => save.mutate({ enabled, startDate: startDate || null, accounts: Object.fromEntries(SLOTS.filter((s) => accounts[s.key]?.id).map((s) => [s.key, accounts[s.key]!])) as Record<Key, Acct> })}
          disabled={!dirty || save.isPending}
        >
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
