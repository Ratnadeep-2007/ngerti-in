"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, X, Trash, Student } from "@phosphor-icons/react";
import { useTranslation } from "@/contexts/UILanguageContext";
import type { Session } from "@/lib/types";

export default function MyLearningsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
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

  useEffect(() => {
    loadSessions();
  }, []);

  function deleteSession(id: string) {
    const updated = sessions.filter((s) => s.id !== id);
    localStorage.setItem("lingodev_sessions", JSON.stringify(updated));
    setSessions(updated);
  }

  const ongoing = sessions.filter((s) => s.status !== "completed");
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 animate-fade-in">
      <div className="mb-10 text-center">
        <h1 className="apple-headline mb-2">
          {t("myLearnings.title")}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {t("myLearnings.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 justify-center">
        <button
          onClick={() => setActiveTab("ongoing")}
          className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
            activeTab === "ongoing"
              ? "bg-[var(--primary)] text-white"
              : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          {t("myLearnings.tabOngoing")} ({ongoing.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
            activeTab === "completed"
              ? "bg-[var(--primary)] text-white"
              : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          {t("myLearnings.tabCompleted")} ({completed.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20">{t("common.loading")}</div>
      ) : activeTab === "ongoing" ? (
        ongoing.length === 0 ? (
          <EmptyState
            title={t("myLearnings.noOngoing")}
            description={t("myLearnings.noOngoingDesc")}
            onAction={() => router.push("/learn")}
            actionLabel={t("myLearnings.startLearning")}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    <div className="group relative flex flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-white p-4 animate-slide-up">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--primary)] opacity-[0.03] rounded-bl-full pointer-events-none group-hover:opacity-[0.06] transition-opacity" />

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
    <div className="mx-auto max-w-lg rounded-[30px] border border-[var(--border)] bg-white p-12 text-center animate-slide-up">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-parchment)] text-[var(--primary)]">
        <Student size={32} weight="duotone" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mb-8 text-[var(--muted)]">{description}</p>
      <button
        onClick={onAction}
        className="rounded-full bg-[var(--primary)] px-8 py-3 text-sm font-medium text-white transition-transform hover:bg-[var(--primary-light)]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
