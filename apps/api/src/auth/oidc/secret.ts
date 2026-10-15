import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/** Client secrets are stored encrypted (AES-256-GCM). The key comes from SECRETS_KEY, else JWT_SECRET. */
function key(): Buffer {
  const base = process.env.SECRETS_KEY || process.env.JWT_SECRET || "";
  if (base.length < 32) throw new Error("SECRETS_KEY or JWT_SECRET must be at least 32 characters");
  return createHmac("sha256", base).update("sso-client-secret-v1").digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
