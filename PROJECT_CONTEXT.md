# Lumina.ai - Project Context Document

This document provides a comprehensive overview of the `Lumina.ai` project architecture, vision, tech stack, and current implementation details to help AI assistants understand the codebase 100%.

## 🌟 Project Vision & Background

Lumina.ai is an innovative AI-powered learning platform designed to provide personalized and interactive learning experiences. It connects students with AI tutors for various subjects, facilitating engaging learning sessions through real-time voice integration and interactive whiteboard explanations. 
- **Achievement:** 3rd Place Winner (Education & Equity Track) at GarudaHacks 6.0.
- **Problem Solved:** Lack of access to quality education, difficulty understanding passive lectures (like YouTube), and fear of judgment when asking questions.
- **Value Proposition:** Unlike ChatGPT or YouTube, Lumina.ai offers real-time whiteboard activations, two-way vocal communication, and personalized on-demand tutoring.

## 🏗 Comprehensive Tech Stack

- **Framework:** Next.js 15.4.3 (App Router)
- **Language:** TypeScript
- **Styling & UI:** Tailwind CSS v4, Radix UI (shadcn/ui components), Framer Motion (animations), Embla Carousel, Lucide React (icons)
- **Database:** PostgreSQL (via Neon serverless)
- **ORM:** Drizzle ORM
- **API Layer:** tRPC (Server & Client) with `@tanstack/react-query`
- **Authentication:** Better Auth (Google OAuth & standard sessions)
- **Video & Realtime AI:** 
  - `@stream-io/video-react-sdk` & `@stream-io/node-sdk` (Video streaming)
  - `@stream-io/openai-realtime-api` & `openai` (Realtime AI voice interactions)
- **Background Jobs:** Inngest (`inngest` & `@inngest/agent-kit`)
- **Whiteboard:** Excalidraw (`@excalidraw/excalidraw`)
- **Forms & Validation:** `react-hook-form`, `zod`, `@hookform/resolvers`
- **Other Utilities:** `tesseract.js` (OCR for homework scanning), `face-api.js` (Emotion detection), `nuqs` (URL state management), `date-fns` (Date parsing).

## 🗄️ Database Schema (`src/db/schema.ts`)

The database uses PostgreSQL via Drizzle ORM. Key tables include:

1. **User Management (Better Auth standard):**
   - `user`: id, name, email, image, role, etc.
   - `session`, `account`, `verification`

2. **Core Domain Entities:**
   - **`agents`**: Represents an AI Tutor.
     - `id`, `name`, `subject` (Math, Bahasa Indonesia, Natural Science, Social Science, English), `prompt` (system instructions defining the AI's persona), `userId` (creator).
   - **`meetings`**: Represents a study session.
     - `id`, `name`, `userId`, `agentId`, `status` (upcoming, active, completed, processing, cancelled), `startedAt`, `endedAt`, `transcriptUrl`, `recordingUrl`, `summary`.

## 📁 Architecture & Directory Structure

The project follows a modular Domain-Driven Design (DDD) architecture under `src/`:

- `src/app/`: Next.js App Router definitions.
  - `/(auth)`: Sign-in and Sign-up routes.
  - `/(home)`: Landing page.
  - `/dashboard`: User dashboard, meetings list, and AI tutors management.
  - `/call/[meetingId]`: The actual interactive video call and whiteboard UI.
  - `/api/trpc/[trpc]`: tRPC endpoint.
  - `/api/inngest`: Inngest event receiver.
  - `/api/ai-whiteboard` & `/api/webhook`: Webhooks and specific API routes.
- `src/components/`: Reusable, generic UI components (mostly shadcn/ui).
- `src/db/`: Drizzle schema, DB connection, and migrations.
- `src/hooks/`: Global custom React hooks.
- `src/inngest/`: Background job definitions and Inngest client.
- `src/lib/`: Utility functions, constants, auth client, and Stream clients.
- `src/modules/`: **Domain Modules**. Contains specific business logic separated by feature:
  - `agents/`, `meetings/`, `call/`, `dashboard/`, `landing/`, `auth/`, `main-dashboard/`
  - Each module typically contains `params.ts`, `schemas.ts`, `types.ts`, `server/` (tRPC procedures), `hooks/`, and `ui/` (components and views).
- `src/trpc/`: Base tRPC initialization, query clients, and the main `_app.ts` router.

## ⚙️ Background Jobs (`src/inngest/functions.ts`)

1. **`meetingsProcessing`**: Triggered when a meeting ends. Fetches the Stream transcript, matches speaker IDs, uses an Inngest AI agent (GPT-4o) to generate a markdown summary, and updates the DB.
2. **`pollAgentPrompt`**: Polls the DB during a call to check if the AI agent's instructions (`agents.prompt`) changed. If so, updates the Stream Realtime AI dynamically.

## 🌐 Environment & Integrations

To run fully, the project requires:
- **Neon Postgres**: `DATABASE_URL`
- **Better Auth**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, Google OAuth credentials.
- **Stream**: `NEXT_PUBLIC_STREAM_VIDEO_API_KEY`, `STREAM_VIDEO_SECRET`, `NEXT_PUBLIC_STREAM_CHAT_API_KEY`, `STREAM_CHAT_SECRET_KEY`
- **OpenAI**: `OPENAI_API_KEY` for generating summaries and handling the realtime voice API.
- **Cloudflare Tunnels**: A public URL (`NEXT_PUBLIC_APP_URL`) is required during development to allow external services (like Stream webhooks) to hit the local environment.

## 🚀 Feature Implementation Status

### ✅ Implemented Features
1. **AI Realtime Voice Tutoring:** Stream Video SDK + Stream OpenAI Realtime API.
2. **Interactive Shared Whiteboard:** Excalidraw integration for real-time collaboration.
3. **"Snap, Drop, & Solve":** Uses `tesseract.js` for OCR on images dropped into Excalidraw.
4. **Automated Session Summaries:** Inngest background jobs + GPT-4o analyze transcripts.
5. **Adaptive Quizzes:** Generated post-meeting and displayed interactively.
6. **Multilingual Native Dialect Support:** Dynamic prompt injection for dialects like Javanese/Sundanese.
7. **Session Recordings & Transcripts:** Stream Video SDK recording services.
8. **YouTube Integration:** AI suggests and embeds relevant educational YouTube videos based on session context.
9. **"Upload Your Textbook" (RAG):** RAG-based tutoring via PDF parsing and vector database indexing.
10. **"Smart Knowledge Map":** Visual representation of student mastery using `react-force-graph`.
11. **Confusion/Emotion Detection:** Proactive AI intervention via `face-api.js` evaluating facial expressions in real-time.
12. **"Export to Flashcards":** Exporting AI-generated quizzes to Anki (CSV format).
13. **"AI Study Buddy":** Real-time matchmaking to suggest and join collaborative study sessions with other students.

### 🚧 Planned Features (Roadmap)
*All core roadmap features have been successfully implemented!*

