"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { BudgetSummary } from "@construction/shared";
import { DollarSign, TrendingDown, Wallet, FileText } from "lucide-react";

interface BudgetSummaryCardsProps {
  summary: BudgetSummary;
}

export function BudgetSummaryCards({ summary }: BudgetSummaryCardsProps) {
  const remaining = summary.totalBudgeted - summary.totalCommitted;
  const commitmentPercentage = summary.totalBudgeted > 0
    ? (summary.totalCommitted / summary.totalBudgeted) * 100
    : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            <CurrencyDisplay amount={summary.totalBudgeted} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.lineItemCount} line items
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Committed</CardTitle>
          <Wallet className="h-4 w-4 text-financial-pending" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-financial-pending">
            <CurrencyDisplay amount={summary.totalCommitted} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {commitmentPercentage.toFixed(1)}% of budget
          </p>
          <Progress value={commitmentPercentage} className="mt-2 h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Remaining</CardTitle>
          <TrendingDown className={`h-4 w-4 ${remaining >= 0 ? "text-financial-positive" : "text-financial-negative"}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <CurrencyDisplay amount={remaining} colorize />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {remaining >= 0 ? "Under budget" : "Over budget"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Commitments</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-muted-foreground">
            {summary.commitmentCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Active commitments
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
