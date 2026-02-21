"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useWorkflowState } from "../useWorkflowState";
import { EstimateLineItemsTable } from "../../line-items/EstimateLineItemsTable";
import { formatCurrency } from "../../line-items/MarginCalculator";

interface LineItemsStepProps {
  estimateId: string;
}

/**
 * Step 3: Line Items Entry
 * Spreadsheet-style table for entering estimate line items with inline editing.
 * Unlocks Step 4 once at least one line item exists.
 */
export function LineItemsStep({ estimateId }: LineItemsStepProps) {
  const { unlockStep } = useWorkflowState();

  // Load estimate with line items
  const { data: estimate, isLoading } = trpc.estimates.getById.useQuery(
    { id: estimateId },
    { enabled: !!estimateId }
  );

  // Unlock Step 4 when line items exist
  useEffect(() => {
    if (estimate?.lineItems && estimate.lineItems.length > 0) {
      unlockStep(4);
    }
  }, [estimate?.lineItems, unlockStep]);

  // Calculate total estimate cost
  const totalCost = estimate?.totalCost ? Number(estimate.totalCost) : 0;

  // Default markup by cost type (should come from company settings in future)
  const defaultMarkup = {
    labor: 20,
    material: 15,
    equipment: 10,
    subcontractor: 5,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading line items...</div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">Estimate not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Estimate Line Items</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add cost line items to build your estimate. Click any cell to edit. Changes save
          automatically.
        </p>
      </div>

      <EstimateLineItemsTable
        estimateId={estimateId}
        lineItems={estimate.lineItems || []}
        defaultMarkup={defaultMarkup}
      />

      <div className="pt-4 border-t flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            {estimate.lineItems && estimate.lineItems.length > 0 ? (
              <span className="text-financial-positive font-medium">
                ✓ Step 4 unlocked - proceed to Labor Rates
              </span>
            ) : (
              <span>Add at least one line item to unlock the next step</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Estimate Cost</p>
          <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
        </div>
      </div>
    </div>
  );
}
