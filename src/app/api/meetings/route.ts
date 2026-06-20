import { NextResponse } from "next/server";
import { store } from "@/lib/server-store";

export async function GET() {
  const activeInvite = store.meetings.find((m) => m.active) || null;
  return NextResponse.json({
    meetings: store.meetings,
    activeInvite,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, topic, host } = body;

    if (action === "create") {
      // Deactivate all previous meetings to ensure only one is active at a time
      store.meetings.forEach((m) => {
        m.active = false;
      });

      const newMeeting = {
        id: id || `zoom_${Math.random().toString(36).substring(2, 10)}`,
        topic: topic || "Zoom Meeting",
        host: host || "Teacher",
        createdAt: new Date().toISOString(),
        active: true,
      };

      store.meetings.unshift(newMeeting);
      // Keep only top 20 meetings in history
      if (store.meetings.length > 20) {
        store.meetings.pop();
      }

      return NextResponse.json({ success: true, meeting: newMeeting });
    }

    if (action === "deactivate") {
      const meeting = store.meetings.find((m) => m.id === id);
      if (meeting) {
        meeting.active = false;
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
