import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { tenantRouter } from "./routers/tenant.js";

/**
 * Root application router.
 * All sub-routers are merged here.
 */
export const appRouter = router({
  health: healthRouter,
  tenant: tenantRouter,
});

/**
 * AppRouter type — exported for client-side type inference.
 * This type is imported by the web package for end-to-end type safety.
 */
export type AppRouter = typeof appRouter;
