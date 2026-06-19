import type { QuizDifficulty, QuizFrequency } from "./types";
import { calculateQuizFrequency as calculateQuizFrequencyFromPlan } from "./quiz-planner";

export function calculateQuizFrequency(
  durationSeconds: number,
  difficulty: QuizDifficulty = "medium"
): QuizFrequency {
  return calculateQuizFrequencyFromPlan(durationSeconds, difficulty);
}
