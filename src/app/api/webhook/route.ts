import {
  CallEndedEvent,
  CallTranscriptionReadyEvent,
  CallSessionParticipantLeftEvent,
  CallRecordingReadyEvent,
  CallSessionStartedEvent,
  MessageNewEvent,
} from "@stream-io/node-sdk";
import { eq, and, not } from "drizzle-orm";
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { inngest } from "@/inngest/client";
import { generatedAvatarUri } from "@/lib/avatar";
import { streamChat } from "@/lib/stream-chat";
import { getGeminiModel } from "@/lib/gemini";

function verifySignatureWithSDK(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
  console.log("📨 Webhook received at", new Date().toISOString());
  const signature = req.headers.get("x-signature");

  if (!signature) {
    console.error("❌ Missing signature in headers");
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 },
    );
  }

  const body = await req.text();
  console.log("📦 Webhook body length:", body.length);

  if (!verifySignatureWithSDK(body, signature)) {
    console.error("❌ Invalid webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log("✅ Signature verified");

  let payload: unknown;

  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch (error) {
    console.error("❌ Failed to parse JSON payload:", error);
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const eventType = (payload as Record<string, unknown>)?.type;
  console.log("🔔 [WEBHOOK] Event type received:", eventType);

  if (eventType === "call.session_started") {
    const event = payload as CallSessionStartedEvent;
    const meetingId = event.call.custom?.meetingId;
    console.log("📞 [WEBHOOK] Call session started! Meeting ID:", meetingId);

    if (!meetingId) {
      console.warn("⚠️ [WEBHOOK] Missing meetingId in event custom data");
      return NextResponse.json(
        { error: "Missing meetingId in call session started event" },
        { status: 400 },
      );
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          not(eq(meetings.status, "completed")),
          not(eq(meetings.status, "cancelled")),
          not(eq(meetings.status, "active")),
          not(eq(meetings.status, "processing")),
        ),
      );

    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Meeting not found or already started" },
        { status: 404 },
      );
    }

    await db
      .update(meetings)
      .set({
        status: "active",
        startedAt: new Date(),
      })
      .where(eq(meetings.id, existingMeeting.id));

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));

    if (!existingAgent) {
      return NextResponse.json(
        { error: "Agent not found for the meeting" },
        { status: 404 },
      );
    }


    // Agent polling is now disabled as we use Deepgram client-side agent
    console.log("✅ Meeting started successfully");
    // const call = streamVideo.video.call("default", meetingId);
    // const realtimeClient = await streamVideo.video.connectOpenAi({
    //   call,
    //   openAiApiKey: process.env.OPENAI_API_KEY!,
    //   agentUserId: existingAgent.id,
    // });

    // const [newAgentPrompt] = await db
    // .select()
    // .from(agents)
    // .where(eq(agents.id, existingMeeting.agentId));

    // realtimeClient.updateSession({
    //   instructions: newAgentPrompt.prompt,
    // });


    // const pollInterval = setInterval(async () => {
    //   try {
    //     const [updatedAgent] = await db
    //       .select()
    //       .from(agents)
    //       .where(eq(agents.id, existingMeeting.agentId));
    
    //     if (updatedAgent) {
    //       realtimeClient.updateSession({
    //         instructions: updatedAgent.prompt,
    //       });
    //       console.log("🔄 Agent prompt updated from database");
    //     }
    //   } catch (error) {
    //     console.error("Error updating agent prompt:", error);
    //   }
    // }, 1000); // Every 1 second
    
    // console.log("existingMeeting", existingMeeting);
    // console.log("existingAgent", existingAgent);
    // console.log("agent name", existingAgent.name);

    // console.log("realtimeClient", realtimeClient);
  } else if (eventType === "call.session_participant_left") {
    const event = payload as CallSessionParticipantLeftEvent;
    const meetingId = event.call_cid.split(":")[1];

    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing meetingId in call session participant left event" },
        { status: 400 },
      );
    }
    
    // We intentionally DO NOT call `await call.end()` here anymore.
    // If the AI agent fails to connect or leaves, the call should remain active for the user!
    console.log(`👤 Participant left meeting ${meetingId}. Call remains active.`);
  } else if (eventType === "call.session_ended") {
    const event = payload as CallEndedEvent;
    const meetingId = event.call.custom?.meetingId;
    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing meetingId in call session ended event" },
        { status: 400 },
      );
    }
    await db
      .update(meetings)
      .set({ status: "processing", endedAt: new Date() })
      .where(and(eq(meetings.id, meetingId), eq(meetings.status, "active")));
  } else if (eventType === "call.transcription_ready") {
    const event = payload as CallTranscriptionReadyEvent;
    const meetingId = event.call_cid.split(":")[1];

    const [updatedMeeting] = await db
      .update(meetings)
      .set({ transcriptUrl: event.call_transcription.url })
      .where(eq(meetings.id, meetingId))
      .returning();

    if (!updatedMeeting) {
      return NextResponse.json(
        { error: "Meeting not found for transcription ready event" },
        { status: 404 },
      );
    }
    console.log(updatedMeeting.transcriptUrl);
    await inngest.send({
      name: "meetings/processing",
      data: {
        meeting_id: updatedMeeting.id,
        transcript_url: updatedMeeting.transcriptUrl,
      },
    });
  } else if (eventType === "call.recording_ready") {
    const event = payload as CallRecordingReadyEvent;
    const meetingId = event.call_cid.split(":")[1];

    await db
      .update(meetings)
      .set({ recordingUrl: event.call_recording.url })
      .where(eq(meetings.id, meetingId))
      .returning();
  } else if (eventType === "message.new") {
    const event = payload as MessageNewEvent;
    const userId = event.user?.id;
    const channelId = event.channel_id;
    const text = event.message?.text;

    if (!userId || !channelId || !text) {
      return NextResponse.json(
        { error: "Missing userId, channelId or text in message event" },
        { status: 400 },
      );
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, channelId));

    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 },
      );
    }

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));

    if (!existingAgent) {
      return NextResponse.json(
        { error: "Agent not found for the meeting" },
        { status: 404 },
      );
    }

    if (userId === existingAgent.id) {
      return NextResponse.json({ status: "ok" });
    }

    // Only respond if the message contains "@ai" (case-insensitive)
    const containsAiTag = text.toLowerCase().includes("@ai");
    if (!containsAiTag) {
      return NextResponse.json({ status: "ok" });
    }

    const cleanText = text.replace(/@ai/gi, "").trim();
    const messageToAI = cleanText !== "" ? cleanText : "Hello";

    let instructions = "";
    if (existingMeeting.status === "completed") {
      const summaryContent = existingMeeting.summary || "No content available from meeting";
      instructions = `
      You are an AI assistant helping the user revisit a recently completed meeting.
      Below is a summary of the meeting, generated from the transcript:
      
      ${summaryContent}
      
      The following are your original instructions from the live meeting assistant. Please continue to follow these behavioral guidelines as you assist the user:
      
      ${existingAgent.prompt}
      
      The user may ask questions about the meeting, request clarifications, or ask for follow-up actions.
      Always base your responses on the meeting summary above.
      
      If the summary is empty ("No content available from meeting") or if you cannot find the relevant content/information from the meeting to answer the user's question, you must reply with exactly: "No content available from meeting".
      
      You also have access to the recent conversation history between you and the user. Use the context of previous messages to provide relevant, coherent, and helpful responses. If the user's question refers to something discussed earlier, make sure to take that into account and maintain continuity in the conversation.
      
      Be concise, helpful, and focus on providing accurate information from the meeting and the ongoing conversation.
      `.trim();
    } else {
      instructions = `
      You are an AI assistant helping the user in a live meeting/learning session.
      Below are your core behavioral guidelines and context for the session:
      
      ${existingAgent.prompt}
      
      Current session context (which may include whiteboard content, OCR of textbooks, etc.):
      ${existingMeeting.currentPrompt || "No additional live context available."}
      
      The user is in a live session and can talk to you or chat with you. Keep your response concise, helpful, and direct.
      `.trim();
    }

    const channelType = event.channel_type || "livestream";
    const channel = streamChat.channel(channelType, channelId);
    await channel.watch();

    const messagesToInclude = (channel.state.messages || [])
      .filter((msg) => msg.id !== event.message?.id) // exclude current message
      .slice(-5); // take last 5 messages

    const history = messagesToInclude
      .filter((msg) => msg.text && msg.text.trim() !== "")
      .map((message) => {
        const role = message.user?.id === existingAgent.id ? "model" : "user";
        let msgText = message.text || "";
        if (role === "user") {
          msgText = msgText.replace(/@ai/gi, "").trim();
        }
        return {
          role,
          parts: [{ text: msgText }],
        };
      });

    const model = getGeminiModel("models/gemini-3.5-flash", {
      systemInstruction: instructions,
    });
    const chat = model.startChat({
      history: history,
    });

    const result = await chat.sendMessage(messageToAI);
    const GPTResponseText = result.response.text();

    if (!GPTResponseText) {
      return NextResponse.json(
        { error: "No response from GPT" },
        { status: 400 },
      );
    }

    const avatarUrl = generatedAvatarUri({
      seed: existingAgent.name,
      variant: "botttsNeutral",
    });

    await streamChat.upsertUser({
      id: existingAgent.id,
      name: existingAgent.name,
      image: avatarUrl,
    });

    await channel.addMembers([existingAgent.id]);

    await channel.sendMessage({
      text: GPTResponseText,
      user: {
        id: existingAgent.id,
        name: existingAgent.name,
        image: avatarUrl,
      },
    });
  }
  return NextResponse.json({ status: "ok" });
}
