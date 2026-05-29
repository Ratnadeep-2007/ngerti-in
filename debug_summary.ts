import "dotenv/config";
import { db } from "./src/db";
import { user, agents, meetings } from "./src/db/schema";
import { eq } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";
import { getGeminiModel } from "./src/lib/gemini";
import { suggestYouTubeVideos } from "./src/lib/youtube";
import { z } from "zod";
import fs from "fs";

const summarizerOutputSchema = z.object({
  summary: z.string(),
  quiz: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctAnswer: z.coerce.number().min(0).max(3),
  })).default([]),
  learningPath: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).default([]),
  topics: z.array(z.string()).default([]),
});

const summarizerSystemPrompt = `
  You are an expert summarizer and educational content creator. Your task is to process a transcript of a study session between a human student and an AI tutor.

  You must generate four things:
  1. A comprehensive summary of the session.
  2. A 3-question quiz (multiple choice) based on the topics covered.
  3. A personalized learning path (next steps).
  4. A list of core educational topics/concepts covered.

  Response Format:
  You MUST respond in valid JSON format with the following structure:
  {
    "summary": "Markdown string here",
    "quiz": [
      {
        "question": "string",
        "options": ["a", "b", "c", "d"],
        "correctAnswer": "index of correct option (0-3)"
      }
    ],
    "learningPath": [
      {
        "title": "string",
        "description": "string"
      }
    ],
    "topics": ["string", "string"]
  }
`.trim();

async function debug() {
  const meeting_id = "XjV2Pjs-rUMYmH_ozBEoI";
  const transcriptPath = "./sample_transcript.jsonl";

  try {
    console.log("1. Reading local transcript...");
    const text = fs.readFileSync(transcriptPath, "utf-8");
    const transcript = JSONL.parse(text);
    console.log("✅ Transcript parsed. Count:", transcript.length);

    console.log("2. Fetching speakers...");
    const [meetingData] = await db.select().from(meetings).where(eq(meetings.id, meeting_id)).limit(1);
    const users = await db.select().from(user).where(eq(user.id, meetingData.userId));
    const agentsList = await db.select().from(agents).where(eq(agents.id, meetingData.agentId));
    console.log("✅ Speakers fetched.");

    const transcriptWithSpeakers = transcript.map((item: any) => {
      const speaker = [...users, ...agentsList].find(s => s.id === item.speaker_id);
      return { ...item, user: { name: speaker ? speaker.name : "Unknown" } };
    });

    console.log("3. Generating Gemini summary...");
    const model = getGeminiModel("gemini-3.5-flash", { responseMimeType: "application/json" });
    const prompt = `System: ${summarizerSystemPrompt}\n\nUser: Process the following transcript and return JSON: ${JSON.stringify(transcriptWithSpeakers)}`;
    const result = await model.generateContent(prompt);
    const content = result.response.text();
    
    // Safer JSON extraction
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const aiOutput = summarizerOutputSchema.parse(JSON.parse(jsonMatch ? jsonMatch[0] : content));
    console.log("✅ AI summary generated.");

    console.log("4. Fetching YouTube...");
    const youtubeVideos = await suggestYouTubeVideos(aiOutput.summary);
    console.log("✅ YouTube videos fetched.");

    console.log("5. Saving results...");
    await db.update(meetings)
      .set({
        summary: aiOutput.summary,
        quiz: JSON.stringify(aiOutput.quiz),
        learningPath: JSON.stringify(aiOutput.learningPath),
        suggestedVideos: JSON.stringify(youtubeVideos),
        topics: JSON.stringify(aiOutput.topics || []),
        status: "completed",
      })
      .where(eq(meetings.id, meeting_id));
    console.log("✅ FINISHED!");

  } catch (err) {
    console.error("❌ DEBUG FAILED:", err);
  }
}

debug();
