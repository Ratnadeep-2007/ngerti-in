import { db } from "./src/db";
import { sql } from "drizzle-orm";

async function check() {
  try {
    const result = await db.execute(sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'meetings'`);
    console.log("Columns in meetings table:", result.rows);
  } catch (error) {
    console.error("Database check failed:", error);
  }
}

check();
