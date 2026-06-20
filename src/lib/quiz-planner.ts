import { QuizDifficulty, QuizFrequency } from "./types";

type DifficultyPlan = {
  intervalMinutes: number;
  questionsPerBreakpoint: number;
  initialWindowMinutes: number;
  prefetchWindowMinutes: number;
};

const DIFFICULTY_PLANS: Record<QuizDifficulty, DifficultyPlan> = {
  easy: {
    intervalMinutes: 10,
    questionsPerBreakpoint: 1,
    initialWindowMinutes: 60,
    prefetchWindowMinutes: 20,
  },
  medium: {
    intervalMinutes: 5,
    questionsPerBreakpoint: 2,
    initialWindowMinutes: 45,
    prefetchWindowMinutes: 15,
  },
  hard: {
    intervalMinutes: 60 / 23, // Exactly 23 checkpoints in 60 minutes
    questionsPerBreakpoint: 3,
    initialWindowMinutes: 30,
    prefetchWindowMinutes: 10,
  },
};

export function getQuizPlan(
  durationSeconds: number,
  difficulty: QuizDifficulty = "medium"
): QuizFrequency & {
  difficulty: QuizDifficulty;
  intervalMinutes: number;
  initialWindowSeconds: number;
  prefetchWindowSeconds: number;
} {
  const plan = DIFFICULTY_PLANS[difficulty];
  const minutes = durationSeconds / 60;

  return {
    difficulty,
    maxBreakpoints: Math.max(1, Math.ceil(minutes / plan.intervalMinutes)),
    questionsPerBreakpoint: plan.questionsPerBreakpoint,
    intervalMinutes: plan.intervalMinutes,
    initialWindowSeconds: Math.min(durationSeconds, plan.initialWindowMinutes * 60),
    prefetchWindowSeconds: Math.min(durationSeconds, plan.prefetchWindowMinutes * 60),
  };
}

export function calculateQuizFrequency(
  durationSeconds: number,
  difficulty: QuizDifficulty = "medium"
): QuizFrequency {
  const plan = getQuizPlan(durationSeconds, difficulty);
  return {
    maxBreakpoints: plan.maxBreakpoints,
    questionsPerBreakpoint: plan.questionsPerBreakpoint,
  };
}
