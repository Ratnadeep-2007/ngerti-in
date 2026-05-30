import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  try {
    const res = await sql`select "id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id" from "session" where "session"."token" = 'Luunv6E0oVBRzy3GK8Eh5gOQTpTGAXYV'`;
    console.log("Query success! Result:", res);
  } catch (err: any) {
    console.error("Query failed!");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    console.error("Full error:", JSON.stringify(err, null, 2));
  }
}

main();
