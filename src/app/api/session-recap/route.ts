import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { QuizPerformanceScore, TranscriptSegment } from "@/lib/types";

const GROQ_RECAP_MODEL = process.env.GROQ_RECAP_MODEL ?? "llama-3.1-8b-instant";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTranscript(transcript: TranscriptSegment[], maxChars = 14000): string {
  const text = transcript
    .map((segment) => `[${formatTime(segment.start)}] ${segment.text}`)
    .join("\n");

  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.floor(maxChars * 0.65))}\n\n[... transcript shortened ...]\n\n${text.slice(-Math.floor(maxChars * 0.35))}`;
}

function formatQuizScores(scores: QuizPerformanceScore[]): string {
  if (!scores.length) return "No checkpoint score details were recorded.";
  return scores
    .map((score) => {
      const pct = Math.round((score.correct / Math.max(1, score.total)) * 100);
      return `- Checkpoint ${score.breakpointIndex + 1}: ${score.topic} (${score.correct}/${score.total}, ${pct}%, ${score.passed ? "passed" : "needs review"})`;
    })
    .join("\n");
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return normalized.length ? normalized.slice(0, 5) : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const { videoTitle, transcript, quizScores } = (await request.json()) as {
      sessionId?: string;
      videoTitle?: string;
      transcript?: TranscriptSegment[];
      quizScores?: QuizPerformanceScore[];
    };

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
    }

    if (!videoTitle || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: "videoTitle and transcript are required" },
        { status: 400 }
      );
    }

    const client = getClient();
    const transcriptText = formatTranscript(transcript);
    const scoreText = formatQuizScores(quizScores ?? []);

    const response = await client.chat.completions.create({
      model: GROQ_RECAP_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.45,
      max_tokens: 1700,
      messages: [
        {
          role: "system",
          content: `You are an expert technical learning tutor for LingoLearn.

Return ONLY valid JSON with this exact shape:
{
  "summaryMarkdown": "markdown string",
  "nextSteps": ["3 concise personalized steps"],
  "recommendedQueries": ["3 concise YouTube search queries"]
}

Summary requirements:
- Use markdown.
- Focus on core technical concepts, definitions, syntax, examples, and likely misconceptions.
- Include code syntax references only when supported by the transcript.

Next step requirements:
- Use quiz scores to identify weak points when scores exist.
- Make each step actionable and project-oriented.

Recommendation query requirements:
- Each query should target related technical YouTube tutorials.
- Include the main topic and skill level where obvious.`,
        },
        {
          role: "user",
          content: `Video title: ${videoTitle}

Checkpoint performance:
${scoreText}

Transcript:
${transcriptText}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Groq returned an empty recap" }, { status: 500 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Groq returned invalid recap JSON" }, { status: 500 });
    }

    const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    const summaryMarkdown =
      typeof record.summaryMarkdown === "string" && record.summaryMarkdown.trim()
        ? record.summaryMarkdown.trim()
        : "## Session Summary\n\nNo summary was generated.";

    return NextResponse.json({
      summaryMarkdown,
      nextSteps: normalizeStringArray(record.nextSteps, [
        "Review the lowest-scoring checkpoint and rewrite the concept in your own words.",
        "Build a small example that applies the main idea from the lesson.",
        "Watch one related tutorial and compare its explanation with this session.",
      ]).slice(0, 3),
      recommendedQueries: normalizeStringArray(record.recommendedQueries, [
        `${videoTitle} tutorial`,
        `${videoTitle} examples`,
        `${videoTitle} project practice`,
      ]).slice(0, 3),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate session recap";
    console.error("Session recap error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
