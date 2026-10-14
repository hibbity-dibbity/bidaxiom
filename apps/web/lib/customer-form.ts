import { z } from "zod";
import { createCustomerSchema, addressSchema, type PAYMENT_TERMS } from "@construction/shared";

/**
 * Form-level customer schema. The API takes a flat address (street1..zip);
 * the form edits a nested `address` object. Use this for react-hook-form and
 * map to the flat shape with `toCustomerPayload` before calling the API.
 */
export const customerFormSchema = createCustomerSchema
  .omit({ street1: true, street2: true, city: true, state: true, zip: true })
  .extend({ address: addressSchema.optional(), paymentTerms: z.string().optional() });

export type CustomerFormData = z.infer<typeof customerFormSchema>;

export function toCustomerPayload(data: CustomerFormData) {
  return {
    companyName: data.companyName,
    contactName: data.contactName,
    phone: data.phone,
    email: data.email,
    street1: data.address?.street1,
    street2: data.address?.street2,
    city: data.address?.city,
    state: data.address?.state,
    zip: data.address?.zipCode,
    paymentTerms: (data.paymentTerms || null) as (typeof PAYMENT_TERMS)[number] | null,
  };
}
