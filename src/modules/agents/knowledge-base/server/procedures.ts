import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { db } from "@/db";
import { knowledgeBase } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const knowledgeBaseRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        filename: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { agentId, filename, content } = input;

      // 1. Generate embedding using OpenAI
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: content.substring(0, 8000), // OpenAI limit
      });

      const embedding = embeddingResponse.data[0].embedding;

      // 2. Save to DB
      const [createdEntry] = await db
        .insert(knowledgeBase)
        .values({
          agentId,
          userId: ctx.userId.user.id,
          filename,
          content,
          embedding,
        })
        .returning();

      return createdEntry;
    }),

  getForAgent: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input, ctx }) => {
      return db
        .select()
        .from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.agentId, input.agentId),
            eq(knowledgeBase.userId, ctx.userId.user.id),
          ),
        );
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [removed] = await db
        .delete(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.id, input.id),
            eq(knowledgeBase.userId, ctx.userId.user.id),
          ),
        )
        .returning();

      if (!removed) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Knowledge base entry not found",
        });
      }

      return removed;
    }),
});
