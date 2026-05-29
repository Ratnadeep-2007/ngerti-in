import { db } from "./src/db";
import { sql } from "drizzle-orm";

async function verify() {
  try {
    const result = await db.execute(sql`
      SELECT atttypmod 
      FROM pg_attribute 
      WHERE attrelid = 'knowledge_base'::regclass 
      AND attname = 'embedding';
    `);
    
    // For pgvector, atttypmod is (dimension) + 4 (if I recall correctly, but let's see the raw value)
    // Actually, we can just check the data type string if possible
    const typeResult = await db.execute(sql`
      SELECT format_type(atttypid, atttypmod) 
      FROM pg_attribute 
      WHERE attrelid = 'knowledge_base'::regclass 
      AND attname = 'embedding';
    `);
    
    console.log("Embedding type:", typeResult.rows[0]);
  } catch (error) {
    console.error("Verification failed:", error);
  } finally {
    process.exit();
  }
}

verify();
