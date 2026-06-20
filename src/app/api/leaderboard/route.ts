import { NextResponse } from "next/server";
import { store } from "@/lib/server-store";
import { db } from "@/db";
import { leaderboard } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    if (db) {
      // Fetch leaderboard from Postgres database
      const list = await db.select().from(leaderboard);
      return NextResponse.json({
        leaderboard: list,
      });
    }

    // Fallback to in-memory store
    return NextResponse.json({
      leaderboard: store.leaderboard,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, role, score } = body;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const roundedScore = Math.round(score || 0);

    if (db) {
      // Check if entry exists in database
      const existing = await db
        .select()
        .from(leaderboard)
        .where(eq(leaderboard.username, username));

      if (existing.length > 0) {
        // Update scores
        await db
          .update(leaderboard)
          .set({
            dailyScore: roundedScore,
            weeklyScore: Math.max(roundedScore, existing[0].weeklyScore),
          })
          .where(eq(leaderboard.username, username));
      } else {
        // Insert new entry
        await db.insert(leaderboard).values({
          username,
          role: role || "student",
          dailyScore: roundedScore,
          weeklyScore: roundedScore,
          avatar: "🎓",
        });
      }

      const list = await db.select().from(leaderboard);
      return NextResponse.json({ success: true, leaderboard: list });
    }

    // Fallback to in-memory store
    const existingIndex = store.leaderboard.findIndex(
      (entry) => entry.username.toLowerCase() === username.toLowerCase()
    );

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
