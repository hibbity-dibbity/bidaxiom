"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressInput } from "@/components/ui/address-input";
import { toast } from "sonner";
import { createSubcontractorSchema, addressSchema, PAYMENT_TERMS } from "@construction/shared";
import type { UpdateSubcontractor, TradeValue } from "@construction/shared";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TradeCombobox } from "@/components/bidding/trade-combobox";
import { useRouter } from "next/navigation";

// The API takes a flat address; the form edits a nested `address` object.
const subcontractorFormSchema = createSubcontractorSchema
  .omit({ street1: true, street2: true, city: true, state: true, zip: true })
  .extend({
    address: addressSchema.optional(),
    // The form holds plain strings (yyyy-mm-dd or empty); they are converted on submit.
    taxIdLast4: z.string().regex(/^(\d{4})?$/, "Enter the last 4 digits, or leave blank").optional(),
    w9ReceivedAt: z.string().optional(),
    insuranceExpiresAt: z.string().optional(),
  });

// <input type="date"> works in yyyy-mm-dd; the API takes ISO date-times.
const toDateInput = (v?: string | Date | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const fromDateInput = (v?: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : undefined);

interface SubcontractorFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<UpdateSubcontractor> & {
    street1?: string | null;
    street2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  onSuccess?: (updated?: { slug: string; id: string }) => void;
}

export function SubcontractorForm({ mode, defaultValues, onSuccess }: SubcontractorFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    resolver: zodResolver(subcontractorFormSchema),
    defaultValues: {
      companyName: defaultValues?.companyName || "",
      contactName: defaultValues?.contactName || "",
      contactEmail: defaultValues?.contactEmail || "",
      contactPhone: defaultValues?.contactPhone || "",
      address: {
        street1: defaultValues?.street1 || "",
        street2: defaultValues?.street2 || "",
        city: defaultValues?.city || "",
        state: defaultValues?.state || "",
        zipCode: defaultValues?.zip || "",
      },
      trades: (defaultValues as any)?.trades || [],  // legacy field kept for form compat
      trade: (defaultValues as any)?.trade || [],
      tradeOther: (defaultValues as any)?.tradeOther || "",
      notes: defaultValues?.notes || "",
      kind: (defaultValues as any)?.kind || "subcontractor",
      category: (defaultValues as any)?.category || "",
      paymentTerms: (defaultValues as any)?.paymentTerms || "",
      creditLimit:
        (defaultValues as any)?.creditLimit != null && (defaultValues as any)?.creditLimit !== ""
          ? Number((defaultValues as any).creditLimit)
          : undefined,
      taxIdLast4: (defaultValues as any)?.taxIdLast4 || "",
      w9OnFile: (defaultValues as any)?.w9OnFile ?? false,
      w9ReceivedAt: toDateInput((defaultValues as any)?.w9ReceivedAt),
      insuranceExpiresAt: toDateInput((defaultValues as any)?.insuranceExpiresAt),
      is1099: (defaultValues as any)?.is1099 ?? false,
    },
  });
  const kind = form.watch("kind") as "subcontractor" | "supplier";

  const createMutation = trpc.subcontractor.create.useMutation({
    onSuccess: () => {
      utils.subcontractor.list.invalidate();
      toast.success("Created successfully");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/subcontractors");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create subcontractor");
    },
  });

  const updateMutation = trpc.subcontractor.update.useMutation({
    onSuccess: (updated) => {
      utils.subcontractor.list.invalidate();
      utils.subcontractor.getById.invalidate();
      toast.success("Updated successfully");
      if (onSuccess) {
        onSuccess(updated as { slug: string; id: string });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update subcontractor");
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
    // Map form data to API schema (flatten address from nested form shape)
    const payload = {
      companyName: data.companyName,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      street1: data.address?.street1 || null,
      street2: data.address?.street2 || null,
      city: data.address?.city || null,
      state: data.address?.state || null,
      zip: data.address?.zipCode || null,
      trades: [],  // legacy — cleared, kept for schema compat
      trade: data.trade ?? [],
      tradeOther: data.tradeOther || undefined,
      notes: data.notes,
      kind: data.kind,
      category: data.kind === "supplier" ? data.category || null : null,
      paymentTerms: data.paymentTerms || null,
      creditLimit: typeof data.creditLimit === "number" && !Number.isNaN(data.creditLimit) ? data.creditLimit : null,
      taxIdLast4: data.taxIdLast4 || null,
      w9OnFile: !!data.w9OnFile,
      w9ReceivedAt: fromDateInput(data.w9ReceivedAt) ?? null,
      insuranceExpiresAt: data.kind === "subcontractor" ? fromDateInput(data.insuranceExpiresAt) ?? null : null,
      is1099: !!data.is1099,
    };

    if (mode === "create") {
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== null)
      ) as typeof payload;
      createMutation.mutate(clean as any);
    } else if (defaultValues?.id) {
      updateMutation.mutate({
        id: defaultValues.id,
        ...payload,
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name *</FormLabel>
                <FormControl>
                  <Input placeholder="ABC Plumbing Inc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@abcplumbing.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <PhoneInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Address</h4>
            <AddressInput form={form} prefix="address" />
          </div>

          {kind === "supplier" && (
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Building materials, Metals, Electrical supply" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {kind === "subcontractor" && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Trades</h4>
            <TradeCombobox
              value={form.watch("trade") ?? []}
              onChange={(trades: string[]) => {
                form.setValue("trade", trades as TradeValue[]);
                // Clear tradeOther when Other is deselected
                if (!trades.includes("Other")) {
                  form.setValue("tradeOther", "");
                }
              }}
            />
            {(form.watch("trade") ?? []).includes("Other") && (
              <FormField
                control={form.control}
                name="tradeOther"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specify trade (Other)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Demolition, Excavation..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
          )}

          <div className="space-y-4 rounded-md border p-4">
            <h4 className="text-sm font-medium">Terms and credit</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment terms</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select terms" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_TERMS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="creditLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit limit ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-md border p-4">
            <h4 className="text-sm font-medium">Compliance</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="taxIdLast4"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax ID (last 4 digits)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" maxLength={4} placeholder="1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {kind === "subcontractor" && (
                <FormField
                  control={form.control}
                  name="insuranceExpiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance certificate expires</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="w9OnFile"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    </FormControl>
                    <FormLabel className="font-normal">W-9 on file</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="w9ReceivedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>W-9 received</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="is1099"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <FormLabel className="font-normal">1099 reporting applies</FormLabel>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Internal notes..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Saving..."
              : mode === "create"
              ? "Create"
              : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
