import { NextResponse } from "next/server";
import { store } from "@/lib/server-store";

export async function GET() {
  return NextResponse.json({
    leaderboard: store.leaderboard,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, role, score } = body;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const existingIndex = store.leaderboard.findIndex(
      (entry) => entry.username.toLowerCase() === username.toLowerCase()
    );

    const roundedScore = Math.round(score || 0);

    if (existingIndex !== -1) {
      store.leaderboard[existingIndex].dailyScore = roundedScore;
      store.leaderboard[existingIndex].weeklyScore = Math.max(
        roundedScore,
        store.leaderboard[existingIndex].weeklyScore
      );
    } else {
      store.leaderboard.push({
        username,
        role: role || "student",
        dailyScore: roundedScore,
        weeklyScore: roundedScore,
        avatar: "🎓",
      });
    }

    return NextResponse.json({ success: true, leaderboard: store.leaderboard });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
