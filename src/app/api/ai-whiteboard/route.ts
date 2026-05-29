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
  const { elements, appState, meetingId, imageBase64 } = await req.json();

  // 1. Ekstrak elemen text dari Excalidraw scene
  const texts = elements
    .filter((el: ExcalidrawElement) => el.type === "text" && el.text && el.text.trim())
    .map((el: ExcalidrawElement) => el.text);

  // 2. (Opsional) OCR jika perlu, tambahkan di sini
  let ocrText = "";
  if (imageBase64) {
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
    } catch (err) {
      console.error("Vision API Error:", err);
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
  console.log(
    texts.length
      ? "Texts found on whiteboard:"
      : "No texts found on whiteboard."
  );
  console.log("Whiteboard Summary:", whiteboardSummary);
  // 4. Query DB untuk agent dan meeting
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId));
  if (!meeting) {
    return NextResponse.json(
      { error: "Meeting tidak ditemukan" },
      { status: 404 }
    );
  }

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, meeting.agentId));
  if (!agent) {
    return NextResponse.json(
      { error: "AI Agent tidak ditemukan" },
      { status: 404 }
    );
  }

  // 4.5 Search Knowledge Base (RAG)
  const kbResults = await queryKnowledgeBase(
    agent.id,
    meeting.userId,
    whiteboardSummary,
  );

  const kbContext = kbResults.length > 0 
    ? "\n\n[TEXTBOOK KNOWLEDGE BASE]\n" + kbResults.map(r => `From ${r.filename}: ${r.content}`).join("\n---\n")
    : "";

  // 5. Generate AI response (OpenAI)
  const updatedPrompt = `
[WHITEBOARD CONTEXT - LIVE UPDATE]
${whiteboardSummary}${kbContext}

Note: The above whiteboard content and textbook excerpts are the latest information shared. Use this context to better understand the current discussion and provide more relevant, accurate responses based on the student's materials.
`;

  await db
    .update(meetings)
    .set({
      currentPrompt: updatedPrompt,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));

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
    }
  } catch (err) {
    console.error("Failed to suggest YT videos:", err);
  }

  return new NextResponse(null, { status: 204 });
}
