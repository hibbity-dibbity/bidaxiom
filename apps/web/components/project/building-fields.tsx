"use client";

import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type Dim = "buildingWidth" | "buildingLength" | "buildingHeight" | "buildingSqft";

/**
 * Building size: width, length, height and square footage. Square footage fills in from width x length
 * as you type, and can also be typed directly (older jobs often only have a total).
 * Shared by the new-project and edit-project forms so they stay the same.
 */
export function BuildingFields({ form }: { form: UseFormReturn<any> }) {
  const field = (name: Dim, label: string, unit: string, onAfter?: () => void) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex items-center gap-1.5">
            <FormControl>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                {...field}
                value={field.value ?? ""}
                onChange={(e) => {
                  field.onChange(e.target.value === "" ? undefined : Number(e.target.value));
                  onAfter?.();
                }}
              />
            </FormControl>
            <span className="whitespace-nowrap text-sm text-muted-foreground">{unit}</span>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  // After width or length changes, square footage follows when both are filled in.
  const fillSqft = () => {
    // Read after React Hook Form has applied the change.
    queueMicrotask(() => {
      const w = Number(form.getValues("buildingWidth"));
      const l = Number(form.getValues("buildingLength"));
      if (w > 0 && l > 0) form.setValue("buildingSqft", Math.round(w * l * 100) / 100, { shouldDirty: true });
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Building Size</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {field("buildingWidth", "Width", "ft", fillSqft)}
        {field("buildingLength", "Length", "ft", fillSqft)}
        {field("buildingHeight", "Height", "ft")}
        {field("buildingSqft", "Square footage", "sf")}
      </div>
      <p className="text-xs text-muted-foreground">
        Square footage is used by the Cost per SF report. It fills in from width x length, or type it in directly.
      </p>
    </div>
  );
}
