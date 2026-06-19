# Lumina.ai — Master Status, Upgrades & Future Roadmap

This document serves as the master record for the current project status, completed technical upgrades, and next-generation product roadmap for the **Lumina.ai** personalized tutoring platform.

---

## 📅 Part 1: Current Project Status

### ✅ Completed Milestones
*   **Font Optimization:** Switched from `next/font/google` to `@fontsource/inter` to resolve network/proxy-related loading errors during page loads.
*   **Emotion Detection Optimization:** Refactored the `useEmotionDetection` hook to prevent heavy model loading unless the feature is explicitly enabled on the active call screen.
*   **Stream SDK Cleanup:** Improved `CallConnect` component logic to guarantee proper cleanup of call and client objects on unmount, preventing hardware/resource leaks.
*   **Project Guidelines:** Consolidated guidelines in [GEMINI.md](file:///C:/RD_PROJECT/negerti-in/GEMINI.md) for local setup, CORS troubleshooting, and credentials.
*   **tRPC Debugging:** Added robust server-side logging in tRPC contexts and protected procedures to trace authentication and session state.
*   **Unit Tests Configured:** Configured `vitest.config.ts` to properly register `vitest.setup.ts`, achieving 100% pass rates across all 37 unit tests.
*   **Production Build Validated:** Next.js production build succeeds with zero type, compilation, or styling syntax errors.
*   **Neon HTTP Connection:** Switched database communication to `drizzle-orm/neon-http` to mitigate serverless cold-start latency.

### 🚧 In Progress / Verification
*   **E2E Verification Plan:** Executing end-to-end verification workflows.
*   **Google OAuth:** Awaiting credentials setup (standard email/password authentication is fully operational).

### 📋 Remaining Actions for User
1.  **Initialize App Tunnel:** Run `./start.ps1` (or `./start.sh`) to start the server over a secure Cloudflare Tunnel (`https`) and link the local environment to Stream Webhooks.
2.  **Hardware Permissions & E2E Run:** Test the entire app flow (landing, signup, agent creation, call, whiteboard drawing, and post-meeting recap/quizzes) over the secure tunnel URL.

---

## 🚀 Part 2: Platform Upgrades & Enhancements

### 1. Cost-Efficient Voice Agent Pipeline
*   **Realtime Migration:** Migrated from the WebRTC-based OpenAI Realtime API to a hybrid browser-to-server text-to-speech loop, cutting API costs by ~95%.
*   **NVIDIA NIM Integration:** Created a server mutation `talkToAgent` in [procedures.ts](file:///C:/RD_PROJECT/negerti-in/src/modules/meetings/server/procedures.ts) querying NVIDIA NIM cloud hosting (Llama 3.1 8B).
*   **Multi-User Audio Sync:** Spoken responses play locally for the sender immediately to eliminate perceived latency, while the audio stream is synchronized across other meeting participants using Stream Call custom events (`call.sendCustomEvent`).
*   **Zero-Tunnel Dependency:** Standard client-initiated event messaging bypasses the requirement for active Cloudflare tunnels during call streams.

### 2. Robust Microphone & Tutor Controls
*   **Decoupled Control State:** Separated `isListening` (active recording state) from `isTutorEnabled` (user intent switch) inside [use-live-tutor.ts](file:///C:/RD_PROJECT/negerti-in/src/modules/call/hooks/use-live-tutor.ts) so that the "Talk to AI" switch remains active when the student pauses speaking.
*   **Auto-Restarting Voice Loop:** The microphone restarts automatically, pausing itself when the AI is thinking or speaking to prevent feedback, and turning back on once the AI finishes.
*   **Access Warning Tooltips:** Wrapped mic buttons and "Talk to AI" switches with custom Radix Tooltips. If browser microphone permissions are blocked, a warning box appears showing `"microhone is not enable"`.
*   **Auto-Shutdown on Revocation:** If microphone access is lost or revoked at runtime, the voice tutor automatically turns off, cancels speech synthesis, and notifies the user via a toast alert.

### 3. Webpack & Next.js Compiler Fixes
*   **Server-Side Import Fallbacks:** Resolved build issues caused by browser-side imports of `face-api.js` (which attempts to resolve Node's native `fs`, `path`, and `child_process` modules).
*   **Webpack Polyfills:** Configured Next.js webpack settings in [next.config.ts](file:///C:/RD_PROJECT/negerti-in/next.config.ts) to treat these backend libraries as `false` in client-side bundles, resolving compiler failures.

### 4. Post-Meeting AI Recaps & Q&A Panel
*   **Custom Recaps Chat Interface:** Replaced generic Stream text chat with a custom-built AI Chat UI in [chat-ui.tsx](file:///C:/RD_PROJECT/negerti-in/src/modules/meetings/ui/components/chat-ui.tsx).
*   **Transcript-Aware Q&A:** Added the `askPostMeetingAI` mutation. It parses the meeting's JSONL transcript and summary, passing it along with the AI Agent's persona to NVIDIA NIM so students can ask questions about the session.
*   **Premium Theme Alignment:** Integrated markdown parsing (`react-markdown`), visual loader animations, initial greeting prompts, custom Dicebear avatars, and auto-scroll behaviors.

### 5. Local Stream Fallbacks (Recordings/Transcripts)
*   **Webhook Bypass:** Created fallback queries inside `getOne` and `getTranscript` procedures in [procedures.ts](file:///C:/RD_PROJECT/negerti-in/src/modules/meetings/server/procedures.ts). 
*   **API Retrieval:** If webhook triggers are blocked in local environments (no active Cloudflare Tunnel), the server calls `listRecordings` and `listTranscriptions` directly on Stream's Node SDK when the user loads the recap page.
*   **Automated Processing Trigger:** Once found, it updates the database status to `"completed"`, saves the URL file references, and triggers the Inngest background function to generate quizzes, summaries, and learning paths.

### 6. Performance & UX Polish
*   **Excalidraw Rendering Optimization:** Added a `500ms` debounce handler to Excalidraw's `onChange` event in [call-ui.tsx](file:///C:/RD_PROJECT/negerti-in/src/modules/call/ui/components/call-ui.tsx) to prevent heavy serialization from blocking the React thread.
*   **On-Demand Emotion Detection:** Hooked up emotion detection models to initialize and run only when the webcam is active.
*   **Auth Redirects:** Added path forwarding to sign-in views so logged-out guest participants are automatically redirected back to their active meeting upon signing in.
*   **UI Loaders:** Inserted dynamic spinners into meeting and agent creation forms.

---

## 🔮 Part 3: Future Roadmap & Ideation

### 1. 🧭 Socratic Tutoring Mode (Pedagogical Excellence)
*   **The Concept:** Instead of acting as an "answer generator" or direct lecturer, the AI shifts to a guide-on-the-side model (reminiscent of Khanmigo).
*   **How it Works:** 
    *   Add a UI switch in the tutoring sidebar: **Direct Help** vs. **Socratic Coach**.
    *   When **Socratic Coach** is enabled, the system prompt strictly forbids revealing the final answer.
    *   The AI evaluates the student's current drawing/text on the whiteboard and asks leading questions to nudge the student to identify the next step.
*   **Implementation Steps:**
    1.  Add a `tutoringMode` column (`"direct"` | `"socratic"`) to the `meetings` or `agents` table.
    2.  Update the system prompt constructor in [route.ts](file:///C:/RD_PROJECT/negerti-in/src/app/api/agent/chat/route.ts) to inject Socratic behavior rules.

### 2. 🎨 True Whiteboard Autonomy (AI Tool/Function Calling)
*   **The Concept:** Replace the current, fragile markdown JSON code-block parsing with native AI tool-calling.
*   **How it Works:** 
    *   Equip the Gemini model with specific tools (functions) to manipulate the Excalidraw canvas.
    *   Tools could include:
        *   `drawCircle(centerX, centerY, radius, color)`
        *   `drawLine(points[], color, strokeWidth)`
        *   `writeText(text, x, y, fontSize)`
        *   `clearCanvas()`
    *   The model executes these tools, producing structured JSON outputs that trigger smooth updates on the student's screen in real-time.
*   **Implementation Steps:**
    1.  Define a set of `FunctionDeclarations` in the Gemini model parameters inside [gemini.ts](file:///C:/RD_PROJECT/negerti-in/src/lib/gemini.ts).
    2.  Create a tool runner in [route.ts](file:///C:/RD_PROJECT/negerti-in/src/app/api/ai-whiteboard/route.ts) to execute the model's choices.
    3.  Emit the corresponding canvas events over the Stream custom event layer.

### 3. 📈 Math & Science Integration (Interactive Graphing)
*   **The Concept:** High school and college STEM subjects rely heavily on graphs (parabolas, derivatives, sine waves, circuits). Manual drawing is slow and imprecise.
*   **How it Works:**
    *   Embed the **Desmos API** or a lightweight plotting container next to or inside the Excalidraw workspace.
    *   The AI can plot functions dynamically via tools (e.g., `plotFunction("y = x^2 - 4x + 4")`).
    *   Students can interact with the graph lines, slider parameters, and visual intersections.
*   **Implementation Steps:**
    1.  Add the Desmos API script or install a plotting library.
    2.  Embed a collapsible graphing panel component in the meeting screen.
    3.  Allow the AI tutor call to trigger graph updates using function calling.

### 4. 👥 AI-Moderated Collaborative Study Rooms
*   **The Concept:** Scale the platform from a 1-on-1 tutoring tool to a collaborative "study club" where multiple students work together on a shared board with a single AI moderator.
*   **How it Works:**
    *   The AI acts as a peer moderator, ensuring group focus.
    *   It monitors who has spoken or drawn, encourages quiet students to participate, and orchestrates turn-taking: *"Rachit, what do you think of Siddhi's formula on the board? Can you help correct the exponent?"*
*   **Implementation Steps:**
    1.  Leverage Stream Video SDK's multi-participant track bindings.
    2.  Extend the Deepgram speech detector to distinguish between different speakers (using speaker diarization or Stream's active speaker status).
    3.  Modify the prompt to manage group engagement.

### 5. 🔌 Local Offline AI Mode (Zero Server Costs)
*   **The Concept:** Running cloud LLMs (Gemini, GPT) and real-time audio APIs at scale introduces substantial server/API costs. Supporting local execution democratizes access.
*   **How it Works:**
    *   Use WebGPU-accelerated models (such as **WebLLM** or **Transformers.js**) to download and run a small, optimized LLM (like Gemma 2B or Llama-3-8B-Instruct) entirely in the student's browser.
    *   Use WASM-based Whisper for offline speech-to-text.
    *   All calculations are run locally, achieving 100% privacy and $0 hosting overhead per active student session.
*   **Implementation Steps:**
    1.  Integrate a web-worker file that loads and executes web-based models.
    2.  Add an "Offline/Local Mode" option in the user's dashboard.
