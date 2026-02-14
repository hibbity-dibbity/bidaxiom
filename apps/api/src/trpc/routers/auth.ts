import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, publicProcedure } from "../trpc.js";
import { getDb } from "../../db/client.js";
import {
  users,
  organizations,
  organizationMemberships,
  organizationInvitations,
  refreshTokens,
  emailVerificationTokens,
  passwordResetTokens,
} from "../../db/schema/public.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../../auth/jwt.js";
import { generateToken, hashToken } from "../../auth/tokens.js";
import { generateMfaSecret, verifyMfaToken, verifyBackupCode } from "../../auth/mfa.js";
import {
  checkLoginRateLimit,
  checkRegistrationRateLimit,
  checkRefreshRateLimit,
} from "../../auth/rate-limit.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../services/email.js";

/**
 * Auth tRPC router - complete authentication API.
 *
 * Replaces Clerk auth endpoints with custom JWT-based authentication.
 * All endpoints use publicProcedure (no auth required) except setupMfa/verifyMfaSetup/switchOrganization
 * which manually verify the access token.
 */

// Don't initialize db at module level - it causes DATABASE_URL to be read before dotenv loads
const getAuthDb = () => getDb();

/**
 * Get client IP from tRPC context.
 * Extracts from x-forwarded-for header or socket remote address.
 */
function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ip.split(",")[0].trim();
  }
  return "unknown";
}

export const authRouter = router({
  /**
   * Register a new user.
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
          .regex(/[a-z]/, "Password must contain at least one lowercase letter")
          .regex(/[0-9]/, "Password must contain at least one number"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        invitationToken: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ip = getClientIp((ctx as any).req?.headers || {});

      // Rate limit
      await checkRegistrationRateLimit(ip);

      // Check if email already registered
      const existing = await getAuthDb().query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Insert user
      const [user] = await getAuthDb()
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash,
          hashType: "argon2id",
          firstName: input.firstName,
          lastName: input.lastName,
        })
        .returning();

      // Generate email verification token
      const { token, hash } = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await getAuthDb().insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash: hash,
        expiresAt,
      });

      // Send verification email
      await sendVerificationEmail(user.email, token);

      // If invitation token provided, accept the invitation
      if (input.invitationToken) {
        const inviteHash = hashToken(input.invitationToken);
        const invitation = await getAuthDb().query.organizationInvitations.findFirst({
          where: and(
            eq(organizationInvitations.tokenHash, inviteHash),
            eq(organizationInvitations.status, "pending"),
            sql`${organizationInvitations.expiresAt} > NOW()`
          ),
        });

        if (invitation) {
          // Create organization membership
          await getAuthDb().insert(organizationMemberships).values({
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          });

          // Mark invitation as accepted
          await getAuthDb()
            .update(organizationInvitations)
            .set({
              status: "accepted",
              acceptedAt: new Date(),
            })
            .where(eq(organizationInvitations.id, invitation.id));
        }
      }

      return {
        userId: user.id,
        message: "Registration successful. Please check your email to verify your account.",
      };
    }),

  /**
   * Login with email and password.
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
        mfaToken: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ip = getClientIp((ctx as any).req?.headers || {});

      // Rate limit
      await checkLoginRateLimit(input.email.toLowerCase(), ip);

      // Find user
      const user = await getAuthDb().query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Verify password
      const { valid, needsRehash } = await verifyPassword(
        user.passwordHash,
        input.password,
        user.hashType as "argon2id" | "bcrypt"
      );

      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Rehash bcrypt passwords to argon2id
      if (needsRehash) {
        const newHash = await hashPassword(input.password);
        await getAuthDb()
          .update(users)
          .set({
            passwordHash: newHash,
            hashType: "argon2id",
          })
          .where(eq(users.id, user.id));
      }

      // Check email verification
      if (!user.emailVerified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Please verify your email before logging in",
        });
      }

      // MFA check
      if (user.mfaEnabled) {
        if (!input.mfaToken) {
          // Client needs to show MFA input
          return {
            requiresMfa: true,
            userId: user.id,
          };
        }

        // Verify MFA token or backup code
        let mfaValid = false;

        if (user.mfaSecret) {
          mfaValid = verifyMfaToken(user.mfaSecret, input.mfaToken);
        }

        // Try backup codes if TOTP failed
        if (!mfaValid && user.mfaBackupCodes) {
          const backupResult = await verifyBackupCode(
            user.mfaBackupCodes as string[],
            input.mfaToken
          );
          mfaValid = backupResult.valid;

          if (backupResult.valid) {
            // Update remaining backup codes
            await getAuthDb()
              .update(users)
              .set({ mfaBackupCodes: backupResult.remainingCodes })
              .where(eq(users.id, user.id));
          }
        }

        if (!mfaValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid MFA token",
          });
        }
      }

      // Get user's first organization (if any)
      const membership = await getAuthDb().query.organizationMemberships.findFirst({
        where: eq(organizationMemberships.userId, user.id),
      });

      let org = null;
      if (membership) {
        org = await getAuthDb().query.organizations.findFirst({
          where: eq(organizations.id, membership.organizationId),
        });
      }

      const orgId = membership?.organizationId || "";
      const orgRole = membership?.role || "org:member";

      // Generate token family ID for refresh token rotation
      const tokenFamily = nanoid();

      // Sign tokens
      const accessToken = await signAccessToken({
        userId: user.id,
        orgId,
        orgRole,
        hasMfa: user.mfaEnabled,
      });

      const refreshToken = await signRefreshToken({
        userId: user.id,
        tokenFamily,
      });

      // Store refresh token hash in database
      const refreshTokenHash = hashToken(refreshToken);
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await getAuthDb().insert(refreshTokens).values({
        userId: user.id,
        tokenHash: refreshTokenHash,
        familyId: tokenFamily,
        expiresAt: refreshExpiresAt,
      });

      // Update last login
      await getAuthDb()
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          mfaEnabled: user.mfaEnabled,
        },
        org: org
          ? {
              id: org.id,
              name: org.name,
              role: membership!.role,
            }
          : null,
      };
    }),

  /**
   * Refresh access token using refresh token.
   */
  refresh: publicProcedure
    .input(
      z.object({
        refreshToken: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Verify refresh token JWT
      let payload;
      try {
        payload = await verifyRefreshToken(input.refreshToken);
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid refresh token",
        });
      }

      // Rate limit
      await checkRefreshRateLimit(payload.userId);

      // Hash token and look up in database
      const tokenHash = hashToken(input.refreshToken);
      const storedToken = await getAuthDb().query.refreshTokens.findFirst({
        where: eq(refreshTokens.tokenHash, tokenHash),
      });

      if (!storedToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Refresh token not found",
        });
      }

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Refresh token expired",
        });
      }

      // Check if token was already revoked/used (reuse detection)
      if (storedToken.revokedAt) {
        // Token reuse detected - revoke entire family
        await getAuthDb()
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.familyId, storedToken.familyId));

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Token reuse detected. All tokens in this family have been revoked.",
        });
      }

      // Get user and current org membership
      const user = await getAuthDb().query.users.findFirst({
        where: eq(users.id, payload.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      const membership = await getAuthDb().query.organizationMemberships.findFirst({
        where: eq(organizationMemberships.userId, user.id),
      });

      const orgId = membership?.organizationId || "";
      const orgRole = membership?.role || "org:member";

      // Generate new token pair
      const newAccessToken = await signAccessToken({
        userId: user.id,
        orgId,
        orgRole,
        hasMfa: user.mfaEnabled,
      });

      const newRefreshToken = await signRefreshToken({
        userId: user.id,
        tokenFamily: storedToken.familyId, // Keep same family
      });

      const newRefreshTokenHash = hashToken(newRefreshToken);
      const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Mark old token as revoked and store new token
      await getAuthDb()
        .update(refreshTokens)
        .set({
          revokedAt: new Date(),
          replacedByHash: newRefreshTokenHash,
        })
        .where(eq(refreshTokens.id, storedToken.id));

      await getAuthDb().insert(refreshTokens).values({
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        familyId: storedToken.familyId,
        expiresAt: newRefreshExpiresAt,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    }),

  /**
   * Verify email address using token.
   */
  verifyEmail: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const tokenHash = hashToken(input.token);

      // Find token
      const verificationToken = await getAuthDb().query.emailVerificationTokens.findFirst({
        where: and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          sql`${emailVerificationTokens.usedAt} IS NULL`,
          sql`${emailVerificationTokens.expiresAt} > NOW()`
        ),
      });

      if (!verificationToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired verification token",
        });
      }

      // Mark token as used and verify user's email
      await getAuthDb()
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(eq(emailVerificationTokens.id, verificationToken.id));

      await getAuthDb()
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, verificationToken.userId));

      return { success: true };
    }),

  /**
   * Request password reset email.
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ip = getClientIp((ctx as any).req?.headers || {});

      // Rate limit by IP
      await checkRegistrationRateLimit(ip);

      // Find user (but don't leak if user exists - prevent email enumeration)
      const user = await getAuthDb().query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      // Always return success message (even if user doesn't exist)
      const message = "If an account exists with that email, a reset link has been sent.";

      if (!user) {
        return { message };
      }

      // Generate password reset token
      const { token, hash } = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await getAuthDb().insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hash,
        expiresAt,
      });

      // Send password reset email
      await sendPasswordResetEmail(user.email, token);

      return { message };
    }),

  /**
   * Reset password using token.
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
          .regex(/[a-z]/, "Password must contain at least one lowercase letter")
          .regex(/[0-9]/, "Password must contain at least one number"),
      })
    )
    .mutation(async ({ input }) => {
      const tokenHash = hashToken(input.token);

      // Find token
      const resetToken = await getAuthDb().query.passwordResetTokens.findFirst({
        where: and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          sql`${passwordResetTokens.usedAt} IS NULL`,
          sql`${passwordResetTokens.expiresAt} > NOW()`
        ),
      });

      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(input.newPassword);

      // Update user password
      await getAuthDb()
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          hashType: "argon2id",
        })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await getAuthDb()
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      // Revoke all refresh tokens for this user (security: force re-login everywhere)
      await getAuthDb()
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.userId, resetToken.userId));

      return { success: true };
    }),

  /**
   * Set up MFA (requires authentication).
   */
  setupMfa: publicProcedure.mutation(async ({ ctx }) => {
    // Manually verify access token from Authorization header
    const authHeader = (ctx as any).req?.headers?.["authorization"];
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid access token",
      });
    }

    // Get user
    const user = await getAuthDb().query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Generate MFA secret and backup codes
    const mfaData = await generateMfaSecret(user.email);

    return {
      secret: mfaData.secret,
      qrCodeDataUrl: mfaData.qrCodeDataUrl,
      backupCodes: mfaData.backupCodes,
      hashedBackupCodes: mfaData.hashedBackupCodes,
    };
  }),

  /**
   * Verify and activate MFA setup.
   */
  verifyMfaSetup: publicProcedure
    .input(
      z.object({
        token: z.string().length(6),
        secret: z.string(),
        hashedBackupCodes: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Manually verify access token
      const authHeader = (ctx as any).req?.headers?.["authorization"];
      const accessToken = authHeader?.replace("Bearer ", "");

      if (!accessToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      let payload;
      try {
        payload = await verifyAccessToken(accessToken);
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid access token",
        });
      }

      // Verify TOTP token
      const isValid = verifyMfaToken(input.secret, input.token);

      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }

      // Enable MFA for user
      await getAuthDb()
        .update(users)
        .set({
          mfaEnabled: true,
          mfaSecret: input.secret,
          mfaBackupCodes: input.hashedBackupCodes,
        })
        .where(eq(users.id, payload.userId));

      return { success: true };
    }),

  /**
   * Switch to a different organization.
   */
  switchOrganization: publicProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Manually verify access token
      const authHeader = (ctx as any).req?.headers?.["authorization"];
      const accessToken = authHeader?.replace("Bearer ", "");

      if (!accessToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      let payload;
      try {
        payload = await verifyAccessToken(accessToken);
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid access token",
        });
      }

      // Get user
      const user = await getAuthDb().query.users.findFirst({
        where: eq(users.id, payload.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Verify user has membership in target organization
      const membership = await getAuthDb().query.organizationMemberships.findFirst({
        where: and(
          eq(organizationMemberships.userId, user.id),
          eq(organizationMemberships.organizationId, input.organizationId)
        ),
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      const org = await getAuthDb().query.organizations.findFirst({
        where: eq(organizations.id, membership.organizationId),
      });

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Sign new access token with updated org
      const newAccessToken = await signAccessToken({
        userId: user.id,
        orgId: membership.organizationId,
        orgRole: membership.role,
        hasMfa: user.mfaEnabled,
      });

      return {
        accessToken: newAccessToken,
        org: {
          id: org.id,
          name: org.name,
          role: membership.role,
        },
      };
    }),
});
