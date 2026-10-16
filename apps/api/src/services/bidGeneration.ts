import type { RequestTenantContext } from "../tenant/context.js";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Generate bid from estimate with immutable snapshot.
 * Creates bid, bid version, and links estimate in a single transaction.
 *
 * Pattern 2 (Immutable Bid Snapshots): Bid version stores complete estimate breakdown
 * at time of bid generation for historical accuracy.
 */
export async function generateBidFromEstimate(
  ctx: { tenant: RequestTenantContext },
  input: { estimateId: string; bidName: string; userId: string }
) {
  const { db, schema } = ctx.tenant;

  // 1. Get estimate
  const estimate = await db.query.estimates.findFirst({
    where: eq(schema.estimates.id, input.estimateId),
  });

  if (!estimate) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Estimate not found",
    });
  }

  // 2. Get estimate line items separately (no relations defined in schema)
  const lineItems = await db
    .select()
    .from(schema.estimateLineItems)
    .where(eq(schema.estimateLineItems.estimateId, input.estimateId));

  if (estimate.status !== "draft" && estimate.status !== "submitted") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Can only generate bid from draft or submitted estimates",
    });
  }

  // 3. Create bid with immutable snapshot in transaction
  return await db.transaction(async (tx) => {
    const [bid] = await tx.insert(schema.bids).values({
      estimateId: input.estimateId,
      projectId: estimate.projectId,
      subcontractorId: null,
      bidderCompanyName: input.bidName,
      bidderContactEmail: null,
      currentVersionId: null,
      status: "draft",
      notes: `Generated from estimate: ${estimate.name}`,
    }).returning();

    // 4. Create bid version with snapshot
    const [bidVersion] = await tx.insert(schema.bidVersions).values({
      bidId: bid.id,
      versionNumber: 1,
      totalAmount: estimate.totalCost,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitCost),
        amount: Number(item.unitCost) * Number(item.quantity),
      })),
      scopeNotes: `Estimate breakdown:\nDirect Costs: ${estimate.directCosts}\nOverhead: ${estimate.overheadAmount}\nMarkup: ${estimate.markupAmount}\nTotal: ${estimate.totalCost}`,
    }).returning();

    // 5. Update bid with current version
    await tx.update(schema.bids)
      .set({ currentVersionId: bidVersion.id })
      .where(eq(schema.bids.id, bid.id));

    // 6. Link estimate to bid
    await tx.update(schema.estimates)
      .set({ linkedBidId: bid.id })
      .where(eq(schema.estimates.id, input.estimateId));

    return bid;
  });
}
