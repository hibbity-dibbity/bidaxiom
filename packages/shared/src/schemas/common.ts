import { z } from "zod";

/**
 * Phone number schema for US phone numbers
 * Format: (###) ###-####
 * Accepts optional empty values for backward compatibility
 */
export const phoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val === "") return true; // Empty is valid
      return /^\(\d{3}\) \d{3}-\d{4}$/.test(val); // Matches (###) ###-####
    },
    {
      message: "Phone must be formatted as (###) ###-####",
    }
  );

/**
 * Address schema with structured fields
 * All fields optional to support partial addresses
 */
export const addressSchema = z.object({
  street1: z.string().max(200).optional(),
  street2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(), // Two-letter state abbreviation
  zipCode: z.string().max(10).optional(),
});

/**
 * Address type inferred from schema
 */
export type Address = z.infer<typeof addressSchema>;
