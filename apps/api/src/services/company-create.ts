import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { db, getPool, createTenantDb } from "../db/client.js";
import { users, organizations, organizationMemberships, userCompanyMappings, passwordResetTokens } from "../db/schema/public.js";
import { hashPassword } from "../auth/password.js";
import { generateToken } from "../auth/tokens.js";
import { provisionTenantSchema } from "../tenant/provision.js";
import { sendAccountSetupEmail } from "./email.js";

function slugFor(name: string): string {
  const base = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40) || "company";
  return `${base}-${nanoid(6).toLowerCase()}`;
}

/** Email the person a one-time link to choose their password. Never shown to the operator. */
export async function sendSetupLink(
  user: { id: string; email: string; firstName: string | null },
  opts: { companyName?: string; reset?: boolean; trialDays?: number }
) {
  const { token, hash } = generateToken();
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  try {
    const sent = await sendAccountSetupEmail(user.email, token, {
      firstName: user.firstName,
      companyName: opts.companyName,
      reset: opts.reset,
      trialDays: opts.trialDays,
    });
    return sent ? ({ emailSent: true } as const) : ({ emailSent: false, emailProblem: "Email sending isn't configured on the server (RESEND_API_KEY)." } as const);
  } catch (err) {
    return { emailSent: false, emailProblem: err instanceof Error ? err.message : "Could not send the email." } as const;
  }
}

/**
 * New company with its first admin. The admin chooses their own password through an emailed link.
 * Used by the operator's "new company" form and by the free-trial signup. Undoes everything if any step fails.
 */
export async function createCompanyWithAdmin(input: {
  companyName: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  trialEndsAt?: Date | null;
}) {
  const email = input.adminEmail.toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: "That email already has an account." });
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
      .values({
        name: input.companyName,
        slug: slugFor(input.companyName),
        tenantId: tenant.id,
        createdBy: admin.id,
        clerkOrgId,
        trialEndsAt: input.trialEndsAt ?? null,
      })
      .returning();
    await db.insert(organizationMemberships).values({ userId: admin.id, organizationId: org.id, role: "org:admin" });
    // Legacy mapping kept for parity with company creation; nothing new depends on it.
    await db.insert(userCompanyMappings).values({ clerkUserId: admin.id, tenantId: tenant.id, role: "org:admin" }).catch(() => {});
    const tenantDb = createTenantDb(tenant.schemaName);
    await tenantDb.db.execute(sql`
      INSERT INTO "${sql.raw(tenant.schemaName)}".user_profiles (clerk_user_id, email, first_name, last_name, role)
      VALUES (${admin.id}, ${email}, ${input.adminFirstName}, ${input.adminLastName}, ${"org:admin"})
    `);
    return { org, admin, email };
  } catch (err) {
    console.error("[company-create] failed:", err);
    // Undo what was created so the person can simply try again.
    await db.delete(organizations).where(eq(organizations.createdBy, admin.id)).catch(() => {});
    await db.delete(users).where(eq(users.id, admin.id)).catch(() => {});
    throw err;
  }
}
