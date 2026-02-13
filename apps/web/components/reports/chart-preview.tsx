'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCurrency, type ChartType } from '@/lib/utils/chart-config';

interface ChartConfig {
  chartType: ChartType;
  xAxis: string;
  yAxis: string;
}

interface ChartPreviewProps {
  chartConfig: ChartConfig;
  data: any[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

export function ChartPreview({ chartConfig, data }: ChartPreviewProps) {
  if (!chartConfig.chartType || chartConfig.chartType === 'table') {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Table view - no chart preview available
      </div>
    );
  }

  if (!chartConfig.xAxis || !chartConfig.yAxis) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Select X and Y axis fields to preview chart
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No data available for preview
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  switch (chartConfig.chartType) {
    case 'bar':
      return (
        <div className="h-80 w-full rounded-md border p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartConfig.xAxis} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey={chartConfig.yAxis} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case 'line':
      return (
        <div className="h-80 w-full rounded-md border p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartConfig.xAxis} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey={chartConfig.yAxis}
                stroke="#3b82f6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case 'pie':
      return (
        <div className="h-80 w-full rounded-md border p-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey={chartConfig.yAxis}
                nameKey={chartConfig.xAxis}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry: any) => `${entry[chartConfig.xAxis!]}: ${formatCurrency(entry[chartConfig.yAxis!])}`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    case 'area':
      return (
        <div className="h-80 w-full rounded-md border p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartConfig.xAxis} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey={chartConfig.yAxis}
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    default:
      return (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Unknown chart type
        </div>
      );
  }
}
