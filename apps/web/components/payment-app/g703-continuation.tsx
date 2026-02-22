"use client";

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

  return (
    <div className="relative w-full overflow-auto max-h-[70vh] rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-background">
          <TableRow>
            <TableHead className="w-[60px] sticky left-0 z-30 bg-background border-r">Item</TableHead>
            <TableHead className="min-w-[200px] sticky left-[60px] z-30 bg-background border-r">Description of Work</TableHead>
            <TableHead className="w-[120px]">Scheduled Value</TableHead>
            <TableHead className="w-[100px]">From Previous (%)</TableHead>
            <TableHead className="w-[100px]">This Period (%)</TableHead>
            <TableHead className="w-[120px]">Work This Period</TableHead>
            <TableHead className="w-[120px]">Materials Stored</TableHead>
            <TableHead className="w-[120px]">Total Completed</TableHead>
            <TableHead className="w-[100px]">% Complete</TableHead>
            <TableHead className="w-[120px]">Balance to Finish</TableHead>
            <TableHead className="w-[120px]">Retainage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((item, index) => {
            const hasError = item.currentPercent < item.previousPercent;
            return (
              <TableRow key={item.sovItemNumber} className={hasError ? "bg-muted" : ""}>
                <TableCell className="font-mono sticky left-0 z-10 bg-background border-r">{item.sovItemNumber}</TableCell>
                <TableCell className="sticky left-[60px] z-10 bg-background border-r">{item.sovDescription}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={item.scheduledValue} />
                </TableCell>
                <TableCell className="text-center">
                  {item.previousPercent.toFixed(2)}%
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.currentPercent}
                      onChange={(e) =>
                        onLineItemChange?.(index, "currentPercent", parseFloat(e.target.value) || 0)
                      }
                      className={`w-full text-center ${hasError ? "border-destructive" : ""}`}
                    />
                  ) : (
                    <div className="text-center">{item.currentPercent.toFixed(2)}%</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={item.workThisPeriod} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {editable ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.materialsStored}
                      onChange={(e) =>
                        onLineItemChange?.(index, "materialsStored", parseFloat(e.target.value) || 0)
                      }
                      className="w-full"
                    />
                  ) : (
                    <CurrencyDisplay amount={item.materialsStored} />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={item.totalCompleted} />
                </TableCell>
                <TableCell className="text-center">
                  {item.currentPercent.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {hasError ? (
                    <span className="text-financial-negative">
                      <CurrencyDisplay amount={item.balanceToFinish} />
                    </span>
                  ) : (
                    <CurrencyDisplay amount={item.balanceToFinish} />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CurrencyDisplay amount={item.retainageAmount} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter className="sticky bottom-0 z-20 bg-muted/50">
          <TableRow className="font-bold">
            <TableCell className="sticky left-0 z-30 bg-muted/50 border-r">Totals</TableCell>
            <TableCell className="sticky left-[60px] z-30 bg-muted/50 border-r" />
            <TableCell className="text-right tabular-nums">
              <CurrencyDisplay amount={totals.scheduledValue} />
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right tabular-nums">
              <CurrencyDisplay amount={totals.workThisPeriod} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <CurrencyDisplay amount={totals.materialsStored} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <CurrencyDisplay amount={totals.totalCompleted} />
            </TableCell>
            <TableCell />
            <TableCell className="text-right tabular-nums">
              <CurrencyDisplay amount={totals.balanceToFinish} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <CurrencyDisplay amount={totals.retainageAmount} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
