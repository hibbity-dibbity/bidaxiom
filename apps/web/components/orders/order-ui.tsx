"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { revisionLabel } from "@construction/shared";

export const dollars = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const fieldCls =
  "h-9 w-full rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-70";

export function signed(n: number) {
  if (Math.abs(n) < 0.005) return "$0.00";
  return `${n > 0 ? "+" : "-"}${dollars(Math.abs(n))}`;
}

export function OrderStatusBadge({ status, revision }: { status: string; revision: number }) {
  const label = status === "draft" ? "Draft" : status === "issued" ? "Issued" : status.replace("_", " ");
  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge variant={status === "draft" ? "draft" : "approved"}>{label}</StatusBadge>
      <span className="text-xs text-muted-foreground">{revisionLabel(revision)}</span>
    </span>
  );
}

export function InsuranceWarning({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <span className={cn("rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-financial-pending", className)}>
      {message}. You can still issue.
    </span>
  );
}

/** Number input that saves on blur when the value changed. */
export function BlurNumber({
  value,
  disabled,
  onSave,
  className,
  label,
}: {
  value: number;
  disabled?: boolean;
  onSave: (v: number) => void;
  className?: string;
  label: string;
}) {
  return (
    <input
      key={value}
      type="number"
      step="0.01"
      min={0}
      aria-label={label}
      disabled={disabled}
      defaultValue={value}
      className={cn(fieldCls, "text-right tabular-nums", className)}
      onBlur={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v) && v >= 0 && Math.round(v * 100) !== Math.round(value * 100)) onSave(v);
      }}
    />
  );
}

export function BlurText({
  value,
  disabled,
  onSave,
  className,
  label,
  placeholder,
}: {
  value: string | null;
  disabled?: boolean;
  onSave: (v: string | null) => void;
  className?: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <input
      key={value ?? ""}
      aria-label={label}
      disabled={disabled}
      placeholder={placeholder}
      defaultValue={value ?? ""}
      className={cn(fieldCls, className)}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v !== (value ?? "")) onSave(v === "" ? null : v);
      }}
    />
  );
}
