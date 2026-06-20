import type { Breakpoint, VoiceQuestion } from "./types";

export const VOICE_SUMMARY_PROMPT =
  "What did you learn so far, explain in your own language";

function buildVoiceQuestion(positionLabel: string): VoiceQuestion {
  return {
    type: "voice",
    question: VOICE_SUMMARY_PROMPT,
    explanation:
      "Summarize the concepts covered so far using only the material from this video segment.",
    expectedAnswer:
      "A clear factual summary of the concepts already covered in the preceding transcript window.",
    keyIdeas: [positionLabel, "summary", "factual recall"],
  };
}

export function buildVoiceSummaryBreakpoints(durationSeconds: number): Breakpoint[] {
  const timestamps = [
    Math.max(1, Math.round(durationSeconds / 3)),
    Math.max(1, Math.round((durationSeconds * 2) / 3)),
    Math.max(1, Math.round(durationSeconds)),
  ];

  return timestamps.map((timestamp, index) => ({
    timestamp,
    topic:
      index === 2
        ? "Voice Summary Check - End"
        : `Voice Summary Check ${index + 1}/3`,
    questions: [buildVoiceQuestion(`${index + 1}/3`)],
    primaryQuestions: [],
    retryQuestions: [],
  }));
}
