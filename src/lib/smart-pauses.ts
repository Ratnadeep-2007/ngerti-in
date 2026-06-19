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
  startTime: number,
  endTime: number,
  difficulty: QuizDifficulty = "medium",
  maxBreakpoints = Number.POSITIVE_INFINITY
): SmartPauseCheckpoint[] {
  if (endTime <= startTime) return [];

  const intervalSeconds = getSmartPauseIntervalSeconds(difficulty);
  const checkpoints: SmartPauseCheckpoint[] = [];

  for (let timestamp = startTime + intervalSeconds; timestamp < endTime; timestamp += intervalSeconds) {
    checkpoints.push({
      timestamp: Math.round(timestamp),
      checkpointMode: pickCheckpointMode(),
    });

    if (checkpoints.length >= maxBreakpoints) {
      return checkpoints;
    }
  }

  if (checkpoints.length === 0) {
    checkpoints.push({
      timestamp: Math.max(startTime + 1, Math.round(startTime + (endTime - startTime) / 2)),
      checkpointMode: pickCheckpointMode(),
    });
  }

  return checkpoints;
}
