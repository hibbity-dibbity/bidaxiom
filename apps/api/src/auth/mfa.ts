import { TOTP, Secret } from "otpauth";
import { nanoid } from "nanoid";
import * as QRCode from "qrcode";
import { hashPassword } from "./password.js";
import { verify } from "@node-rs/argon2";

/**
 * Multi-factor authentication using TOTP (Time-based One-Time Passwords).
 *
 * Uses otpauth library (maintained, supports QR codes).
 * Algorithm: SHA1, Digits: 6, Period: 30 seconds.
 */

const ISSUER = "BidAxiom";
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;

export interface MfaSecret {
  secret: string; // Base32-encoded TOTP secret
  qrCodeDataUrl: string; // Data URL for QR code
  backupCodes: string[]; // Plaintext backup codes (show to user once)
  hashedBackupCodes: string[]; // Hashed backup codes (store in DB)
}

/**
 * Generate a new TOTP secret and backup codes for a user.
 *
 * @param userEmail - User's email address (displayed in authenticator app)
 * @returns TOTP secret, QR code data URL, and backup codes
 */
export async function generateMfaSecret(userEmail: string): Promise<MfaSecret> {
  // Create TOTP instance
  const totp = new TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  // Generate backup codes
  const backupCodes: string[] = [];
  const hashedBackupCodes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = nanoid(BACKUP_CODE_LENGTH);
    backupCodes.push(code);
    hashedBackupCodes.push(await hashPassword(code));
  }

  // Generate QR code data URL
  const qrCodeDataUrl = await QRCode.toDataURL(totp.toString());

  return {
    secret: totp.secret.base32,
    qrCodeDataUrl,
    backupCodes,
    hashedBackupCodes,
  };
}

/**
 * Verify a TOTP token against a secret.
 *
 * Accepts tokens within ±30 seconds (window of 1) to account for clock drift.
 *
 * @param secret - Base32-encoded TOTP secret
 * @param token - 6-digit TOTP token from user
 * @returns True if token is valid
 */
export function verifyMfaToken(secret: string, token: string): boolean {
  try {
    const totp = new TOTP({
      secret: Secret.fromBase32(secret),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });

    // Validate token with window of 1 (±30 seconds)
    const delta = totp.validate({ token, window: 1 });

    // delta is null if invalid, or the time step offset if valid
    return delta !== null;
  } catch {
    return false;
  }
}

export interface VerifyBackupCodeResult {
  valid: boolean;
  remainingCodes: string[]; // Hashed codes excluding the used one
}

/**
 * Verify a backup code against hashed backup codes.
 *
 * If valid, removes the used code from the array (one-time use).
 *
 * @param hashedCodes - Array of hashed backup codes from database
 * @param code - Plaintext backup code from user
 * @returns { valid, remainingCodes }
 */
export async function verifyBackupCode(
  hashedCodes: string[],
  code: string
): Promise<VerifyBackupCodeResult> {
  // Try each hashed code
  for (let i = 0; i < hashedCodes.length; i++) {
    const isValid = await verify(hashedCodes[i], code);

    if (isValid) {
      // Remove used code
      const remainingCodes = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
      return { valid: true, remainingCodes };
    }
  }

  return { valid: false, remainingCodes: hashedCodes };
}
