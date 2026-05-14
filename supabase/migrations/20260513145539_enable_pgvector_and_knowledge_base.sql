-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create a table to store the knowledge base documents
create table if not exists "knowledge_base" (
  "id" text primary key,
  "agent_id" text not null references "agents"("id") on delete cascade,
  "user_id" text not null references "user"("id") on delete cascade,
  "filename" text not null,
  "content" text not null,
  "embedding" vector(1536), -- 1536 is the dimension for OpenAI text-embedding-3-small
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

-- Index for vector similarity search
create index on "knowledge_base" using ivfflat ("embedding" vector_cosine_ops)
with (lists = 100);

-- Enable RLS
alter table "knowledge_base" enable row level security;

-- Policy: Users can only see their own knowledge base entries
-- Note: Better Auth uses 'text' IDs, so we cast auth.uid() if needed, 
-- but actually Better Auth session management might be handled at the application layer.
-- For now, let's make it simpler since we are using tRPC and protectedProcedure.
create policy "Users can only access their own knowledge base"
on "knowledge_base"
for all
using (auth.uid()::text = user_id);
