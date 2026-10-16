import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, publicProcedure, middleware } from "../trpc.js";
import { db, getPool, createTenantDb } from "../../db/client.js";
import {
  users,
  organizations,
  organizationMemberships,
  userCompanyMappings,
  refreshTokens,
  passkeys,
  platformAdmins,
  platformAuditLog,
  passwordResetTokens,
  tenants,
} from "../../db/schema/public.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { verifyMfaToken } from "../../auth/mfa.js";
import { checkLoginRateLimit } from "../../auth/rate-limit.js";
import { signPlatformToken, verifyPlatformToken } from "../../auth/platform.js";
import { generateToken } from "../../auth/tokens.js";
import { sendAccountSetupEmail } from "../../services/email.js";
import { randomBytes } from "node:crypto";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getStorageClient, getBucketName } from "../../storage/client.js";
import { provisionTenantSchema } from "../../tenant/provision.js";

/**
 * Platform operator area: the few things the people running BidAxiom need to do without ever opening a
 * company's data — set up a new company with its first admin, and reset someone's sign-in.
 * Everything here touches account records only (names, emails, sign-in state), never project or financial data.
 * Nobody at BidAxiom ever sees or sets a customer's password: the customer gets an emailed link to choose their own.
 */

const requirePlatformAdmin = middleware(async ({ ctx, next }) => {
  const header = (ctx as any).req?.headers?.["authorization"];
  const token = typeof header === "string" ? header.replace("Bearer ", "") : undefined;
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Operator sign-in required" });
  let adminId: string;
  try {
    adminId = await verifyPlatformToken(token);
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Operator session expired. Sign in again." });
  }
  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, adminId)).limit(1);
  if (!admin || admin.disabled) throw new TRPCError({ code: "UNAUTHORIZED", message: "Operator account unavailable" });
  return next({ ctx: { ...ctx, platformAdminId: admin.id, platformUsername: admin.username } });
});

const platformProcedure = publicProcedure.use(requirePlatformAdmin);

async function audit(adminId: string, action: string, detail: Record<string, unknown>) {
  await db.insert(platformAuditLog).values({ adminId, action, detail });
}

/** Email the person a one-time link to choose their password. Never shown to the operator. */
async function sendSetupLink(user: { id: string; email: string; firstName: string | null }, opts: { companyName?: string; reset?: boolean }) {
  const { token, hash } = generateToken();
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  try {
    const sent = await sendAccountSetupEmail(user.email, token, { firstName: user.firstName, companyName: opts.companyName, reset: opts.reset });
    return sent ? ({ emailSent: true } as const) : ({ emailSent: false, emailProblem: "Email sending isn't configured on the server (RESEND_API_KEY)." } as const);
  } catch (err) {
    return { emailSent: false, emailProblem: err instanceof Error ? err.message : "Could not send the email." } as const;
  }
}

function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (!forwarded) return "unknown";
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
}

function slugFor(name: string): string {
  const base = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40) || "company";
  return `${base}-${nanoid(6).toLowerCase()}`;
}

export const platformRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1), code: z.string().min(6).max(12) }))
    .mutation(async ({ input, ctx }) => {
      const username = input.username.trim().toLowerCase();
      await checkLoginRateLimit(`platform:${username}`, getClientIp((ctx as any).req?.headers || {}));
      const fail = () => new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username, password or code" });

      const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.username, username)).limit(1);
      if (!admin || admin.disabled) throw fail();
      const { valid } = await verifyPassword(admin.passwordHash, input.password, "argon2id");
      if (!valid || !verifyMfaToken(admin.mfaSecret, input.code.replace(/\s/g, ""))) throw fail();

      await db.update(platformAdmins).set({ lastLoginAt: new Date() }).where(eq(platformAdmins.id, admin.id));
      await audit(admin.id, "login", {});
      return { token: await signPlatformToken(admin.id), username: admin.username };
    }),

  me: platformProcedure.query(({ ctx }) => ({ username: ctx.platformUsername })),

  /** Every company with its people's sign-in state. Account information only. */
  companies: platformProcedure.query(async () => {
    const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    const memberships = await db.select().from(organizationMemberships);
    const userIds = [...new Set(memberships.map((m) => m.userId))];
    const people = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
    const keys = userIds.length ? await db.select({ userId: passkeys.userId }).from(passkeys).where(inArray(passkeys.userId, userIds)) : [];
    const passkeyCount = new Map<string, number>();
    for (const k of keys) passkeyCount.set(k.userId, (passkeyCount.get(k.userId) ?? 0) + 1);
    const byId = new Map(people.map((u) => [u.id, u]));

    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      createdAt: o.createdAt.toISOString(),
      disabled: Boolean(o.disabledAt),
      members: memberships
        .filter((m) => m.organizationId === o.id)
        .map((m) => {
          const u = byId.get(m.userId);
          return {
            userId: m.userId,
            email: u?.email ?? "(unknown)",
            name: [u?.firstName, u?.lastName].filter(Boolean).join(" "),
            role: m.role === "org:admin" ? "Admin" : "Member",
            authenticator: Boolean(u?.mfaEnabled),
            passkeys: passkeyCount.get(m.userId) ?? 0,
            lastLoginAt: u?.lastLoginAt?.toISOString() ?? null,
          };
        }),
    }));
  }),

  /** New company + its first admin account. The admin is emailed a link to choose their password. */
  createCompany: platformProcedure
    .input(
      z.object({
        companyName: z.string().trim().min(1).max(120),
        adminEmail: z.string().trim().email().max(200),
        adminFirstName: z.string().trim().min(1).max(80),
        adminLastName: z.string().trim().max(80).default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.adminEmail.toLowerCase();
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "That email already has an account. Use a different email for the new company's admin." });
      }

      const [admin] = await db
        .insert(users)
        .values({
          email,
          emailVerified: true,
          // Nobody knows this password; the admin chooses theirs through the emailed link.
          passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
          hashType: "argon2id",
          firstName: input.adminFirstName,
          lastName: input.adminLastName || null,
        })
        .returning();

      try {
        const clerkOrgId = `org_${nanoid(24)}`;
        const tenant = await provisionTenantSchema(clerkOrgId, input.companyName, getPool());
        const [org] = await db
          .insert(organizations)
          .values({ name: input.companyName, slug: slugFor(input.companyName), tenantId: tenant.id, createdBy: admin.id, clerkOrgId })
          .returning();
        await db.insert(organizationMemberships).values({ userId: admin.id, organizationId: org.id, role: "org:admin" });
        // Legacy mapping kept for parity with company creation; nothing new depends on it.
        await db.insert(userCompanyMappings).values({ clerkUserId: admin.id, tenantId: tenant.id, role: "org:admin" }).catch(() => {});
        const tenantDb = createTenantDb(tenant.schemaName);
        await tenantDb.db.execute(sql`
          INSERT INTO "${sql.raw(tenant.schemaName)}".user_profiles (clerk_user_id, email, first_name, last_name, role)
          VALUES (${admin.id}, ${email}, ${input.adminFirstName}, ${input.adminLastName}, ${"org:admin"})
        `);
        await audit(ctx.platformAdminId, "createCompany", { company: input.companyName, adminEmail: email });
        const mail = await sendSetupLink(admin, { companyName: org.name });
        return { companyId: org.id, companyName: org.name, adminEmail: email, userId: admin.id, ...mail };
      } catch (err) {
        console.error("[platform] createCompany failed:", err);
        // Undo what was created so the operator can simply try again.
        await db.delete(organizations).where(eq(organizations.createdBy, admin.id)).catch(() => {});
        await db.delete(users).where(eq(users.id, admin.id)).catch(() => {});
        throw err;
      }
    }),

  /**
   * Reset someone's sign-in: old password and every second factor are wiped, all sessions end, and they are
   * emailed a link to choose a new password. After that they sign in and set up MFA again.
   */
  resetSignIn: platformProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await db
        .update(users)
        .set({
          passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
          hashType: "argon2id",
          emailVerified: true,
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: null,
          requireMfaSetup: true,
        })
        .where(eq(users.id, target.id));
      await db.delete(passkeys).where(eq(passkeys.userId, target.id));
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, target.id), sql`${refreshTokens.revokedAt} IS NULL`));
      await audit(ctx.platformAdminId, "resetSignIn", { email: target.email });
      return { email: target.email, ...(await sendSetupLink(target, { reset: true })) };
    }),

  /** Send the "choose your password" email again (lost, expired, or the email service was down). */
  resendSetupEmail: platformProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await audit(ctx.platformAdminId, "resendSetupEmail", { email: target.email });
      return { email: target.email, ...(await sendSetupLink(target, {})) };
    }),

  /** Switch a company off (or back on). Members are locked out; nothing is deleted. */
  setCompanyDisabled: platformProcedure
    .input(z.object({ organizationId: z.string().uuid(), disabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId)).limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      await db.update(organizations).set({ disabledAt: input.disabled ? new Date() : null }).where(eq(organizations.id, org.id));
      await audit(ctx.platformAdminId, input.disabled ? "disableCompany" : "enableCompany", { company: org.name });
      return { ok: true as const };
    }),

  /**
   * Permanently delete a company: its database schema, its stored files, and the accounts of people who belong
   * to no other company. Only a disabled company can be deleted, and the operator must retype its name.
   */
  deleteCompany: platformProcedure
    .input(z.object({ organizationId: z.string().uuid(), confirmName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId)).limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      if (!org.disabledAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Disable the company first. Only a disabled company can be deleted." });
      if (input.confirmName.trim() !== org.name) throw new TRPCError({ code: "BAD_REQUEST", message: "The name you typed doesn't match the company name." });

      const [tenant] = org.tenantId ? await db.select().from(tenants).where(eq(tenants.id, org.tenantId)).limit(1) : [];
      const members = await db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(eq(organizationMemberships.organizationId, org.id));

      // Stored files first (they are keyed by tenant id), then the database schema.
      let filesDeleted = 0;
      if (tenant) {
        const s3 = getStorageClient();
        const Bucket = getBucketName();
        let ContinuationToken: string | undefined;
        do {
          const page = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `tenants/${tenant.id}/`, ContinuationToken }));
          const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
          if (keys.length) {
            await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }));
            filesDeleted += keys.length;
          }
          ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (ContinuationToken);

        if (!/^tenant_[a-z0-9_]+$/.test(tenant.schemaName)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unexpected schema name; nothing was deleted." });
        await getPool().query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
        await db.delete(userCompanyMappings).where(eq(userCompanyMappings.tenantId, tenant.id)).catch(() => {});
        await db.delete(tenants).where(eq(tenants.id, tenant.id)); // cascades to the company, memberships, invitations, signing links
      }
      await db.delete(organizations).where(eq(organizations.id, org.id));

      // Accounts that now belong to no company go too (people in other companies keep theirs).
      let accountsDeleted = 0;
      for (const m of members) {
        const [left] = await db.select({ id: organizationMemberships.id }).from(organizationMemberships).where(eq(organizationMemberships.userId, m.userId)).limit(1);
        if (!left) {
          await db.delete(users).where(eq(users.id, m.userId));
          accountsDeleted++;
        }
      }
      await audit(ctx.platformAdminId, "deleteCompany", { company: org.name, filesDeleted, accountsDeleted });
      return { ok: true as const, filesDeleted, accountsDeleted };
    }),

  activity: platformProcedure.query(async () => {
    const rows = await db.select().from(platformAuditLog).orderBy(desc(platformAuditLog.createdAt)).limit(30);
    return rows.map((r) => ({ id: r.id, action: r.action, detail: r.detail, at: r.createdAt.toISOString() }));
  }),
});
