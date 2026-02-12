import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { tenantRouter } from "./routers/tenant.js";
import { auditRouter } from "./routers/audit.js";

/**
 * Root application router.
 * All sub-routers are merged here.
 *
 * Future routers (projects, budgets, bids) will use withAuditLog
 * middleware for sensitive actions (financial changes, bid submissions, etc.)
 */
export const appRouter = router({
  health: healthRouter,
  tenant: tenantRouter,
  audit: auditRouter,
});

/**
 * AppRouter type — exported for client-side type inference.
 * This type is imported by the web package for end-to-end type safety.
 */
export type AppRouter = typeof appRouter;
