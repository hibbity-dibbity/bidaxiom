"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Phones hide the column headers, so this is the way to sort a list shown as cards. Works with any TanStack table. */
export function MobileSort<T>({ table }: { table: Table<T> }) {
  const cols = table.getAllLeafColumns().filter((c) => c.getCanSort() && typeof c.columnDef.header === "string" && c.columnDef.header);
  if (cols.length === 0) return null;
  const current = table.getState().sorting[0];
  return (
    <div className="flex items-center gap-2 sm:hidden">
      <Select value={current?.id ?? ""} onValueChange={(id) => table.setSorting([{ id, desc: current?.desc ?? false }])}>
        <SelectTrigger aria-label="Sort by" className="flex-1">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {cols.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.columnDef.header as string}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={current?.desc ? "Sorted descending, switch to ascending" : "Sorted ascending, switch to descending"}
        disabled={!current}
        onClick={() => current && table.setSorting([{ id: current.id, desc: !current.desc }])}
      >
        {current?.desc ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
      </Button>
    </div>
  );
}
