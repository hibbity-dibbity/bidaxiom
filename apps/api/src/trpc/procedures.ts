import { TRPCError } from "@trpc/server";
import { middleware, publicProcedure } from "./trpc.js";

/**
 * Middleware: require authenticated user.
 * Throws UNAUTHORIZED if no userId in context.
 */
const requireAuth = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

/**
 * Whether to enforce MFA for all API requests.
 * Mirrors NEXT_PUBLIC_ENFORCE_MFA on the frontend.
 * Requires Clerk Pro plan + custom session token claim "isMfa".
 */
const ENFORCE_MFA = process.env.ENFORCE_MFA === "true";

/**
 * Middleware: require active tenant (+ optional MFA).
 * Must be chained after requireAuth.
 * Throws FORBIDDEN if MFA enforcement is on and MFA not enabled,
 * or if no active organization.
 */
const requireTenant = middleware(async ({ ctx, next }) => {
  if (ENFORCE_MFA && !ctx.hasMfa) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Multi-factor authentication is required",
    });
  }

  if (!ctx.tenant) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization. Please select or create a company.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      tenant: ctx.tenant,
    },
  });
});

/**
 * Public procedure: no authentication required.
 * Use for health checks and public endpoints.
 */
export { publicProcedure };

/**
 * Auth procedure: requires authenticated user.
 * Use for endpoints that need a userId but not necessarily a tenant
 * (e.g., listing organizations, onboarding).
 */
export const authProcedure = publicProcedure.use(requireAuth);

/**
 * Protected procedure: requires auth + MFA + active tenant.
 * Use for ALL tenant-scoped data operations.
 * This is the primary procedure type for business logic.
 */
export const protectedProcedure = authProcedure.use(requireTenant);

/**
 * Authorized procedure: requires auth + MFA + tenant + CASL abilities.
 * Use for routes that need role-based permission checks.
 * Procedure hierarchy: public -> auth -> protected -> authorized
 */
import { withAbilities } from "./middleware/authorize.js";
export const authorizedProcedure = protectedProcedure.use(withAbilities);
