import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { VoiceQuestion, TranscriptSegment } from "@/lib/types";

export const runtime = "nodejs";

const GROQ_GRADE_MODEL = process.env.GROQ_GRADE_MODEL ?? process.env.GROQ_QUIZ_MODEL ?? "llama-3.1-70b-versatile";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

function isVoiceQuestion(question: unknown): question is VoiceQuestion {
  return (
    typeof question === "object" &&
    question !== null &&
    (question as { type?: string }).type === "voice" &&
    typeof (question as { question?: unknown }).question === "string"
  );
}

function formatTranscriptContext(transcriptContext: TranscriptSegment[]): string {
  return transcriptContext
    .map((segment) => `[${segment.start.toFixed(0)}-${segment.end.toFixed(0)}] ${segment.text}`)
    .join("\n");
}

async function gradeVoiceAnswer(params: {
  question: VoiceQuestion;
  spokenAnswer: string;
  transcriptContext: TranscriptSegment[];
}): Promise<{ score: number; feedback: string } | null> {
  const client = getClient();
  const transcriptContextText = formatTranscriptContext(params.transcriptContext);

  const prompt = `You are grading a learner's spoken summary for factual correctness only.

Rules:
- Score only whether the learner accurately summarized the lesson context.
- Ignore tone, pacing, accent, filler words, and grammar unless they make the meaning impossible to understand.
- Be generous about paraphrases.
- Penalize only factual mistakes, missing core ideas, or claims that contradict the transcript context.
- Return valid JSON only.

Question:
${params.question.question}

Expected ideas:
${params.question.expectedAnswer ?? "Summarize the concepts covered so far."}

Transcript context:
${transcriptContextText || "(empty)"}

Learner spoken answer:
${params.spokenAnswer}

Return JSON in this exact shape:
{
  "score": number,  // 0 to 10
  "feedback": string
}`;

  try {
    const response = await client.chat.completions.create({
      model: GROQ_GRADE_MODEL,
      messages: [
        { role: "system", content: "You are a strict but fair factual grader." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 256,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { score?: unknown; feedback?: unknown };
    const score = Number(parsed.score);
    if (!Number.isFinite(score)) return null;

    return {
      score: Math.max(0, Math.min(10, Math.round(score))),
      feedback:
        typeof parsed.feedback === "string" && parsed.feedback.trim()
          ? parsed.feedback.trim()
          : "No feedback returned.",
    };
  } catch (error) {
    console.error("Groq voice grading failed:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: unknown;
      spokenAnswer?: unknown;
      transcriptContext?: unknown;
    };

    if (
      !isVoiceQuestion(body.question) ||
      typeof body.spokenAnswer !== "string" ||
      !Array.isArray(body.transcriptContext)
    ) {
      return NextResponse.json(
        { error: "question, spokenAnswer, and transcriptContext are required" },
        { status: 400 }
      );
    }

    const transcriptContext = body.transcriptContext.filter(
      (segment): segment is TranscriptSegment =>
        typeof segment === "object" &&
        segment !== null &&
        typeof (segment as TranscriptSegment).start === "number" &&
        typeof (segment as TranscriptSegment).end === "number" &&
        typeof (segment as TranscriptSegment).text === "string"
    );

    const result = await gradeVoiceAnswer({
      question: body.question,
      spokenAnswer: body.spokenAnswer.trim(),
      transcriptContext,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Voice grading failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("grade-voice error:", error);
    return NextResponse.json(
      { error: "Failed to grade voice answer" },
      { status: 500 }
    );
  }
}
