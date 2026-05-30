import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof neon> | undefined;
};

const conn = globalForDb.conn ?? neon(process.env.DATABASE_URL!, {
  fetchOptions: {
    cache: "no-store",
  },
});

if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn);
