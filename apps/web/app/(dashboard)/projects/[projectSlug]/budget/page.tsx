"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetSummaryCards } from "@/components/budget/budget-summary-cards";
import { BudgetVarianceChart } from "@/components/budget/budget-variance-chart";
import { ForecastMetrics } from "@/components/budget/forecast-metrics";
import { AlertCircle, FileEdit, FileText, Plus } from "lucide-react";

export default function BudgetDashboardPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: summary, isLoading: summaryLoading } =
    trpc.budget.getProjectSummary.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const { data: alerts, isLoading: alertsLoading } =
    trpc.budget.getVarianceAlerts.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const { data: forecast, isLoading: forecastLoading } =
    trpc.budget.getForecast.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const { data: lineItems, isLoading: lineItemsLoading } =
    trpc.budget.listLineItems.useQuery({ projectId: projectId! }, { enabled: !!projectId });

  const criticalAlerts = alerts?.filter((a) => a.severity === "critical") || [];
  const warningAlerts = alerts?.filter((a) => a.severity === "warning") || [];

  // Loading state
  if (summaryLoading || !summary) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Empty state
  if (summary.lineItemCount === 0) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Budget Set Up Yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Get started by adding budget line items. This will allow you to track
              costs, create commitments, and monitor your project's financial health.
            </p>
            <Button asChild>
              <Link href={`/projects/${projectSlug}/budget/line-items`}>
                <Plus className="h-4 w-4 mr-2" />
                Add Budget Line Items
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button asChild>
          <Link href={`/projects/${projectSlug}/budget/line-items`}>
            <FileEdit className="h-4 w-4 mr-2" />
            Manage Line Items
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectSlug}/commitments`}>
            <FileText className="h-4 w-4 mr-2" />
            View Commitments
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectSlug}/commitments/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Commitment
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <BudgetSummaryCards summary={summary} />

      {/* Variance Alerts */}
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <div className="space-y-3">
          {criticalAlerts.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Critical Budget Variances</AlertTitle>
              <AlertDescription>
                {criticalAlerts.length} cost code{criticalAlerts.length > 1 ? "s" : ""}{" "}
                exceed budget by more than 20%. Review commitments immediately.
              </AlertDescription>
            </Alert>
          )}
          {warningAlerts.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Budget Warnings</AlertTitle>
              <AlertDescription>
                {warningAlerts.length} cost code{warningAlerts.length > 1 ? "s are" : " is"}{" "}
                approaching budget limits (10-20% variance).
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Variance Chart */}
      {alerts && alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Committed by Cost Code</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetVarianceChart data={alerts} />
          </CardContent>
        </Card>
      )}

      {/* Forecast Metrics */}
      {forecast && (
        <Card>
          <CardHeader>
            <CardTitle>Earned Value Management (EVM) Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastMetrics metrics={forecast} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
