"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  status?: "success" | "warning" | "error" | "neutral";
  onClick?: () => void;
  className?: string;
}

const statusColorMap = {
  success: "text-green-600 dark:text-green-500",
  warning: "text-amber-600 dark:text-amber-500",
  error: "text-red-600 dark:text-red-500",
  neutral: "",
};

export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  status,
  onClick,
  className,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        onClick && "cursor-pointer hover:shadow-sm transition-shadow",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold",
            status && statusColorMap[status]
          )}
        >
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}
