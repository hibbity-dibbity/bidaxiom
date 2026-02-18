"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, GripVertical } from "lucide-react";
import { formatCurrency } from "../line-items/MarginCalculator";

export interface SOVLineItem {
  id: string;
  description: string;
  amount: number;
  costCodeReferences: string[];
  completionPercent: number;
  sortOrder: number;
}

interface SOVLineItemCardProps {
  sovLineItem: SOVLineItem;
  onUpdate: (id: string, updates: Partial<SOVLineItem>) => void;
  onDelete: (id: string) => void;
  isEditable: boolean;
}

/**
 * SOV Line Item Card
 * Displays a single SOV line item with inline editing capabilities.
 */
export function SOVLineItemCard({
  sovLineItem,
  onUpdate,
  onDelete,
  isEditable,
}: SOVLineItemCardProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(sovLineItem.description);
  const [amountValue, setAmountValue] = useState(sovLineItem.amount);

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    if (descriptionValue !== sovLineItem.description) {
      onUpdate(sovLineItem.id, { description: descriptionValue });
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag handle */}
          {isEditable && (
            <div className="pt-1 cursor-move">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 space-y-3">
            {/* Description */}
            <div>
              {isEditable && isEditingDescription ? (
                <Input
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleDescriptionBlur();
                    }
                  }}
                  autoFocus
                  className="font-medium"
                />
              ) : (
                <div
                  onClick={() => isEditable && setIsEditingDescription(true)}
                  className={`font-medium ${
                    isEditable ? "cursor-pointer hover:bg-muted/50 p-1 rounded" : ""
                  }`}
                >
                  {sovLineItem.description}
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Amount:</span>
              {isEditable && isEditingAmount ? (
                <CurrencyInput
                  value={amountValue}
                  onChange={(n) => {
                    setAmountValue(n);
                    setIsEditingAmount(false);
                    if (n !== sovLineItem.amount) {
                      onUpdate(sovLineItem.id, { amount: n });
                    }
                  }}
                  className="w-32"
                />
              ) : (
                <div
                  onClick={() => isEditable && setIsEditingAmount(true)}
                  className={`font-semibold text-lg ${
                    isEditable ? "cursor-pointer hover:bg-muted/50 px-2 py-1 rounded" : ""
                  }`}
                >
                  {formatCurrency(sovLineItem.amount)}
                </div>
              )}
            </div>

            {/* Cost Code References */}
            {sovLineItem.costCodeReferences.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sovLineItem.costCodeReferences.map((ref, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {ref}
                  </Badge>
                ))}
              </div>
            )}

            {/* Completion Percent (display only for now) */}
            <div className="text-xs text-muted-foreground">
              Completion: {sovLineItem.completionPercent}%
            </div>
          </div>

          {/* Delete button */}
          {isEditable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(sovLineItem.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
