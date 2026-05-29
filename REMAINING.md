# Project Status: ngerti_jules

## ✅ Done
- **Font Optimization:** Switched from `next/font/google` to `@fontsource/inter` to fix network-related loading errors.
- **Emotion Detection Optimization:** Updated `useEmotionDetection` hook to prevent heavy model loading unless explicitly enabled.
- **Stream SDK Cleanup:** Improved `CallConnect` component to ensure proper cleanup of call objects on unmount.
- **Project Guidelines:** Updated `GEMINI.md` with recent architecture decisions and troubleshooting steps.
- **tRPC Debugging:** Added server-side logging to tRPC context and protected procedures to trace session issues.

## 🚧 In Progress / Issues
- **Sign-in Slowness:** Identifying the bottleneck in Better-Auth/Neon database connection.
- **Hardware Permission Errors:** Browser blocking Stream SDK device access due to lack of HTTPS/Tunneling. (Status: Tunneling guide provided to user).
- **tRPC Unauthorized Errors:** `TRPCClientError: You must be logged in` appearing on initial load.

## 📋 Remaining Tasks
1. **Implement Tunneling (Cloudflare):**
   - Run `cloudflared tunnel --url http://localhost:3006`.
   - Update `.env` with the new Cloudflare `.trycloudflare.com` URL.
   - Update Google OAuth redirect URIs in the Google Cloud Console.
2. **Database Performance:**
   - Check Neon connection pooling settings to reduce "cold start" latency.
3. **Stream Video Validation:**
   - Once HTTPS is active, verify that camera/mic permissions can be granted.
   - Test the proactive emotion detection with the AI tutor.
4. **Final Verification:**
   - Perform a full end-to-end test from Landing -> Sign In -> Dashboard -> Call.
