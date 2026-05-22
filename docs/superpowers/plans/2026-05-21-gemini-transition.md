# Gemini & Inngest Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all OpenAI logic with Google Gemini and verify background tasks using the Inngest Dev Server.

**Architecture:** direct replacement of OpenAI SDK with Google Generative AI SDK. Update database schema for 768-dimension embeddings. Use Inngest for orchestrating AI tasks locally.

**Tech Stack:** Next.js, Google Generative AI SDK, Inngest, Drizzle ORM, PostgreSQL (Neon).

---

### Task 1: Database Schema & Environment
**Files:**
- Modify: `src/db/schema.ts`

- [x] **Step 1: Update embedding dimension**
```typescript
// src/db/schema.ts
// Change from vector(1536) to vector(768)
export const knowledgeBase = pgTable("knowledge_base", {
  // ...
  embedding: vector("embedding"), // Update the customType definition at the top
  // ...
});

// At the top of src/db/schema.ts:
const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(768)"; // Changed from 1536
  },
});
```

- [x] **Step 2: Push schema to database**
Run: `npm run db:push`
Expected: Database updated, `knowledge_base` table cleared or column updated to 768 dimensions.

- [x] **Step 3: Commit**
```bash
git add src/db/schema.ts
git commit -m "chore: update knowledge base embedding dimension to 768 for Gemini"
```

---

### Task 2: Knowledge Base Embeddings (Gemini)
**Files:**
- Modify: `src/modules/agents/knowledge-base/server/procedures.ts`
- Modify: `src/modules/agents/knowledge-base/server/query.ts`

- [ ] **Step 1: Update insertion logic in procedures.ts**
```typescript
// src/modules/agents/knowledge-base/server/procedures.ts
import { genAI } from "@/lib/gemini";

// In the mutation:
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
const result = await model.embedContent(content.substring(0, 8000));
const embedding = result.embedding.values;
```

- [ ] **Step 2: Update search logic in query.ts**
```typescript
// src/modules/agents/knowledge-base/server/query.ts
import { genAI } from "@/lib/gemini";

// In queryKnowledgeBase:
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
const result = await model.embedContent(queryText.substring(0, 4000));
const queryEmbedding = result.embedding.values;
```

- [ ] **Step 3: Verify with build**
Run: `npm run build`
Expected: No type errors in knowledge base files.

- [ ] **Step 4: Commit**
```bash
git add src/modules/agents/knowledge-base/server/procedures.ts src/modules/agents/knowledge-base/server/query.ts
git commit -m "feat: switch knowledge base to Gemini embeddings"
```

---

### Task 3: Inngest Functions (Gemini)
**Files:**
- Modify: `src/inngest/functions.ts`

- [ ] **Step 1: Replace OpenAI summarizer with Gemini**
```typescript
// src/inngest/functions.ts
import { genAI } from "@/lib/gemini";

// Update the summarizer logic:
// Since inngest-agent-kit is OpenAI-centric, we will bypass it or 
// use the Gemini model directly within the step.run calls.

// Replace summarizer.run with:
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const prompt = `System: ${summarizerSystemPrompt}\n\nUser: Process this transcript: ${JSON.stringify(transcriptWithSpeakers)}`;
const result = await model.generateContent(prompt);
const outputText = result.response.text();
```

- [ ] **Step 2: Verify locally**
Run: `npm run dev:inngest`
Action: Go to `localhost:8288`, trigger `meetings/processing`.
Expected: Gemini generates summary, quiz, and learning path. Database updated.

- [ ] **Step 3: Commit**
```bash
git add src/inngest/functions.ts
git commit -m "feat: switch Inngest background tasks to Gemini"
```

---

### Task 4: AI Whiteboard (Gemini Vision)
**Files:**
- Modify: `src/app/api/ai-whiteboard/route.ts`

- [ ] **Step 1: Replace OpenAI Vision with Gemini 1.5 Flash**
```typescript
// src/app/api/ai-whiteboard/route.ts
import { genAI } from "@/lib/gemini";

// Replace visionResponse logic:
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const result = await model.generateContent([
  "Extract and transcribe all text visible in this whiteboard image. Only return the text content, no explanations:",
  {
    inlineData: {
      data: pureBase64,
      mimeType: "image/png"
    }
  }
]);
ocrText = result.response.text();
```

- [ ] **Step 2: Verify build**
Run: `npm run build`
Expected: Successful compilation.

- [ ] **Step 3: Commit**
```bash
git add src/app/api/ai-whiteboard/route.ts
git commit -m "feat: switch AI Whiteboard OCR to Gemini Vision"
```

---

### Task 5: YouTube & Webhooks (Final Cleanup)
**Files:**
- Modify: `src/lib/youtube.ts`
- Modify: `src/app/api/webhook/route.ts`

- [ ] **Step 1: Update YouTube generator**
```typescript
// src/lib/youtube.ts
import { genAI } from "@/lib/gemini";
// Use gemini-1.5-flash to generate YouTube JSON suggestions.
```

- [ ] **Step 2: Update Webhook chat handler**
```typescript
// src/app/api/webhook/route.ts
import { genAI } from "@/lib/gemini";
// Replace openaiClient.chat.completions with Gemini generation.
```

- [ ] **Step 3: Final Verification**
Run: `npm run lint && npm run build`
Expected: 0 errors.

- [ ] **Step 4: Commit**
```bash
git add src/lib/youtube.ts src/app/api/webhook/route.ts
git commit -m "feat: finalize transition to Gemini across all AI touchpoints"
```
