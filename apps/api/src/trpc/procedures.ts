import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { middleware, publicProcedure } from "./trpc.js";
import { db as publicDb } from "../db/client.js";
import { users } from "../db/schema/public.js";

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
  // Admins need two second-factor methods, and anyone an admin reset must set one up again; ENFORCE_MFA extends one to everyone.
  if ((ENFORCE_MFA && !ctx.hasMfa) || ctx.mfaGate) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Multi-factor authentication is required. Finish setting up your sign-in security (authenticator app and passkey for admins).",
    });
  }

  if (!ctx.tenant) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization. Please select or create a company.",
    });
  }

  // Lazy-sync user profile: ensure the current user has a profile in the tenant schema.
  // This replaces webhook-based sync.
  if (ctx.userId) {
    try {
      const { db, schema } = ctx.tenant;
      const existing = await db
        .select({ id: schema.userProfiles.id })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.clerkUserId, ctx.userId))
        .limit(1);

      if (existing.length === 0) {
        // Query our own users table instead of Clerk API
        const userRecord = await publicDb
          .select({
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName
          })
          .from(users)
          .where(eq(users.id, ctx.userId))
          .limit(1);

        if (userRecord.length > 0) {
          await db.insert(schema.userProfiles).values({
            clerkUserId: ctx.userId, // Legacy column name; stores our user ID now
            email: userRecord[0].email,
            firstName: userRecord[0].firstName,
            lastName: userRecord[0].lastName,
            role: "member",
          });
        }
      }
    } catch {
      // Non-fatal: profile sync failure shouldn't block the request
    }
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
