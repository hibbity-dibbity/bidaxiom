import { hash, verify } from "@node-rs/argon2";
import * as bcryptjs from "bcryptjs";

/**
 * Password hashing and verification using Argon2id (OWASP recommended).
 *
 * OWASP minimum configuration for Argon2id:
 * - Memory cost: 19456 KiB (19 MiB)
 * - Time cost: 2 iterations
 * - Parallelism: 1 thread
 *
 * Also supports bcrypt verification for migrated Clerk users.
 */

const ARGON2_CONFIG = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2, // 2 iterations
  parallelism: 1, // 1 thread
};

/**
 * Hash a password using Argon2id.
 *
 * @param password - Plaintext password
 * @returns Argon2id hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, ARGON2_CONFIG);
}

export interface VerifyPasswordResult {
  valid: boolean;
  needsRehash: boolean;
}

/**
 * Verify a password against a stored hash.
 *
 * Supports both Argon2id (new passwords) and bcrypt (migrated Clerk users).
 * Returns needsRehash=true when a bcrypt password is verified successfully
 * (caller should rehash with Argon2id).
 *
 * @param storedHash - Hash from database
 * @param password - Plaintext password to verify
 * @param hashType - Hash algorithm ('argon2id' or 'bcrypt')
 * @returns { valid, needsRehash }
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
  hashType: "argon2id" | "bcrypt"
): Promise<VerifyPasswordResult> {
  if (hashType === "argon2id") {
    const valid = await verify(storedHash, password);
    return { valid, needsRehash: false };
  } else if (hashType === "bcrypt") {
    const valid = await bcryptjs.compare(password, storedHash);
    return { valid, needsRehash: valid }; // Rehash bcrypt to Argon2id if valid
  } else {
    throw new Error(`Unsupported hash type: ${hashType}`);
  }
}
