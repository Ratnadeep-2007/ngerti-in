import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { transcript, meetingId, agentId } = await req.json();

    if (!transcript || !meetingId || !agentId) {
      return NextResponse.json(
        { error: "Missing required fields: transcript, meetingId, or agentId" },
        { status: 400 },
      );
    }

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId));

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const systemInstruction = `
You are an AI Tutor named ${existingAgent.name}. 
Here are your primary instructions:
${existingAgent.prompt}

Current Meeting Context:
${existingMeeting.currentPrompt || "No additional context."}

IMPORTANT: Keep your responses highly conversational, concise, and natural to be spoken aloud via TTS. Do not use markdown, lists, or complex formatting. Just plain spoken English. Respond directly to what the user just said.
`;

    const model = getGeminiModel("models/gemini-3.5-flash", {
      systemInstruction,
    });

    // Send the user's transcript to Gemini
    const result = await model.generateContent(transcript);
    const text = result.response.text();

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error("Error in agent chat API:", error);
    return NextResponse.json(
      { error: "Failed to generate AI response" },
      { status: 500 },
    );
  }
}
