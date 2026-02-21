"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { VarianceAlert } from "@construction/shared";
import { CSI_DIVISIONS } from "@construction/shared";

interface BudgetVarianceChartProps {
  data: VarianceAlert[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function BudgetVarianceChart({ data }: BudgetVarianceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No budget data yet</p>
      </div>
    );
  }

  const chartData = data.map((alert) => {
    const division = CSI_DIVISIONS.find((d) => d.division === alert.costCodeId);
    const divisionName = division
      ? `Div ${alert.costCodeId}: ${division.name}`
      : `Cost Code ${alert.costCodeId}`;

    return {
      name: divisionName,
      budgeted: alert.budgeted,
      committed: alert.committed,
      variance: alert.variance,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-card p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{payload[0].payload.name}</p>
          <div className="space-y-1 text-sm">
            <p className="text-primary">
              Budgeted: {currencyFormatter.format(payload[0].payload.budgeted)}
            </p>
            <p className="text-financial-pending">
              Committed: {currencyFormatter.format(payload[0].payload.committed)}
            </p>
            <p
              className={
                payload[0].payload.variance >= 0 ? "text-financial-positive" : "text-financial-negative"
              }
            >
              Variance: {currencyFormatter.format(payload[0].payload.variance)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickFormatter={(value) =>
            currencyFormatter.format(value).replace(/\.00$/, "")
          }
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: "20px" }} />
        <Bar dataKey="budgeted" fill="#2563eb" name="Budgeted" radius={[4, 4, 0, 0]} />
        <Bar dataKey="committed" fill="#d97706" name="Committed" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
