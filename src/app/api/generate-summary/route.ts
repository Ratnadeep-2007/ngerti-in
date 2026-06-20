import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { TranscriptSegment } from "@/lib/types";

const GROQ_QUIZ_MODEL = process.env.GROQ_QUIZ_MODEL ?? "llama-3.1-8b-instant";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

export async function POST(req: Request) {
  try {
    const { transcript, title } = (await req.json()) as { transcript: TranscriptSegment[]; title: string };

    if (!transcript || transcript.length === 0) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const chunkText = transcript
      .map((segment) => `[${segment.start}] ${segment.text}`)
      .join("\n")
      .slice(0, 15000); // limit to avoid token overflow

    const client = getClient();
    const prompt = `You are a technical educator. Generate a concise, highly structured Markdown summary of the following video transcript.
Video Title: ${title}

Focus on:
1. Core technical concepts covered.
2. Key definitions.
3. Code syntax references or architecture overviews discussed.
Do not mention the speaker's intro, outro, or promotional content.
Use standard markdown headings, lists, and code blocks.`;

    const response = await client.chat.completions.create({
      model: GROQ_QUIZ_MODEL,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Transcript:\n${chunkText}` },
      ],
      temperature: 0.5,
      max_tokens: 1024,
    });

    const summary = response.choices[0]?.message?.content || "Summary could not be generated.";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Generate summary error:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
