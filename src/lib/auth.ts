import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 1 day
  },
  database: drizzleAdapter(db, {
    schema,
    provider: "pg",
  }),
});

/**
 * Robust session fetcher for Next.js Server Components and API routes.
 * Gracefully catches synchronous Proxy errors and asynchronous Drizzle errors
 * to prevent Next.js from crashing with red error overlays.
 */
export const getSessionCore = async (headersList: Headers) => {
  try {
    const session = await auth.api.getSession({
      headers: headersList,
    });
    return session;
  } catch (err: any) {
    if (err?.cause) {
      console.warn("⚠️ [Session Fetch Warning] Drizzle Error Cause:", err.cause);
    } else {
      console.warn("⚠️ [Session Fetch Warning] Drizzle Error:", err?.message || err);
    }
    return null;
  }
};
