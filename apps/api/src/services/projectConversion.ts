import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Convert an accepted estimate to an active project with automatic budget creation.
 *
 * Creates budget line items from estimate line items, updates estimate status to "under_contract",
 * and activates the project. All operations are atomic within a database transaction.
 *
 * @param ctx - Tenant context with database connection and schema
 * @param input - Estimate ID and user ID for the conversion
 * @returns Object containing project ID and count of created budget line items
 * @throws TRPCError if estimate not found, not in accepted status, or budget already exists
 */
export async function convertEstimateToProject(
  ctx: {
    tenant: NonNullable<
      Awaited<ReturnType<typeof import("../tenant/context.js").buildTenantContext>>
    >;
  },
  input: { estimateId: string; userId: string }
) {
  const { db, schema } = ctx.tenant;

  // 1. Get estimate with line items
  const estimate = await db.query.estimates.findFirst({
    where: eq(schema.estimates.id, input.estimateId),
    with: {
      lineItems: true,
      project: true,
    },
  });

  if (!estimate) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Estimate not found",
    });
  }

  if (estimate.status !== "accepted") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only accepted estimates can be converted to projects",
    });
  }

  // 2. Check if estimate already has budget (prevent double conversion)
  const existingBudget = await db.query.budgetLineItems.findFirst({
    where: eq(schema.budgetLineItems.projectId, estimate.projectId),
  });

  if (existingBudget) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Project already has budget. Cannot convert estimate twice.",
    });
  }

  // 3. Transaction: update estimate, update project, create budget
  return await db.transaction(async (tx) => {
    // Update estimate status to under_contract
    await tx.update(schema.estimates)
      .set({
        status: "under_contract",
        updatedAt: new Date(),
      })
      .where(eq(schema.estimates.id, input.estimateId));

    // Update project status to active and set budget
    await tx.update(schema.projects)
      .set({
        status: "active",
        budget: estimate.totalCost,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, estimate.projectId));

    // Create budget line items from estimate line items
    const budgetLineItems = estimate.lineItems.map((item, index) => ({
      projectId: estimate.projectId,
      costCodeId: item.costCodeId,
      description: item.description,
      budgetAmount: String(Number(item.unitCost) * Number(item.quantity)),
      committedCost: "0",
      actualCost: "0",
      isLocked: false,
      orderIndex: index,
      createdBy: input.userId,
    }));

    await tx.insert(schema.budgetLineItems).values(budgetLineItems);

    return {
      projectId: estimate.projectId,
      budgetLineItemsCreated: budgetLineItems.length,
    };
  });
}
