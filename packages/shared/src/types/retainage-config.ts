import { z } from "zod";

/** Company default retainage settings (kept on the company profile). */

export const retainageConfigSchema = z.object({
  defaultRate: z.number().min(0).max(100).default(10),
  progressiveRates: z
    .array(
      z.object({
        upToPercent: z.number().min(0).max(100),
        rate: z.number().min(0).max(100),
      })
    )
    .optional(),
  releaseConditions: z.object({
    substantialCompletion: z.boolean().default(true),
    punchListComplete: z.boolean().default(false),
    finalAcceptance: z.boolean().default(false),
    lienWaiversRequired: z.boolean().default(true),
  }),
});
export type RetainageConfig = z.infer<typeof retainageConfigSchema>;
