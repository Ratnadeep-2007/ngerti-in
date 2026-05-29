import { db } from "./src/db";
import { meetings } from "./src/db/schema";
import { eq, desc } from "drizzle-orm";
import { Inngest } from "inngest";

const inngest = new Inngest({ id: "lumina-ai" });

async function simulate() {
  try {
    // 1. Get latest meeting
    const [latest] = await db.select().from(meetings).orderBy(desc(meetings.createdAt)).limit(1);
    
    if (!latest) {
      console.log("❌ No meetings found.");
      return;
    }

    console.log(`🚀 Simulating for meeting: ${latest.name} (${latest.id})`);

    // 2. Add dummy transcript URL (pointing to a sample JSONL if you have one, or just a mock)
    // We'll use a public sample transcript for testing
    const sampleTranscript = "https://gist.githubusercontent.com/ariefrizky/6e88e8c8f0e5c9f5f0b5f1f5f0b5f1f5/raw/sample_transcript.jsonl";

    await db.update(meetings)
      .set({ 
        status: "processing",
        transcriptUrl: sampleTranscript
      })
      .where(eq(meetings.id, latest.id));

    console.log("✅ Status updated to 'processing'.");

    // 3. Manually trigger Inngest event
    // Note: You must have 'npm run dev:inngest' running!
    await fetch("http://localhost:8288/e/meetings/processing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "meetings/processing",
        data: {
          meeting_id: latest.id,
          transcript_url: sampleTranscript
        }
      })
    });

    console.log("📡 Inngest event sent! Check http://localhost:8288 for progress.");
    console.log("🔄 Refresh your dashboard in 10 seconds to see the summary.");

  } catch (error) {
    console.error("❌ Simulation failed:", error);
  }
}

simulate();
