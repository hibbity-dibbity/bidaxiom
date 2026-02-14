"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentAppListProps {
  projectId: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-700 border-gray-200",
  submitted: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  under_review: "bg-orange-500/10 text-orange-700 border-orange-200",
  approved: "bg-green-500/10 text-green-700 border-green-200",
  rejected: "bg-red-500/10 text-red-700 border-red-200",
  paid: "bg-blue-500/10 text-blue-700 border-blue-200",
};

export function PaymentAppList({ projectId }: PaymentAppListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: paymentApps, isLoading } = trpc.paymentApp.list.useQuery({
    projectId,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const { data: summary } = trpc.paymentApp.getSummary.useQuery({ projectId });
  const { data: retainage } = trpc.paymentApp.getRetainage.useQuery({ projectId });
  const { data: sovItems } = trpc.sov.list.useQuery({ projectId });

  const hasSovItems = (sovItems?.items.length || 0) > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[120px] bg-muted animate-pulse rounded" />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary
                ? currencyFormatter.format(Number(summary.amounts.totalApproved))
                : "$0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary
                ? currencyFormatter.format(Number(summary.amounts.totalPending))
                : "$0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary
                ? currencyFormatter.format(Number(summary.amounts.totalPaid))
                : "$0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Retainage Held</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {retainage?.totals?.totalHeld
                ? currencyFormatter.format(Number(retainage.totals.totalHeld))
                : "$0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasSovItems ? (
          <Button asChild>
            <Link href={`/projects/${projectId}/payment-apps/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Payment Application
            </Link>
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              New Payment Application
            </Button>
            <p className="text-sm text-muted-foreground">
              Set up SOV first
            </p>
          </div>
        )}
      </div>

      {!hasSovItems && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You must set up a Schedule of Values before creating payment applications.{" "}
            <Link
              href={`/projects/${projectId}/sov`}
              className="font-medium underline underline-offset-4"
            >
              Set up SOV
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Apps Table */}
      {paymentApps && paymentApps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Payment Applications</CardTitle>
            <CardDescription>
              {paymentApps.length} payment application{paymentApps.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application #</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Current Payment Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono">{app.applicationNumber}</TableCell>
                    <TableCell>
                      {new Date(app.periodStart).toLocaleDateString()} -{" "}
                      {new Date(app.periodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      {currencyFormatter.format(Number(app.currentPaymentDue))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[app.status] || "bg-gray-500/10 text-gray-700"}
                        variant="outline"
                      >
                        {app.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/projects/${projectId}/payment-apps/${app.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No payment applications yet
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
