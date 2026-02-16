import type { TenantContext } from "../tenant/context.js";
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
  ctx: TenantContext,
  input: { estimateId: string; bidName: string; userId: string }
) {
  const { db, schema } = ctx.tenant;

  // 1. Get estimate with line items
  const estimate = await db.query.estimates.findFirst({
    where: eq(schema.estimates.id, input.estimateId),
    with: {
      lineItems: true,
    },
  });

  if (!estimate) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Estimate not found",
    });
  }

  if (estimate.status !== "draft" && estimate.status !== "submitted") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Can only generate bid from draft or submitted estimates",
    });
  }

  // 2. Create bid with immutable snapshot in transaction
  return await db.transaction(async (tx) => {
    const [bid] = await tx.insert(schema.bids).values({
      estimateId: input.estimateId,
      projectId: estimate.projectId,
      rfqId: null, // Estimate-based bids don't have RFQ
      invitationId: null,
      subcontractorId: null,
      bidderCompanyName: input.bidName,
      bidderContactEmail: null,
      currentVersionId: null,
      status: "draft",
      notes: `Generated from estimate: ${estimate.name}`,
    }).returning();

    // 3. Create bid version with snapshot
    const [bidVersion] = await tx.insert(schema.bidVersions).values({
      bidId: bid.id,
      versionNumber: 1,
      totalAmount: estimate.totalCost,
      lineItems: estimate.lineItems.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitCost),
        amount: Number(item.unitCost) * Number(item.quantity),
      })),
      scopeNotes: `Estimate breakdown:\nDirect Costs: ${estimate.directCosts}\nOverhead: ${estimate.overheadAmount}\nMarkup: ${estimate.markupAmount}\nTotal: ${estimate.totalCost}`,
      createdBy: input.userId,
    }).returning();

    // 4. Update bid with current version
    await tx.update(schema.bids)
      .set({ currentVersionId: bidVersion.id })
      .where(eq(schema.bids.id, bid.id));

    // 5. Link estimate to bid
    await tx.update(schema.estimates)
      .set({ linkedBidId: bid.id })
      .where(eq(schema.estimates.id, input.estimateId));

    return bid;
  });
}
