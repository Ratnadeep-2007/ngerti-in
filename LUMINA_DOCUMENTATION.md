# Lumina.ai — Exhaustive Project Specifications, Architecture, & Workflows

Lumina.ai is a personalized AI tutoring classroom application. It won **3rd Place at GarudaHacks 6.0 (Education & Equity Track)**. The platform bridges the gap between AI reasoning and human empathy through real-time multi-modal interactions.

---

## 📁 1. Project Directory Structure

```
ngerti-in/
├── drizzle/                    # Drizzle migrations and generated SQL files
├── src/
│   ├── app/                    # Next.js 15 App Router directory
│   │   ├── (auth)/             # Authentication route layouts (Sign In, Sign Up)
│   │   ├── (home)/             # Main landing and discovery dashboard
│   │   ├── api/                # Next.js Route Handlers
│   │   │   ├── agent/          # Agent APIs (TTS and Chat reasoning endpoints)
│   │   │   ├── ai-whiteboard/  # Multimodal whiteboard analysis handler
│   │   │   ├── auth/           # Better-Auth endpoints wrapper
│   │   │   ├── inngest/        # Inngest event loop listener
│   │   │   ├── trpc/           # tRPC server-to-client edge proxy
│   │   │   ├── upload-pdf/     # PDF parsing & text extraction service
│   │   │   └── webhook/        # Webhook listener for Stream Video SDK callbacks
│   │   ├── call/               # Video Classroom routes (Active screen, lobbies)
│   │   ├── dashboard/          # Student main management control panels
│   │   ├── globals.css         # Styling, Tailwind configurations, fonts, keyframes
│   │   ├── layout.tsx          # App base layout (fonts, providers, headers)
│   │   └── loading.tsx         # Page transition loader
│   ├── components/             # Reusable UI widgets (modals, dialogs, alerts)
│   ├── db/                     # Database setup, Drizzle connection, and SQL schema
│   │   ├── index.ts            # Neon HTTP database driver export
│   │   └── schema.ts           # Postgres schemas, enums, indexes, and tables
│   ├── hooks/                  # Global custom hooks (e.g., custom confirm modals)
│   ├── inngest/                # Async task queues and functions
│   │   ├── client.ts           # Inngest instance definition
│   │   └── functions.ts        # Session processing, summaries, polling loops
│   ├── lib/                    # SDK initializations & central utility wrappers
│   │   ├── auth.ts             # Better-Auth server configuration
│   │   ├── auth-client.ts      # Better-Auth client hooks
│   │   ├── gemini.ts           # Google AI SDK configuration wrapper
│   │   ├── stream-chat.ts      # Stream Chat Server Node initialization
│   │   ├── stream-video.ts     # Stream Video Server Node initialization
│   │   └── youtube.ts          # YouTube API wrapper (concept searches)
│   ├── modules/                # Domain-driven features (Modular pattern)
│   │   ├── agents/             # AI Tutor creation, prompt editing, and RAG uploads
│   │   ├── auth/               # UI components for credential forms
│   │   ├── call/               # Video lobby, webcam widgets, and drawing canvas
│   │   ├── dashboard/          # Statistics panels, session logs, progress charts
│   │   ├── main-dashboard/     # Sidebar layouts and core panel navigations
│   │   └── meetings/           # Summaries, transcripts, quiz cards, post-call chats
│   └── trpc/                   # tRPC configurations
│       ├── client.ts           # tRPC client hooks
│       ├── init.ts             # Context initialization, tRPC routers
│       └── server.ts           # tRPC server-side query prefetch engines
```

---

## 🛠️ 2. Core Technological Architecture

The platform combines multiple web APIs, database structures, and machine learning components to form a unified learning ecosystem.

### A. Next.js 15+ & TypeScript
Uses App Router configuration. Next.js server components prefetch database values, while client components handle live UI states (Excalidraw, media streaming, webcams).

### B. Neon Serverless Postgres & Drizzle ORM
A serverless PostgreSQL cloud instance. Drizzle ORM defines tables and executes relational queries. Vector operations are conducted via a custom Drizzle configuration integrating the PostgreSQL `pgvector` extension:
```typescript
const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value.slice(1, -1).split(",").map(Number);
    }
    return value as number[];
  },
});
```

### C. Better-Auth (with Google OAuth)
Handles user credential workflows. Configured with a `drizzleAdapter` linked to Drizzle PostgreSQL tables:
*   Email / Password (enabled).
*   Google Social Provider (OAuth configuration).
*   Automatic token updates and secure cookie session storage.

### D. Stream Video & Chat SDKs
Orchestrates live tutoring connections.
*   **Video:** Streams webcam views, handles audio, records calls, and runs automated speech transcription.
*   **Chat:** Synchronizes text exchanges in class and recap sessions. Supports custom messages using `@ai` tags, triggering the background tutor response system.

### E. Deepgram Voice Technologies
*   **Speech-to-Text (STT):** Streams user microphone bytes (Int16) to Deepgram's WebSocket API (`wss://api.deepgram.com/v1/listen`), returning real-time transcription chunks.
*   **Text-to-Speech (TTS):** The `aura-asteria-en` model converts text responses into an `audio/mpeg` MP3 array buffer for playback.

### F. Client-Side Vision & OCR
*   **face-api.js:** Loads TensorFlow models `tinyFaceDetector` and `faceExpressionNet` in the browser, scanning the user's camera feed to analyze expression indices (sadness, anger, fear) every 2 seconds.
*   **Tesseract.js:** Recognizes text in Indonesian and English from images uploaded directly to the canvas.

### G. Background Task Processing (Inngest)
Coordinates asynchronous pipelines. Inngest hooks into webhook callbacks, triggers AI summaries, polls active meeting prompt changes, and generates follow-up quizzes.

---

## 🗄️ 3. Complete Database Schema Details

Tables are located in `src/db/schema.ts`:

### 1. `user` Table
Stores registered student identities.
*   `id` (text, Primary Key)
*   `name` (text, not null)
*   `email` (text, not null, unique)
*   `emailVerified` (boolean, defaults to false)
*   `image` (text, nullable profile photo)
*   `createdAt` / `updatedAt` (timestamp)

### 2. `session` Table
Manages active Better-Auth web tokens.
*   `id` (text, Primary Key)
*   `userId` (text, references `user.id` on cascade delete)
*   `token` (text, unique)
*   `expiresAt` (timestamp)
*   `ipAddress` / `userAgent` (text, nullable)

### 3. `account` Table
Stores authentication provider linkages (Google OAuth / local login hashes).
*   `id` (text, Primary Key)
*   `userId` (text, references `user.id` on cascade delete)
*   `providerId` / `accountId` (text, not null)
*   `accessToken` / `refreshToken` / `idToken` (text, nullable)
*   `password` (text, nullable credential hash)

### 4. `verification` Table
Manages secure login token validations.
*   `id` (text, Primary Key)
*   `identifier` / `value` (text, not null)
*   `expiresAt` (timestamp)

### 5. `agents` Table
Stores custom AI Tutor definitions.
*   `id` (text, Primary Key, generated via `nanoid`)
*   `name` (text, not null)
*   `subject` (enum `mata_pelajaran`: `Math`, `Bahasa Indonesia`, `Natural Science`, `Social Science`, `English`)
*   `language` (text, default "Standard")
*   `prompt` (text, not null system instructions)
*   `userId` (text, references `user.id` on cascade delete)

### 6. `knowledgeBase` Table
Maintains RAG documents for specific tutors.
*   `id` (text, Primary Key, generated via `nanoid`)
*   `agentId` (text, references `agents.id` on cascade delete)
*   `userId` (text, references `user.id` on cascade delete)
*   `filename` (text, name of source PDF)
*   `content` (text, extracted chunk contents)
*   `embedding` (vector(768), 3D similarity coordinates)
*   *Index:* `idx_kb_agent_id` for fast query lookup.

### 7. `meetings` Table
Tracks tutoring classrooms, logs transcripts, and stores recaps.
*   `id` (text, Primary Key)
*   `name` (text, not null)
*   `userId` (text, references `user.id` on cascade delete)
*   `agentId` (text, references `agents.id` on cascade delete)
*   `status` (enum `meeting_status`: `upcoming`, `active`, `completed`, `processing`, `cancelled`)
*   `startedAt` / `endedAt` (timestamp)
*   `transcriptUrl` / `recordingUrl` (text references to Stream Video S3 storage)
*   `summary` (text, generated markdown report)
*   `quiz` (text, JSON string storing practice questions)
*   `learningPath` (text, JSON string of next steps)
*   `suggestedVideos` (text, JSON string containing YouTube recommendations)
*   `topics` (text, JSON string storing concept list)
*   `whiteboardSnapshot` (text, Base64 image snapshot of final canvas layout)
*   `currentPrompt` (text, temporary prompts from live actions like OCR/confusion triggers)
*   `isPublic` (boolean, defaults to false)
*   *Indexes:* `idx_meetings_user_id`, `idx_meetings_agent_id`, `idx_meetings_status` for dashboard querying.

---

## 🔄 4. Detailed Core Feature Workflows

### Feature A: Document Ingestion (RAG)

Allows students to feed PDF textbooks to their AI tutors to serve as query context.

```
[Student Uploads PDF]
       │
       ▼
[Client-side Form Data] ───► POST /api/upload-pdf
                                 │
                                 ▼
                     [Parsed via pdf-parse library]
                                 │
                                 ▼
                      [Returns plain text content]
                                 │
                                 ▼
                     [tRPC: knowledgeBase.create]
                                 │
                                 ▼
               [Gemini API: text-embedding-004] (produces 768 Vector)
                                 │
                                 ▼
                 [Save Content & Vector to Neon DB]
```

*   **Similarity Lookup API:** When the whiteboard updates or text is queried, a similarity search retrieves matching textbook excerpts using cosine distance:
    ```sql
    SELECT filename, content, 1 - (embedding <=> :queryEmbedding::vector) as similarity
    FROM knowledge_base
    WHERE agent_id = :agentId AND user_id = :userId
    AND 1 - (embedding <=> :queryEmbedding::vector) > 0.5
    ORDER BY embedding <=> :queryEmbedding::vector LIMIT 3
    ```

---

### Feature B: Low-Latency Voice Agent Loop

Students can hold the Spacebar to speak to the AI tutor, receiving low-latency voice responses.

```
       [User holds spacebar and speaks]
                      │
                      ▼
[PCM Int16 Audio stream captured from microphone]
                      │
                      ▼
[Deepgram WebSockets (wss://api.deepgram.com/v1/listen)]
                      │
                      ▼
        [Real-time transcript returned]
                      │
                      ▼
         [POST /api/agent/chat endpoint]
                      │
                      ▼
   [Fetch AI Agent Persona + Classroom Context]
                      │
                      ▼
    [Gemini API generates text response]
                      │
                      ▼
         [POST /api/agent/tts endpoint]
                      │
                      ▼
   [Deepgram Aura TTS (aura-asteria-en) API]
                      │
                      ▼
[Returns audio/mpeg buffer -> Played via AudioContext]
                      │
                      ▼
  [Stream Video publishes audio into the call]
```

---

### Feature C: Interactive Whiteboard & Homework Scanner (OCR)

The whiteboard supports shared drawing, homework image scanning, and automated AI annotations.

*   **Whiteboard Sync:** Drawings and text on the canvas are debounced by 500ms and synced to the database. Text elements are parsed every 3 seconds and sent to `/api/ai-whiteboard` to update the tutor's context.
*   **Homework Scanner:**
    1.  The student clicks "Scan Homework" and selects an image.
    2.  `Tesseract.js` extracts text from the image client-side.
    3.  A text element is inserted into the Excalidraw canvas at coordinates `(100, 100)`.
    4.  The system calls the database to update `meetings.currentPrompt`, notifying the AI tutor of the scanned problem.
    5.  It requests an explanation from `/api/ai-whiteboard`, triggering the AI to speak the solution.
*   **Autonomous Drawings:**
    If the AI tutor needs to illustrate its answer, it appends a structured code block to its response text:
    ```excalidraw
    [
      { "type": "rectangle", "x": 150, "y": 150, "width": 100, "height": 100, "strokeColor": "#3b82f6" },
      { "type": "text", "x": 160, "y": 190, "text": "A = 100m²", "fontSize": 16, "strokeColor": "#10b981" }
    ]
    ```
    The client-side `ExcalidrawWrapper` parses this block, removes it from the speech audio stream, and updates the canvas scene in real-time.

---

### Feature D: Proactive Confusion Detection

Lumina.ai monitors student facial expressions to detect confusion automatically.

```
 [Student Webcam Video Feed]
              │
              ▼
    [face-api.js hook] (TinyFaceDetector & FaceExpressionNet)
              │
              ▼
   [Evaluates expressions every 2 seconds]
              │
              ▼
     [Is confusion score > 0.5?]
         ├── Yes: Increment counter ──► Is counter >= 3? (6 seconds)
         │                                   ├── Yes: Trigger handleConfused()
         │                                   └── No: Continue loop
         └── No: Reset counter ──► Continue loop
```

*   **Adaptation Mechanism:** When `handleConfused()` is triggered, it updates `meetings.currentPrompt` in the database with:
    > "The AI emotion detector noticed the student looks confused. Please pause, check in with them warmly, and offer to explain the current topic in a simpler way."
*   This context is fed directly to the AI tutor's next conversation turn, allowing it to adapt its explanation dynamically.

---

### Feature E: Post-Meeting Summary & Recaps

Once a classroom session ends, Webhooks and Inngest generate summaries, quizzes, and learning guides.

```
       [Stream Call Ends]
               │
               ▼
[Stream Webhook Callback (call.transcription_ready)]
               │
               ▼
   [Triggers Inngest background event]
               │
               ▼
    [Parses JSONL transcript files]
               │
               ▼
   [Calls Gemini API (gemini-3.5-flash)]
               │
               ▼
 [Validates output via Zod schemas]
               │
               ▼
 [Fetch YouTube recommendations & save to DB]
               │
               ▼
    [Recap Dashboard goes active]
```

*   **Recap Chat:** After the meeting ends, a chat tab becomes active. It uses the meeting summary and parsed transcript as context, allowing the student to ask follow-up questions.
*   **Practice Room:** Renders an interactive practice dashboard:
    *   *Multiple Choice:* Dynamic quizzes with real-time feedback.
    *   *3D Flashcards:* Rotating card deck for key concept review.
    *   *Anki Export:* Generates a CSV file containing `"Question","Answer"` pairs for study deck imports.
*   **Study Guide PDF:** Uses `jsPDF` to generate a branded PDF containing the summary, learning path, quiz deck, and the final whiteboard snapshot.

---

## 🛠️ 5. Local Setup, Webhooks, & Tunneling

Lumina.ai requires secure HTTPS tunneling to connect local servers with remote Stream Video webhook callbacks.

### 1. Running the Project Locally
Run standard server processes:
```bash
npm run dev # Launches local server on port 3006
```

### 2. Tunneling Configuration (Mandatory)
Start a secure tunnel connection:
```bash
cloudflared tunnel --url http://localhost:3006
```
This generates a secure tunnel URL (e.g., `https://your-tunnel.trycloudflare.com`). 

Update the environment file (`.env`):
```env
NEXT_PUBLIC_APP_URL=https://your-tunnel.trycloudflare.com
BETTER_AUTH_URL=https://your-tunnel.trycloudflare.com
```

### 3. Webhook Integration
1.  Configure webhook URL subscriptions on your Stream Dashboard to target:
    `https://your-tunnel.trycloudflare.com/api/webhook`
2.  Stream triggers events like `call.transcription_ready` to this endpoint. The endpoint verifies webhook signatures via `streamVideo.verifyWebhook(body, signature)` before processing the payload.
3.  For offline local development, fallbacks in the `getOne` and `getTranscript` endpoints query `listRecordings` and `listTranscriptions` directly on Stream's Node SDK when loading the recap dashboard, bypassing active tunnel requirements.
