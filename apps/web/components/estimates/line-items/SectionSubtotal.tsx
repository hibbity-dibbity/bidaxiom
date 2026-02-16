"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { calculateLineItemMargin, formatCurrency, formatPercent, getMarginColorClass } from "./MarginCalculator";

export interface LineItem {
  id: string;
  quantity: string | number;
  unitCost: string | number;
  customMarkupPercent?: string | number | null;
  costType: string;
}

interface SectionSubtotalProps {
  sectionName: string;
  lineItems: LineItem[];
  defaultMarkupByType: {
    labor: number;
    material: number;
    equipment: number;
    subcontractor: number;
  };
}

/**
 * Section subtotal row for estimate line items table.
 * Displays rolled-up totals for a CSI division with cost, markup, and margin.
 */
export function SectionSubtotal({
  sectionName,
  lineItems,
  defaultMarkupByType,
}: SectionSubtotalProps) {
  // Calculate section totals
  let sectionCost = 0;
  let sectionMarkup = 0;

  lineItems.forEach((item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);

    // Determine markup percent (custom or default by cost type)
    let markupPercent = 0;
    if (item.customMarkupPercent !== undefined && item.customMarkupPercent !== null) {
      markupPercent = Number(item.customMarkupPercent);
    } else {
      const costType = item.costType as keyof typeof defaultMarkupByType;
      markupPercent = defaultMarkupByType[costType] || 0;
    }

    const result = calculateLineItemMargin(quantity, unitCost, markupPercent);
    sectionCost += result.cost;
    sectionMarkup += result.markup;
  });

  const sectionTotal = sectionCost + sectionMarkup;
  const sectionMarginPercent = sectionTotal > 0 ? (sectionMarkup / sectionTotal) * 100 : 0;

  return (
    <TableRow className="bg-muted/50 font-semibold border-t-2 border-b-2">
      <TableCell colSpan={7} className="pl-8">
        {sectionName}
      </TableCell>
      <TableCell className="text-right">{formatCurrency(sectionCost)}</TableCell>
      <TableCell className="text-right">{formatCurrency(sectionMarkup)}</TableCell>
      <TableCell className={`text-right ${getMarginColorClass(sectionMarginPercent)}`}>
        {formatPercent(sectionMarginPercent)}
      </TableCell>
      <TableCell></TableCell>
    </TableRow>
  );
}
