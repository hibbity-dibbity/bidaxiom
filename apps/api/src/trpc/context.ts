import { verifyAccessToken } from "../auth/jwt.js";
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
  mfaGate: boolean;
  idp: boolean;
  /** The active company has been disabled by the platform operator. */
  orgDisabled?: boolean;
  tenant: RequestTenantContext | null;
  ip?: string;
  /** The incoming request's headers (Authorization, X-Forwarded-For) for procedures that read them directly. */
  req?: { headers: Record<string, string | string[] | undefined> };
}

interface CreateContextOpts {
  req: { headers: Record<string, string | string[] | undefined> };
  ip?: string; // Client IP for rate limiting
}

/**
 * Create tRPC context from the incoming request.
 *
 * CRITICAL: Auth is verified HERE at the data access layer.
 * This prevents middleware bypass attacks. Even if Next.js
 * middleware is bypassed, tRPC context independently verifies
 * the JWT token.
 */
export async function createContext(
  opts: CreateContextOpts
): Promise<Context> {
  // Support both Fastify (plain object headers) and Web API (Headers.get())
  const rawAuth = opts.req.headers["authorization"] ?? opts.req.headers["Authorization"];
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  const token = authHeader?.replace("Bearer ", "");

  // Extract IP for rate limiting (from opts or headers)
  const ip = opts.ip ||
    (Array.isArray(opts.req.headers["x-forwarded-for"])
      ? opts.req.headers["x-forwarded-for"][0]
      : opts.req.headers["x-forwarded-for"]) ||
    (Array.isArray(opts.req.headers["x-real-ip"])
      ? opts.req.headers["x-real-ip"][0]
      : opts.req.headers["x-real-ip"]);

  // No token = unauthenticated
  if (!token) {
    return {
      userId: null,
      orgId: null,
      orgRole: null,
      hasMfa: false,
      mfaGate: false,
      idp: false,
      tenant: null,
      ip,
      req: opts.req,
    };
  }

  try {
    // Verify custom JWT token
    const payload = await verifyAccessToken(token);

    const userId = payload.userId;
    const orgId = payload.orgId;
    const orgRole = payload.orgRole;
    const hasMfa = payload.hasMfa;

    // No active organization — return partial context
    if (!orgId) {
      return {
        userId,
        orgId: null,
        orgRole: orgRole ?? null,
        hasMfa,
        mfaGate: payload.mfaGate === true,
        idp: payload.idp === true,
        tenant: null,
        ip,
        req: opts.req,
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
        mfaGate: payload.mfaGate === true,
        idp: payload.idp === true,
        tenant,
        ip,
        req: opts.req,
      };
    } catch (err) {
      // Tenant not provisioned yet — return context without tenant
      const orgDisabled = (err as { code?: string })?.code === "TENANT_DISABLED";
      if (!orgDisabled) console.warn(`Tenant context build failed for org ${orgId}:`, err);
      return {
        orgDisabled,
        userId,
        orgId,
        orgRole: orgRole ?? null,
        hasMfa,
        mfaGate: payload.mfaGate === true,
        idp: payload.idp === true,
        tenant: null,
        ip,
        req: opts.req,
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
      mfaGate: false,
      idp: false,
      tenant: null,
      ip,
      req: opts.req,
    };
  }
}
