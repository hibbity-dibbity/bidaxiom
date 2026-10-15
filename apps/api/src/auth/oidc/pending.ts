import { SignJWT, jwtVerify } from "jose";
import { createHmac, randomBytes, createHash } from "node:crypto";

/**
 * The browser carries the half-finished sign-in (state, nonce, PKCE verifier) between leaving for the
 * provider and coming back. It is signed here with a key derived from, but different from, the login
 * signing key, so it can never be used as an access token and cannot be forged or altered.
 */
export interface PendingSso {
  connectionId: string;
  purpose: "login" | "setup";
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  /** setup only: who is testing the connection */
  userId?: string;
}

function key(): Uint8Array {
  const base = process.env.JWT_SECRET ?? "";
  if (base.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
  return createHmac("sha256", base).update("sso-pending-v1").digest();
}

export function newPkce() {
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge, state: randomBytes(24).toString("base64url"), nonce: randomBytes(24).toString("base64url") };
}

export async function signPending(p: PendingSso): Promise<string> {
  return new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256", typ: "sso-pending" }).setIssuedAt().setExpirationTime("10m").sign(key());
}

export async function verifyPending(token: string): Promise<PendingSso> {
  const { payload, protectedHeader } = await jwtVerify(token, key());
  if (protectedHeader.typ !== "sso-pending") throw new Error("Not a sign-in request");
  return payload as unknown as PendingSso;
}
