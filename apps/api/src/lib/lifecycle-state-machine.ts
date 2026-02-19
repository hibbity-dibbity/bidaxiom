import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { LIFECYCLE_ORDER, type LifecyclePhase, AuditAction } from "@construction/shared";
import { createAuditLog } from "../audit/logger.js";

// Re-export LIFECYCLE_ORDER so callers don't need a second import
export { LIFECYCLE_ORDER };

/**
 * Validates a lifecycle phase transition.
 * Forward: must be exactly one step forward.
 * Backward: any prior phase is allowed, but reason is required.
 * Throws TRPCError on invalid transitions.
 */
export function isValidTransition(
  from: LifecyclePhase,
  to: LifecyclePhase,
  reason?: string
): void {
  const fromIdx = LIFECYCLE_ORDER.indexOf(from);
  const toIdx = LIFECYCLE_ORDER.indexOf(to);

  if (fromIdx === toIdx) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Project is already in this phase.",
    });
  }

  const isForward = toIdx === fromIdx + 1;
  const isBackward = toIdx < fromIdx;
  const isSkippingForward = toIdx > fromIdx + 1;

  if (isSkippingForward) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot skip phases. Advance one phase at a time (from ${from} you can only go to ${LIFECYCLE_ORDER[fromIdx + 1]}).`,
    });
  }

  if (isBackward && !reason?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A reason is required when reverting to a prior phase.",
    });
  }
}

/**
 * Attempts an automatic phase advance triggered by a system event.
 * Only advances if the target phase is exactly one step ahead of the current phase.
 * Silently returns without error if the project is already at or past the target phase.
 *
 * @param db - Drizzle tenant database connection
 * @param schema - Tenant Drizzle schema object
 * @param projectId - UUID of the project to advance
 * @param targetPhase - The phase to advance to (must be one step ahead)
 * @param eventSource - Human-readable event name, e.g., 'estimate_created'
 * @param actorId - The user UUID who triggered the system event
 */
export async function tryAutoAdvance(
  db: any,
  schema: any,
  projectId: string,
  targetPhase: LifecyclePhase,
  eventSource: string,
  actorId: string
): Promise<void> {
  const [project] = await db
    .select({ lifecyclePhase: schema.projects.lifecyclePhase })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);

  if (!project) return;

  const currentIdx = LIFECYCLE_ORDER.indexOf(project.lifecyclePhase as LifecyclePhase);
  const targetIdx = LIFECYCLE_ORDER.indexOf(targetPhase);

  // Only auto-advance if target is exactly the next phase
  if (targetIdx !== currentIdx + 1) return;

  await db.transaction(async (tx: any) => {
    await tx
      .update(schema.projects)
      .set({ lifecyclePhase: targetPhase, updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId));

    await tx.insert(schema.projectLifecycleTransitions).values({
      projectId,
      fromPhase: project.lifecyclePhase,
      toPhase: targetPhase,
      triggeredBy: "system",
      actorId,
      eventSource,
    });
  });

  await createAuditLog(db, schema, {
    entityType: "Project",
    entityId: projectId,
    action: AuditAction.UPDATE,
    actorId,
    changes: {
      before: { lifecyclePhase: project.lifecyclePhase },
      after: { lifecyclePhase: targetPhase },
    },
    metadata: { triggeredBy: "system", eventSource },
  });
}
