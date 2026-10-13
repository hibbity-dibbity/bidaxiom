"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const money = (value: number) => currencyFormatter.format(Number(value) || 0);

interface AgingReportTableProps {
  type: "ar" | "ap";
  /** Limit the report to one project. Omit for company-wide totals. */
  projectId?: string;
}

interface AgingBuckets {
  current: number;
  days31_60: number;
  days61_90: number;
  days91_120: number;
  days120Plus: number;
}

interface AgingRow {
  key: string;
  label: string;
  buckets: AgingBuckets;
  total: number;
}

export function AgingReportTable({ type, projectId }: AgingReportTableProps) {
  const isAr = type === "ar";
  const heading = isAr ? "Accounts Receivable" : "Accounts Payable";

  // Both hooks always run; only the one for this table's type fetches.
  const ar = trpc.invoiceTracking.getARAgingReport.useQuery({ projectId }, { enabled: isAr });
  const ap = trpc.invoiceTracking.getAPAgingReport.useQuery({ projectId }, { enabled: !isAr });
  const query = isAr ? ar : ap;

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{heading} Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (query.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{heading} Aging</CardTitle>
          <CardDescription>Could not load this report.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-financial-negative">{query.error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const report = isAr ? ar.data : ap.data;
  if (!report) {
    return null;
  }

  const { buckets, totalOutstanding } = report;

  const rows: AgingRow[] = isAr
    ? (ar.data?.byProject ?? []).map((p) => ({
        key: p.projectId,
        label: p.projectName || "Unknown Project",
        buckets: p.buckets,
        total: p.total,
      }))
    : (ap.data?.byVendor ?? []).map((v) => ({
        key: v.vendorName,
        label: v.vendorName,
        buckets: v.buckets,
        total: v.total,
      }));

  const overdue =
    buckets.days31_60 + buckets.days61_90 + buckets.days91_120 + buckets.days120Plus;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading} Aging</CardTitle>
        <CardDescription>Outstanding {isAr ? "invoices" : "bills"} by aging bucket</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Bar */}
        <div className="flex gap-6 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold tabular-nums">{money(totalOutstanding)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overdue (&gt;30 days)</p>
            <p className={`text-2xl font-bold tabular-nums ${overdue > 0 ? "text-financial-negative" : ""}`}>
              {money(overdue)}
            </p>
          </div>
        </div>

        {/* Aging Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isAr ? "Project" : "Vendor"}</TableHead>
              <TableHead className="text-right">Current (0-30)</TableHead>
              <TableHead className="text-right">31-60</TableHead>
              <TableHead className="text-right">61-90</TableHead>
              <TableHead className="text-right">91-120</TableHead>
              <TableHead className="text-right">120+</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No outstanding {isAr ? "invoices" : "bills"}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-financial-positive">
                    {money(row.buckets.current)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {money(row.buckets.days31_60)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {money(row.buckets.days61_90)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-financial-negative">
                    {money(row.buckets.days91_120)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-financial-negative">
                    {money(row.buckets.days120Plus)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-bold">
                    {money(row.total)}
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Totals Row */}
            <TableRow className="font-bold bg-muted/50">
              <TableCell>Total</TableCell>
              <TableCell className="text-right font-mono tabular-nums text-financial-positive">
                {money(buckets.current)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                {money(buckets.days31_60)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                {money(buckets.days61_90)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-financial-negative">
                {money(buckets.days91_120)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-financial-negative">
                {money(buckets.days120Plus)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums font-bold">
                {money(totalOutstanding)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
