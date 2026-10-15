import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * JWT signing and verification using jose (ESM-native, Edge-compatible).
 *
 * Uses HS256 (HMAC with SHA-256) for simplicity and performance.
 * Secrets must be at least 256 bits (32 bytes) for HS256.
 */

// Lazy-load secrets to ensure dotenv runs first
function requireSecret(name: string): Uint8Array {
  const v = process.env[name] ?? "";
  if (v.length < 32) throw new Error(`${name} must be set to a random value of at least 32 characters`);
  return new TextEncoder().encode(v);
}

function getJwtSecret(): Uint8Array {
  return requireSecret("JWT_SECRET");
}

function getJwtRefreshSecret(): Uint8Array {
  return requireSecret("JWT_REFRESH_SECRET");
}

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
  /** The sign-in that started this session passed a second factor (authenticator code, passkey or the company's identity provider). */
  hasMfa?: boolean;
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
    .sign(getJwtSecret());

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
    hasMfa: payload.hasMfa === true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setJti(randomBytes(12).toString("base64url")) // two tokens minted in the same second must still differ
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(getJwtRefreshSecret());

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
  const { payload } = await jwtVerify(token, getJwtSecret());

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
  const { payload } = await jwtVerify(token, getJwtRefreshSecret());

  return {
    userId: payload.sub as string,
    tokenFamily: payload.tokenFamily as string,
    hasMfa: payload.hasMfa === true,
  };
}
