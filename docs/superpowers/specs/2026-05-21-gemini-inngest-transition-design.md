# Design: Transitioning from OpenAI to Gemini with Inngest

## 1. Objective
Replace all OpenAI dependencies and logic with Google Gemini (Google AI SDK) across the entire codebase, including background tasks handled by Inngest.

## 2. Infrastructure Changes
### 2.1 Database Schema
- **File:** `src/db/schema.ts`
- **Change:** Update the `vector` dimension in the `knowledgeBase` table.
- **Old:** `vector(1536)` (OpenAI)
- **New:** `vector(768)` (Gemini `text-embedding-004`)
- **Impact:** Existing knowledge base data will be invalidated/cleared upon schema push.

### 2.2 Environment Variables
- **New Variable:** `GEMINI_API_KEY` (Required)
- **Deprecated:** `OPENAI_API_KEY` (Can be removed after transition)

## 3. Component Design

### 3.1 AI Utility Layer
- **Source:** `src/lib/gemini.ts`
- **Responsibility:** Centralize model initialization and configuration.
- **Models:**
  - `gemini-1.5-flash`: General chat, OCR, and summarization.
  - `text-embedding-004`: Vector generation.

### 3.2 Inngest Functions (`src/inngest/functions.ts`)
- **Summarizer Agent:** Replace `createAgent` with direct Gemini SDK calls or a custom adapter if necessary.
- **Workflow:**
  1. Fetch and parse transcript.
  2. Call Gemini with the transcript content and custom instructions.
  3. Enforce JSON output format using Gemini's response schema or system prompt.
  4. Save results to the database.

### 3.3 Knowledge Base (`src/modules/agents/knowledge-base/`)
- **Procedures:** Update `create` mutation to use Gemini's `embedContent`.
- **Queries:** Update vector search to use 768-dimension embeddings.

### 3.4 AI Whiteboard (`src/app/api/ai-whiteboard/route.ts`)
- **OCR:** Replace OpenAI Vision logic with Gemini 1.5 Flash multi-modal input (text + base64 image).
- **Prompting:** Update logic to update agent prompts based on Gemini's analysis.

### 3.5 YouTube Suggestions (`src/lib/youtube.ts`)
- Replace OpenAI chat completion with Gemini content generation for video recommendations.

## 4. Verification Plan
1. **Schema Validation:** Run `npm run db:push` and verify the `knowledge_base` table structure.
2. **Inngest Local Testing:** Start `npm run dev:inngest` and manually trigger a `meetings/processing` event.
3. **OCR Testing:** Upload a test image to the whiteboard and verify text extraction.
4. **Knowledge Base Testing:** Upload a PDF/text snippet and perform a similarity search.
5. **Compilation:** Run `npm run build` to ensure no orphaned OpenAI types remain.
