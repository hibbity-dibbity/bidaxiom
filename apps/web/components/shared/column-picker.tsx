"use client";

import { Settings2 } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ColumnPickerProps<TData> {
  table: Table<TData>;
}

export function ColumnPicker<TData>({ table }: ColumnPickerProps<TData>) {
  const hideableColumns = table
    .getAllLeafColumns()
    .filter((col) => col.getCanHide());

  if (hideableColumns.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Column settings"
        >
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">Column settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <p className="text-xs font-medium text-muted-foreground px-2 pb-2">
          Toggle columns
        </p>
        <div className="space-y-1">
          {hideableColumns.map((col) => {
            const label =
              typeof col.columnDef.header === "string"
                ? col.columnDef.header
                : col.id;
            return (
              <label
                key={col.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded"
              >
                <Checkbox
                  checked={col.getIsVisible()}
                  onCheckedChange={(checked) =>
                    col.toggleVisibility(!!checked)
                  }
                />
                {label}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
