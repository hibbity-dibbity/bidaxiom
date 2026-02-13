"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

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

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Item</TableHead>
            <TableHead className="min-w-[200px]">Description of Work</TableHead>
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
              <TableRow key={item.sovItemNumber} className={hasError ? "bg-red-50" : ""}>
                <TableCell className="font-mono">{item.sovItemNumber}</TableCell>
                <TableCell>{item.sovDescription}</TableCell>
                <TableCell className="font-mono">
                  {currencyFormatter.format(item.scheduledValue)}
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
                      className={`w-full text-center ${hasError ? "border-red-500" : ""}`}
                    />
                  ) : (
                    <div className="text-center">{item.currentPercent.toFixed(2)}%</div>
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  {currencyFormatter.format(item.workThisPeriod)}
                </TableCell>
                <TableCell>
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
                    <div className="font-mono">{currencyFormatter.format(item.materialsStored)}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  {currencyFormatter.format(item.totalCompleted)}
                </TableCell>
                <TableCell className="text-center">
                  {item.currentPercent.toFixed(2)}%
                </TableCell>
                <TableCell className="font-mono">
                  {currencyFormatter.format(item.balanceToFinish)}
                </TableCell>
                <TableCell className="font-mono">
                  {currencyFormatter.format(item.retainageAmount)}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Totals Row */}
          <TableRow className="font-bold bg-muted/50">
            <TableCell colSpan={2}>Totals</TableCell>
            <TableCell className="font-mono">
              {currencyFormatter.format(totals.scheduledValue)}
            </TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell className="font-mono">
              {currencyFormatter.format(totals.workThisPeriod)}
            </TableCell>
            <TableCell className="font-mono">
              {currencyFormatter.format(totals.materialsStored)}
            </TableCell>
            <TableCell className="font-mono">
              {currencyFormatter.format(totals.totalCompleted)}
            </TableCell>
            <TableCell></TableCell>
            <TableCell className="font-mono">
              {currencyFormatter.format(totals.balanceToFinish)}
            </TableCell>
            <TableCell className="font-mono">
              {currencyFormatter.format(totals.retainageAmount)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
