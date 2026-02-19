import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";

/**
 * PDF generation router.
 * Shell router for Phase 38 — real procedures (generateProposal,
 * generateChangeOrder, generatePaymentApp, generateRfq) are added by
 * plans 38-03 through 38-06.
 */
export const pdfRouter = router({
  /**
   * Smoke-test procedure to confirm the router loads without error.
   * Returns { ok: true } for all authenticated + tenant-scoped requests.
   */
  getStatus: protectedProcedure
    .query(() => ({ ok: true })),
});
