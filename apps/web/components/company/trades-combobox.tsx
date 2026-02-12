"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { CSI_DIVISIONS } from "@/lib/csi-divisions";

interface TradesComboboxProps {
  value: number[];
  onChange: (value: number[]) => void;
}

/**
 * Multi-select combobox for CSI division selection.
 * Searchable by division number or name.
 * Shows selected divisions as removable badges.
 */
export function TradesCombobox({ value, onChange }: TradesComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const toggleDivision = (divisionNumber: number) => {
    const isSelected = value.includes(divisionNumber);
    if (isSelected) {
      onChange(value.filter((num) => num !== divisionNumber));
    } else {
      onChange([...value, divisionNumber]);
    }
  };

  const removeDivision = (divisionNumber: number) => {
    onChange(value.filter((num) => num !== divisionNumber));
  };

  const selectedDivisions = CSI_DIVISIONS.filter((div) =>
    value.includes(div.number)
  );

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value.length === 0
              ? "Select trades..."
              : `${value.length} trade${value.length === 1 ? "" : "s"} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search divisions..." />
            <CommandList>
              <CommandEmpty>No division found.</CommandEmpty>
              <CommandGroup>
                {CSI_DIVISIONS.map((division) => {
                  const isSelected = value.includes(division.number);
                  const paddedNumber = division.number
                    .toString()
                    .padStart(2, "0");
                  return (
                    <CommandItem
                      key={division.number}
                      value={`${paddedNumber} ${division.name}`}
                      onSelect={() => toggleDivision(division.number)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
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

      {selectedDivisions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedDivisions.map((division) => (
            <Badge
              key={division.number}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => removeDivision(division.number)}
            >
              <span className="font-mono mr-1">
                {division.number.toString().padStart(2, "0")}
              </span>
              {division.name}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
