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

interface AgingReportTableProps {
  type: "ar" | "ap";
}

export function AgingReportTable({ type }: AgingReportTableProps) {
  const { data: report, isLoading } = type === "ar"
    ? trpc.invoiceTracking.getARAgingReport.useQuery({})
    : trpc.invoiceTracking.getAPAgingReport.useQuery({});

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{type === "ar" ? "Accounts Receivable" : "Accounts Payable"} Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return null;
  }

  const { overallBuckets, byProject, byVendor } = report;

  const totalOutstanding =
    Number(overallBuckets.current) +
    Number(overallBuckets.days31to60) +
    Number(overallBuckets.days61to90) +
    Number(overallBuckets.days91to120) +
    Number(overallBuckets.over120);

  const overdue =
    Number(overallBuckets.days31to60) +
    Number(overallBuckets.days61to90) +
    Number(overallBuckets.days91to120) +
    Number(overallBuckets.over120);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{type === "ar" ? "Accounts Receivable" : "Accounts Payable"} Aging</CardTitle>
        <CardDescription>Outstanding {type === "ar" ? "invoices" : "bills"} by aging bucket</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Bar */}
        <div className="flex gap-6 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold">{currencyFormatter.format(totalOutstanding)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overdue (&gt;30 days)</p>
            <p className={`text-2xl font-bold ${overdue > 0 ? "text-red-600" : ""}`}>
              {currencyFormatter.format(overdue)}
            </p>
          </div>
        </div>

        {/* Aging Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{type === "ar" ? "Project" : "Vendor"}</TableHead>
              <TableHead className="text-right">Current (0-30)</TableHead>
              <TableHead className="text-right">31-60</TableHead>
              <TableHead className="text-right">61-90</TableHead>
              <TableHead className="text-right">91-120</TableHead>
              <TableHead className="text-right">120+</TableHead>
              <TableHead className="text-right font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {type === "ar"
              ? byProject?.map((item: any) => (
                  <TableRow key={item.projectId}>
                    <TableCell>{item.projectName || "Unknown Project"}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {currencyFormatter.format(Number(item.current))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-yellow-600">
                      {currencyFormatter.format(Number(item.days31to60))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      {currencyFormatter.format(Number(item.days61to90))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {currencyFormatter.format(Number(item.days91to120))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-800">
                      {currencyFormatter.format(Number(item.over120))}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {currencyFormatter.format(Number(item.total))}
                    </TableCell>
                  </TableRow>
                ))
              : byVendor?.map((item: any) => (
                  <TableRow key={item.vendorName}>
                    <TableCell>{item.vendorName}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {currencyFormatter.format(Number(item.current))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-yellow-600">
                      {currencyFormatter.format(Number(item.days31to60))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      {currencyFormatter.format(Number(item.days61to90))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {currencyFormatter.format(Number(item.days91to120))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-800">
                      {currencyFormatter.format(Number(item.over120))}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {currencyFormatter.format(Number(item.total))}
                    </TableCell>
                  </TableRow>
                ))}

            {/* Totals Row */}
            <TableRow className="font-bold bg-muted/50">
              <TableCell>Total</TableCell>
              <TableCell className="text-right font-mono text-green-600">
                {currencyFormatter.format(Number(overallBuckets.current))}
              </TableCell>
              <TableCell className="text-right font-mono text-yellow-600">
                {currencyFormatter.format(Number(overallBuckets.days31to60))}
              </TableCell>
              <TableCell className="text-right font-mono text-orange-600">
                {currencyFormatter.format(Number(overallBuckets.days61to90))}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {currencyFormatter.format(Number(overallBuckets.days91to120))}
              </TableCell>
              <TableCell className="text-right font-mono text-red-800">
                {currencyFormatter.format(Number(overallBuckets.over120))}
              </TableCell>
              <TableCell className="text-right font-mono font-bold">
                {currencyFormatter.format(totalOutstanding)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
