"use client";

import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dollars } from "@/components/orders/order-ui";

const VIEW = ["org:admin", "org:project_manager", "org:accountant"];
const ACT = ["org:admin", "org:project_manager"];

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Projected cost against what QuickBooks says was spent on the project, and the QuickBooks costs no order accounts for. */
export function ProjectCosts({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const { orgRole } = useAuth();
  const allowed = !orgRole || VIEW.includes(orgRole);
  const canAct = !orgRole || ACT.includes(orgRole);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.outstanding.projectCosts.useQuery({ projectId }, { enabled: allowed });
  const refresh = () => utils.outstanding.projectCosts.invalidate({ projectId });
  const ignoreBill = trpc.outstanding.ignoreBill.useMutation({ onSuccess: () => { toast.success("Set aside"); refresh(); }, onError: (e) => toast.error(e.message) });
  const ignoreExpense = trpc.outstanding.ignoreExpense.useMutation({ onSuccess: () => { toast.success("Set aside"); refresh(); }, onError: (e) => toast.error(e.message) });

  if (!allowed) return null;
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return null;

  const over = data.actual - data.projected;
  const cards: Array<{ label: string; value: number; note?: string; warn?: boolean }> = [
    { label: "Budget", value: data.budget },
    { label: "Projected", value: data.projected },
    { label: "Actual in QuickBooks", value: data.actual, note: data.readingOn ? undefined : "QuickBooks is not being read" },
    { label: "Not on an order", value: data.unaccountedTotal, warn: data.unaccountedTotal > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Projected vs actual cost</h2>
        <span className="text-xs text-muted-foreground">
          {!data.readingOn ? "Turn on reading payments and bills in Settings > Integrations to see actuals." : !data.inQuickBooks ? "This project is not in QuickBooks yet." : data.lastCheckAt ? `QuickBooks read ${new Date(data.lastCheckAt).toLocaleString()}` : "Waiting for the first QuickBooks read"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-md border p-3 ${c.warn ? "border-amber-500" : ""}`}>
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="font-mono text-lg font-semibold tabular-nums">{dollars(c.value)}</div>
            {c.note && <div className="text-xs text-muted-foreground">{c.note}</div>}
          </div>
        ))}
      </div>
      {data.connected && (
        <p className="text-sm text-muted-foreground">
          {over > 0 ? `Actual is ${dollars(over)} over projected.` : over < 0 ? `Actual is ${dollars(-over)} under projected so far.` : "Actual matches projected."}
          {data.setAside > 0 ? ` ${dollars(data.setAside)} more was set aside.` : ""}
        </p>
      )}

      {data.rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Projected</TableHead>
              <TableHead className="text-right">Billed in QuickBooks</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Left to bill</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/projects/${projectSlug}/orders/${r.id}`} className="hover:underline">{r.number}</Link>
                  {r.status === "draft" && <span className="ml-2 text-xs text-muted-foreground">draft</span>}
                </TableCell>
                <TableCell>{r.vendorName ?? "—"}</TableCell>
                <TableCell className="text-right">{dollars(r.budget)}</TableCell>
                <TableCell className="text-right">{dollars(r.projected)}</TableCell>
                <TableCell className="text-right">{dollars(r.billed)}</TableCell>
                <TableCell className="text-right">{dollars(r.paid)}</TableCell>
                <TableCell className={`text-right ${r.billed > r.projected ? "text-destructive" : ""}`}>{dollars(r.projected - r.billed)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data.unaccounted.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">In QuickBooks on this project, not on any order ({data.unaccounted.length})</h3>
          <p className="text-xs text-muted-foreground">
            Bills can be tied to an order on the <Link href="/outstanding" className="underline">Outstanding</Link> page. Checks and card purchases cannot be tied to an order; set aside the ones that need no action.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Ref / account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.unaccounted.map((x) => (
                <TableRow key={`${x.kind}-${x.id}`}>
                  <TableCell>{shortDate(x.date)}</TableCell>
                  <TableCell>{x.kind === "bill" ? "Bill" : "Expense"}</TableCell>
                  <TableCell>{x.vendor ?? "—"}</TableCell>
                  <TableCell>
                    {[x.docNumber, x.account].filter(Boolean).join(" · ") || "—"}
                    {x.memo && <div className="text-xs text-muted-foreground">{x.memo}</div>}
                  </TableCell>
                  <TableCell className="text-right">{dollars(x.amount)}</TableCell>
                  <TableCell className="text-right">
                    {canAct && (
                      <Button size="sm" variant="outline" disabled={ignoreBill.isPending || ignoreExpense.isPending} onClick={() => (x.kind === "bill" ? ignoreBill.mutate({ billId: x.id, ignored: true }) : ignoreExpense.mutate({ expenseId: x.id, ignored: true }))}>
                        Set aside
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
