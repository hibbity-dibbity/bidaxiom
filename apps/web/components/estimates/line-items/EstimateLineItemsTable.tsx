"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { CSI_DIVISIONS } from "@construction/shared";
import {
  calculateLineItemMargin,
  formatCurrency,
  formatPercent,
  getMarginColorClass,
} from "./MarginCalculator";
import { SectionSubtotal } from "./SectionSubtotal";

export interface EstimateLineItem {
  id: string;
  estimateId: string;
  costCodeId: number;
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
  costType: string;
  customMarkupPercent: string | null;
  orderIndex: number;
}

interface EstimateLineItemsTableProps {
  estimateId: string;
  lineItems: EstimateLineItem[];
  defaultMarkup: {
    labor: number;
    material: number;
    equipment: number;
    subcontractor: number;
  };
  onLineItemsChange?: () => void;
}

const UNITS = ["ea", "sf", "lf", "cy", "ton", "hr", "ls"];
const COST_TYPES = ["labor", "material", "equipment", "subcontractor"];

/**
 * Estimate line items table with inline editing, margin display, and section subtotals.
 * Uses TanStack Table for spreadsheet-like editing experience.
 */
export function EstimateLineItemsTable({
  estimateId,
  lineItems,
  defaultMarkup,
  onLineItemsChange,
}: EstimateLineItemsTableProps) {
  const utils = trpc.useUtils();

  // Update mutation with debouncing handled by cell onBlur
  const updateLineItem = trpc.estimates.updateLineItem.useMutation({
    onSuccess: () => {
      utils.estimates.getById.invalidate({ id: estimateId });
      onLineItemsChange?.();
    },
    onError: (error) => {
      toast.error("Failed to update line item", {
        description: error.message,
      });
    },
  });

  // Delete mutation
  const deleteLineItem = trpc.estimates.deleteLineItem.useMutation({
    onSuccess: () => {
      utils.estimates.getById.invalidate({ id: estimateId });
      toast.success("Line item deleted");
      onLineItemsChange?.();
    },
    onError: (error) => {
      toast.error("Failed to delete line item", {
        description: error.message,
      });
    },
  });

  // Create mutation
  const createLineItem = trpc.estimates.createLineItem.useMutation({
    onSuccess: () => {
      utils.estimates.getById.invalidate({ id: estimateId });
      toast.success("Line item added");
      onLineItemsChange?.();
    },
    onError: (error) => {
      toast.error("Failed to add line item", {
        description: error.message,
      });
    },
  });

  // Group line items by CSI division
  const lineItemsByDivision = useMemo(() => {
    const grouped = new Map<number, EstimateLineItem[]>();
    lineItems.forEach((item) => {
      const division = item.costCodeId;
      if (!grouped.has(division)) {
        grouped.set(division, []);
      }
      grouped.get(division)!.push(item);
    });
    return grouped;
  }, [lineItems]);

  // Editable cell component
  function EditableCell({
    value: initialValue,
    row,
    column,
    type = "text",
  }: {
    value: any;
    row: any;
    column: any;
    type?: "text" | "number";
  }) {
    const [value, setValue] = useState(initialValue ?? "");
    const [isEditing, setIsEditing] = useState(false);

    const handleBlur = () => {
      setIsEditing(false);
      if (value !== initialValue) {
        const updates: any = { id: row.original.id };

        if (column.id === "quantity" || column.id === "unitCost") {
          updates[column.id] = parseFloat(value) || 0;
        } else if (column.id === "customMarkupPercent") {
          updates[column.id] = value ? parseFloat(value) : null;
        } else {
          updates[column.id] = value;
        }

        updateLineItem.mutate(updates);
      }
    };

    if (!isEditing) {
      return (
        <div
          onClick={() => setIsEditing(true)}
          className="cursor-pointer hover:bg-muted/50 p-2 rounded min-h-[32px]"
        >
          {type === "number" && initialValue ? Number(initialValue).toFixed(type === "number" ? 2 : 0) : value || "-"}
        </div>
      );
    }

    return (
      <Input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleBlur();
          }
        }}
        autoFocus
        className="h-8"
      />
    );
  }

  // Select cell for dropdowns
  function SelectCell({
    value,
    row,
    column,
    options,
  }: {
    value: any;
    row: any;
    column: any;
    options: readonly string[] | { value: number; label: string }[];
  }) {
    const handleChange = (newValue: string) => {
      const updates: any = { id: row.original.id };

      if (column.id === "costCodeId") {
        updates.costCodeId = parseInt(newValue);
      } else {
        updates[column.id] = newValue;
      }

      updateLineItem.mutate(updates);
    };

    return (
      <Select value={String(value)} onValueChange={handleChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => {
            const optValue = typeof opt === "string" ? opt : String(opt.value);
            const optLabel = typeof opt === "string" ? opt : opt.label;
            return (
              <SelectItem key={optValue} value={optValue}>
                {optLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  const columnHelper = createColumnHelper<EstimateLineItem>();

  const columns: ColumnDef<EstimateLineItem, any>[] = [
    columnHelper.accessor("costCodeId", {
      header: "CSI Code",
      cell: ({ getValue, row, column }) => (
        <SelectCell
          value={getValue()}
          row={row}
          column={column}
          options={CSI_DIVISIONS.map((d) => ({
            value: d.division,
            label: `${d.division} - ${d.name}`,
          }))}
        />
      ),
    }),
    columnHelper.accessor("description", {
      header: "Description",
      cell: ({ getValue, row, column }) => (
        <EditableCell value={getValue()} row={row} column={column} />
      ),
    }),
    columnHelper.accessor("quantity", {
      header: "Quantity",
      cell: ({ getValue, row, column }) => (
        <EditableCell value={getValue()} row={row} column={column} type="number" />
      ),
    }),
    columnHelper.accessor("unit", {
      header: "Unit",
      cell: ({ getValue, row, column }) => (
        <SelectCell value={getValue()} row={row} column={column} options={UNITS} />
      ),
    }),
    columnHelper.accessor("unitCost", {
      header: "Unit Cost",
      cell: ({ getValue, row, column }) => (
        <EditableCell value={getValue()} row={row} column={column} type="number" />
      ),
    }),
    columnHelper.accessor("costType", {
      header: "Cost Type",
      cell: ({ getValue, row, column }) => (
        <SelectCell value={getValue()} row={row} column={column} options={COST_TYPES} />
      ),
    }),
    columnHelper.accessor("customMarkupPercent", {
      header: "Markup %",
      cell: ({ getValue, row, column }) => (
        <EditableCell value={getValue()} row={row} column={column} type="number" />
      ),
    }),
    columnHelper.display({
      id: "cost",
      header: "Cost",
      cell: ({ row }) => {
        const quantity = Number(row.original.quantity);
        const unitCost = Number(row.original.unitCost);
        const cost = quantity * unitCost;
        return <div className="text-right">{formatCurrency(cost)}</div>;
      },
    }),
    columnHelper.display({
      id: "marginDollars",
      header: "Margin $",
      cell: ({ row }) => {
        const quantity = Number(row.original.quantity);
        const unitCost = Number(row.original.unitCost);
        const markupPercent = row.original.customMarkupPercent
          ? Number(row.original.customMarkupPercent)
          : defaultMarkup[row.original.costType as keyof typeof defaultMarkup] || 0;

        const result = calculateLineItemMargin(quantity, unitCost, markupPercent);
        return <div className="text-right">{formatCurrency(result.marginDollars)}</div>;
      },
    }),
    columnHelper.display({
      id: "marginPercent",
      header: "Margin %",
      cell: ({ row }) => {
        const quantity = Number(row.original.quantity);
        const unitCost = Number(row.original.unitCost);
        const markupPercent = row.original.customMarkupPercent
          ? Number(row.original.customMarkupPercent)
          : defaultMarkup[row.original.costType as keyof typeof defaultMarkup] || 0;

        const result = calculateLineItemMargin(quantity, unitCost, markupPercent);
        const colorClass = getMarginColorClass(result.marginPercent);

        return (
          <div className={`text-right font-medium ${colorClass}`}>
            {formatPercent(result.marginPercent)}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (confirm("Delete this line item?")) {
              deleteLineItem.mutate({ id: row.original.id });
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    }),
  ];

  const table = useReactTable({
    data: lineItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleAddLineItem = () => {
    createLineItem.mutate({
      estimateId,
      costCodeId: 1, // Default to General Requirements
      description: "New line item",
      quantity: 1,
      unit: "ea",
      unitCost: 0,
      costType: "material",
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {lineItemsByDivision.size === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No line items yet. Click "Add Line Item" to get started.
                </TableCell>
              </TableRow>
            ) : (
              Array.from(lineItemsByDivision.entries()).map(([division, items]) => {
                const divisionInfo = CSI_DIVISIONS.find((d) => d.division === division);
                const sectionName = divisionInfo
                  ? `Division ${division} - ${divisionInfo.name}`
                  : `Division ${division}`;

                return (
                  <>
                    {items.map((item) => {
                      const row = table.getRowModel().rows.find((r) => r.original.id === item.id);
                      if (!row) return null;

                      return (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                    <SectionSubtotal
                      key={`subtotal-${division}`}
                      sectionName={sectionName}
                      lineItems={items}
                      defaultMarkupByType={defaultMarkup}
                    />
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Button onClick={handleAddLineItem} variant="outline">
        <Plus className="mr-2 h-4 w-4" />
        Add Line Item
      </Button>
    </div>
  );
}
