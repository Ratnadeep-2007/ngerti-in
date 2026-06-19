import type { QuizDifficulty } from "./types";

export type CheckpointMode = "sandbox" | "reverse";

export interface SmartPauseCheckpoint {
  timestamp: number;
  checkpointMode: CheckpointMode;
}

const SMART_PAUSE_INTERVALS: Record<QuizDifficulty, number> = {
  easy: 10 * 60,
  medium: 5 * 60,
  hard: 3 * 60,
};

export function getSmartPauseIntervalSeconds(difficulty: QuizDifficulty = "medium"): number {
  return SMART_PAUSE_INTERVALS[difficulty];
}

export function pickCheckpointMode(): CheckpointMode {
  return Math.random() < 0.5 ? "sandbox" : "reverse";
}

export function buildSmartPauseSchedule(
  duration: number,
  difficulty: QuizDifficulty = "medium",
  maxBreakpoints = Number.POSITIVE_INFINITY
): SmartPauseCheckpoint[] {
  const firstCheckpoint = 10 * 60; // First checkpoint ALWAYS at 10:00
  if (duration <= firstCheckpoint) return [];

  const intervalSeconds = getSmartPauseIntervalSeconds(difficulty);
  const checkpoints: SmartPauseCheckpoint[] = [];

  for (let timestamp = firstCheckpoint; timestamp < duration; timestamp += intervalSeconds) {
    checkpoints.push({
      timestamp: Math.round(timestamp),
      checkpointMode: pickCheckpointMode(),
    });

    if (checkpoints.length >= maxBreakpoints) {
      return checkpoints;
    }
  }

  return checkpoints;
}
