import { streamVideo } from "@/lib/stream-video";
import JSONL from "jsonl-parse-stringify";
// ❌ Remove this line - causing circular dependency
// import { inngest } from "@/inngest/client";
import { StreamTranscriptItem } from "@/modules/meetings/types";
import { db } from "@/db";
import { user, agents, meetings } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createAgent, openai, TextMessage } from "@inngest/agent-kit";
import { Inngest } from "inngest"; // ✅ Import Inngest directly
// import { real } from "drizzle-orm/gel-core";

// ✅ Create inngest client here instead of importing
const inngest = new Inngest({ 
  id: "ngerti-in",
});

const summarizer = createAgent({
  name: "summarizer",
  system: `
  You are an expert summarizer and educational content creator. Your task is to process a transcript of a study session between a human student and an AI tutor.

  You must generate three things:
  1. A comprehensive summary of the session.
  2. A 3-question quiz (multiple choice) based on the topics covered.
  3. A personalized learning path (next steps).

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
    ]
  }

  For the summary:
  Use markdown. Include ### Overview and ### Notes sections.

  For the quiz:
  Make it challenging but fair based on the transcript.

  For the learning path:
  Suggest 3 specific topics or exercises the student should do next.
`.trim(),
  model: openai({ model: "gpt-4o", apiKey: process.env.OPENAI_API_KEY }),
});

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

    const { output } = await summarizer.run(
      "Process the following transcript and return JSON as requested: " +
        JSON.stringify(transcriptWithSpeakers),
    );

    const result = await step.run("parse-ai-output", async () => {
      const content = (output[0] as TextMessage).content as string;
      // Extract JSON if AI wrapped it in markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : content);
    });

    await step.run("save-results", async () => {
      await db
        .update(meetings)
        .set({
          summary: result.summary,
          quiz: JSON.stringify(result.quiz),
          learningPath: JSON.stringify(result.learningPath),
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
        realtimeClient.on("conversation.updated", (instruction: any) => {
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

            if (latestAgent) {
              // ✅ Only update if prompt has changed
              if (latestAgent.prompt !== previousPrompt) {
                console.log("🔄 Prompt changed, updating session...");
                console.log("📝 New prompt:", latestAgent.prompt.substring(0, 200) + "...");
                
                await realtimeClient.updateSession({
                  instructions: latestAgent.prompt,
                });
                
                previousPrompt = latestAgent.prompt;
                console.log("✅ Session updated with new instructions");
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