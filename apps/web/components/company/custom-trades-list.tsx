"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CSI_DIVISIONS } from "@/lib/csi-divisions";

interface CustomTrade {
  id: string;
  name: string;
  parentDivision?: number;
}

interface CustomTradesListProps {
  value: CustomTrade[];
  onChange: (value: CustomTrade[]) => void;
}

/**
 * Inline add/remove list for custom specialty trades.
 * Allows adding trades with optional parent CSI division.
 */
export function CustomTradesList({ value, onChange }: CustomTradesListProps) {
  const [tradeName, setTradeName] = React.useState("");
  const [parentDivision, setParentDivision] = React.useState<number | undefined>(
    undefined
  );
  const [open, setOpen] = React.useState(false);

  const addTrade = () => {
    const trimmedName = tradeName.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      return;
    }

    const newTrade: CustomTrade = {
      id: crypto.randomUUID(),
      name: trimmedName,
      parentDivision,
    };

    onChange([...value, newTrade]);
    setTradeName("");
    setParentDivision(undefined);
  };

  const removeTrade = (id: string) => {
    onChange(value.filter((trade) => trade.id !== id));
  };

  const getParentDivisionName = (divisionNumber: number) => {
    const division = CSI_DIVISIONS.find((div) => div.number === divisionNumber);
    return division
      ? `${division.number.toString().padStart(2, "0")} ${division.name}`
      : "";
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add specialty trades not covered by CSI divisions
      </p>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="trade-name" className="sr-only">
            Trade name
          </Label>
          <Input
            id="trade-name"
            placeholder="Trade name (e.g., Solar Panel Installation)"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTrade();
              }
            }}
          />
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[200px] justify-start"
              type="button"
            >
              {parentDivision !== undefined
                ? getParentDivisionName(parentDivision)
                : "Parent division"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search divisions..." />
              <CommandList>
                <CommandEmpty>No division found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      setParentDivision(undefined);
                      setOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">
                      None (no parent)
                    </span>
                  </CommandItem>
                  {CSI_DIVISIONS.map((division) => {
                    const paddedNumber = division.number
                      .toString()
                      .padStart(2, "0");
                    return (
                      <CommandItem
                        key={division.number}
                        value={`${paddedNumber} ${division.name}`}
                        onSelect={() => {
                          setParentDivision(division.number);
                          setOpen(false);
                        }}
                      >
                        <span className="font-mono text-muted-foreground mr-2">
                          {paddedNumber}
                        </span>
                        <span>{division.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button type="button" onClick={addTrade}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between rounded-lg border bg-card p-3"
            >
              <div>
                <div className="font-medium">{trade.name}</div>
                {trade.parentDivision !== undefined && (
                  <div className="text-sm text-muted-foreground">
                    Parent: {getParentDivisionName(trade.parentDivision)}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => removeTrade(trade.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
