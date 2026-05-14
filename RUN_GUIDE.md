# Lumina.ai - Project Run Guide

Follow these steps to set up and run the **Lumina.ai** project locally.

## 1. Prerequisites
- **Node.js**: v18 or higher.
- **npm**: v9 or higher.
- **Inngest Dev Server**: Required for background tasks (AI summarization, etc.).

## 2. Environment Setup
Create a `.env` file in the root directory and add the following keys. 
*Note: You can use the values from the existing `.env` or provide your own. For features requiring webhooks (like AI summarization), you may need a public URL via Cloudflare Tunnel.*

```env
# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000" # Use Cloudflare Tunnel URL if testing webhooks

# Database (Neon PostgreSQL)
DATABASE_URL="your_neon_db_url"

# Authentication (Better Auth)
BETTER_AUTH_SECRET="your_secret_here"
BETTER_AUTH_URL="http://localhost:3000"

# OpenAI (For AI Tutor & Vision)
OPENAI_API_KEY="your_openai_api_key"

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
The app will be available at `http://localhost:3000`.

### Terminal 2: Inngest Dev Server
Lumina.ai uses Inngest for AI background tasks (like generating quiz summaries).
```bash
npm run dev:inngest
```
The Inngest UI will be available at `http://localhost:8288`.

### Terminal 3: Cloudflare Tunnel (Optional)
If you need to test features that require a public URL (like webhooks), use Cloudflare Tunnel:
```bash
cloudflared tunnel --url http://localhost:3000
```
Update your `NEXT_PUBLIC_APP_URL` in `.env` with the generated `trycloudflare.com` URL.

## 6. Features to Test
- **Sign In/Up**: Use the authentication flow.
- **Create Meeting**: Create a new session and enter the call.
- **AI Whiteboard**: Use Excalidraw, upload "homework" images, and use "Ask AI".
- **AI Tutor Voice**: Ensure your microphone is enabled to talk to the AI tutor.
- **Post-Meeting Summary**: After leaving a call, Inngest will process the transcript to generate a summary and quiz.

## 7. Troubleshooting
- **tRPC Errors**: If you encounter `useUtils` errors, ensure you are using the `queryClient.fetchQuery` pattern as implemented in the recent fixes.
- **Inngest Functions**: If summaries aren't appearing, check the Inngest Dev Server logs at `http://localhost:8288`.
