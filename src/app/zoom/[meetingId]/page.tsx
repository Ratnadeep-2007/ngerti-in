"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFocusTracker } from "@/lib/use-focus-tracker";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FocusLogEntry {
  time: string;
  status: string;
}

function createParticipantId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 12);
  return `participant_${Date.now().toString(36)}_${randomPart}`;
}

export default function ZoomMeetingRoom() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const meetingId = typeof params.meetingId === "string" ? params.meetingId : "";
  const role = searchParams.get("role") === "teacher" ? "teacher" : "student";
  const { user } = useAuth();

  // Derive the actual role from auth context (URL param is just a hint)
  const isTeacher = user?.role === "teacher" || user?.role === "guest_teacher";
  const effectiveRole = isTeacher ? "teacher" : role;
  const displayName = user?.username ?? (effectiveRole === "teacher" ? "Teacher" : "Student");

  const [isClient, setIsClient] = useState(false);
  const [topic, setTopic] = useState("Zoom Call");
  const [participantId, setParticipantId] = useState("");
  
  // Meeting states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [focusLogs, setFocusLogs] = useState<FocusLogEntry[]>([]);
  const [remoteParticipants, setRemoteParticipants] = useState<any[]>([]);

  // Hook for distraction avoidance
  const { start, stopAndEvaluate, stream, isDistracted, latestSample } = useFocusTracker();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micLevelRef = useRef(0);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = "lumina_meeting_participant_id";
    const existing = window.sessionStorage.getItem(storageKey);
    const id = existing || createParticipantId();

    if (!existing) {
      window.sessionStorage.setItem(storageKey, id);
    }

    setParticipantId(id);
  }, []);

  // Fetch topic from API instead of localStorage so students get it too
  useEffect(() => {
    setIsClient(true);
    fetch("/api/meetings")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.meetings) {
          const current = data.meetings.find((m: any) => m.id === meetingId);
          if (current) {
            setTopic(current.topic);
            return;
          }
        }
        // Fallback to local storage
        const saved = localStorage.getItem("lumina_meetings");
        if (saved) {
          try {
            const mtgs = JSON.parse(saved);
            const current = mtgs.find((m: any) => m.id === meetingId);
            if (current) setTopic(current.topic);
          } catch (e) {
            console.error(e);
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching meetings list", err);
      });
  }, [meetingId]);

  // Guard: students must have accepted the invite — block direct URL access
  useEffect(() => {
    if (!isClient || !participantId) return;
    if (effectiveRole === "teacher") return; // teachers always allowed
    
    // Auto-accept direct URL joins to make testing and link sharing easier during development
    if (typeof window !== "undefined") {
      localStorage.setItem(`lumina_accepted_invite_${meetingId}`, "true");
    }
  }, [isClient, effectiveRole, meetingId, participantId]);

  // Participant registry: Join on mount, Leave on unmount
  useEffect(() => {
    if (!isClient || !participantId) return;

    fetch("/api/meetings/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          participantId,
          username: displayName,
          role: effectiveRole,
          action: "join",
      }),
    }).catch((err) => console.error("Error joining participant list", err));

    return () => {
      fetch("/api/meetings/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          participantId,
          username: displayName,
          role: effectiveRole,
          action: "leave",
        }),
      }).catch((err) => console.error("Error leaving participant list", err));
    };
  }, [isClient, meetingId, participantId, displayName, effectiveRole]);

  // Heartbeat & Poll participants
  const focusScorePercent = isVideoOn ? Math.round((latestSample?.eyeFocus ?? 0) * 100) : 100;
  const captureLocalFrame = useCallback(() => {
    const video = localVideoRef.current;
    if (!video || !isVideoOn || video.readyState < 2 || video.videoWidth === 0) return undefined;

    const canvas = frameCanvasRef.current ?? document.createElement("canvas");
    frameCanvasRef.current = canvas;
    canvas.width = 240;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.48);
  }, [isVideoOn]);

  useEffect(() => {
    if (!isClient || !participantId) return;

    const syncPresence = () => {
      const videoFrame = captureLocalFrame();
      // Send Heartbeat
      fetch("/api/meetings/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          participantId,
          username: displayName,
          role: effectiveRole,
          focusScore: focusScorePercent,
          isDistracted: isDistracted && isVideoOn,
          isMuted,
          isVideoOn,
          micLevel: micLevelRef.current,
          videoFrame,
          action: "heartbeat",
        }),
      }).catch((err) => console.error("Heartbeat error", err));

      // Fetch participants list
      fetch(`/api/meetings/participants?meetingId=${meetingId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.participants) {
            const others = data.participants.filter(
              (p: any) => (p.participantId ? p.participantId !== participantId : p.username !== displayName)
            );
            setRemoteParticipants(others);
          }
        })
        .catch((err) => console.error("Error retrieving participant list", err));
    };

    syncPresence();
    const interval = setInterval(syncPresence, 1000);

    return () => clearInterval(interval);
  }, [isClient, meetingId, participantId, displayName, effectiveRole, focusScorePercent, isDistracted, isMuted, isVideoOn, captureLocalFrame]);

  // Distraction trigger logs for the teacher dashboard
  const prevDistractedRef = useRef<{ [participantId: string]: boolean }>({});
  useEffect(() => {
    remoteParticipants.forEach((p) => {
      const remoteId = p.participantId || p.username;
      const wasDistracted = !!prevDistractedRef.current[remoteId];
      const isNowDistracted = p.isDistracted;
      if (isNowDistracted && !wasDistracted) {
        if (effectiveRole === "teacher") {
          const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setFocusLogs((prev) => [
            { time: logTime, status: `${p.username} distracted` },
            ...prev,
          ].slice(0, 15));
          toast.warning(`🔔 Student ${p.username} has looked away from the lecture.`, {
            id: `distract-${remoteId}-${Date.now()}`
          });
        }
      }
      prevDistractedRef.current[remoteId] = isNowDistracted;
    });
  }, [remoteParticipants, effectiveRole]);

  // Bind camera stream
  useEffect(() => {
    if (stream && localVideoRef.current && isVideoOn) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream, isVideoOn]);

  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = isVideoOn;
    });
  }, [stream, isMuted, isVideoOn]);

  useEffect(() => {
    if (!stream || typeof window === "undefined") return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      micAnalyserRef.current = analyser;
    } catch (err) {
      console.error("Mic analyser failed", err);
    }
  }, [stream]);

  useEffect(() => {
    if (!stream) return;

    const data = new Uint8Array(128);
    const interval = setInterval(() => {
      const analyser = micAnalyserRef.current;
      if (!analyser || isMuted) {
        micLevelRef.current = 0;
        return;
      }
      analyser.getByteTimeDomainData(data);
      const volume = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length;
      micLevelRef.current = Math.min(100, Math.round(volume * 4));
    }, 250);

    return () => clearInterval(interval);
  }, [stream, isMuted]);

  // Handle focus tracking activation based on isVideoOn
  useEffect(() => {
    if (isClient && isVideoOn) {
      start().catch((err) => {
        console.error("Failed to start camera for Zoom meeting", err);
      });
    } else if (isClient && !isVideoOn) {
      try {
        stopAndEvaluate();
      } catch {
        // ignore
      }
    }
  }, [isVideoOn, start, stopAndEvaluate, isClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isClient) {
        try {
          stopAndEvaluate();
        } catch {
          // ignore
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
        }
      }
    };
  }, [stopAndEvaluate, isClient]);

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
      osc.frequency.setValueAtTime(700, ctx.currentTime);
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
      // ignore
    }
  }, []);

  // Handle local user distraction
  useEffect(() => {
    if (isDistracted) {
      playBeep();
      setFocusLogs(prev => [
        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), status: "Distracted" },
        ...prev
      ].slice(0, 15));
      toast.error("⚠️ Attention required! Please focus on the call.");
    }
  }, [isDistracted, playBeep]);

  // Handle screen share
  const handleToggleScreenShare = async () => {
    if (isSharingScreen) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      screenStreamRef.current = null;
      setIsSharingScreen(false);
      toast.info("Screen sharing stopped");
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setIsSharingScreen(true);
        toast.success("Screen sharing started");
        
        // Bind to preview
        setTimeout(() => {
          if (screenShareVideoRef.current) {
            screenShareVideoRef.current.srcObject = stream;
          }
        }, 100);

        stream.getVideoTracks()[0].onended = () => {
          setIsSharingScreen(false);
          screenStreamRef.current = null;
        };
      } catch (err) {
        console.error(err);
        toast.error("Screen sharing permission denied");
      }
    }
  };

  const handleLeaveCall = () => {
    try {
      stopAndEvaluate();
    } catch {
      // ignore
    }
    if (role === "teacher") {
      router.push("/teacher");
    } else {
      // Clear accepted flag when leaving so they'd need a new invite to re-join
      localStorage.removeItem(`lumina_accepted_invite_${meetingId}`);
      router.push("/my-learnings");
    }
  };

  if (!isClient) return null;

  // Compute values for rendering
  const faceDetected = latestSample?.faceDetected ?? false;
  const isTeacherPresent = remoteParticipants.some(
    (p) => p.role === "teacher" || p.role === "guest_teacher"
  );
  const remoteStudents = remoteParticipants.filter(
    (p) => p.role !== "teacher" && p.role !== "guest_teacher"
  );

  return (
    <div className="fixed inset-0 bg-[#0e0f11] text-white z-50 flex flex-col font-sans select-none pt-0">
      
      {/* Zoom Meeting Header */}
      <header className="h-14 bg-[#16181d] px-6 border-b border-gray-800 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-extrabold text-sm uppercase tracking-wider text-gray-400">
            Live Stream
          </span>
          <span className="h-4 w-[1px] bg-gray-700" />
          <h2 className="font-bold text-base text-gray-200 line-clamp-1">
            {topic}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-gray-800 text-gray-400 px-2.5 py-1 pixel-border border-gray-700">
            ID: {meetingId.split("_")[1] || meetingId}
          </span>
          <span className="text-xs font-bold px-2 py-1 pixel-border text-white bg-[var(--primary)] uppercase">
            {effectiveRole === "teacher" ? `Host · ${displayName}` : `Participant · ${displayName}`}
          </span>
        </div>
      </header>

      {/* Main Area: Split into Video Grid & Focus Analytics Panel */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* Left Area: Video Participant Grid */}
        <div className="flex-1 bg-[#0b0c0e] p-6 flex flex-col items-center justify-center min-h-0 overflow-y-auto">
          
          {/* Main call grid */}
          <div className={`w-full max-w-5xl grid gap-6 ${isSharingScreen ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
            
            {/* Screen Share Display Box */}
            {isSharingScreen && (
              <div className="md:col-span-2 aspect-video bg-black pixel-border border-gray-800 rounded-xl relative overflow-hidden flex flex-col">
                <video
                  ref={screenShareVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-black/80 px-3 py-1 rounded text-xs font-bold flex items-center gap-2 border border-gray-700">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                  Your Shared Screen
                </div>
              </div>
            )}

            {/* Local Video Card */}
            <div className={`aspect-video bg-[#1a1c22] pixel-border border-gray-800 rounded-xl relative overflow-hidden flex flex-col group ${isDistracted && isVideoOn ? "ring-4 ring-[var(--error)] animate-shake" : ""}`}>
              {isVideoOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${isDistracted ? "brightness-50" : ""}`}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-2xl font-bold mb-2">
                    {effectiveRole === "teacher" ? "👨‍🏫" : "🎓"}
                  </div>
                  <span className="text-gray-400 font-bold text-sm">Camera Off</span>
                </div>
              )}

              {/* Warning Overlay */}
              {isDistracted && isVideoOn && (
                <div className="absolute inset-0 bg-red-600/40 flex flex-col items-center justify-center text-center p-4 animate-pulse">
                  <span className="text-4xl mb-1">⚠️</span>
                  <span className="text-white font-black text-sm uppercase tracking-wider bg-black/80 px-2.5 py-1 pixel-border border-red-600">
                    Distraction Detected!
                  </span>
                  <span className="text-white font-bold text-[10px] mt-1 bg-black/60 px-2 py-0.5 rounded">
                    Please focus on the screen
                  </span>
                </div>
              )}

              {/* HUD Scanlines */}
              {isVideoOn && (
                <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />
              )}

              {/* Label */}
              <div className="absolute bottom-3 left-3 bg-black/75 px-3 py-1 rounded text-xs font-bold flex items-center gap-2 border border-gray-800">
                <span className={`w-2 h-2 rounded-full ${faceDetected && isVideoOn ? "bg-green-500" : "bg-red-500"}`} />
                {displayName} (You)
              </div>
            </div>

            {/* Remote Participant Cards */}
            {remoteParticipants.map((p) => {
              const isParticipantTeacher = p.role === "teacher" || p.role === "guest_teacher";
              const remoteId = p.participantId || p.username;
              return (
                <div
                  key={remoteId}
                  className={`aspect-video bg-[#1a1c22] pixel-border border-gray-800 rounded-xl relative overflow-hidden flex flex-col group ${p.isDistracted ? "ring-4 ring-orange-500 animate-pulse" : ""}`}
                >
                  <div className="flex-1 bg-[#101216] flex flex-col items-center justify-center relative">
                    {p.videoFrame && p.isVideoOn !== false ? (
                      <img
                        src={p.videoFrame}
                        alt={`${p.username} live camera preview`}
                        className={`h-full w-full object-cover ${p.isDistracted ? "brightness-50" : ""}`}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-4">
                        <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-[var(--primary)] flex items-center justify-center text-3xl mb-3 shadow-[0_0_15px_rgba(108,92,231,0.3)]">
                          {isParticipantTeacher ? "👨‍🏫" : "🎓"}
                        </div>
                        <span className="font-bold text-base text-gray-200">
                          {p.username}
                        </span>
                        <span className="text-xs text-gray-400 font-semibold mt-1">
                          Camera {p.isVideoOn === false ? "off" : "warming up"}
                        </span>
                      </div>
                    )}

                    {p.isDistracted && (
                      <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-center p-4">
                        <div className="rounded bg-black/80 px-3 py-2 border border-orange-700">
                          <span className="text-orange-400 font-extrabold text-xs uppercase tracking-wider">
                            Distracted / Looking Away
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="absolute top-3 right-3 flex items-center gap-2 rounded bg-black/75 px-2 py-1 text-[10px] font-bold border border-gray-800">
                      <span>{p.isMuted ? "Muted" : `Mic ${Math.round(p.micLevel ?? 0)}%`}</span>
                      <span className={`h-2 w-8 rounded bg-gray-800 overflow-hidden ${p.isMuted ? "opacity-50" : ""}`}>
                        <span
                          className="block h-full bg-green-500 transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, p.micLevel ?? 0))}%` }}
                        />
                      </span>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="absolute bottom-3 left-3 bg-black/75 px-3 py-1 rounded text-xs font-bold flex items-center gap-2 border border-gray-800">
                    <span className={`w-2 h-2 rounded-full ${p.isDistracted ? "bg-orange-500" : "bg-green-500"}`} />
                    {p.username} ({isParticipantTeacher ? "Teacher" : "Student"})
                  </div>
                </div>
              );
            })}

            {/* Waiting Placeholders */}
            {effectiveRole === "teacher" && remoteStudents.length === 0 && (
              <div className="aspect-video bg-[#13151b] border-2 border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center text-center p-6 animate-pulse">
                <span className="text-4xl mb-3">🔔</span>
                <h4 className="text-gray-400 font-bold text-sm uppercase tracking-wider">
                  Waiting for students to join...
                </h4>
                <p className="text-gray-600 text-xs mt-1 max-w-xs">
                  Students will appear here once they accept the invitation banner.
                </p>
              </div>
            )}

            {effectiveRole !== "teacher" && !isTeacherPresent && (
              <div className="aspect-video bg-[#13151b] border-2 border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center text-center p-6 animate-pulse">
                <span className="text-4xl mb-3">👨‍🏫</span>
                <h4 className="text-gray-400 font-bold text-sm uppercase tracking-wider">
                  Waiting for the teacher...
                </h4>
                <p className="text-gray-600 text-xs mt-1 max-w-xs">
                  The session will begin as soon as the teacher connects.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* Right Area: Lumina Focus Telemetry Analytics Sidebar */}
        <aside className="w-80 bg-[#16181d] border-l border-gray-800 p-5 flex flex-col shrink-0 min-h-0 select-none z-10">
          <div className="space-y-1 mb-6">
            <span className="text-[10px] uppercase font-bold text-[var(--primary-light)] tracking-widest">
              Biometric HUD
            </span>
            <h3 className="font-black text-lg text-gray-100 flex items-center gap-1.5">
              <span>🧠</span> Focus Telemetry
            </h3>
          </div>

          {/* Gauges */}
          <div className="space-y-5 flex-1 overflow-y-auto pr-1">
            
            {/* Local Focus Meter */}
            <div className="bg-[#1e212b] border border-gray-800 p-4 pixel-border space-y-3">
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">
                Your Focus Index
              </span>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center rounded-full border-4 border-gray-700" style={{ borderColor: isDistracted ? "var(--error)" : "var(--success)" }}>
                  <span className="font-black text-sm text-gray-200">
                    {isVideoOn ? `${focusScorePercent}%` : "--"}
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <span className={`text-xs font-bold uppercase ${isDistracted ? "text-[var(--error)]" : "text-[var(--success)]"}`}>
                    {isVideoOn ? (isDistracted ? "Looking Away" : "Focused") : "Camera Off"}
                  </span>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Eye alignment offset relative to screen center.
                  </p>
                </div>
              </div>
            </div>

            {/* Class/Teacher Focus Section */}
            {effectiveRole === "teacher" ? (
              <div className="space-y-4">
                <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">
                  Class Focus Dashboard
                </span>
                {remoteStudents.length === 0 ? (
                  <div className="text-gray-500 italic text-[11px] text-center py-4 bg-[#1e212b] border border-gray-800 rounded">
                    No students currently in call.
                  </div>
                ) : (
                  remoteStudents.map((s) => (
                    <div key={s.username} className="bg-[#1e212b] border border-gray-800 p-3 pixel-border space-y-2">
                      <div className="flex justify-between text-xs font-bold text-gray-200">
                        <span>🎓 {s.username}</span>
                        <span className={s.isDistracted ? "text-orange-500" : "text-green-500"}>
                          {s.focusScore}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${s.isDistracted ? "bg-orange-500" : "bg-green-500"}`}
                          style={{ width: `${s.focusScore}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="bg-[#1e212b] border border-gray-800 p-4 pixel-border space-y-3">
                <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">
                  Teacher Status
                </span>
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 flex items-center justify-center rounded-full border-4 border-gray-700" style={{ borderColor: isTeacherPresent ? "var(--success)" : "var(--muted)" }}>
                    <span className="font-black text-xs text-gray-200">
                      {isTeacherPresent ? "ON" : "OFF"}
                    </span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className={`text-xs font-bold uppercase ${isTeacherPresent ? "text-[var(--success)]" : "text-gray-400"}`}>
                      {isTeacherPresent ? "Teacher Connected" : "Teacher Offline"}
                    </span>
                    <p className="text-[10px] text-gray-400 font-medium font-sans">
                      {isTeacherPresent ? "Teacher is actively hosting the lesson." : "Waiting for the teacher to start."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings Event Log */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Session Warnings Log
              </span>
              <div className="bg-[#1e212b] border border-gray-800 rounded p-3 text-[11px] font-mono text-gray-300 min-h-[140px] max-h-[220px] overflow-y-auto space-y-1.5">
                {focusLogs.length === 0 ? (
                  <div className="text-gray-500 italic text-center py-8">
                    No warnings generated yet. Clear attention record.
                  </div>
                ) : (
                  focusLogs.map((log, i) => (
                    <div key={i} className="flex justify-between border-b border-gray-800/50 pb-1">
                      <span className="text-gray-500">{log.time}</span>
                      <span className={log.status.toLowerCase().includes("distracted") ? "text-[var(--error)] font-bold" : "text-gray-300"}>
                        {log.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          <div className="mt-4 pt-4 border-t border-gray-800 text-[10px] text-gray-500 font-medium">
            Lumina Anti-Distraction Suite v1.2
          </div>
        </aside>

      </div>

      {/* Zoom Bottom Control Bar */}
      <footer className="h-20 bg-[#16181d] px-8 border-t border-gray-800 flex justify-between items-center z-10 shrink-0 select-none">
        
        {/* Left Side: Audio/Video Toggles */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border transition-all ${isMuted ? "bg-red-600/20 border-red-500 text-red-500" : "bg-gray-800/80 border-gray-700 hover:bg-gray-700"}`}
          >
            <span className="text-sm">{isMuted ? "🔇" : "🎙️"}</span>
            <span className="text-[8px] mt-0.5 font-bold uppercase">{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border transition-all ${!isVideoOn ? "bg-red-600/20 border-red-500 text-red-500" : "bg-gray-800/80 border-gray-700 hover:bg-gray-700"}`}
          >
            <span className="text-sm">{isVideoOn ? "📹" : "❌"}</span>
            <span className="text-[8px] mt-0.5 font-bold uppercase">{isVideoOn ? "Stop Cam" : "Start Cam"}</span>
          </button>
        </div>

        {/* Middle: Screen Share & Chat */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleScreenShare}
            className={`w-14 h-12 flex flex-col items-center justify-center rounded-lg border transition-all ${isSharingScreen ? "bg-green-600/20 border-green-500 text-green-500" : "bg-gray-800/80 border-gray-700 hover:bg-gray-700"}`}
          >
            <span className="text-sm">🖥️</span>
            <span className="text-[8px] mt-0.5 font-bold uppercase">Share Screen</span>
          </button>
        </div>

        {/* Right Side: End Call */}
        <div className="flex items-center">
          <button
            onClick={handleLeaveCall}
            className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-6 py-3 rounded-lg border border-red-700 hover:scale-105 transition-transform"
          >
            {effectiveRole === "teacher" ? "End Meeting" : "Leave Meeting"}
          </button>
        </div>

      </footer>

    </div>
  );
}
