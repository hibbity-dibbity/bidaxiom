"use client";

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ColumnPicker } from "@/components/shared/column-picker";

interface G703LineItem {
  sovItemNumber: number;
  sovDescription: string;
  scheduledValue: number;
  previousPercent: number;
  currentPercent: number;
  workThisPeriod: number;
  materialsStored: number;
  totalCompleted: number;
  retainagePercent: number;
  retainageAmount: number;
  balanceToFinish: number;
}

interface G703ContinuationProps {
  lineItems: G703LineItem[];
  editable?: boolean;
  onLineItemChange?: (index: number, field: "currentPercent" | "materialsStored", value: number) => void;
}

export function G703Continuation({ lineItems, editable = false, onLineItemChange }: G703ContinuationProps) {
  const totals = lineItems.reduce(
    (acc, item) => ({
      scheduledValue: acc.scheduledValue + item.scheduledValue,
      workThisPeriod: acc.workThisPeriod + item.workThisPeriod,
      materialsStored: acc.materialsStored + item.materialsStored,
      totalCompleted: acc.totalCompleted + item.totalCompleted,
      retainageAmount: acc.retainageAmount + item.retainageAmount,
      balanceToFinish: acc.balanceToFinish + item.balanceToFinish,
    }),
    {
      scheduledValue: 0,
      workThisPeriod: 0,
      materialsStored: 0,
      totalCompleted: 0,
      retainageAmount: 0,
      balanceToFinish: 0,
    }
  );

  const columns: ColumnDef<G703LineItem>[] = React.useMemo(() => [
    { id: "item", header: "Item", enableHiding: false },
    { id: "description", header: "Description of Work", enableHiding: false },
    { id: "scheduledValue", header: "Scheduled Value" },
    { id: "fromPreviousPct", header: "From Previous %" },
    { id: "thisPeriodPct", header: "This Period %" },
    { id: "workThisPeriod", header: "Work This Period" },
    { id: "materialsStored", header: "Materials Stored" },
    { id: "totalCompleted", header: "Total Completed" },
    { id: "pctComplete", header: "% Complete" },
    { id: "balanceToFinish", header: "Balance to Finish" },
    { id: "retainage", header: "Retainage" },
  ], []);

  const { columnVisibility, onColumnVisibilityChange } = useColumnVisibility("g703-continuation");

  const table = useReactTable({
    data: lineItems,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="flex justify-end mb-1">
        <ColumnPicker table={table} />
      </div>
      <div className="relative w-full overflow-auto max-h-[70vh] rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isItem = header.id === "item";
                  const isDesc = header.id === "description";
                  return (
                    <TableHead
                      key={header.id}
                      className={
                        isItem
                          ? "w-[60px] sticky left-0 z-30 bg-background border-r"
                          : isDesc
                          ? "min-w-[200px] sticky left-[60px] z-30 bg-background border-r"
                          : undefined
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const item = row.original;
              const hasError = item.currentPercent < item.previousPercent;
              const rowIndex = lineItems.indexOf(item);
              return (
                <TableRow key={row.id} className={hasError ? "bg-muted" : ""}>
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;

                    if (colId === "item") {
                      return (
                        <TableCell key={cell.id} className="font-mono sticky left-0 z-10 bg-background border-r w-[60px]">
                          {item.sovItemNumber}
                        </TableCell>
                      );
                    }
                    if (colId === "description") {
                      return (
                        <TableCell key={cell.id} className="min-w-[200px] sticky left-[60px] z-10 bg-background border-r">
                          {item.sovDescription}
                        </TableCell>
                      );
                    }
                    if (colId === "scheduledValue") {
                      return (
                        <TableCell key={cell.id} className="text-right tabular-nums min-w-[100px]">
                          <CurrencyDisplay amount={item.scheduledValue} />
                        </TableCell>
                      );
                    }
                    if (colId === "fromPreviousPct") {
                      return (
                        <TableCell key={cell.id} className="text-center min-w-[100px]">
                          {item.previousPercent.toFixed(2)}%
                        </TableCell>
                      );
                    }
                    if (colId === "thisPeriodPct") {
                      return (
                        <TableCell key={cell.id} className="min-w-[100px]">
                          {editable ? (
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.currentPercent}
                              onChange={(e) =>
                                onLineItemChange?.(rowIndex, "currentPercent", parseFloat(e.target.value) || 0)
                              }
                              className={`w-full text-center ${hasError ? "border-destructive" : ""}`}
                            />
                          ) : (
                            <div className="text-center">{item.currentPercent.toFixed(2)}%</div>
                          )}
                        </TableCell>
                      );
                    }
                    if (colId === "workThisPeriod") {
                      return (
                        <TableCell key={cell.id} className="text-right tabular-nums min-w-[100px]">
                          <CurrencyDisplay amount={item.workThisPeriod} />
                        </TableCell>
                      );
                    }
                    if (colId === "materialsStored") {
                      return (
                        <TableCell key={cell.id} className="text-right tabular-nums min-w-[100px]">
                          {editable ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.materialsStored}
                              onChange={(e) =>
                                onLineItemChange?.(rowIndex, "materialsStored", parseFloat(e.target.value) || 0)
                              }
                              className="w-full"
                            />
                          ) : (
                            <CurrencyDisplay amount={item.materialsStored} />
                          )}
                        </TableCell>
                      );
                    }
                    if (colId === "totalCompleted") {
                      return (
                        <TableCell key={cell.id} className="text-right tabular-nums min-w-[100px]">
                          <CurrencyDisplay amount={item.totalCompleted} />
                        </TableCell>
                      );
                    }
                    if (colId === "pctComplete") {
                      return (
                        <TableCell key={cell.id} className="text-center min-w-[80px]">
                          {item.currentPercent.toFixed(2)}%
                        </TableCell>
                      );
                    }
                    if (colId === "balanceToFinish") {
                      return (
                        <TableCell key={cell.id} className="text-right tabular-nums min-w-[100px]">
                          {hasError ? (
                            <span className="text-financial-negative">
                              <CurrencyDisplay amount={item.balanceToFinish} />
                            </span>
                          ) : (
                            <CurrencyDisplay amount={item.balanceToFinish} />
                          )}
                        </TableCell>
                      );
                    }
                    if (colId === "retainage") {
                      return (
                        <TableCell key={cell.id} className="text-right tabular-nums min-w-[100px]">
                          <CurrencyDisplay amount={item.retainageAmount} />
                        </TableCell>
                      );
                    }
                    return <TableCell key={cell.id} />;
                  })}
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="sticky bottom-0 z-20 bg-muted/50">
            <TableRow className="font-bold">
              {/* Item column — always visible */}
              <TableCell className="sticky left-0 z-30 bg-muted/50 border-r">Totals</TableCell>
              {/* Description column — always visible */}
              <TableCell className="sticky left-[60px] z-30 bg-muted/50 border-r" />
              {table.getColumn("scheduledValue")?.getIsVisible() && (
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={totals.scheduledValue} />
                </TableCell>
              )}
              {table.getColumn("fromPreviousPct")?.getIsVisible() && (
                <TableCell />
              )}
              {table.getColumn("thisPeriodPct")?.getIsVisible() && (
                <TableCell />
              )}
              {table.getColumn("workThisPeriod")?.getIsVisible() && (
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={totals.workThisPeriod} />
                </TableCell>
              )}
              {table.getColumn("materialsStored")?.getIsVisible() && (
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={totals.materialsStored} />
                </TableCell>
              )}
              {table.getColumn("totalCompleted")?.getIsVisible() && (
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={totals.totalCompleted} />
                </TableCell>
              )}
              {table.getColumn("pctComplete")?.getIsVisible() && (
                <TableCell />
              )}
              {table.getColumn("balanceToFinish")?.getIsVisible() && (
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={totals.balanceToFinish} />
                </TableCell>
              )}
              {table.getColumn("retainage")?.getIsVisible() && (
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={totals.retainageAmount} />
                </TableCell>
              )}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}
