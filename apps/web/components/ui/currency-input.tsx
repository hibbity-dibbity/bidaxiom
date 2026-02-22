"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency, parseCurrencyInput } from "@/lib/utils/format";
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
 * Currency input that shows raw number while typing and formats
 * as "$X,XXX.XX" when the user leaves the field.
 *
 * Uses type="text" inputMode="decimal" to avoid browser number input quirks.
 * Syncs from parent value prop only while not focused.
 */
export function CurrencyInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder = "0.00",
  className,
  disabled,
  id,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(
    value === 0 ? "" : formatCurrency(value)
  );
  const isFocusedRef = useRef(false);

  // Sync from parent when value changes externally (e.g. form reset, field array append)
  // but NOT while the user is actively typing
  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplayValue(value === 0 ? "" : formatCurrency(value));
    }
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    // Show raw number (no $ or commas) so the user can edit cleanly
    const numeric = parseCurrencyInput(e.target.value);
    setDisplayValue(numeric === 0 ? "" : String(numeric));
    // Select all so user can immediately type a replacement
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only update local display — don't call parent onChange yet
    setDisplayValue(e.target.value);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const numeric = parseCurrencyInput(displayValue);
    // Format for display
    setDisplayValue(numeric === 0 ? "" : formatCurrency(numeric));
    // Notify parent with the parsed number
    onChange(numeric);
    onBlur?.();
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={cn(className)}
      disabled={disabled}
    />
  );
}
