import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc.js";
import { checkTrialRateLimit } from "../../auth/rate-limit.js";
import { createCompanyWithAdmin, sendSetupLink } from "../../services/company-create.js";
import { TRIAL_DAYS } from "../../services/trial.js";
import { db } from "../../db/client.js";
import { platformAuditLog } from "../../db/schema/public.js";

function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (!forwarded) return "unknown";
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
}

/** Public free-trial signup (called by the marketing site). Creates a company that switches itself off after TRIAL_DAYS. */
export const trialRouter = router({
  start: publicProcedure
    .input(
      z.object({
        companyName: z.string().trim().min(2).max(120),
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().max(80).default(""),
        email: z.string().trim().email().max(200),
        // Hidden field real people leave empty.
        website: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.website) return { ok: true as const }; // bot: pretend it worked
      await checkTrialRateLimit(getClientIp((ctx as any).req?.headers || {}));

      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000);
      let created;
      try {
        created = await createCompanyWithAdmin({
          companyName: input.companyName,
          adminEmail: input.email,
          adminFirstName: input.firstName,
          adminLastName: input.lastName,
          trialEndsAt,
        });
      } catch (err) {
        if (err instanceof TRPCError && err.code === "CONFLICT") {
          throw new TRPCError({ code: "CONFLICT", message: "That email already has a BidAxiom account. Sign in at app.bidaxiom.com, or use a different email for the trial." });
        }
        throw err;
      }
      await sendSetupLink(created.admin, { companyName: created.org.name, trialDays: TRIAL_DAYS });
      await db
        .insert(platformAuditLog)
        .values({ adminId: null, action: "trialSignup", detail: { company: created.org.name, email: created.email } })
        .catch(() => {});
      return { ok: true as const };
    }),
});
