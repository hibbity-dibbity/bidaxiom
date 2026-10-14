"use client";

import type { UseFormReturn } from "react-hook-form";
import { PAYMENT_TERMS, DEFAULT_PAYMENT_TERMS } from "@construction/shared";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

/** Customer-specific payment terms. Blank means the company default applies to new proposals. */
export function PaymentTermsField({ form }: { form: UseFormReturn<any> }) {
  return (
    <FormField
      control={form.control}
      name="paymentTerms"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Default payment terms</FormLabel>
          <FormControl>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
            >
              <option value="">Company default ({DEFAULT_PAYMENT_TERMS})</option>
              {PAYMENT_TERMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormControl>
          <p className="text-xs text-muted-foreground">Used for new proposals and change orders for this customer. You can still change it on each proposal.</p>
        </FormItem>
      )}
    />
  );
}
