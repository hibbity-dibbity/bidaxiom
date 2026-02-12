import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

/**
 * tRPC initialization with our custom context type.
 * All routers and procedures derive from this instance.
 */
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;
