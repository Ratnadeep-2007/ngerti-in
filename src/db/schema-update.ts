// Add pgvector to schema later when pgvector extension is created in Neon
/*
import { vector } from "drizzle-orm/pg-core";

export const documentEmbeddings = pgTable("document_embeddings", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  content: text("content"),
  embedding: vector("embedding", { dimensions: 384 }), // dimensions for MiniLM
});
*/
