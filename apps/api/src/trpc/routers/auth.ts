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
import { passwordLoginBlocked } from "../../auth/oidc/sso.js";
import { hasSecondFactor, computeMfaGate, assertCompanyActive, COMPANY_DISABLED_MESSAGE } from "../../auth/session.js";
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

      // Companies are set up by the BidAxiom operator and people join by invitation, so open sign-up is closed.
      const invitation = input.invitationToken
        ? await getAuthDb().query.organizationInvitations.findFirst({
            where: and(
              eq(organizationInvitations.tokenHash, hashToken(input.invitationToken)),
              eq(organizationInvitations.status, "pending"),
              sql`${organizationInvitations.expiresAt} > NOW()`
            ),
          })
        : undefined;
      if (!invitation || invitation.email.toLowerCase() !== input.email.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Accounts are created by invitation. Ask your company administrator to invite the email address you are using.",
        });
      }

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
          // Everyone new sets up a second sign-in step the first time they sign in.
          requireMfaSetup: true,
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

      // Join the company that invited them
      await getAuthDb().insert(organizationMemberships).values({
        userId: user.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      });
      await getAuthDb()
        .update(organizationInvitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(organizationInvitations.id, invitation.id));

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

      // A disabled company's people cannot sign in at all.
      try {
        await assertCompanyActive(user.id);
      } catch (e) {
        throw new TRPCError({ code: "FORBIDDEN", message: e instanceof Error ? e.message : COMPANY_DISABLED_MESSAGE });
      }

      // A company that requires single sign-on does not accept passwords from its members.
      if (await passwordLoginBlocked(user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your company requires Microsoft sign-in. Use the Sign in with Microsoft button.",
        });
      }

      // MFA check: an authenticator app and/or passkeys. A password alone never opens a session for these people.
      const hasPasskey = await hasSecondFactor(user.id, false);
      if (user.mfaEnabled || hasPasskey) {
        if (!input.mfaToken) {
          // Client shows whichever second steps this person has set up
          return {
            requiresMfa: true,
            userId: user.id,
            methods: { totp: user.mfaEnabled, passkey: hasPasskey },
          };
        }
        if (!user.mfaEnabled) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Use your passkey to finish signing in" });
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
      const mfaGate = await computeMfaGate(user.id, orgRole, false);
      const accessToken = await signAccessToken({
        userId: user.id,
        orgId,
        orgRole,
        hasMfa: user.mfaEnabled,
        mfaGate,
      });

      const refreshToken = await signRefreshToken({
        userId: user.id,
        tokenFamily,
        hasMfa: user.mfaEnabled,
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
          mfaGate,
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

      // Stays true once the session passed a second factor; becomes true when one is set up during the session.
      const sessionMfa = payload.hasMfa === true || (await hasSecondFactor(user.id, user.mfaEnabled));

      // Generate new token pair
      const newAccessToken = await signAccessToken({
        userId: user.id,
        orgId,
        orgRole,
        hasMfa: sessionMfa,
        mfaGate: await computeMfaGate(user.id, orgRole, payload.idp === true),
        idp: payload.idp === true,
      });

      const newRefreshToken = await signRefreshToken({
        userId: user.id,
        tokenFamily: storedToken.familyId, // Keep same family
        hasMfa: sessionMfa,
        idp: payload.idp === true,
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
  /** The email address an invitation was sent to, so the sign-up page can show it fixed (the invitation only works for that address). */
  invitationPreview: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const inv = await getAuthDb().query.organizationInvitations.findFirst({
        where: and(
          eq(organizationInvitations.tokenHash, hashToken(input.token)),
          eq(organizationInvitations.status, "pending"),
          sql`${organizationInvitations.expiresAt} > NOW()`
        ),
      });
      return inv ? { valid: true as const, email: inv.email.toLowerCase() } : { valid: false as const, email: null };
    }),

  /** Whether a password setup/reset link can still be used (so the page can refuse a used link up front). */
  checkResetToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const found = await getAuthDb().query.passwordResetTokens.findFirst({
        where: and(
          eq(passwordResetTokens.tokenHash, hashToken(input.token)),
          sql`${passwordResetTokens.usedAt} IS NULL`,
          sql`${passwordResetTokens.expiresAt} > NOW()`
        ),
      });
      return { valid: !!found };
    }),

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

      // Use the token in one atomic step so two submissions of the same link cannot both succeed.
      const [resetToken] = await getAuthDb()
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            sql`${passwordResetTokens.usedAt} IS NULL`,
            sql`${passwordResetTokens.expiresAt} > NOW()`
          )
        )
        .returning();

      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This link has already been used or has expired",
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
   * Change password for authenticated user.
   * Requires current password verification before applying the new one.
   * Revokes all refresh tokens on success (forces re-login on other devices).
   */
  changePassword: publicProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
          .regex(/[a-z]/, "Password must contain at least one lowercase letter")
          .regex(/[0-9]/, "Password must contain at least one number"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Auth is already verified by createContext — ctx.userId is set if the JWT was valid
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      // Get user
      const user = await getAuthDb().query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Verify current password
      const { valid } = await verifyPassword(
        user.passwordHash,
        input.currentPassword,
        user.hashType as "argon2id" | "bcrypt"
      );

      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
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
        .where(eq(users.id, ctx.userId));

      // Revoke all refresh tokens for this user (security: force re-login on other devices)
      await getAuthDb()
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.userId, ctx.userId));

      return { success: true };
    }),

  /**
   * Disable MFA for authenticated user.
   * Requires password confirmation before disabling.
   * Nulls out mfaSecret and mfaBackupCodes on success.
   */
  disableMfa: publicProcedure
    .input(
      z.object({
        currentPassword: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Auth is already verified by createContext — ctx.userId is set if the JWT was valid
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      // Get user
      const user = await getAuthDb().query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Check MFA is currently enabled
      {
        const adminRow = await getAuthDb().query.organizationMemberships.findFirst({
          where: and(eq(organizationMemberships.userId, user.id), eq(organizationMemberships.role, "org:admin")),
        });
        if (adminRow) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Company admins need both an authenticator app and a passkey, so it can't be turned off." });
        }
      }
      if (!user.mfaEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MFA is not currently enabled",
        });
      }

      // Verify current password
      const { valid } = await verifyPassword(
        user.passwordHash,
        input.currentPassword,
        user.hashType as "argon2id" | "bcrypt"
      );

      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      // Disable MFA and clear all MFA fields
      await getAuthDb()
        .update(users)
        .set({
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: null,
        })
        .where(eq(users.id, ctx.userId));

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
      // Use userId from context (already verified by createContext)
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      // Get user
      const user = await getAuthDb().query.users.findFirst({
        where: eq(users.id, ctx.userId),
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
        hasMfa: ctx.hasMfa === true || user.mfaEnabled,
        mfaGate: await computeMfaGate(user.id, membership.role, ctx.idp),
        idp: ctx.idp,
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
