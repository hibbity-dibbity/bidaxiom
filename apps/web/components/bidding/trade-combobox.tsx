"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SIMPLE_TRADES } from "@construction/shared";
import { cn } from "@/lib/utils";

interface TradeComboboxProps {
  value: string[];
  onChange: (trades: string[]) => void;
  disabled?: boolean;
}

export function TradeCombobox({ value, onChange, disabled }: TradeComboboxProps) {
  const [open, setOpen] = useState(false);

  const toggleTrade = (trade: string) => {
    const next = value.includes(trade)
      ? value.filter((t) => t !== trade)
      : [...value, trade];
    onChange(next);
  };

  const triggerLabel = () => {
    if (value.length === 0) return "Select trades...";
    if (value.length === 1) return value[0];
    return `${value.length} trades`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
          type="button"
        >
          <span className={cn(value.length === 0 && "text-muted-foreground")}>
            {triggerLabel()}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {SIMPLE_TRADES.map((trade) => (
            <div
              key={trade}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
              onClick={() => toggleTrade(trade)}
            >
              <Checkbox
                id={`trade-cb-${trade}`}
                checked={value.includes(trade)}
                onCheckedChange={() => toggleTrade(trade)}
                onClick={(e) => e.stopPropagation()}
              />
              <label
                htmlFor={`trade-cb-${trade}`}
                className="text-sm cursor-pointer flex-1"
              >
                {trade}
              </label>
              {value.includes(trade) && (
                <Check className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
