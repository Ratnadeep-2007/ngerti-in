import { db } from "./src/db";
import { sql } from "drizzle-orm";

async function check() {
  try {
    const result = await db.execute(sql`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`);
    console.log("Tables in database:", result);
  } catch (error) {
    console.error("Database check failed:", error);
  }
}

check();
