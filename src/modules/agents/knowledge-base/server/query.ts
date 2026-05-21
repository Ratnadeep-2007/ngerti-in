import { db } from "@/db";
import { knowledgeBase } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { genAI } from "@/lib/gemini";

/**
 * Searches the knowledge base for content relevant to the current conversation.
 * @param agentId The ID of the agent whose knowledge base to search.
 * @param userId The ID of the user owning the knowledge base.
 * @param queryText The text to search for (e.g., the last few messages or whiteboard context).
 * @param limit Number of relevant chunks to return.
 */
export async function queryKnowledgeBase(
  agentId: string,
  userId: string,
  queryText: string,
  limit: number = 3,
) {
  try {
    // 1. Generate embedding for the query using Gemini
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(queryText.substring(0, 4000));
    const queryEmbedding = result.embedding.values;

    // 2. Perform vector similarity search using raw SQL (Drizzle doesn't natively support <-> for vectors yet)
    // We use cosine distance <=> or inner product <#> or Euclidean distance <->
    // Cosine similarity is usually best for text
    const similarityThreshold = 0.5; // Optional threshold

    const results = await db.execute(sql`
      SELECT filename, content, 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM knowledge_base
      WHERE agent_id = ${agentId} AND user_id = ${userId}
      AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${similarityThreshold}
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `);

    return results as unknown as { filename: string; content: string; similarity: number }[];
  } catch (error) {
    console.error("Knowledge Base Query Error:", error);
    return [];
  }
}
