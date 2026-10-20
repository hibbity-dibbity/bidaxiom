import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db as publicDb, createTenantDb } from "../db/client.js";
import { tenants } from "../db/schema/public.js";
import { sendDocumentMail } from "./email.js";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

function prettyDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Emails each task reminder whose time has come (task is open, "email me" is on, and it has not been sent yet).
 * Each reminder is claimed before it is sent, so two copies of this running at once never send it twice, and
 * the claim is released again if the send fails so the next pass retries.
 */
export async function sendDueTaskEmails(): Promise<number> {
  if (!process.env.RESEND_API_KEY) return 0; // email is not set up; reminders still show under the bell
  const all = await publicDb.select({ name: tenants.name, schemaName: tenants.schemaName }).from(tenants).where(eq(tenants.status, "active"));
  let sent = 0;
  for (const tenant of all) {
    try {
      const tdb = createTenantDb(tenant.schemaName);
      const t = tdb.projectTasks;
      const due = await tdb.db
        .select({
          id: t.id,
          title: t.title,
          notes: t.notes,
          dueDate: t.dueDate,
          email: tdb.userProfiles.email,
          firstName: tdb.userProfiles.firstName,
          projectName: tdb.projects.name,
          projectSlug: tdb.projects.slug,
          jobNumber: tdb.projects.jobNumber,
        })
        .from(t)
        .innerJoin(tdb.userProfiles, eq(tdb.userProfiles.clerkUserId, t.assigneeId))
        .leftJoin(tdb.projects, eq(t.projectId, tdb.projects.id))
        .where(and(eq(t.status, "open"), eq(t.remindEmail, true), lte(t.remindAt, new Date()), isNull(t.emailSentAt)))
        .limit(100);
      for (const task of due) {
        const claimed = await tdb.db
          .update(t)
          .set({ emailSentAt: new Date() })
          .where(and(eq(t.id, task.id), isNull(t.emailSentAt)))
          .returning({ id: t.id });
        if (!claimed.length) continue;
        const where = task.projectName ? `${task.jobNumber ? `${task.jobNumber} - ` : ""}${task.projectName}` : null;
        const link = task.projectSlug ? `${appUrl()}/projects/${task.projectSlug}/tasks` : `${appUrl()}/tasks`;
        const lines = [
          `Hi${task.firstName ? ` ${task.firstName}` : ""},`,
          "",
          "A reminder about a task assigned to you:",
          "",
          task.title,
          ...(where ? [`Project: ${where}`] : []),
          ...(task.dueDate ? [`Due: ${prettyDate(task.dueDate)}`] : []),
          ...(task.notes ? ["", task.notes] : []),
          "",
          `Open it: ${link}`,
        ];
        try {
          await sendDocumentMail({ fromName: tenant.name, to: [task.email], subject: `Reminder: ${task.title}`, text: lines.join("\n") });
          sent++;
        } catch (e) {
          console.error(`[tasks] reminder email failed for task ${task.id}:`, e instanceof Error ? e.message : e);
          await tdb.db.update(t).set({ emailSentAt: null }).where(eq(t.id, task.id));
        }
      }
    } catch (e) {
      console.error(`[tasks] reminder pass failed for ${tenant.schemaName}:`, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
