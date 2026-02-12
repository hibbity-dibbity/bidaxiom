import { router } from "../trpc.js";
import { publicProcedure } from "../procedures.js";

export const healthRouter = router({
  check: publicProcedure.query(() => {
    return {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      version: "0.0.1",
    };
  }),
});
