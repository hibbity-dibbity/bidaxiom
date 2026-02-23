"use client";

import { NumericFormat } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Currency input with live formatting as the user types.
 * Shows $ prefix, thousands separators, and up to 2 decimal places.
 *
 * External interface unchanged — all call sites work without modification.
 * Empty field shows blank (no $0.00 placeholder); $ appears as user types.
 */
export function CurrencyInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  disabled,
  id,
}: CurrencyInputProps) {
  return (
    <NumericFormat
      id={id}
      value={value === 0 ? "" : value}
      prefix="$"
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale={false}
      allowNegative
      customInput={Input}
      className={cn(className)}
      disabled={disabled}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onValueChange={(values) => {
        onChange(values.floatValue ?? 0);
      }}
    />
  );
}
