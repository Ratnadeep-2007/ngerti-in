import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const GROQ_QUIZ_MODEL = process.env.GROQ_QUIZ_MODEL ?? "llama-3.1-8b-instant";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

export async function POST(req: Request) {
  try {
    const { messages, summaryContext, transcriptContext } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages provided" }, { status: 400 });
    }

    const client = getClient();
    const systemPrompt = `You are a helpful AI Tutor for LingoLearn. The user has just finished watching a technical video.
Here is the summary of the video:
${summaryContext}

Use the transcript context below if needed, but focus on the user's question:
${transcriptContext.slice(0, 10000)}

Answer their questions accurately, clearly, and concisely. Use code blocks if applicable. If they ask something outside the video's scope, try to help but mention it wasn't covered in the video.`;

    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content }))
    ];

    const response = await client.chat.completions.create({
      model: GROQ_QUIZ_MODEL,
      messages: groqMessages as any,
      temperature: 0.5,
      max_tokens: 1024,
    });

    const reply = response.choices[0]?.message?.content || "I couldn't process that.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Recap chat error:", error);
    return NextResponse.json({ error: "Failed to fetch response" }, { status: 500 });
  }
}
