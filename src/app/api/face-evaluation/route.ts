import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { FaceTrackingGroqEvaluation, FocusEvaluation } from "@/lib/types";

export const runtime = "nodejs";

const GROQ_FACE_MODEL = process.env.GROQ_FACE_MODEL ?? process.env.GROQ_RECAP_MODEL ?? "llama-3.1-8b-instant";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return normalized.length ? normalized.slice(0, 4) : fallback;
}

function buildFallbackEvaluation(focusEvaluation: FocusEvaluation): FaceTrackingGroqEvaluation {
  const samples = focusEvaluation.sampleCount;
  const presence = clampPercent(focusEvaluation.facePresenceRatio * 100);
  const focus = clampPercent(focusEvaluation.focusScore);
  const calmness = clampPercent(focusEvaluation.calmnessScore);
  const posture = clampPercent(focusEvaluation.postureScore);

  return {
    headline:
      focusEvaluation.permission === "granted" && samples > 0
        ? "Face tracking captured a usable session"
        : "No usable camera data was captured",
    summaryMarkdown:
      focusEvaluation.permission === "granted" && samples > 0
        ? `The tracker recorded ${samples} samples with about ${presence}% face presence. Focus was ${focus}%, calmness was ${calmness}%, and posture stability was ${posture}%.`
        : "Camera access was unavailable or denied, so no face-tracking evidence could be collected for this session.",
    strengths:
      focusEvaluation.permission === "granted" && samples > 0
        ? ["Camera permission was granted.", `Recorded ${samples} face-tracking samples.`, `Session kept a ${presence}% face presence ratio.`]
        : ["The app handled the missing camera session cleanly."],
    concerns:
      focusEvaluation.permission === "granted" && samples > 0
        ? [
            focus < 60 ? "Focus score was below a strong tracking threshold." : "Focus score stayed reasonably steady.",
            calmness < 60 ? "The tracker saw noticeable movement or fidgeting." : "Movement stayed relatively stable.",
          ]
        : ["No movement analysis is available without a camera feed."],
    suggestions:
      focusEvaluation.permission === "granted" && samples > 0
        ? [
            "Keep the face centered in the webcam frame for cleaner analysis.",
            "Use better lighting to improve landmark stability.",
            "Stay still during explanations so the tracker can distinguish real attention from camera noise.",
          ]
        : [
            "Grant camera permission before the next learning session.",
            "If the browser blocks the camera, check system privacy settings and reload the page.",
          ],
  };
}

function normalizeResponse(record: Record<string, unknown>, fallback: FaceTrackingGroqEvaluation): FaceTrackingGroqEvaluation {
  return {
    headline:
      typeof record.headline === "string" && record.headline.trim()
        ? record.headline.trim()
        : fallback.headline,
    summaryMarkdown:
      typeof record.summaryMarkdown === "string" && record.summaryMarkdown.trim()
        ? record.summaryMarkdown.trim()
        : fallback.summaryMarkdown,
    strengths: toStringArray(record.strengths, fallback.strengths),
    concerns: toStringArray(record.concerns, fallback.concerns),
    suggestions: toStringArray(record.suggestions, fallback.suggestions),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      videoTitle?: unknown;
      userName?: unknown;
      focusEvaluation?: unknown;
      mode?: unknown;
    };

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
    }

    if (
      typeof body.focusEvaluation !== "object" ||
      body.focusEvaluation === null ||
      typeof (body.focusEvaluation as FocusEvaluation).sampleCount !== "number"
    ) {
      return NextResponse.json({ error: "focusEvaluation is required" }, { status: 400 });
    }

    const focusEvaluation = body.focusEvaluation as FocusEvaluation;
    const fallback = buildFallbackEvaluation(focusEvaluation);

    if (focusEvaluation.permission !== "granted" || focusEvaluation.sampleCount === 0) {
      return NextResponse.json({ groqEvaluation: fallback });
    }

    const client = getClient();
    const response = await client.chat.completions.create({
      model: GROQ_FACE_MODEL,
      temperature: 0.25,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write concise coaching reports for a learning app.

Return ONLY valid JSON with this exact shape:
{
  "headline": "short title",
  "summaryMarkdown": "markdown summary",
  "strengths": ["up to 3 short bullets"],
  "concerns": ["up to 3 short bullets"],
  "suggestions": ["up to 3 short bullets"]
}

Rules:
- Use only the supplied camera metrics.
- Do not claim medical, biometric, or identity insights.
- Be practical, direct, and non-judgmental.
- If face presence is weak, say the session was hard to assess rather than making up certainty.
- Keep the markdown summary to 2 short paragraphs or 3 bullet points max.`,
        },
        {
          role: "user",
          content: `Video title: ${typeof body.videoTitle === "string" ? body.videoTitle : "Unknown video"}
Learner: ${typeof body.userName === "string" ? body.userName : "Unknown learner"}
Mode: ${typeof body.mode === "string" ? body.mode : "unknown"}

Camera metrics:
- Permission: ${focusEvaluation.permission}
- Samples: ${focusEvaluation.sampleCount}
- Face presence ratio: ${focusEvaluation.facePresenceRatio.toFixed(3)}
- Focus score: ${focusEvaluation.focusScore}
- Calmness score: ${focusEvaluation.calmnessScore}
- Posture score: ${focusEvaluation.postureScore}
- Fidgeting variance: ${focusEvaluation.fidgetingVariance.toFixed(4)}
- Gaze wandering ratio: ${focusEvaluation.gazeWanderingRatio.toFixed(3)}
- Body movement variance: ${focusEvaluation.bodyMovementVariance.toFixed(4)}

Write a short human-readable evaluation of how the learner appeared during the session.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ groqEvaluation: fallback });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ groqEvaluation: fallback });
    }

    const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    return NextResponse.json({ groqEvaluation: normalizeResponse(record, fallback) });
  } catch (error) {
    console.error("Face evaluation error:", error);
    return NextResponse.json({ error: "Failed to generate face evaluation" }, { status: 500 });
  }
}
