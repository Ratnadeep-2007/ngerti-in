"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFocusTracker } from "@/lib/use-focus-tracker";
import { toast } from "sonner";

interface MeetingInvite {
  id: string;
  topic: string;
  host: string;
  createdAt: string;
  active: boolean;
}

export default function TeacherDashboard() {
  const router = useRouter();
  
  // States
  const [topic, setTopic] = useState("");
  const [meetings, setMeetings] = useState<MeetingInvite[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Hook for distraction avoidance
  const { start, stopAndEvaluate, stream, isDistracted, latestSample } = useFocusTracker();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Ensure client side execution
  useEffect(() => {
    setIsClient(true);
    // Load existing meetings
    const saved = localStorage.getItem("lumina_meetings");
    if (saved) {
      try {
        setMeetings(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Web camera streaming to visual element
  useEffect(() => {
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Start focus tracking automatically for the teacher on load
  useEffect(() => {
    if (isClient) {
      start().catch((err) => {
        console.error("Failed to start camera for teacher dashboard", err);
      });
    }
    return () => {
      // Evaluate session silently on unmount
      if (isClient) {
        try {
          stopAndEvaluate();
        } catch {
          // ignore
        }
      }
    };
  }, [start, stopAndEvaluate, isClient]);

  // Audio warning oscillator
  const playBeep = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        try {
          osc.stop();
        } catch {
          // silent error
        }
      }, 150);
    } catch {
      // ignore audio errors
    }
  }, []);

  // Trigger beep on distraction
  useEffect(() => {
    if (isDistracted) {
      playBeep();
      toast.warning("Distraction alert! Please look back at your camera.");
    }
  }, [isDistracted, playBeep]);

  // Create meeting
  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a meeting topic");
      return;
    }

    const meetingId = `zoom_${Math.random().toString(36).substring(2, 10)}`;
    const newMeeting: MeetingInvite = {
      id: meetingId,
      topic: topic.trim(),
      host: "Ratnadeep (Teacher)",
      createdAt: new Date().toISOString(),
      active: true,
    };

    const updated = [newMeeting, ...meetings].slice(0, 10);
    setMeetings(updated);
    localStorage.setItem("lumina_meetings", JSON.stringify(updated));
    
    // Broadcast active meeting via localStorage for open tabs
    localStorage.setItem("lumina_active_meeting_invite", JSON.stringify(newMeeting));

    toast.success(`Meeting "${topic}" created!`);
    setTopic("");

    // Join the meeting instantly
    router.push(`/zoom/${meetingId}?role=teacher`);
  };

  const handleEndMeeting = (id: string) => {
    const updated = meetings.map(m => m.id === id ? { ...m, active: false } : m);
    setMeetings(updated);
    localStorage.setItem("lumina_meetings", JSON.stringify(updated));

    // Clear active broadcast if this was it
    const activeBroadcast = localStorage.getItem("lumina_active_meeting_invite");
    if (activeBroadcast) {
      try {
        const parsed = JSON.parse(activeBroadcast);
        if (parsed.id === id) {
          localStorage.removeItem("lumina_active_meeting_invite");
          // Trigger storage change manually for own tab
          window.dispatchEvent(new Event("storage"));
        }
      } catch (e) {
        console.error(e);
      }
    }
    toast.info("Meeting deactivated");
  };

  if (!isClient) return null;

  // Compute stats for gauges
  const faceDetected = latestSample?.faceDetected ?? false;
  const eyeFocus = latestSample?.eyeFocus ?? 0;
  const focusScorePercent = Math.round(eyeFocus * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 relative z-10">
      {/* Top Header */}
      <div className="flex justify-between items-center bg-opacity-70 glass-panel pixel-border p-6 rounded-xl">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-widest text-[var(--primary-light)]">
            Lumina Pro / Control Room
          </span>
          <h1 className="text-3xl font-black pixel-text-strong text-[var(--foreground)] mt-1">
            Teacher Dashboard
          </h1>
        </div>
        <Link href="/my-learnings">
          <button className="pixel-border bg-[var(--surface-light)] hover:bg-[var(--primary)] text-[var(--foreground)] hover:text-white px-5 py-2.5 font-bold transition-all text-sm flex items-center gap-2">
            <span>🎓</span> Return to Student Dashboard
          </button>
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Create Meet and Webcam preview (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Create Call Form */}
          <div className="glass-panel pixel-border p-8 rounded-xl space-y-6">
            <h2 className="text-2xl font-black text-[var(--foreground)] flex items-center gap-2">
              <span>📹</span> Host a New Zoom Meeting
            </h2>
            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
                  Meeting Topic or Lesson Name
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Introduction to React Hook State Managers"
                  className="w-full bg-[var(--surface)] text-[var(--foreground)] border border-border p-3 outline-none focus:border-[var(--primary)] pixel-border font-medium text-base"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-extrabold text-lg py-4 pixel-border transition-all active:translate-y-[1px]"
              >
                Create Zoom Meeting & Start Invite
              </button>
            </form>
          </div>

          {/* Teacher's Focus Tracker Test Bed */}
          <div className="glass-panel pixel-border p-8 rounded-xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-[var(--foreground)] flex items-center gap-2">
                <span>👁️</span> Teacher Distraction Avoidance Preview
              </h2>
              <span className={`px-3 py-1 font-bold text-xs uppercase pixel-border text-white ${faceDetected ? "bg-[var(--success)]" : "bg-[var(--error)] animate-pulse"}`}>
                {faceDetected ? "Tracking Active" : "No Face Detected"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Webcam view */}
              <div className="relative aspect-video bg-black pixel-border overflow-hidden group">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${isDistracted ? "brightness-50 border-4 border-[var(--error)]" : ""}`}
                />
                
                {/* Warning HUD Overlay */}
                {isDistracted && (
                  <div className="absolute inset-0 bg-red-600/30 flex flex-col items-center justify-center text-center p-4 animate-pulse">
                    <span className="text-5xl mb-2">⚠️</span>
                    <span className="text-white font-black text-xl uppercase tracking-wider bg-black/75 px-3 py-1.5 pixel-border">
                      Distracted!
                    </span>
                    <span className="text-white font-semibold text-xs mt-2 bg-black/60 px-2 py-0.5 rounded">
                      Looking away / Pupil out of focus
                    </span>
                  </div>
                )}

                {/* HUD Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.07] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />
                
                <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                  Teacher Lens
                </span>
              </div>

              {/* Distraction avoidance details */}
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted)] font-medium leading-relaxed">
                  Lumina monitors your eye alignment and head posture. If you look away or leave the frame for more than 1 second, an warning beep triggers to keep the meeting session engaged.
                </p>
                <div className="space-y-3 bg-[var(--surface)] p-4 pixel-border">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[var(--muted)] mb-1 uppercase">
                      <span>Real-time Eye Focus</span>
                      <span>{focusScorePercent}%</span>
                    </div>
                    <div className="h-2.5 bg-[var(--surface-light)] overflow-hidden p-[1px]">
                      <div
                        className={`h-full transition-all duration-150 ${focusScorePercent > 55 ? "bg-[var(--success)]" : "bg-[var(--error)]"}`}
                        style={{ width: `${focusScorePercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs font-semibold text-[var(--foreground)] border-t border-border pt-2 mt-2">
                    <span>Face Present</span>
                    <span className={faceDetected ? "text-[var(--success)] font-bold" : "text-[var(--error)] font-bold"}>
                      {faceDetected ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Active and Past Meetings (4 cols) */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass-panel pixel-border p-6 rounded-xl space-y-6 h-full flex flex-col">
            <h2 className="text-xl font-black text-[var(--foreground)] flex items-center gap-2">
              <span>📅</span> Live Meetings Log
            </h2>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-1">
              {meetings.length === 0 ? (
                <div className="text-center py-12 text-[var(--muted)] border border-dashed border-border p-6 text-sm font-medium">
                  No meetings hosted yet. Use the creation pane to broadcast a call.
                </div>
              ) : (
                meetings.map((m) => (
                  <div key={m.id} className="bg-[var(--surface)] border border-border p-4 pixel-border space-y-3 relative group">
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] px-2 py-0.5 pixel-border font-bold uppercase ${m.active ? "bg-[var(--success)] text-white" : "bg-[var(--muted)] text-[var(--foreground)]"}`}>
                        {m.active ? "Active Link" : "Ended"}
                      </span>
                      <span className="text-[10px] text-[var(--muted)]">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[var(--foreground)] leading-snug line-clamp-2">
                      {m.topic}
                    </h4>

                    <div className="pt-2 flex gap-2">
                      {m.active ? (
                        <>
                          <button
                            onClick={() => router.push(`/zoom/${m.id}?role=teacher`)}
                            className="flex-1 py-1.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white pixel-border text-center"
                          >
                            Re-Join Call
                          </button>
                          <button
                            onClick={() => handleEndMeeting(m.id)}
                            className="px-2 py-1.5 text-xs font-bold bg-[var(--error)] hover:bg-red-700 text-white pixel-border"
                            title="End call for students"
                          >
                            ⏹️
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-[var(--muted)] italic">
                          Session archived
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
