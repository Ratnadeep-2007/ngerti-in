import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { transcript, meetingId, agentId } = await req.json();

    console.log(
      `[agent/chat] Request received. meetingId=${meetingId ?? "missing"}, agentId=${agentId ?? "missing"}, transcriptChars=${transcript?.trim?.().length ?? 0}`,
    );

    if (!transcript || !meetingId || !agentId) {
      console.warn("[agent/chat] Rejecting request: missing required fields.");
      return NextResponse.json(
        { error: "Missing required fields: transcript, meetingId, or agentId" },
        { status: 400 },
      );
    }

    const [agentResult, meetingResult] = await Promise.all([
      db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId)),
      db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId)),
    ]);

    const existingAgent = agentResult[0];
    if (!existingAgent) {
      console.warn(`[agent/chat] Agent not found. agentId=${agentId}`);
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const existingMeeting = meetingResult[0];
    if (!existingMeeting) {
      console.warn(`[agent/chat] Meeting not found. meetingId=${meetingId}`);
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const systemInstruction = `
You are an AI Tutor named ${existingAgent.name}. 
Here are your primary instructions:
${existingAgent.prompt}

Current Meeting Context:
${existingMeeting.currentPrompt || "No additional context."}

IMPORTANT: Keep your response highly conversational and natural for TTS. Reply in 1 or 2 short sentences unless the student explicitly asks for detail. Do not use markdown, lists, or complex formatting. Just plain spoken English. Respond directly to what the user just said.
`;

    const model = getGeminiModel("models/gemini-3.5-flash", {
      systemInstruction,
    });

    // Send the user's transcript to Gemini
    console.log(
      `[agent/chat] Sending transcript to Gemini. meetingId=${meetingId}, agentName=${existingAgent.name}`,
    );
    const result = await model.generateContent(transcript);
    const text = result.response.text();

    console.log(
      `[agent/chat] Gemini response generated. meetingId=${meetingId}, responseChars=${text.length}`,
    );

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error("Error in agent chat API:", error);
    return NextResponse.json(
      { error: "Failed to generate AI response" },
      { status: 500 },
    );
  }
}
