import { NextResponse } from "next/server";
import { store } from "@/lib/server-store";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    if (db) {
      // Fetch meetings from Postgres database sorted by creation time
      const list = await db.select().from(meetings);
      // Sort in memory or use drizzle orderBy. Let's sort in memory for ease
      const sortedList = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const activeInvite = sortedList.find((m) => m.active) || null;
      return NextResponse.json({
        meetings: sortedList,
        activeInvite,
      });
    }

    // Fallback to in-memory store
    const activeInvite = store.meetings.find((m) => m.active) || null;
    return NextResponse.json({
      meetings: store.meetings,
      activeInvite,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, topic, host } = body;

    if (action === "create") {
      const meetingId = id || `zoom_${Math.random().toString(36).substring(2, 10)}`;
      const newMeeting = {
        id: meetingId,
        topic: topic || "Zoom Meeting",
        host: host || "Teacher",
        createdAt: new Date().toISOString(),
        active: true,
      };

      if (db) {
        // Deactivate all previous meetings in DB
        await db.update(meetings).set({ active: false }).where(eq(meetings.active, true));
        // Insert new active meeting
        await db.insert(meetings).values(newMeeting);
      } else {
        // In-memory update
        store.meetings.forEach((m) => {
          m.active = false;
        });
        store.meetings.unshift(newMeeting);
        if (store.meetings.length > 20) {
          store.meetings.pop();
        }
      }

      return NextResponse.json({ success: true, meeting: newMeeting });
    }

    if (action === "deactivate") {
      if (db) {
        // Deactivate in DB
        await db.update(meetings).set({ active: false }).where(eq(meetings.id, id));
      } else {
        // Deactivate in memory
        const meeting = store.meetings.find((m) => m.id === id);
        if (meeting) {
          meeting.active = false;
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
