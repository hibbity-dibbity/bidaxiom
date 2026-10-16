import { z } from "zod";
import { phoneSchema, addressSchema } from "../schemas/common";
import { PAYMENT_TERMS } from "./bidding";

/**
 * Customer creation schema
 * CompanyName is optional (not all customers are companies)
 * ContactName is required and serves as fallback if no company name
 */
export const createCustomerSchema = z.object({
  companyName: z.string().max(200).optional(),
  contactName: z.string().min(1).max(200),
  phone: phoneSchema,
  email: z.string().email().max(200),
  street1: z.string().max(200).optional(),
  street2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).or(z.literal("")).optional(),
  zip: z.string().max(10).optional(),
  /** this customer's default payment terms; empty uses the company default */
  paymentTerms: z.enum(PAYMENT_TERMS).nullable().optional(),
});

/**
 * Customer update schema
 * All fields optional except ID
 */
export const updateCustomerSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string().max(200).nullable().optional(),
  contactName: z.string().min(1).max(200).optional(),
  phone: phoneSchema,
  email: z.string().email().max(200).optional(),
  street1: z.string().max(200).nullable().optional(),
  street2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().length(2).or(z.literal("")).nullable().optional(),
  zip: z.string().max(10).nullable().optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).nullable().optional(),
});

/**
 * Customer response type (inferred from database)
 */
export type Customer = {
  id: string;
  companyName: string | null;
  contactName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  paymentTerms?: string | null;
  slug: string | null;
  createdBy: string;
  // Dates arrive as ISO strings over tRPC (JSON).
  createdAt: Date | string;
  updatedAt: Date | string;
};

/**
 * Helper to get display name for customer
 * Shows company name if available, otherwise contact name
 */
export function getCustomerDisplayName(customer: Pick<Customer, 'companyName' | 'contactName'>): string {
  return customer.companyName || customer.contactName;
}
