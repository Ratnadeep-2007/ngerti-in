import { db } from "./src/db";
import { meetings } from "./src/db/schema";
import { desc } from "drizzle-orm";

async function listMeetings() {
  try {
    const allMeetings = await db.select().from(meetings).orderBy(desc(meetings.createdAt)).limit(5);
    console.log("--- Recent Meetings ---");
    allMeetings.forEach(m => {
      console.log(`ID: ${m.id} | Name: ${m.name} | Status: ${m.status} | Has Transcript: ${!!m.transcriptUrl}`);
    });
  } catch (error) {
    console.error("Failed to list meetings:", error);
  }
}

listMeetings();
