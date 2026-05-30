import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  try {
    const res = await sql`SELECT table_schema, column_name FROM information_schema.columns WHERE table_name = 'session';`;
    console.log(res);
  } catch (err) {
    console.error("Error querying db:", err);
  }
}

main();
