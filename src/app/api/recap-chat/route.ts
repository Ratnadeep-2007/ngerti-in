import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { RecapChatMessage, TranscriptSegment } from "@/lib/types";

const GROQ_RECAP_MODEL = process.env.GROQ_RECAP_MODEL ?? "llama-3.1-8b-instant";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTranscript(transcript: TranscriptSegment[], maxChars = 12000): string {
  const text = transcript
    .map((segment) => `[${formatTime(segment.start)}] ${segment.text}`)
    .join("\n");

  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.floor(maxChars * 0.6))}\n\n[... transcript shortened ...]\n\n${text.slice(-Math.floor(maxChars * 0.4))}`;
}

function toGroqMessages(messages: RecapChatMessage[]) {
  return messages.slice(-10).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const { videoTitle, transcript, summaryMarkdown, messages } = (await request.json()) as {
      videoTitle?: string;
      transcript?: TranscriptSegment[];
      summaryMarkdown?: string;
      messages?: RecapChatMessage[];
    };

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
    }

    if (!videoTitle || !Array.isArray(transcript) || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "videoTitle, transcript, and messages are required" },
        { status: 400 }
      );
    }

    const client = getClient();
    const response = await client.chat.completions.create({
      model: GROQ_RECAP_MODEL,
      temperature: 0.55,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You are the LingoLearn AI Tutor.

Answer follow-up questions using only the provided video transcript and session summary.
If the answer is not supported by the transcript, say what is missing and suggest a useful way to study it.
Keep answers concise, specific, and learner-friendly.

Video title: ${videoTitle}

Session summary:
${summaryMarkdown || "No generated summary yet."}

Transcript:
${formatTranscript(transcript)}`,
        },
        ...toGroqMessages(messages),
      ],
    });

    const message = response.choices[0]?.message?.content?.trim();
    if (!message) {
      return NextResponse.json({ error: "Groq returned an empty chat response" }, { status: 500 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to answer recap chat";
    console.error("Recap chat error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
