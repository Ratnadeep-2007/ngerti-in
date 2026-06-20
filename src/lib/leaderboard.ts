"use client";

export interface LeaderboardEntry {
  username: string;
  role: string;
  dailyScore: number;
  weeklyScore: number;
  avatar: string;
}

const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  { username: "Mei Tanaka", role: "student", dailyScore: 96, weeklyScore: 95, avatar: "🏮" },
  { username: "Alex Rivera", role: "student", dailyScore: 92, weeklyScore: 94, avatar: "🎨" },
  { username: "Taylor Chen", role: "student", dailyScore: 88, weeklyScore: 90, avatar: "⚡" },
  { username: "Jordan Smith", role: "student", dailyScore: 84, weeklyScore: 86, avatar: "🧠" },
  { username: "Sarah Connor", role: "student", dailyScore: 79, weeklyScore: 82, avatar: "💪" },
  { username: "Chris Evans", role: "student", dailyScore: 72, weeklyScore: 75, avatar: "🛡️" },
];

export function getLeaderboardData(currentUser?: { username: string; score: number }): LeaderboardEntry[] {
  if (typeof window === "undefined") return DEFAULT_LEADERBOARD;

  const saved = localStorage.getItem("lumina_leaderboard");
  let list: LeaderboardEntry[] = DEFAULT_LEADERBOARD;

  if (saved) {
    try {
      list = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse leaderboard", e);
    }
  }

  if (currentUser && currentUser.username) {
    const existingIndex = list.findIndex(
      (u) => u.username.toLowerCase() === currentUser.username.toLowerCase()
    );

    const score = Math.round(currentUser.score);

    if (existingIndex !== -1) {
      list[existingIndex].dailyScore = score;
      // Keep weekly score as the max of current score or their existing weekly score
      list[existingIndex].weeklyScore = Math.max(score, list[existingIndex].weeklyScore);
    } else {
      list.push({
        username: currentUser.username,
        role: "student",
        dailyScore: score,
        weeklyScore: score,
        avatar: "🎓",
      });
    }

    localStorage.setItem("lumina_leaderboard", JSON.stringify(list));
  }

  return list;
}
