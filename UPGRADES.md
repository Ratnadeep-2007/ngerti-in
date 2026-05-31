# Lumina.ai – Platform Upgrades & Enhancements

This document details all the technical upgrades, performance optimizations, and feature enhancements made to the **Lumina.ai** tutoring platform.

---

## 1. Cost-Efficient Voice Agent Pipeline (NVIDIA NIM)
* **OpenAI Realtime Migration:** Migrated away from the WebRTC-based OpenAI Realtime API to a hybrid browser-to-server text-to-speech loop, saving ~95%+ on credits.
* **Direct tRPC NIM Integration:** Created a server mutation `talkToAgent` in [procedures.ts](file:///E:/Skills/Webstack/DYHack/ngerti_jules/src/modules/meetings/server/procedures.ts) querying NVIDIA NIM cloud hosting (Llama 3.1 8B).
* **Multi-User Audio Sync:** Responses are spoken locally for the sender immediately to reduce latency, while the audio response is synchronized across all other meeting participants using Stream Call custom events (`call.sendCustomEvent`).
* **Zero-Tunnel Dependency:** Standard client-initiated event messaging bypasses the requirement for active Cloudflare tunnels during call streams.

---

## 2. Robust Microphone & Tutor Controls
* **Switch/Mic Toggle Decoupling:** Separated `isListening` (active recording state) from `isTutorEnabled` (user intent switch) inside [use-live-tutor.ts](file:///E:/Skills/Webstack/DYHack/ngerti_jules/src/modules/call/hooks/use-live-tutor.ts) to prevent the "Talk to AI" toggle from automatically flipping off when speech finishes.
* **Auto-Restarting Voice Loop:** The microphone now restarts automatically, pausing itself when the AI is thinking or speaking to prevent feedback, and turning back on once the AI finishes.
* **Microphone Access Warning Tooltips:** Wrapped the standard mic button and "Talk to AI" switch block in [call-active.tsx](file:///E:/Skills/Webstack/DYHack/ngerti_jules/src/modules/call/ui/components/call-active.tsx) with custom Radix Tooltips. If browser microphone permissions are blocked, a warning box appears on hover showing `"microhone is not enable"`.
* **Auto-Shutdown on Permission Revocation:** If microphone access is lost or revoked at runtime, the voice tutor automatically turns off, cancels speech synthesis, and notifies the user via a toast alert.

---

## 3. Webpack & Next.js Compiler Fixes
* **Server-side Fallbacks:** Resolved build issues caused by browser-side imports of `face-api.js` (which attempts to resolve Node's native `fs`, `path`, and `child_process` modules).
* **Webpack fallbacks:** Configured next webpack settings in [next.config.ts](file:///E:/Skills/Webstack/DYHack/ngerti_jules/next.config.ts) to treat these backend libraries as `false` in client-side bundles, resolving compiler failures.

---

## 4. Post-Meeting AI Recaps & Q&A Panel
* **Custom Recaps Chat Interface:** Replaced generic Stream text chat with a custom-built AI Chat UI in [chat-ui.tsx](file:///E:/Skills/Webstack/DYHack/ngerti_jules/src/modules/meetings/ui/components/chat-ui.tsx).
* **Transcript-Aware Q&A:** Added the `askPostMeetingAI` mutation. It fetches and parses the meeting's JSONL transcript and summary, passing it along with the AI Agent's persona to NVIDIA NIM so students can ask questions about what happened in the meeting.
* **Premium Theme Alignment:** Integrated Markdown parsing (`react-markdown`), visual loaders ("Typing..."), initial greeting prompts, custom Dicebear avatars, and auto-scroll behaviors.

---

## 5. Local Stream Fallbacks (Recordings/Transcripts)
* **Webhook Bypass:** Created fallback queries inside `getOne` and `getTranscript` procedures in [procedures.ts](file:///E:/Skills/Webstack/DYHack/ngerti_jules/src/modules/meetings/server/procedures.ts). 
* **API Retrieval:** If webhook triggers are blocked in local environments (no active Cloudflare Tunnel), the server calls `listRecordings` and `listTranscriptions` directly on Stream's Node SDK when the user loads the recap page.
* **Automated Processing Trigger:** Once found, it updates the database status to `"completed"`, saves the URL file references, and triggers the Inngest background function to generate quizzes, summaries, and learning paths.

---

## 6. Performance & UX Polish
* **Excalidraw Rendering Optimization:** Added a `500ms` debounce handler to Excalidraw's `onChange` event in [call-ui.tsx](file:///E:/Skills/Webstack/DYHack/ngerti_jules/src/modules/call/ui/components/call-ui.tsx) to prevent heavy serialization from blocking the React thread.
* **On-Demand Emotion Detection:** Hooked up emotion detection models to initialize and run only when the webcam is active.
* **Auth Redirects:** Added path forwarding to sign-in views so logged-out guest participants are automatically redirected back to their active meeting upon signing in.
* **UI Loaders:** Inserted dynamic spinners into meeting and agent creation forms.
