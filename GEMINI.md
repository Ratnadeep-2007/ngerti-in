# Lumina.ai Project Guidelines

## Architecture & Conventions
- **Framework:** Next.js 15+ (App Router).
- **Styling:** Tailwind CSS 4+ with `oklch` colors.
- **Database:** Neon (Serverless Postgres) with Drizzle ORM.
- **Authentication:** Better-Auth with Google Social Provider and Email/Password.
- **Real-time Video/Audio:** Stream Video SDK.
- **AI/LLM:** Google Generative AI (Gemini) with Inngest for background tasks.

## Critical Workflows

### Font Management
- **Local Fonts Only:** To avoid network/proxy issues with Google Fonts, use `@fontsource` packages or local font files.
- **Inter:** The primary sans-serif font is served via `@fontsource/inter`.

### Development & Tunneling
- **Hardware Access:** Stream SDK requires HTTPS for microphone and camera access.
- **Cloudflare Tunnels:** Use `cloudflared tunnel --url http://localhost:3006` for local development that requires HTTPS or external access.
- **Environment URLs:** When using a tunnel, ensure `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` in `.env` match the tunnel URL to avoid CORS and authentication failures.

### Performance & Resource Management
- **AI Models:** Emotion detection models (Face-API) should only be loaded when needed. Ensure the `useEmotionDetection` hook is disabled by default and only enabled on the active call screen.
- **Cleanup:** Always ensure `StreamCall.leave()` and `StreamVideoClient.disconnectUser()` are called on component unmount to prevent resource leaks and background hardware usage.

## Known Issues & Fixes
- **EADDRINUSE (Port 3006):** If the server fails to start, use `taskkill /F /PID <pid>` to clear zombie Node processes.
- **NotFoundError (Hardware):** Often caused by lack of HTTPS on the development URL or browser permission blocks.
- **CORS / Auth Fetch Failures:** Usually caused by a mismatch between the browser URL and the `NEXT_PUBLIC_APP_URL` in `.env`.
