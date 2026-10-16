import { eq, and, lt, isNotNull } from "drizzle-orm";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { db, getPool } from "../db/client.js";
import { organizations, organizationMemberships, userCompanyMappings, tenants, users } from "../db/schema/public.js";
import { getStorageClient, getBucketName } from "../storage/client.js";

/** How long a deleted company stays recoverable before it is removed for good. */
export const RETENTION_DAYS = Number(process.env.RECYCLE_BIN_DAYS) > 0 ? Number(process.env.RECYCLE_BIN_DAYS) : 60;

/**
 * Permanently remove a company: its database schema, its stored files, and its people's accounts
 * (every account belongs to exactly one company). Cannot be undone.
 */
export async function permanentlyDeleteCompany(organizationId: string): Promise<{ name: string; filesDeleted: number; accountsDeleted: number }> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) throw new Error("Company not found");
  const [tenant] = org.tenantId ? await db.select().from(tenants).where(eq(tenants.id, org.tenantId)).limit(1) : [];
  const members = await db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(eq(organizationMemberships.organizationId, org.id));

  // Stored files first (keyed by tenant id), then the database schema.
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

    if (!/^tenant_[a-z0-9_]+$/.test(tenant.schemaName)) throw new Error("Unexpected schema name; nothing was deleted.");
    await getPool().query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
    await db.delete(userCompanyMappings).where(eq(userCompanyMappings.tenantId, tenant.id)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenant.id)); // cascades to the company, memberships, invitations, signing links
  }
  await db.delete(organizations).where(eq(organizations.id, org.id));

  let accountsDeleted = 0;
  for (const m of members) {
    const [left] = await db.select({ id: organizationMemberships.id }).from(organizationMemberships).where(eq(organizationMemberships.userId, m.userId)).limit(1);
    if (!left) {
      await db.delete(users).where(eq(users.id, m.userId));
      accountsDeleted++;
    }
  }
  return { name: org.name, filesDeleted, accountsDeleted };
}

/** Remove companies that have sat in the recycle bin past the retention period. */
export async function purgeExpiredCompanies(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expired = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(and(isNotNull(organizations.deletedAt), lt(organizations.deletedAt, cutoff)));
  let n = 0;
  for (const o of expired) {
    try {
      const r = await permanentlyDeleteCompany(o.id);
      console.log(`[recycle-bin] Removed "${r.name}" after ${RETENTION_DAYS} days (${r.filesDeleted} files, ${r.accountsDeleted} accounts).`);
      n++;
    } catch (err) {
      console.error(`[recycle-bin] Could not remove "${o.name}":`, err);
    }
  }
  return n;
}

export function startRecycleBinPurge(): void {
  const run = () => purgeExpiredCompanies().catch((err) => console.error("[recycle-bin] purge failed:", err));
  setTimeout(run, 60_000);
  setInterval(run, 6 * 60 * 60 * 1000);
}
