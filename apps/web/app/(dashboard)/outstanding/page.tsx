"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Receipt } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListToolbar, SearchField, FilterSelect } from "@/components/shared/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/utils/format";
import { QboReceiptsPanel } from "@/components/outstanding/qbo-receipts-panel";
import { QboBillsPanel } from "@/components/outstanding/qbo-bills-panel";

type Item = { id: string; outstanding: number };

/** Combinations of up to 4 items whose balances add up to the amount (to the cent). Used for lump-sum deposits and checks. */
function findCombos(items: Item[], target: number, max = 5): string[][] {
  const cents = Math.round(target * 100);
  if (!(cents > 0) || items.length === 0 || items.length > 24) return [];
  const vals = items.map((i) => Math.round(i.outstanding * 100));
  const out: string[][] = [];
  const walk = (start: number, left: number, picked: number[]) => {
    if (out.length >= max) return;
    if (left === 0 && picked.length > 0) {
      out.push(picked.map((i) => items[i].id));
      return;
    }
    if (picked.length === 4) return;
    for (let i = start; i < items.length; i++) {
      if (vals[i] <= left) walk(i + 1, left - vals[i], [...picked, i]);
    }
  };
  walk(0, cents, []);
  return out;
}

const jobLabel = (r: { jobNumber: string | null; projectName: string }) => [r.jobNumber, r.projectName].filter(Boolean).join(" - ");

export default function OutstandingPage() {
  const { data, isLoading, error } = trpc.outstanding.overview.useQuery(undefined, { refetchOnWindowFocus: true });
  const [tab, setTab] = useState<"invoices" | "expenses">("invoices");
  const [search, setSearch] = useState("");
  const [amountText, setAmountText] = useState("");

  const amount = Number(amountText.replace(/[$,\s]/g, ""));
  const hasAmount = amountText.trim() !== "" && Number.isFinite(amount) && amount > 0;
  const q = search.trim().toLowerCase();

  // Which rows are part of an exact match for the typed amount, per group.
  const matchedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!data || !hasAmount) return { ids, groups: new Set<string>() };
    const groups = new Set<string>();
    const groupsOf = tab === "invoices" ? data.customers.map((c) => ({ key: c.customerId, items: c.invoices })) : data.vendors.map((v) => ({ key: v.vendorId, items: v.orders }));
    for (const g of groupsOf) {
      const combos = findCombos(g.items, amount);
      if (combos.length) groups.add(g.key);
      for (const c of combos) c.forEach((id) => ids.add(id));
    }
    return { ids, groups };
  }, [data, hasAmount, amount, tab]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return <EmptyState icon={Receipt} heading="Could not load what is outstanding" description={error?.message ?? "Try again in a moment."} />;
  }

  const matches = (text: string) => !q || text.toLowerCase().includes(q);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outstanding"
        description="Everything still owed, in one place: invoices you are waiting to be paid on and orders you have not finished paying. Handy while you match bank activity in QuickBooks."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Owed to you (invoices)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCurrency(data.invoiceTotal)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">You owe (purchase and work orders)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCurrency(data.expenseTotal)}</p></CardContent>
        </Card>
      </div>

      <QboReceiptsPanel />
      <QboBillsPanel />

      <ListToolbar>
        <SearchField value={search} onChange={setSearch} placeholder="Search customer, vendor or project" />
        <FilterSelect
          label="Show"
          value={tab}
          onChange={(v) => setTab(v as "invoices" | "expenses")}
          options={[
            { value: "invoices", label: "Invoices by customer" },
            { value: "expenses", label: "Expenses by vendor" },
          ]}
        />
        <Input
          className="w-full sm:w-64"
          inputMode="decimal"
          placeholder="Deposit or check amount to match"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          aria-label="Amount to match"
        />
      </ListToolbar>
      {hasAmount && (
        <p className="text-sm text-muted-foreground">
          {matchedIds.ids.size > 0
            ? `Highlighted rows add up to exactly ${formatCurrency(amount)} (up to four together within one ${tab === "invoices" ? "customer" : "vendor"}).`
            : `Nothing adds up to exactly ${formatCurrency(amount)}${tab === "invoices" ? " for a single customer" : " for a single vendor"}.`}
        </p>
      )}

      {tab === "invoices" ? (
        data.customers.length === 0 ? (
          <EmptyState icon={Receipt} heading="Nothing outstanding" description="Every sent invoice is paid." />
        ) : (
          data.customers
            .map((c) => ({ ...c, invoices: c.invoices.filter((i) => matches(`${c.name} ${i.number} ${i.milestoneName} ${jobLabel(i)}`)) }))
            .filter((c) => c.invoices.length > 0)
            .map((c) => (
              <Card key={c.customerId} className={matchedIds.groups.has(c.customerId) ? "ring-2 ring-primary" : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <CardTitle className="text-base">
                      {c.name} <span className="text-sm font-normal text-muted-foreground">· {c.projectCount} project{c.projectCount === 1 ? "" : "s"}</span>
                    </CardTitle>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(c.total)}</p>
                      {c.overdueTotal > 0 && <p className="text-xs text-destructive">{formatCurrency(c.overdueTotal)} overdue</p>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Invoice total</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.invoices.map((i) => (
                        <TableRow key={i.id} className={matchedIds.ids.has(i.id) ? "bg-primary/10" : undefined}>
                          <TableCell>
                            <Link href={`/projects/${i.projectSlug}`} className="hover:underline">{jobLabel(i)}</Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/projects/${i.projectSlug}/invoices/${i.id}`} className="hover:underline">{i.number}</Link>
                            <span className="block text-xs text-muted-foreground">{i.milestoneName}</span>
                          </TableCell>
                          <TableCell className={i.overdue ? "text-destructive" : undefined}>
                            {i.dueOn ?? "—"}
                            {i.overdue && <span className="block text-xs">Overdue</span>}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(i.amount)}</TableCell>
                          <TableCell className="text-right">{i.received > 0 ? formatCurrency(i.received) : "—"}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(i.outstanding)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
        )
      ) : data.vendors.length === 0 ? (
        <EmptyState icon={Receipt} heading="Nothing outstanding" description="Every issued order is paid." />
      ) : (
        data.vendors
          .map((v) => ({ ...v, orders: v.orders.filter((o) => matches(`${v.name} ${o.number} ${jobLabel(o)}`)) }))
          .filter((v) => v.orders.length > 0)
          .map((v) => (
            <Card key={v.vendorId} className={matchedIds.groups.has(v.vendorId) ? "ring-2 ring-primary" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle className="text-base">{v.name}</CardTitle>
                  <p className="font-semibold">{formatCurrency(v.total)}</p>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead className="text-right">Order total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {v.orders.map((o) => (
                      <TableRow key={o.id} className={matchedIds.ids.has(o.id) ? "bg-primary/10" : undefined}>
                        <TableCell>
                          <Link href={`/projects/${o.projectSlug}`} className="hover:underline">{jobLabel(o)}</Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/projects/${o.projectSlug}/orders/${o.id}`} className="hover:underline">{o.number}</Link>
                          <span className="block text-xs text-muted-foreground">{o.kind === "work" ? "Work order" : "Purchase order"}</span>
                        </TableCell>
                        <TableCell>{o.issuedAt ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(o.total)}</TableCell>
                        <TableCell className="text-right">{o.paid > 0 ? formatCurrency(o.paid) : "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(o.outstanding)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
      )}
    </div>
  );
}
