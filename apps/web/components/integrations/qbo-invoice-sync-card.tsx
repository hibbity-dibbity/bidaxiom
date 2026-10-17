"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

type Item = { id: string; name: string; incomeAccount: string | null };

/** Per-company choice to create each sent invoice in QuickBooks, so the bookkeeper receives payments against it. */
export function QboInvoiceSyncCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.quickbooks.getInvoiceSync.useQuery();
  const [enabled, setEnabled] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [item, setItem] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setStartDate(data.startDate ?? "");
      setItem(data.itemId ? { id: data.itemId, name: data.itemName ?? data.itemId } : null);
    }
  }, [data]);

  const load = trpc.quickbooks.listIncomeItems.useMutation({
    onSuccess: (rows) => {
      setItems(rows);
      if (rows.length === 0) toast.message("QuickBooks has no active products or services yet. Create one there, then load again.");
    },
    onError: (e) => toast.error("Could not read QuickBooks", { description: e.message }),
  });
  const save = trpc.quickbooks.setInvoiceSync.useMutation({
    onSuccess: () => {
      toast.success("Invoice sync saved");
      utils.quickbooks.getInvoiceSync.invalidate();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  const dirty = data ? enabled !== data.enabled || startDate !== (data.startDate ?? "") || (item?.id ?? null) !== data.itemId : false;
  const options: Array<{ id: string; label: string }> = items.map((i) => ({ id: i.id, label: i.incomeAccount ? `${i.name} (${i.incomeAccount})` : i.name }));
  if (item && !options.some((o) => o.id === item.id)) options.unshift({ id: item.id, label: item.name });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices in QuickBooks</CardTitle>
        <CardDescription>
          Create each invoice in QuickBooks when you send it, under the project&apos;s job. Your bookkeeper then receives the customer&apos;s payment against it (or matches it from the bank feed), and BidAxiom marks the invoice paid. QuickBooks does not email the customer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} id="qbo-invoice-push" />
          <div>
            <Label htmlFor="qbo-invoice-push">Send invoices to QuickBooks</Label>
            <p className="text-sm text-muted-foreground">
              Talk to your bookkeeper first: once an invoice is in QuickBooks, customer money must be received against it, not entered as a separate sales deposit. Run QuickBooks reports on a cash basis if that is how you file.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="qbo-invoice-from">Send invoices sent on or after</Label>
            <Input id="qbo-invoice-from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Invoices sent before this date are never sent, so nothing already handled is duplicated.</p>
          </div>
          <div className="space-y-2">
            <Label>Post invoice lines to</Label>
            <div className="flex gap-2">
              <Select value={item?.id ?? ""} onValueChange={(v) => setItem({ id: v, name: options.find((o) => o.id === v)?.label ?? v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a QuickBooks item" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => load.mutate()} disabled={load.isPending}>
                {load.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load items
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Pick the service item tied to your contract income account. Invoices go out non-taxable.</p>
          </div>
        </div>
        <Button onClick={() => save.mutate({ enabled, startDate: startDate || null, itemId: item?.id ?? null, itemName: item?.name ?? null })} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
