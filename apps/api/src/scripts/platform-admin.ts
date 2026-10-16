import { config } from "dotenv";
import { resolve } from "path";
import { randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import * as QRCode from "qrcode";
import { eq } from "drizzle-orm";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { db, getPool } = await import("../db/client.js");
const { platformAdmins } = await import("../db/schema/public.js");
const { hashPassword } = await import("../auth/password.js");

/**
 * Create a platform operator, or reset an existing one's password and authenticator.
 *   npx tsx src/scripts/platform-admin.ts <username>
 * Prints a new password and an authenticator setup QR code. Shown once; run again to reset.
 */
const username = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error("Usage: npx tsx src/scripts/platform-admin.ts <username>   (3-32 letters, numbers, . _ -)");
  process.exit(1);
}

const password = randomBytes(18).toString("base64url");
const secret = new Secret({ size: 20 });
const totp = new TOTP({ issuer: "BidAxiom Operator", label: username, algorithm: "SHA1", digits: 6, period: 30, secret });
const passwordHash = await hashPassword(password);

const [existing] = await db.select().from(platformAdmins).where(eq(platformAdmins.username, username)).limit(1);
if (existing) {
  await db.update(platformAdmins).set({ passwordHash, mfaSecret: secret.base32, disabled: false }).where(eq(platformAdmins.id, existing.id));
} else {
  await db.insert(platformAdmins).values({ username, passwordHash, mfaSecret: secret.base32 });
}

console.log(`\n${existing ? "Reset operator" : "Created operator"}: ${username}`);
console.log(`Password: ${password}`);
console.log(`\nAdd this to your authenticator app (scan the code, or enter the key by hand):`);
console.log(await QRCode.toString(totp.toString(), { type: "terminal", small: true }));
console.log(`Key: ${secret.base32}\n`);
console.log("Store the password in your password manager. It is not saved anywhere else.\n");
await getPool().end();
process.exit(0);
