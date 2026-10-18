import { and, isNotNull, isNull, lte, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { organizations, organizationMemberships, users } from "../db/schema/public.js";
import { eq } from "drizzle-orm";
import { sendTrialNoticeEmail } from "./email.js";

export const TRIAL_DAYS = 30;
const WARN_DAYS = 3;

async function adminsOf(orgId: string) {
  const rows = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .where(and(eq(organizationMemberships.organizationId, orgId), eq(organizationMemberships.role, "org:admin")));
  return rows;
}

/** Switch off trials that have run out, and warn the ones about to. Safe to run as often as you like. */
export async function sweepTrials(): Promise<{ disabled: number; warned: number }> {
  const now = new Date();
  let disabled = 0;
  let warned = 0;

  const expired = await db
    .select()
    .from(organizations)
    .where(and(isNotNull(organizations.trialEndsAt), lte(organizations.trialEndsAt, now), isNull(organizations.disabledAt), isNull(organizations.deletedAt)));
  for (const org of expired) {
    await db.update(organizations).set({ disabledAt: now }).where(eq(organizations.id, org.id));
    disabled++;
    for (const a of await adminsOf(org.id)) {
      await sendTrialNoticeEmail(a.email, { firstName: a.firstName, companyName: org.name, endsAt: org.trialEndsAt!, ended: true });
    }
    console.log(`[trial] Switched off ${org.name}: trial ended`);
  }

  const soon = await db
    .select()
    .from(organizations)
    .where(
      and(
        isNotNull(organizations.trialEndsAt),
        gt(organizations.trialEndsAt, now),
        lte(organizations.trialEndsAt, new Date(now.getTime() + WARN_DAYS * 86400000)),
        isNull(organizations.trialWarnedAt),
        isNull(organizations.disabledAt),
        isNull(organizations.deletedAt)
      )
    );
  for (const org of soon) {
    await db.update(organizations).set({ trialWarnedAt: now }).where(eq(organizations.id, org.id));
    warned++;
    for (const a of await adminsOf(org.id)) {
      await sendTrialNoticeEmail(a.email, { firstName: a.firstName, companyName: org.name, endsAt: org.trialEndsAt!, ended: false });
    }
  }
  return { disabled, warned };
}

export function startTrialSweeper() {
  const run = async () => {
    try {
      await sweepTrials();
    } catch (err) {
      console.error("[trial] sweep failed:", err);
    }
  };
  setTimeout(run, 30 * 1000);
  setInterval(run, 60 * 60 * 1000);
}
