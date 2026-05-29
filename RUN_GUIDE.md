# Lumina.ai - Project Run Guide

Follow these steps to set up and run the **Lumina.ai** project locally.

## 1. Prerequisites
- **Node.js**: v18 or higher.
- **npm**: v9 or higher.
- **Inngest Dev Server**: Required for background tasks (AI summarization, etc.).
- **Cloudflare (cloudflared)**: Required for HTTPS (camera/mic access) and Stream webhooks.

## 2. Environment Setup
Create a `.env` file in the root directory and add the following keys. 

```env
# App Configuration
# NOTE: Use your public Cloudflare Tunnel URL here for camera/mic and webhooks
NEXT_PUBLIC_APP_URL="https://vocational-hugo-relative-profiles.trycloudflare.com"

# Database (Neon PostgreSQL)
DATABASE_URL="your_neon_db_url"

# Authentication (Better Auth)
BETTER_AUTH_SECRET="your_secret_here"
BETTER_AUTH_URL="https://vocational-hugo-relative-profiles.trycloudflare.com"

# Google Gemini (For AI Tutor, Vision, and Inngest Tasks)
GEMINI_API_KEY="your_gemini_api_key"

# Stream Video & Chat (For Voice/Video Calls)
NEXT_PUBLIC_STREAM_VIDEO_API_KEY="your_api_key"
STREAM_VIDEO_SECRET="your_secret"
NEXT_PUBLIC_STREAM_CHAT_API_KEY="your_api_key"
STREAM_CHAT_SECRET_KEY="your_secret"
```

## 3. Installation
Install the project dependencies:
```bash
npm install
```

## 4. Database Setup
Push the schema to your database using Drizzle:
```bash
npm run db:push
```

## 5. Running the Application

You need to run the following commands in **separate terminals**:

### Terminal 1: Next.js Development Server
```bash
npm run dev
```
The app will be available locally at `http://localhost:3006`.

### Terminal 2: Public Tunnel (Mandatory for Calls)
Since Stream Video SDK requires HTTPS for microphone/camera access and relies on webhooks, you **must** use a public tunnel:
```bash
cloudflared tunnel --url http://localhost:3006
```
1. Copy the resulting `https://*.trycloudflare.com` URL.
2. Update `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` in `.env` with this new URL.
3. **Restart Terminal 1 (Next.js server)**.

### Terminal 3: Inngest Dev Server
Lumina.ai uses Inngest for AI background tasks (like generating quiz summaries).
```bash
npm run dev:inngest
```
The Inngest UI will be available at `http://localhost:8288`.

## 6. Features to Test
- **Sign In/Up**: Use the authentication flow.
- **Create Meeting**: Create a new session and enter the call.
- **AI Whiteboard**: Use Excalidraw, upload "homework" images, and use "Ask AI".
- **AI Tutor Voice**: Ensure your microphone is enabled to talk to the AI tutor.
- **Post-Meeting Summary**: After leaving a call, Inngest will process the transcript to generate a summary and quiz.

## 7. Troubleshooting
- **EADDRINUSE (Port 3006)**: If the server fails to start, kill the existing process:
  - Windows: `taskkill /F /PID <pid>` (find PID with `netstat -ano | findstr :3006`)
- **Hardware Access (Microphone/Camera)**: Most browsers block hardware access on `http://localhost`. Use the HTTPS URL provided by Terminal 2.
- **AI Agent Not Joining**: If using only `localhost`, the AI will **not** join the call because Stream webhooks cannot reach your local machine. Ensure your `NEXT_PUBLIC_APP_URL` in `.env` matches your public tunnel URL.
- **tRPC Errors**: If you encounter `useUtils` errors, ensure you are using the `queryClient.fetchQuery` pattern.
