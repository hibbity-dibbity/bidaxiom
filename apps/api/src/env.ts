import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional().default("redis://localhost:6379"),
  API_PORT: z.coerce.number().optional().default(3001),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error("Invalid environment variables:", formatted);
    throw new Error("Invalid environment variables. Check server logs.");
  }

  return result.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
