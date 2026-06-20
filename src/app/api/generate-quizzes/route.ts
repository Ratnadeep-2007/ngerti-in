import { NextRequest, NextResponse } from "next/server";
import { generateBreakpointFromWindow, generateSingleBreakpoint } from "@/lib/groq";
import { TranscriptSegment, QuizDifficulty } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { transcript, maxBreakpoints, questionsPerBreakpoint, startTime, endTime, aiWindowEndSec, difficulty, videoTitle } =
      (await request.json()) as {
        transcript: TranscriptSegment[];
        maxBreakpoints: number;
        questionsPerBreakpoint: number;
        startTime?: number;
        endTime?: number;
        aiWindowEndSec?: number;
        difficulty?: QuizDifficulty;
        videoTitle?: string;
      };

    if (!transcript || !maxBreakpoints || !questionsPerBreakpoint) {
      return NextResponse.json(
        { error: "transcript, maxBreakpoints, and questionsPerBreakpoint are required" },
        { status: 400 }
      );
    }

    if (startTime !== undefined && endTime !== undefined && startTime !== endTime) {
      const bp = await generateSingleBreakpoint(
        transcript,
        startTime,
        endTime,
        questionsPerBreakpoint,
        difficulty ?? "medium",
        videoTitle ?? "Learning Video"
      );
      return NextResponse.json({ breakpoints: bp ? [bp] : [] });
    }

    const finalQuiz = await generateBreakpointFromWindow(
      transcript,
      transcript.reduce((max, segment) => Math.max(max, segment.end), 0),
      questionsPerBreakpoint,
      difficulty ?? "medium",
      videoTitle ?? "Learning Video"
    );

    return NextResponse.json({ breakpoints: finalQuiz ? [finalQuiz] : [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate quizzes";
    console.error("Generate quizzes error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
