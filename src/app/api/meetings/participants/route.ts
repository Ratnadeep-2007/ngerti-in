import { NextRequest, NextResponse } from "next/server";
import { store, type MeetingParticipant } from "@/lib/server-store";

// Helper to clean up participants who haven't sent a heartbeat in the last 8 seconds
function cleanupStaleParticipants() {
  const now = Date.now();
  store.participants = store.participants.filter(
    (p) => now - p.lastSeen <= 8000
  );
}

export async function GET(request: NextRequest) {
  try {
    cleanupStaleParticipants();

    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const list = store.participants.filter((p) => p.meetingId === meetingId);
    return NextResponse.json({ participants: list });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    cleanupStaleParticipants();

    const body = await request.json();
    const { meetingId, username, role, focusScore, isDistracted, action } = body;

    if (!meetingId || !username || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (action === "join") {
      // Remove existing to avoid duplicates
      store.participants = store.participants.filter(
        (p) => !(p.meetingId === meetingId && p.username === username)
      );

      const newParticipant: MeetingParticipant = {
        meetingId,
        username,
        role,
        focusScore: focusScore ?? 100,
        isDistracted: !!isDistracted,
        joinedAt: new Date().toISOString(),
        lastSeen: Date.now(),
      };
      store.participants.push(newParticipant);
    } else if (action === "heartbeat") {
      const p = store.participants.find(
        (p) => p.meetingId === meetingId && p.username === username
      );
      if (p) {
        p.lastSeen = Date.now();
        if (typeof focusScore === "number") p.focusScore = focusScore;
        if (typeof isDistracted === "boolean") p.isDistracted = isDistracted;
      } else {
        // If not found (e.g. server restarted or expired), treat it as a join
        const newParticipant: MeetingParticipant = {
          meetingId,
          username,
          role,
          focusScore: focusScore ?? 100,
          isDistracted: !!isDistracted,
          joinedAt: new Date().toISOString(),
          lastSeen: Date.now(),
        };
        store.participants.push(newParticipant);
      }
    } else if (action === "leave") {
      store.participants = store.participants.filter(
        (p) => !(p.meetingId === meetingId && p.username === username)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
