import { streamVideo } from "@/lib/stream-video";
import JSONL from "jsonl-parse-stringify";
// ❌ Remove this line - causing circular dependency
// import { inngest } from "@/inngest/client";
import { StreamTranscriptItem } from "@/modules/meetings/types";
import { db } from "@/db";
import { user, agents, meetings } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { Inngest } from "inngest"; // ✅ Import Inngest directly
import { suggestYouTubeVideos } from "@/lib/youtube";
import { z } from "zod";
import { getGeminiModel } from "@/lib/gemini";

// ✅ Define schema for summarizer output validation
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

// ✅ Create inngest client here instead of importing
const inngest = new Inngest({ 
  id: "lumina-ai",
});

const summarizerSystemPrompt = `
  You are an expert summarizer and educational content creator. Your task is to process a transcript of a study session between a human student and an AI tutor.

  You must generate four things:
  1. A comprehensive summary of the session.
  2. A 3-question quiz (multiple choice) based on the topics covered.
  3. A personalized learning path (next steps).
  4. A list of core educational topics/concepts covered (e.g., ["Quadratic Equations", "Photosynthesis"]).

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

  For the summary:
  Use markdown. Include ### Overview and ### Notes sections.

  For the quiz:
  Make it challenging but fair based on the transcript.

  For the learning path:
  Suggest 3 specific topics or exercises the student should do next.
`.trim();

const meetingsProcessing = inngest.createFunction(
  { id: "meetings/processing", triggers: [{ event: "meetings/processing" }] },
  async ({ event, step }) => {
    const transcriptUrl = event.data.transcript_url;
    if (!transcriptUrl) {
      throw new Error("Missing transcript_url in event data");
    }
    console.log(transcriptUrl);

    const response = await step.run("fetch-transcript", async () => {
      return fetch(transcriptUrl).then((res) => res.text());
    });

    const transcript = await step.run("parse-transcript", async () => {
      return JSONL.parse<StreamTranscriptItem>(response);
    });

    const transcriptWithSpeakers = await step.run("add-speakers", async () => {
      const speakerIds = Array.from(
        new Set(transcript.map((item) => item.speaker_id)),
      );
      const userSpeakers = await db
        .select()
        .from(user)
        .where(inArray(user.id, speakerIds))
        .then((users) => users.map((user) => ({ ...user })));
      const agentSpeakers = await db
        .select()
        .from(agents)
        .where(inArray(agents.id, speakerIds))
        .then((agents) => agents.map((agent) => ({ ...agent })));

      const speakers = [...userSpeakers, ...agentSpeakers];

      return transcript.map((item) => {
        const speaker = speakers.find(
          (speaker) => speaker.id === item.speaker_id,
        );
        return {
          ...item,
          user: {
            name: speaker ? speaker.name : "Unknown",
          },
        };
      });
    });

    const content = await step.run("generate-summary", async () => {
      const model = getGeminiModel("gemini-1.5-flash");
      const prompt = `System: ${summarizerSystemPrompt}\n\nUser: Process the following transcript and return JSON as requested: ${JSON.stringify(transcriptWithSpeakers)}`;
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    const result = await step.run("parse-ai-output", async () => {
      // Extract JSON if AI wrapped it in markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const rawData = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      
      // ✅ Validate AI output structure with Zod
      return summarizerOutputSchema.parse(rawData);
    });

    const videos = await step.run("fetch-youtube-videos", async () => {
      return await suggestYouTubeVideos(result.summary);
    });

    await step.run("save-results", async () => {
      await db
        .update(meetings)
        .set({
          summary: result.summary,
          quiz: JSON.stringify(result.quiz),
          learningPath: JSON.stringify(result.learningPath),
          suggestedVideos: JSON.stringify(videos),
          topics: JSON.stringify(result.topics || []),
          status: "completed",
        })
        .where(eq(meetings.id, event.data.meeting_id));
    });
  },
);

// Add this at the top of functions.ts to track active polling
const activePolling = new Set<string>();
const pollAgentPrompt = inngest.createFunction(
  { id: "poll-agent-prompt", triggers: [{ event: "agent/prompt.poll" }] },
  async ({ event, step }) => {
    console.log("🎯 [INNGEST] pollAgentPrompt started with data:", event.data);
    
    const { agentId, meetingId } = event.data;
    const pollingKey = `${meetingId}-${agentId}`;

    // ✅ Prevent multiple polling for same meeting/agent
    if (activePolling.has(pollingKey)) {
      console.log("🛑 Polling already active for:", pollingKey);
      return;
    }

    activePolling.add(pollingKey);

    try {
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId));

      if (!agent) {
        console.error("❌ Agent not found:", agentId);
        activePolling.delete(pollingKey);
        return;
      }

      // ✅ Create connection and loop inside step.run()
      await step.run("connect-and-update-loop", async () => {
        const call = streamVideo.video.call("default", meetingId);
        const realtimeClient = await streamVideo.video.connectOpenAi({
          call,
          openAiApiKey: process.env.OPENAI_API_KEY!,
          agentUserId: agentId,
        });

        console.log("✅ Agent connected to call:", agentId);

        // ✅ Set up event listener ONCE outside the loop
        realtimeClient.on("conversation.updated", (instruction: unknown) => {
          console.log(`📡 received conversation.updated`, instruction);
        });

        // ✅ Wait for connection to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        let previousPrompt = "";

        // ✅ Loop inside step.run() - connection dibuat sekali, update berkali-kali
        while (true) {
          try {
            const [latestAgent] = await db
              .select()
              .from(agents)
              .where(eq(agents.id, agentId));

            const [latestMeeting] = await db
              .select({ currentPrompt: meetings.currentPrompt })
              .from(meetings)
              .where(eq(meetings.id, meetingId));

            if (latestAgent) {
              const combinedPrompt = latestMeeting?.currentPrompt 
                ? `${latestAgent.prompt}\n\n${latestMeeting.currentPrompt}`
                : latestAgent.prompt;

              // ✅ Only update if prompt has changed
              if (combinedPrompt !== previousPrompt) {
                console.log("🔄 Prompt changed, updating session...");
                console.log("📝 New combined prompt:", combinedPrompt.substring(0, 200) + "...");
                
                await realtimeClient.updateSession({
                  instructions: combinedPrompt,
                });
                
                previousPrompt = combinedPrompt;
                console.log("✅ Session updated with new combined instructions");
              } else {
                console.log("⏭️ No prompt change, skipping update");
              }
            }

            // Wait 1 second before next check
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (updateError) {
            console.error("❌ Update error:", updateError);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      });

    } catch (error) {
      console.error("❌ Error in pollAgentPrompt:", error);
    } finally {
      activePolling.delete(pollingKey);
    }
  }
);
export { meetingsProcessing, pollAgentPrompt, inngest };