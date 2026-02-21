"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
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

interface RetainageSummaryProps {
  projectId: string;
}

export function RetainageSummary({ projectId }: RetainageSummaryProps) {
  const { data: retainage, isLoading } = trpc.paymentApp.getRetainage.useQuery({ projectId });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Retainage Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!retainage) {
    return null;
  }

  const { summary, records } = retainage;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retainage Summary</CardTitle>
        <CardDescription>Retainage held and released for this project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">Total Held</p>
            <p className="text-2xl font-bold text-financial-negative">
              {currencyFormatter.format(Number(summary.totalHeld))}
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">Total Released</p>
            <p className="text-2xl font-bold text-financial-positive">
              {currencyFormatter.format(Number(summary.totalReleased))}
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">Eligible for Release</p>
            <p className="text-2xl font-bold">
              {currencyFormatter.format(Number(summary.totalEligibleForRelease))}
            </p>
          </div>

          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">Remaining Held</p>
            <p className="text-2xl font-bold">
              {currencyFormatter.format(Number(summary.totalHeld) - Number(summary.totalReleased))}
            </p>
          </div>
        </div>

        {/* Retainage Records Table */}
        {records.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Retainage Records</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment App</TableHead>
                  <TableHead>Amount Held</TableHead>
                  <TableHead>Rate (%)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Released Amount</TableHead>
                  <TableHead>Released Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono">{record.applicationNumber}</TableCell>
                    <TableCell className="font-mono">
                      {currencyFormatter.format(Number(record.amountHeld))}
                    </TableCell>
                    <TableCell className="text-center">
                      {Number(record.retainageRate).toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={
                          record.status === "held"
                            ? "warning"
                            : record.status === "eligible_for_release"
                            ? "pending"
                            : "approved"
                        }
                      >
                        {record.status.replace("_", " ")}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {record.releasedAmount
                        ? currencyFormatter.format(Number(record.releasedAmount))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {record.releasedAt
                        ? new Date(record.releasedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {records.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No retainage records yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
