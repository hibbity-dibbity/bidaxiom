import { z } from "zod";

export const searchResultSchema = z.object({
  type: z.enum(["project", "customer", "estimate", "subcontractor"]),
  id: z.string(),
  title: z.string(), // Project name or customer company name
  subtitle: z.string().nullable(), // Job number or customer contact
  url: z.string(), // Navigation path
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const globalSearchInputSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(50).default(10),
});
