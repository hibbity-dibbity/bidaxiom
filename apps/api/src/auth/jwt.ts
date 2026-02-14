import { SignJWT, jwtVerify } from "jose";

/**
 * JWT signing and verification using jose (ESM-native, Edge-compatible).
 *
 * Uses HS256 (HMAC with SHA-256) for simplicity and performance.
 * Secrets must be at least 256 bits (32 bytes) for HS256.
 */

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "");
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || "");

const ACCESS_TOKEN_TTL = "15m"; // 15 minutes
const REFRESH_TOKEN_TTL = "7d"; // 7 days

export interface AccessTokenPayload {
  userId: string;
  orgId: string;
  orgRole: string;
  hasMfa: boolean;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenFamily: string;
}

/**
 * Sign an access token (short-lived, 15 minutes).
 *
 * @param payload - User ID, org ID, org role, and MFA status
 * @returns JWT string
 */
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const jwt = await new SignJWT({
    orgId: payload.orgId,
    orgRole: payload.orgRole,
    hasMfa: payload.hasMfa,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(JWT_SECRET);

  return jwt;
}

/**
 * Sign a refresh token (long-lived, 7 days).
 *
 * @param payload - User ID and token family ID
 * @returns JWT string
 */
export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  const jwt = await new SignJWT({
    tokenFamily: payload.tokenFamily,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(JWT_REFRESH_SECRET);

  return jwt;
}

/**
 * Verify an access token and return decoded payload.
 *
 * @param token - JWT string
 * @returns Decoded payload
 * @throws If token is invalid or expired
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);

  return {
    userId: payload.sub as string,
    orgId: payload.orgId as string,
    orgRole: payload.orgRole as string,
    hasMfa: payload.hasMfa as boolean,
  };
}

/**
 * Verify a refresh token and return decoded payload.
 *
 * @param token - JWT string
 * @returns Decoded payload
 * @throws If token is invalid or expired
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);

  return {
    userId: payload.sub as string,
    tokenFamily: payload.tokenFamily as string,
  };
}
