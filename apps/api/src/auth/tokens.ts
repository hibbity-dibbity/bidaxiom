import { nanoid } from "nanoid";
import { createHash } from "node:crypto";

/**
 * Secure token generation for email verification and password reset.
 *
 * Uses nanoid for cryptographically random tokens and SHA-256 for hashing.
 * SHA-256 is appropriate for high-entropy random tokens (not passwords).
 */

const DEFAULT_TOKEN_LENGTH = 32;

export interface GeneratedToken {
  token: string; // Plaintext token (send to user)
  hash: string; // SHA-256 hash (store in database)
}

/**
 * Generate a secure random token and its hash.
 *
 * The plaintext token should be sent to the user (via email).
 * The hash should be stored in the database for verification.
 *
 * @param length - Token length (default: 32)
 * @returns { token, hash }
 */
export function generateToken(length: number = DEFAULT_TOKEN_LENGTH): GeneratedToken {
  const token = nanoid(length);
  const hash = hashToken(token);

  return { token, hash };
}

/**
 * Hash a token using SHA-256.
 *
 * Used for verification lookups. SHA-256 is sufficient for high-entropy
 * random tokens (not suitable for user-chosen passwords).
 *
 * @param token - Plaintext token
 * @returns SHA-256 hex hash
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
