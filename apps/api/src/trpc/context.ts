import { verifyToken } from "@clerk/backend";
import { buildTenantContext, type RequestTenantContext } from "../tenant/context.js";

/**
 * tRPC context available to all procedures.
 * Created fresh for every request — NEVER stored in globals.
 */
export interface Context {
  userId: string | null;
  orgId: string | null;
  orgRole: string | null;
  hasMfa: boolean;
  tenant: RequestTenantContext | null;
}

interface CreateContextOpts {
  req: Request;
}

/**
 * Create tRPC context from the incoming request.
 *
 * CRITICAL: Auth is verified HERE at the data access layer.
 * This prevents CVE-2025-29927 middleware bypass attacks.
 * Even if Next.js middleware is bypassed, tRPC context
 * independently verifies the Clerk token.
 */
export async function createContext(
  opts: CreateContextOpts
): Promise<Context> {
  const authHeader = opts.req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  // No token = unauthenticated
  if (!token) {
    return {
      userId: null,
      orgId: null,
      orgRole: null,
      hasMfa: false,
      tenant: null,
    };
  }

  try {
    // Verify Clerk JWT independently of middleware
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    const verified = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });

    const userId = verified.sub;
    const orgId = (verified as Record<string, unknown>).org_id as
      | string
      | undefined;
    const orgRole = (verified as Record<string, unknown>).org_role as
      | string
      | undefined;
    const hasMfa =
      ((verified as Record<string, unknown>).isMfa as boolean) ?? false;

    // No active organization — return partial context
    if (!orgId) {
      return {
        userId,
        orgId: null,
        orgRole: orgRole ?? null,
        hasMfa,
        tenant: null,
      };
    }

    // Build full tenant context with scoped DB
    try {
      const tenant = await buildTenantContext(orgId, userId);
      return {
        userId,
        orgId,
        orgRole: orgRole ?? null,
        hasMfa,
        tenant,
      };
    } catch (err) {
      // Tenant not provisioned yet — return context without tenant
      console.warn(`Tenant context build failed for org ${orgId}:`, err);
      return {
        userId,
        orgId,
        orgRole: orgRole ?? null,
        hasMfa,
        tenant: null,
      };
    }
  } catch (err) {
    // Invalid token
    console.warn("Token verification failed:", err);
    return {
      userId: null,
      orgId: null,
      orgRole: null,
      hasMfa: false,
      tenant: null,
    };
  }
}
