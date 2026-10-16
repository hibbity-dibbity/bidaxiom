import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * Platform operator sessions. Signed with a key derived from JWT_SECRET but different from the one used for
 * company users, and tagged with its own audience, so an operator token never works as a company token or vice versa.
 */
function platformKey(): Uint8Array {
  const base = process.env.JWT_SECRET ?? "";
  if (base.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
  return new Uint8Array(createHash("sha256").update(`bidaxiom-platform:${base}`).digest());
}

export async function signPlatformToken(adminId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setAudience("platform")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(platformKey());
}

export async function verifyPlatformToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, platformKey(), { audience: "platform" });
  if (!payload.sub) throw new Error("bad token");
  return payload.sub;
}
