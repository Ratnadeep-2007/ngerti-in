import type { Breakpoint, VoiceQuestion, QuizDifficulty } from "./types";
import { getQuizPlan } from "./quiz-planner";

export const VOICE_SUMMARY_PROMPT =
  "What did you learn so far, explain in your own language";

export function buildVoiceQuestion(positionLabel: string): VoiceQuestion {
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

export function buildVoiceSummaryBreakpoints(
  durationSeconds: number,
  difficulty: QuizDifficulty = "medium"
): Breakpoint[] {
  const plan = getQuizPlan(durationSeconds, difficulty);
  const totalBreakpoints = Math.max(1, plan.maxBreakpoints);
  const timestamps = Array.from({ length: totalBreakpoints }, (_, index) => {
    const position = Math.round(((index + 1) * durationSeconds) / totalBreakpoints);
    return Math.max(1, Math.min(durationSeconds, position));
  });

  const dedupedTimestamps = timestamps.filter((timestamp, index, all) => {
    return index === 0 || timestamp > all[index - 1];
  });

  const breakpointsList: Breakpoint[] = dedupedTimestamps.map((timestamp, index) => ({
    timestamp,
    topic: `Checkpoint ${index + 1}`,
    questions: [], // Empty to trigger JIT generation of MCQs
    primaryQuestions: [],
    retryQuestions: [],
  }));

  // Inject exactly 3 "What have you learnt so far" voice questions
  const total = breakpointsList.length;
  if (total >= 3) {
    const indices = [
      Math.floor(total * 0.33) - 1,
      Math.floor(total * 0.66) - 1,
      total - 1,
    ];
    indices.forEach((idx) => {
      if (idx >= 0 && idx < total) {
        breakpointsList[idx].questions = [buildVoiceQuestion(`Checkpoint ${idx + 1}/${total}`)];
      }
    });
  }

  return breakpointsList;
}
