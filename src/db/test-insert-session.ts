import 'dotenv/config';
import { db } from '../db';
import { session } from '../db/schema';
import { nanoid } from 'nanoid';

async function main() {
  console.log("Inserting test session...");
  try {
    const newSession = {
      id: nanoid(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      token: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'ngCHwRBEeDxurQc6ysa9cou5inUKhwIj', // admin user id
    };
    
    const result = await db.insert(session).values(newSession).returning();
    console.log("Insert success! Result:", result);
    
    // Clean up
    await db.delete(session).where(eq(session.id, newSession.id));
    console.log("Cleaned up session.");
  } catch (err: any) {
    console.error("Insert failed!");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
  }
}

// Helper to simulate eq since we didn't import eq
import { eq } from 'drizzle-orm';

main();
