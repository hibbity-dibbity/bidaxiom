"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ForecastMetrics } from "@construction/shared";
import { TrendingUp, TrendingDown, Target, AlertCircle } from "lucide-react";

interface ForecastMetricsProps {
  metrics: ForecastMetrics;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function ForecastMetrics({ metrics }: ForecastMetricsProps) {
  const getCpiColor = (cpi: number) => {
    if (cpi > 1.0) return "text-green-600 border-green-200 bg-green-50";
    if (cpi >= 0.8) return "text-amber-600 border-amber-200 bg-amber-50";
    return "text-red-600 border-red-200 bg-red-50";
  };

  const getVacColor = (vac: number) => {
    if (vac > 0) return "text-green-600";
    if (vac < 0) return "text-red-600";
    return "text-slate-600";
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className={`border-2 ${getCpiColor(metrics.costPerformanceIndex)}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPI</CardTitle>
          <Target className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.costPerformanceIndex.toFixed(2)}
          </div>
          <p className="text-xs mt-1 opacity-80">
            {metrics.costPerformanceIndex > 1.0
              ? "Under budget"
              : metrics.costPerformanceIndex >= 0.8
              ? "Monitoring"
              : "Over budget"}
          </p>
          <p className="text-xs mt-1 opacity-70">
            &gt; 1.0 = under budget
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">EAC</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {currencyFormatter.format(metrics.estimateAtCompletion)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Estimate at completion
          </p>
          {metrics.estimateAtCompletion !== metrics.budgetAtCompletion && (
            <p className="text-xs mt-1 flex items-center gap-1">
              {metrics.estimateAtCompletion > metrics.budgetAtCompletion ? (
                <>
                  <TrendingUp className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">
                    {currencyFormatter.format(
                      metrics.estimateAtCompletion - metrics.budgetAtCompletion
                    )}
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">
                    {currencyFormatter.format(
                      metrics.budgetAtCompletion - metrics.estimateAtCompletion
                    )}
                  </span>
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">ETC</CardTitle>
          <AlertCircle className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {currencyFormatter.format(metrics.estimateToComplete)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Remaining cost to finish
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">VAC</CardTitle>
          <TrendingDown className="h-4 w-4 text-slate-600" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getVacColor(metrics.varianceAtCompletion)}`}>
            {currencyFormatter.format(metrics.varianceAtCompletion)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.varianceAtCompletion > 0
              ? "Under budget"
              : metrics.varianceAtCompletion < 0
              ? "Over budget"
              : "On budget"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
