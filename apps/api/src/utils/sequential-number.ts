import { eq, and, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Generate the next sequential change order number with SELECT FOR UPDATE locking.
 * Prevents race conditions under concurrent requests.
 *
 * @param db - Drizzle database instance
 * @param changeOrderCounters - Change order counters table from tenant schema
 * @param projectId - Project UUID
 * @param type - Either 'pco' or 'co'
 * @param year - Optional year (defaults to current year)
 * @returns Formatted number like "PCO-2026-001" or "CO-2026-015"
 */
export async function getNextChangeOrderNumber(
  db: NodePgDatabase<any>,
  changeOrderCounters: any,
  projectId: string,
  type: "pco" | "co",
  year?: number
): Promise<string> {
  const targetYear = year ?? new Date().getFullYear();

  return await db.transaction(async (tx) => {
    // Use raw SQL for SELECT FOR UPDATE since Drizzle's .for() may not be available
    const counterResult = await tx.execute(
      sql`SELECT id, last_number FROM ${changeOrderCounters}
          WHERE project_id = ${projectId}
          AND type = ${type}
          AND year = ${targetYear}
          FOR UPDATE`
    );

    let nextNumber: number;
    const rows = counterResult.rows as any[];

    if (!rows || rows.length === 0) {
      // First CO/PCO for this project/year — insert counter
      await tx.insert(changeOrderCounters).values({
        projectId,
        type,
        year: targetYear,
        lastNumber: 1,
      });
      nextNumber = 1;
    } else {
      nextNumber = rows[0].last_number + 1;
      await tx
        .update(changeOrderCounters)
        .set({ lastNumber: nextNumber })
        .where(eq(changeOrderCounters.id, rows[0].id));
    }

    const prefix = type === "pco" ? "PCO" : "CO";
    return `${prefix}-${targetYear}-${String(nextNumber).padStart(3, "0")}`;
  });
}
