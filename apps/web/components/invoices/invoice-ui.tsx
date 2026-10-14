"use client";

import * as React from "react";
import { StatusBadge } from "@/components/shared/status-badge";

export const dollars = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially paid",
  paid: "Paid",
};

export function InvoiceStatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) return <StatusBadge variant="error">Overdue</StatusBadge>;
  const variant = status === "draft" ? "draft" : status === "paid" ? "approved" : "pending";
  return <StatusBadge variant={variant}>{STATUS_LABEL[status] ?? status}</StatusBadge>;
}
