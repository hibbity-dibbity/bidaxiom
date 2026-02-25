import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { eq, desc } from "drizzle-orm";

/**
 * Notes router.
 * Per-project team notes with author attribution and admin delete capability.
 */
export const notesRouter = router({
  /**
   * List notes for a project in reverse-chronological order.
   * Includes author name via LEFT JOIN on userProfiles.
   */
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }
      const { db, schema } = ctx.tenant;

      const rows = await db
        .select({
          id: schema.projectNotes.id,
          content: schema.projectNotes.content,
          createdAt: schema.projectNotes.createdAt,
          userId: schema.projectNotes.userId,
          firstName: schema.userProfiles.firstName,
          lastName: schema.userProfiles.lastName,
        })
        .from(schema.projectNotes)
        .leftJoin(
          schema.userProfiles,
          eq(schema.projectNotes.userId, schema.userProfiles.clerkUserId)
        )
        .where(eq(schema.projectNotes.projectId, input.projectId))
        .orderBy(desc(schema.projectNotes.createdAt));

      return rows.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
        userId: row.userId,
        authorName:
          (row.firstName ?? "") +
          (row.lastName ? " " + row.lastName : "") ||
          "Unknown",
      }));
    }),

  /**
   * Create a note on a project.
   * Attributed to the current user. Any authenticated org member may add notes.
   */
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        content: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }
      const { db, schema } = ctx.tenant;

      const [inserted] = await db
        .insert(schema.projectNotes)
        .values({
          projectId: input.projectId,
          userId: ctx.userId,
          content: input.content,
        })
        .returning();

      return inserted;
    }),

  /**
   * Delete a note.
   * Owner may delete their own notes. org:admin may delete any note.
   * Returns 403 if the requester is neither the owner nor an admin.
   */
  delete: protectedProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }
      const { db, schema } = ctx.tenant;

      const [note] = await db
        .select({ userId: schema.projectNotes.userId })
        .from(schema.projectNotes)
        .where(eq(schema.projectNotes.id, input.noteId))
        .limit(1);

      if (!note) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Note not found",
        });
      }

      if (note.userId !== ctx.userId && ctx.orgRole !== "org:admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own notes",
        });
      }

      await db
        .delete(schema.projectNotes)
        .where(eq(schema.projectNotes.id, input.noteId));

      return { success: true };
    }),
});
