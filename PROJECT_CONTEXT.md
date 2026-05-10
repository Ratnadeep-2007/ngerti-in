# Ngerti.In - Project Context Document

This document provides a comprehensive overview of the `Ngerti.In` project architecture, stack, and current implementation details to help AI assistants (like Claude) understand the codebase quickly.

## 🏗 Tech Stack Overview

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Radix UI (shadcn/ui components)
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **API Layer:** tRPC (Server & Client)
- **Authentication:** Better Auth
- **Video & Realtime AI:** Stream Video SDK + Stream OpenAI Realtime API
- **Background Jobs:** Inngest
- **Whiteboard:** Excalidraw
- **Other:** Zod (validation), React Hook Form, Zustand/Context (state)

## 🗄️ Database Schema (`src/db/schema.ts`)

The database uses PostgreSQL via Drizzle ORM. Key tables include:

1. **User Management (Better Auth standard):**
   - `user`: id, name, email, image, etc.
   - `session`, `account`, `verification`

2. **Core Domain Entities:**
   - **`agents`**: Represents an AI Tutor.
     - `id`, `name`, `subject` (Enum: Math, Bahasa Indonesia, Natural Science, Social Science, English), `prompt` (The system instructions defining the AI's persona and behavior), `userId` (creator).
   - **`meetings`**: Represents a study session.
     - `id`, `name`, `userId`, `agentId`, `status` (upcoming, active, completed, processing, cancelled), `startedAt`, `endedAt`, `transcriptUrl`, `recordingUrl`, `summary`.

## 🌐 API & Server Layer (`src/trpc/routers/_app.ts`)

The application uses tRPC for end-to-end typesafe APIs.
The main router (`appRouter`) aggregates sub-routers:
- `agents`: Procedures for creating, updating, and fetching AI tutors. (`src/modules/agents/server/procedures.ts`)
- `meetings`: Procedures for managing video call sessions. (`src/modules/meetings/server/procedures.ts`)

## ⚙️ Background Jobs (`src/inngest/functions.ts`)

Inngest is used to handle asynchronous, long-running tasks.

1. **`meetingsProcessing` (Event: `meetings/processing`):**
   - Triggered when a meeting ends.
   - Fetches the Stream transcript JSONL file.
   - Matches speaker IDs to Database Users/Agents.
   - Uses an Inngest `@inngest/agent-kit` summarizer (powered by GPT-4o) to generate a markdown summary of the lesson.
   - Updates the `meetings` table with the summary.

2. **`pollAgentPrompt` (Event: `agent/prompt.poll`):**
   - Connects the Stream OpenAI Realtime client to a specific call.
   - Polls the database every 1 second to check if the `agents.prompt` has changed.
   - If changed, it dynamically updates the live AI's session instructions mid-call (`realtimeClient.updateSession({ instructions })`).

## 📁 Directory Structure & Routing (`src/app/`)

- `/(auth)/sign-in`, `/(auth)/sign-up`: Authentication routes.
- `/(home)/page.tsx`: Landing page.
- `/dashboard`: User dashboard to view meetings and AI tutors.
  - `/dashboard/meetings`: List/Create meetings.
  - `/dashboard/tutor`: List/Create AI Agents.
- `/call/[meetingId]`: The actual video call and whiteboard interface.
- `/api/...`: Next.js Route Handlers.
  - `/api/trpc/[trpc]`: tRPC endpoint.
  - `/api/inngest`: Inngest event receiver.

## 🤝 Key Integrations

- **Stream Realtime API:** Used for the core "Talk to AI" feature. The AI connects to the video call as a participant, listens to the user, and replies via voice using OpenAI's realtime models.
- **Excalidraw:** Integrated as a shared canvas during the call.
- **Better Auth:** Handles secure session management and OAuth (Google).

## 🚀 Hackathon Feature Context

If implementing new features (like the Homework Scanner or Adaptive Quizzes), you will primarily interact with:
1. `src/app/call/[meetingId]/page.tsx` (or related UI components) for frontend integrations (like camera scanning).
2. `src/inngest/functions.ts` to add new background jobs (e.g., generating quizzes post-meeting).
3. `src/db/schema.ts` to add new fields (e.g., storing quiz results).
4. `src/modules/...` to add new tRPC procedures to fetch the newly created data.