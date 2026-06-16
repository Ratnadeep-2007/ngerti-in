// src/app/api/ai-whiteboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { streamVideo } from "@/lib/stream-video";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { agents, meetings } from "@/db/schema";
// import { createWorker } from "tesseract.js";
// import { StreamChat } from "stream-chat";
import { streamChat } from "@/lib/stream-chat";
import { queryKnowledgeBase } from "@/modules/agents/knowledge-base/server/query";
import { suggestYouTubeVideos } from "@/lib/youtube";

interface ExcalidrawElement {
  type: string;
  text?: string;
}

export async function POST(req: NextRequest) {
  let requestBody;
  try {
    requestBody = await req.json();
  } catch (parseErr) {
    console.error("[Whiteboard API] Failed to parse request JSON body:", parseErr);
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const { elements = [], appState, meetingId, imageBase64 } = requestBody;
  console.log(`[Whiteboard API] Processing POST request for meetingId: ${meetingId}, elements count: ${elements.length}, snapshot present: ${!!imageBase64}`);

  // 1. Ekstrak elemen text dari Excalidraw scene
  const texts = elements
    .filter((el: ExcalidrawElement) => el.type === "text" && el.text && el.text.trim())
    .map((el: ExcalidrawElement) => el.text);

  // 2. (Opsional) OCR jika perlu, tambahkan di sini
  let ocrText = "";
  if (imageBase64) {
    console.log(`[Whiteboard API] Transcribing whiteboard snapshot for meetingId: ${meetingId}`);
    try {
      const pureBase64 = imageBase64.startsWith("data:")
        ? imageBase64.split(",")[1]
        : imageBase64;

      const model = genAI.getGenerativeModel({ model: "models/gemini-3.5-flash" });
      const result = await model.generateContent([
        "Extract and transcribe all text visible in this whiteboard image. Only return the text content, no explanations:",
        {
          inlineData: {
            data: pureBase64,
            mimeType: "image/png"
          }
        }
      ]);
      ocrText = result.response.text();
      console.log(`[Whiteboard API] OCR transcription successful for meetingId: ${meetingId}`);
    } catch (err) {
      console.error(`[Whiteboard API] Vision OCR API Error for meetingId ${meetingId}:`, err);
      ocrText = "";
    }
  }

  // 3. Generate summary/context untuk AI
  const whiteboardSummary =
    [
      texts.length ? "Direct text from board:\n" + texts.join("\n") : "",
      ocrText ? "OCR results from images/handwriting:\n" + ocrText : "",
    ]
      .filter(Boolean)
      .join("\n\n") || "Whiteboard is empty or contains only drawings.";

  console.log(`[Whiteboard API] Whiteboard context compilation complete. Texts: ${texts.length}, OCR length: ${ocrText.length}`);

  // 4. Query DB untuk agent dan meeting
  let meeting;
  try {
    const results = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));
    meeting = results[0];
  } catch (dbErr) {
    console.error(`[Whiteboard API] Database error fetching meeting with ID ${meetingId}:`, dbErr);
    return NextResponse.json({ error: "Internal database error" }, { status: 500 });
  }

  if (!meeting) {
    console.warn(`[Whiteboard API] Meeting not found: ${meetingId}`);
    return NextResponse.json(
      { error: "Meeting tidak ditemukan" },
      { status: 404 }
    );
  }

  let agent;
  try {
    const results = await db
      .select()
      .from(agents)
      .where(eq(agents.id, meeting.agentId));
    agent = results[0];
  } catch (dbErr) {
    console.error(`[Whiteboard API] Database error fetching agent with ID ${meeting.agentId}:`, dbErr);
    return NextResponse.json({ error: "Internal database error" }, { status: 500 });
  }

  if (!agent) {
    console.warn(`[Whiteboard API] AI Agent not found: ${meeting.agentId} for meeting ${meetingId}`);
    return NextResponse.json(
      { error: "AI Agent tidak ditemukan" },
      { status: 404 }
    );
  }

  // 4.5 Search Knowledge Base (RAG)
  let kbResults: any[] = [];
  try {
    kbResults = await queryKnowledgeBase(
      agent.id,
      meeting.userId,
      whiteboardSummary,
    );
    console.log(`[Whiteboard API] RAG search returned ${kbResults.length} knowledge base matches`);
  } catch (kbErr) {
    console.error(`[Whiteboard API] Knowledge Base query failed for agent ${agent.id}, user ${meeting.userId}:`, kbErr);
  }

  const kbContext = kbResults.length > 0 
    ? "\n\n[TEXTBOOK KNOWLEDGE BASE]\n" + kbResults.map(r => `From ${r.filename}: ${r.content}`).join("\n---\n")
    : "";

  // 5. Generate AI response (OpenAI)
  const updatedPrompt = `
[WHITEBOARD CONTEXT - LIVE UPDATE]
${whiteboardSummary}${kbContext}

Note: The above whiteboard content and textbook excerpts are the latest information shared. Use this context to better understand the current discussion and provide more relevant, accurate responses based on the student's materials.
`;

  const updatePayload: any = {
    currentPrompt: updatedPrompt,
    updatedAt: new Date(),
  };

  if (imageBase64) {
    updatePayload.whiteboardSnapshot = imageBase64;
  }

  try {
    await db
      .update(meetings)
      .set(updatePayload)
      .where(eq(meetings.id, meetingId));
    console.log(`[Whiteboard API] Successfully saved currentPrompt and snapshot to DB for meeting ${meetingId}`);
  } catch (dbUpdateErr) {
    console.error(`[Whiteboard API] Database update failed for meeting ${meetingId}:`, dbUpdateErr);
  }

  // 6. Suggest YouTube Videos (RAG-enhanced context)
  try {
    const videos = await suggestYouTubeVideos(updatedPrompt);
    if (videos.length > 0) {
      await db
        .update(meetings)
        .set({
          suggestedVideos: JSON.stringify(videos),
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, meetingId));
      console.log(`[Whiteboard API] Successfully suggested and saved ${videos.length} YT videos for meeting ${meetingId}`);
    }
  } catch (err) {
    console.error(`[Whiteboard API] Failed to suggest or save YT videos for meeting ${meetingId}:`, err);
  }

  // 7. Generate explanation of whiteboard contents in Tutor's Persona
  let aiExplanationText = "";
  try {
    const explanationPrompt = `
      You are the AI Tutor named ${agent.name}. Your subject is ${agent.subject}.
      Your system instructions/persona are:
      ${agent.prompt}

      The student has just updated the whiteboard. You are provided with the text content and the actual whiteboard image containing their drawings, diagrams, mathematical symbols, or formulas.
      
      Here is the textual whiteboard context:
      ${whiteboardSummary}
      
      Here is the textbook knowledge base context:
      ${kbContext}

      Please analyze the whiteboard image (especially any hand-drawn diagrams, flowcharts, scribbles, or math notation) and the textual context. Explain what you see, and provide a helpful, constructive check-in/explanation regarding the student's sketches.
      
      IMPORTANT: Keep your response short, highly conversational, and suitable for being read aloud via Text-to-Speech (concise sentences, no markdown lists or bullet formatting, maximum 3 sentences).
    `.trim();

    const explanationModel = genAI.getGenerativeModel({ model: "models/gemini-3.5-flash" });
    
    let explanationResult;
    if (imageBase64) {
      const pureBase64 = imageBase64.startsWith("data:")
        ? imageBase64.split(",")[1]
        : imageBase64;
        
      explanationResult = await explanationModel.generateContent([
        explanationPrompt,
        {
          inlineData: {
            data: pureBase64,
            mimeType: "image/png"
          }
        }
      ]);
    } else {
      explanationResult = await explanationModel.generateContent(explanationPrompt);
    }
    
    aiExplanationText = explanationResult.response.text();
  } catch (err) {
    console.error("Failed to generate whiteboard AI explanation:", err);
  }

  return NextResponse.json({
    response: aiExplanationText
  });
}
