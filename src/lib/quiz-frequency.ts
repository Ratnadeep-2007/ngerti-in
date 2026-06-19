import { QuizDifficulty, QuizFrequency } from "./types";

const DIFFICULTY_CONFIG: Record<QuizDifficulty, { intervalMinutes: number; questionsPerBreakpoint: number }> = {
  easy: { intervalMinutes: 10, questionsPerBreakpoint: 1 },
  medium: { intervalMinutes: 5, questionsPerBreakpoint: 2 },
  hard: { intervalMinutes: 3, questionsPerBreakpoint: 3 },
};

export function calculateQuizFrequency(
  durationSeconds: number,
  difficulty: QuizDifficulty = "medium"
): QuizFrequency {
  const minutes = durationSeconds / 60;
  const config = DIFFICULTY_CONFIG[difficulty];
  const maxBreakpoints = Math.max(1, Math.floor(minutes / config.intervalMinutes));

  return {
    maxBreakpoints,
    questionsPerBreakpoint: config.questionsPerBreakpoint,
  };
}
