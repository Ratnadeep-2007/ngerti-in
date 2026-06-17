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
    const transcriptUrl = event.data.transcriptUrl || event.data.transcript_url;
    const { meeting_id } = event.data;
    if (!transcriptUrl) {
      console.error(`[Inngest meetingsProcessing] Failed: Missing transcriptUrl for meeting ${meeting_id}`);
      throw new Error("Missing transcript_url");
    }

    // 1. Fetch and parse transcript
    const transcript = await step.run("fetch-and-parse-transcript", async () => {
      console.log(`[Inngest meetingsProcessing] Fetching transcript from ${transcriptUrl} for meeting ${meeting_id}`);
      try {
        let urlToFetch = transcriptUrl;
        let res = await fetch(urlToFetch);
        if (!res.ok) {
          if (res.status === 404) {
            console.warn(`[Inngest meetingsProcessing] Transcript file is permanently gone (404) for meeting ${meeting_id}. Gracefully falling back to empty transcript.`);
            return [];
          }
          console.warn(`[Inngest meetingsProcessing] Fetch failed with status ${res.status}. Attempting to refresh transcript URL from Stream Video.`);
          try {
            const transcriptionsRes = await streamVideo.video.listTranscriptions({ type: "default", id: meeting_id });
            if (transcriptionsRes?.transcriptions && transcriptionsRes.transcriptions.length > 0) {
              const freshUrl = transcriptionsRes.transcriptions[0].url;
              console.log(`[Inngest meetingsProcessing] Found fresh transcript URL. Retrying fetch.`);
              res = await fetch(freshUrl);
              if (!res.ok) {
                if (res.status === 404) {
                  console.warn(`[Inngest meetingsProcessing] Refreshed transcript file is permanently gone (404) for meeting ${meeting_id}. Gracefully falling back to empty transcript.`);
                  return [];
                }
                throw new Error(`Fetch with fresh URL failed with status ${res.status}`);
              }
              
              // Update the database with the fresh URL so we don't use the expired one next time
              await db.update(meetings)
                .set({ transcriptUrl: freshUrl })
                .where(eq(meetings.id, meeting_id));
            } else {
              throw new Error(`Original fetch failed (${res.status}) and no transcription found on Stream Video`);
            }
          } catch (refreshErr) {
            console.error(`[Inngest meetingsProcessing] Failed to refresh transcript URL from Stream Video:`, refreshErr);
            throw new Error(`Fetch failed with status ${res.status} and refresh failed: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`);
          }
        }
        const text = await res.text();
        const parsed = JSONL.parse<StreamTranscriptItem>(text);
        console.log(`[Inngest meetingsProcessing] Successfully parsed ${parsed.length} transcript lines`);
        return parsed;
      } catch (err) {
        console.error(`[Inngest meetingsProcessing] Failed to fetch or parse transcript from URL ${transcriptUrl}:`, err);
        throw err;
      }
    });

    // 2. Identify speakers
    const speakers = await step.run("get-relevant-speakers", async () => {
      console.log(`[Inngest meetingsProcessing] Fetching meeting, user, and agent details for meeting ${meeting_id}`);
      try {
        const [meetingData] = await db
          .select()
          .from(meetings)
          .where(eq(meetings.id, meeting_id))
          .limit(1);

        if (!meetingData) {
          throw new Error(`Meeting not found: ${meeting_id}`);
        }

        const [users, agentsList] = await Promise.all([
          db.select().from(user).where(eq(user.id, meetingData.userId)),
          db.select().from(agents).where(eq(agents.id, meetingData.agentId)),
        ]);
        console.log(`[Inngest meetingsProcessing] Found ${users.length} users and ${agentsList.length} agents matching the session`);
        return { users, agents: agentsList };
      } catch (err) {
        console.error(`[Inngest meetingsProcessing] Database fetch failure in get-relevant-speakers for meeting ${meeting_id}:`, err);
        throw err;
      }
    });

    // ✅ Map speakers to transcript
    const transcriptWithSpeakers = transcript.map((item) => {
      const speaker = [...speakers.users, ...speakers.agents].find(s => s.id === item.speaker_id);
      return { ...item, user: { name: speaker ? speaker.name : "Unknown" } };
    });

    // Check if there is any text content in the transcript
    const hasContent = transcriptWithSpeakers.some(t => t.text && t.text.trim().length > 0);

    if (!hasContent) {
      console.warn(`[Inngest meetingsProcessing] Transcript contains no spoken text content for meeting ${meeting_id}. Skipping summary.`);
      await step.run("save-final-results", async () => {
        try {
          await db.update(meetings)
            .set({
              summary: "No content available from meeting",
              quiz: JSON.stringify([]),
              learningPath: JSON.stringify([]),
              suggestedVideos: JSON.stringify([]),
              topics: JSON.stringify([]),
              status: "completed",
            })
            .where(eq(meetings.id, meeting_id));
        } catch (saveErr) {
          console.error(`[Inngest meetingsProcessing] Failed to save fallback empty results to DB for meeting ${meeting_id}:`, saveErr);
          throw saveErr;
        }
      });
      return;
    }

    // 3 & 4. Generate summary and YouTube suggestions in parallel
    let aiOutput: any;
    let youtubeVideos: any;
    try {
      console.log(`[Inngest meetingsProcessing] Invoking Gemini and YouTube suggestions in parallel for meeting ${meeting_id}`);
      const [aiOutputRes, youtubeVideosRes] = await Promise.all([
        step.run("generate-gemini-summary", async () => {
          try {
            const model = getGeminiModel("models/gemini-3.5-flash", { responseMimeType: "application/json" });
            const prompt = `System: ${summarizerSystemPrompt}\n\nUser: Process the following transcript and return JSON: ${JSON.stringify(transcriptWithSpeakers)}`;
            const result = await model.generateContent(prompt);
            const textResponse = result.response.text();
            if (!textResponse) throw new Error("Gemini response is empty");
            const data = JSON.parse(textResponse);
            if (!data.summary || data.summary.trim().length === 0) {
              data.summary = "No content available from meeting";
            }
            return summarizerOutputSchema.parse(data);
          } catch (geminiErr) {
            console.error(`[Inngest meetingsProcessing] generate-gemini-summary step failed:`, geminiErr);
            throw geminiErr;
          }
        }),
        step.run("fetch-youtube-recommendations", async () => {
          try {
            return await suggestYouTubeVideos(transcriptWithSpeakers.slice(0, 5).map(t => t.text).join(" "));
          } catch (ytErr) {
            console.error(`[Inngest meetingsProcessing] fetch-youtube-recommendations step failed:`, ytErr);
            return [];
          }
        }),
      ]);
      aiOutput = aiOutputRes;
      youtubeVideos = youtubeVideosRes;
    } catch (parallelErr) {
      console.error(`[Inngest meetingsProcessing] Concurrency steps failed:`, parallelErr);
      throw parallelErr;
    }

    // ✅ Final Save
    await step.run("save-final-results", async () => {
      console.log(`[Inngest meetingsProcessing] Saving final summarized results to database for meeting ${meeting_id}`);
      try {
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
        console.log(`[Inngest meetingsProcessing] Successfully processed and marked meeting ${meeting_id} as completed`);
      } catch (saveErr) {
        console.error(`[Inngest meetingsProcessing] Failed to save final processing results to DB for meeting ${meeting_id}:`, saveErr);
        throw saveErr;
      }
    });
  },
);

// Add this at the top of functions.ts or here to track active polling
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
        console.log("🛠️ [INNGEST] Upserting agent in Stream:", agent.id);
        // Ensure agent is upserted in Stream Video
        await streamVideo.upsertUsers([
          {
            id: agent.id,
            name: agent.name,
            role: "admin",
            image: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${agent.name}`,
          },
        ]);

        console.log("🛠️ [INNGEST] Connecting OpenAI to call:", meetingId);
        const call = streamVideo.video.call("default", meetingId);
        
        try {
          const realtimeClient = await streamVideo.video.connectOpenAi({
            call,
            openAiApiKey: process.env.OPENAI_API_KEY!,
            agentUserId: agent.id,
          });

          console.log("✅ [INNGEST] Agent connected to call successfully:", agent.id);

          // ✅ Set up event listener ONCE outside the loop
          realtimeClient.on("conversation.updated", (instruction: unknown) => {
            console.log(`📡 [INNGEST] received conversation.updated`, instruction);
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
                  console.log("🔄 [INNGEST] Prompt changed, updating session...");
                  
                  await realtimeClient.updateSession({
                    instructions: combinedPrompt,
                  });
                  
                  previousPrompt = combinedPrompt;
                  console.log("✅ [INNGEST] Session updated with new combined instructions");
                }
              }

              // Wait 1 second before next check
              await new Promise(resolve => setTimeout(resolve, 1000));
              
            } catch (updateError) {
              console.error("❌ [INNGEST] Update error:", updateError);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (connError) {
          console.error("❌ [INNGEST] Failed to connect OpenAI to Stream:", connError);
          throw connError;
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