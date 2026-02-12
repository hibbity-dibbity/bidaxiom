import { TRPCError } from "@trpc/server";
import { ForbiddenError } from "@casl/ability";
import { middleware } from "../trpc.js";
import { defineAbilitiesFor, type AppAbility } from "../../auth/abilities.js";
import type { AppActions, AppSubjects } from "@construction/shared";

/**
 * tRPC middleware that injects CASL abilities into the context.
 * Must be used after auth middleware (requires ctx.orgRole and ctx.userId).
 */
export const withAbilities = middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.orgRole) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication and organization role required",
    });
  }

  const abilities = defineAbilitiesFor(ctx.orgRole, ctx.userId);

  return next({
    ctx: {
      ...ctx,
      abilities,
    },
  });
});

/**
 * Factory for tRPC middleware that checks a specific permission.
 * Throws FORBIDDEN with a clear message if the user lacks the ability.
 *
 * Usage:
 *   .use(requirePermission('create', 'Project'))
 */
export function requirePermission(action: AppActions, subject: AppSubjects) {
  return middleware(async ({ ctx, next }) => {
    const abilities = (ctx as { abilities?: AppAbility }).abilities;

    if (!abilities) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Abilities not initialized. Use withAbilities middleware first.",
      });
    }

    try {
      ForbiddenError.from(abilities).throwUnlessCan(action, subject);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You do not have permission to ${action} ${subject}`,
        });
      }
      throw err;
    }

    return next({ ctx });
  });
}
