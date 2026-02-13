import { z } from "zod";

/**
 * Customer creation schema
 * CompanyName is optional (not all customers are companies)
 * ContactName is required and serves as fallback if no company name
 */
export const createCustomerSchema = z.object({
  companyName: z.string().max(200).optional(),
  contactName: z.string().min(1).max(200),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(200).optional(),
  address: z.string().max(500).optional(),
});

/**
 * Customer update schema
 * All fields optional except ID
 */
export const updateCustomerSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string().max(200).nullable().optional(),
  contactName: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
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
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Helper to get display name for customer
 * Shows company name if available, otherwise contact name
 */
export function getCustomerDisplayName(customer: Pick<Customer, 'companyName' | 'contactName'>): string {
  return customer.companyName || customer.contactName;
}
