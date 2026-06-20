"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, X, Trash } from "@phosphor-icons/react";
import { useTranslation } from "@/contexts/UILanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { LeaderboardEntry } from "@/lib/leaderboard";
import type { Session } from "@/lib/types";

interface MeetingInvite {
  id: string;
  topic: string;
  host: string;
  createdAt: string;
  active: boolean;
}

export default function MyLearningsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // States
  const [sessions, setSessions] = useState<Session[]>([]);
  const [meetings, setMeetings] = useState<MeetingInvite[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<"daily" | "weekly">("daily");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ongoing" | "completed">("ongoing");

  const loadSessions = () => {
    const saved = localStorage.getItem("lingodev_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
    setLoading(false);
  };

  const fetchMeetings = () => {
    fetch("/api/meetings")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.meetings) {
          setMeetings(data.meetings);
        }
      })
      .catch((err) => console.error("Error fetching meetings", err));
  };

  const fetchLeaderboard = () => {
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
      })
      .catch((err) => console.error("Error fetching leaderboard", err));
  };

  useEffect(() => {
    loadSessions();
    fetchMeetings();
    fetchLeaderboard();

    // Polling intervals to sync with other laptops/devices on the network
    const meetingsInterval = setInterval(fetchMeetings, 3000);
    const leaderboardInterval = setInterval(fetchLeaderboard, 5000);

    return () => {
      clearInterval(meetingsInterval);
      clearInterval(leaderboardInterval);
    };
  }, []);

  // Compute stats
  let totalCorrect = 0;
  let totalQuestions = 0;
  sessions.forEach((s) => {
    if (s.progress.quizScores && s.progress.quizScores.length > 0) {
      s.progress.quizScores.forEach((score) => {
        totalCorrect += score.correct;
        totalQuestions += score.total;
      });
    } else {
      const cleared = s.progress.breakpointsCleared.filter(Boolean).length;
      const total = s.progress.breakpointsCleared.length;
      totalCorrect += cleared;
      totalQuestions += total;
    }
  });

  const combinedScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Post student score to network leaderboard when calculated
  useEffect(() => {
    if (user && user.role) {
      fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          role: user.role,
          score: combinedScore,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.leaderboard) {
            setLeaderboard(data.leaderboard);
          }
        })
        .catch((err) => console.error("Error posting score to leaderboard", err));
    }
  }, [user, combinedScore]);

  function deleteSession(id: string) {
    const updated = sessions.filter((s) => s.id !== id);
    localStorage.setItem("lingodev_sessions", JSON.stringify(updated));
    setSessions(updated);
  }

  const joinMeeting = (meetingId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`lumina_accepted_invite_${meetingId}`, "true");
    }
    const role = user?.role === "teacher" || user?.role === "guest_teacher" ? "teacher" : "student";
    router.push(`/zoom/${meetingId}?role=${role}`);
  };

  const ongoing = sessions.filter((s) => s.status !== "completed");
  const completed = sessions.filter((s) => s.status === "completed");

  const sortedLeaderboard = [...leaderboard].sort((a, b) =>
    leaderboardTab === "daily" ? b.dailyScore - a.dailyScore : b.weeklyScore - a.weeklyScore
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 relative z-10">
      {/* Hero Welcome & combined score banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-opacity-70 glass-panel pixel-border p-6 rounded-xl items-center">
        <div className="md:col-span-2 space-y-2">
          <span className="text-xs uppercase font-extrabold tracking-widest text-[var(--primary-light)]">
            Lumina.ai / Learner Dashboard
          </span>
          <h1 className="text-3xl font-black pixel-text-strong text-[var(--foreground)] mt-1">
            Welcome back, {user?.username || "Learner"}!
          </h1>
          <p className="text-sm text-[var(--foreground)] opacity-75">
            Track your progress, join live teacher classroom meetings, and check your rank on the leaderboard.
          </p>
        </div>

        {/* Combined Score Circular Gauge */}
        <div className="flex items-center justify-center md:justify-end gap-4">
          <div className="text-right">
            <span className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
              Combined Score
            </span>
            <span className="block text-2xl font-black text-[var(--foreground)]">
              {totalQuestions > 0 ? `${totalCorrect}/${totalQuestions} Correct` : "No activity"}
            </span>
          </div>
          <div className="relative w-24 h-24 flex items-center justify-center pixel-border bg-[var(--surface-light)] rounded-full">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="34"
                className="stroke-gray-700 fill-none"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                className="stroke-[var(--primary)] fill-none transition-all duration-1000"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - combinedScore / 100)}`}
              />
            </svg>
            <span className="absolute text-xl font-extrabold text-[var(--foreground)]">
              {combinedScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (8 cols): Video Lessons and Meetings */}
        <div className="lg:col-span-8 space-y-8">
          {/* Live Classroom & Meetings Section */}
          <div className="glass-panel pixel-border p-6 rounded-xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-[var(--foreground)] flex items-center gap-2">
                <span>📹</span> Live Classroom Meetings
              </h2>
              {meetings.some((m) => m.active) && (
                <span className="animate-pulse flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--success)]"></span>
                </span>
              )}
            </div>

            {meetings.length === 0 ? (
              <div className="text-center py-8 bg-[var(--surface-light)] pixel-border">
                <span className="text-4xl block mb-2">📭</span>
                <p className="text-sm text-[var(--muted)] font-medium">
                  No classroom meetings scheduled. A teacher can start one from their control panel.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className={`flex flex-col sm:flex-row justify-between sm:items-center p-4 pixel-border transition-all ${
                      meeting.active
                        ? "bg-gradient-to-r from-emerald-950/20 to-transparent border-[var(--success)]"
                        : "bg-[var(--surface-light)] opacity-75 border-gray-700"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 uppercase pixel-border text-white ${
                            meeting.active ? "bg-[var(--success)]" : "bg-gray-600"
                          }`}
                        >
                          {meeting.active ? "Active" : "Ended"}
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          {new Date(meeting.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-bold text-[var(--foreground)] text-base">{meeting.topic}</h4>
                      <p className="text-xs text-[var(--muted)]">Host: {meeting.host}</p>
                    </div>

                    <div className="mt-3 sm:mt-0 flex gap-2">
                      {meeting.active ? (
                        <button
                          onClick={() => joinMeeting(meeting.id)}
                          className="w-full sm:w-auto bg-[var(--success)] hover:bg-[var(--success-dark)] text-white font-extrabold text-sm px-6 py-2.5 pixel-border transition-all active:translate-y-[1px]"
                        >
                          Join Meeting
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-[var(--muted)] py-2.5 px-4 bg-black/20 pixel-border border-gray-800">
                          Class Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lessons Section */}
          <div className="glass-panel pixel-border p-6 rounded-xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <h2 className="text-2xl font-black text-[var(--foreground)] flex items-center gap-2">
                <span>📚</span> {t("myLearnings.title")}
              </h2>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("ongoing")}
                  className={`px-4 py-1.5 text-xs font-bold pixel-border transition-all ${
                    activeTab === "ongoing"
                      ? "bg-[var(--primary)] text-white translate-y-[-1px] shadow-[0_2px_0_var(--primary-dark)]"
                      : "bg-[var(--surface-light)] text-[var(--foreground)] hover:bg-black/20"
                  }`}
                >
                  {t("myLearnings.tabOngoing")} ({ongoing.length})
                </button>
                <button
                  onClick={() => setActiveTab("completed")}
                  className={`px-4 py-1.5 text-xs font-bold pixel-border transition-all ${
                    activeTab === "completed"
                      ? "bg-[var(--success)] text-white translate-y-[-1px] shadow-[0_2px_0_var(--success-dark)]"
                      : "bg-[var(--surface-light)] text-[var(--foreground)] hover:bg-black/20"
                  }`}
                >
                  {t("myLearnings.tabCompleted")} ({completed.length})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">{t("common.loading")}</div>
            ) : activeTab === "ongoing" ? (
              ongoing.length === 0 ? (
                <EmptyState
                  title={t("myLearnings.noOngoing")}
                  description={t("myLearnings.noOngoingDesc")}
                  onAction={() => router.push("/learn")}
                  actionLabel={t("myLearnings.startLearning")}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {ongoing.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onDelete={() => deleteSession(s.id)}
                      onAction={() => router.push(`/learn/${s.id}`)}
                      actionLabel={t("myLearnings.continue")}
                    />
                  ))}
                </div>
              )
            ) : completed.length === 0 ? (
              <EmptyState
                title={t("myLearnings.noCompleted")}
                description={t("myLearnings.noCompletedDesc")}
                onAction={() => router.push("/explore")}
                actionLabel={t("explore.title")}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {completed.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onDelete={() => deleteSession(s.id)}
                    onAction={() => router.push(`/certificate/${s.id}`)}
                    actionLabel={t("myLearnings.viewCertificate")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Leaderboard */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass-panel pixel-border p-6 rounded-xl space-y-6">
            <div>
              <h2 className="text-2xl font-black text-[var(--foreground)] flex items-center gap-2">
                <span>🏆</span> Competency Leaderboard
              </h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Compete with classmates based on quiz performance percentages.
              </p>
            </div>

            {/* Leaderboard toggle tabs */}
            <div className="grid grid-cols-2 gap-2 bg-black/20 p-1 pixel-border">
              <button
                onClick={() => setLeaderboardTab("daily")}
                className={`py-1.5 font-bold text-xs pixel-border transition-all ${
                  leaderboardTab === "daily"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground)] hover:bg-black/10"
                }`}
              >
                Daily Rank
              </button>
              <button
                onClick={() => setLeaderboardTab("weekly")}
                className={`py-1.5 font-bold text-xs pixel-border transition-all ${
                  leaderboardTab === "weekly"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground)] hover:bg-black/10"
                }`}
              >
                Weekly Rank
              </button>
            </div>

            {/* List */}
            <div className="space-y-2">
              {sortedLeaderboard.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser =
                  user && entry.username.toLowerCase() === user.username.toLowerCase();
                const score = leaderboardTab === "daily" ? entry.dailyScore : entry.weeklyScore;

                let rankBadge = `${rank}`;
                let rankStyle = "bg-gray-800 text-gray-400";

                if (rank === 1) {
                  rankBadge = "🥇";
                  rankStyle = "bg-yellow-500/20 text-yellow-400 border-yellow-500";
                } else if (rank === 2) {
                  rankBadge = "🥈";
                  rankStyle = "bg-gray-400/20 text-gray-300 border-gray-400";
                } else if (rank === 3) {
                  rankBadge = "🥉";
                  rankStyle = "bg-amber-700/20 text-amber-500 border-amber-600";
                }

                return (
                  <div
                    key={entry.username}
                    className={`flex items-center justify-between p-3 pixel-border ${
                      isCurrentUser
                        ? "bg-[var(--primary)]/10 border-[var(--primary)] font-bold scale-[1.02] shadow-[0_0_10px_rgba(var(--primary-rgb),0.15)]"
                        : "bg-[var(--surface-light)] border-gray-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 flex items-center justify-center text-xs font-black pixel-border ${rankStyle}`}
                      >
                        {rankBadge}
                      </span>
                      <span className="text-xl">{entry.avatar}</span>
                      <div className="flex flex-col">
                        <span className="text-sm text-[var(--foreground)]">
                          {entry.username} {isCurrentUser && <span className="text-[10px] text-[var(--primary)] uppercase font-extrabold">(You)</span>}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
                          {entry.role}
                        </span>
                      </div>
                    </div>
                    <span className="font-extrabold text-base text-[var(--foreground)]">{score}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  onDelete,
  onAction,
  actionLabel,
}: {
  session: Session;
  onDelete: () => void;
  onAction: () => void;
  actionLabel: string;
}) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);

  const cleared = session.progress.breakpointsCleared.filter(Boolean).length;
  const total = session.progress.breakpointsCleared.length;

  return (
    <div className="glass-panel pixel-border p-4 flex flex-col group animate-slide-up relative overflow-hidden">
      {/* Hero Icon */}
      <div className="group relative mb-4 h-40 overflow-hidden rounded-[22px] bg-[var(--surface)]">
        <img
          src={session.metadata.thumbnail}
          alt={session.metadata.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 grayscale-[20%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] to-transparent opacity-60" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
            <Play size={26} weight="fill" className="ml-1 text-[var(--primary)]" />
          </div>
        </div>

        {/* Status Badge */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
            {session.targetLocale}
          </span>
          {session.status === "completed" ? (
            <span className="rounded-full bg-[var(--success)] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
              {t("myLearnings.statusCompleted")}
            </span>
          ) : (
            <span className="rounded-full bg-[var(--warning)] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
              {t("myLearnings.statusOngoing")}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3">
        <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-[var(--foreground)]">
          {session.metadata.title}
        </h3>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-[var(--muted)] uppercase tracking-tighter">
            <span>{t("myLearnings.checkpoints", { cleared, total })}</span>
            <span>{Math.round((cleared / (total || 1)) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-light)]">
            <div
              className={`h-full transition-all duration-500 ${
                session.status === "completed" ? "bg-[var(--success)]" : "bg-[var(--primary)]"
              }`}
              style={{ width: `${(cleared / (total || 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          <button
            onClick={onAction}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
              session.status === "completed"
                ? "bg-[var(--success)] text-white hover:bg-[var(--success-dark)]"
                : "bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]"
            }`}
          >
            {actionLabel}
          </button>

          {showConfirm ? (
            <div className="flex gap-1 animate-in slide-in-from-right-2 duration-200">
              <button
                onClick={onDelete}
                className="rounded-full bg-[var(--error)] px-3 py-2 text-xs font-semibold text-white"
              >
                {t("myLearnings.delete")}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-full bg-[var(--surface-light)] px-2 py-2 text-xs font-semibold text-[var(--foreground)]"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-full bg-[var(--surface-light)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--error)] hover:text-white"
              title={t("myLearnings.delete")}
            >
              <Trash size={17} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  onAction,
  actionLabel,
}: {
  title: string;
  description: string;
  onAction: () => void;
  actionLabel: string;
}) {
  return (
    <div className="glass-panel pixel-border p-12 text-center max-w-lg mx-auto animate-slide-up">
      <span className="text-5xl block mb-4">📖</span>
      <h3 className="text-xl font-bold pixel-text text-[var(--foreground)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted)] mb-6">{description}</p>
      <button
        onClick={onAction}
        className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold py-3 px-6 pixel-border transition-all active:translate-y-[1px]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
