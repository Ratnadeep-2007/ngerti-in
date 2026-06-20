"use client";

import { use, useState } from "react";
import Link from "next/link";
import { getSession } from "@/lib/session";
import type { Session } from "@/lib/types";
import { useTranslation } from "@/contexts/UILanguageContext";
import PostSessionEcosystem from "@/components/recap/PostSessionEcosystem";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

function LoadingState() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="flex items-center gap-3" style={{ color: "var(--muted)" }}>
        <svg className="animate-spin" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="var(--border)" strokeWidth="2.5" />
          <path d="M10 2a8 8 0 018 8" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="text-sm">{t("certificate.loading")}</span>
      </div>
    </div>
  );
}

function NotFoundState() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-4xl font-extrabold text-[var(--foreground)] pixel-text-strong">
        {t("certificate.sessionNotFound")}
      </h1>
      <p className="mb-8 text-lg text-[var(--muted)] pixel-text">
        {t("certificate.sessionNotFoundDesc")}
      </p>
      <Link href="/my-learnings" className="text-xl font-bold text-[var(--primary-text)] hover:underline pixel-text">
        {t("certificate.backToMyLearnings")}
      </Link>
    </div>
  );
}

function IncompleteState({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center bg-[var(--error)] text-white text-5xl font-bold pixel-border">
        !
      </div>
      <h1 className="mb-4 text-4xl font-extrabold text-[var(--foreground)] pixel-text-strong">
        {t("certificate.notReady")}
      </h1>
      <p className="mb-8 max-w-sm text-lg leading-relaxed text-[var(--muted)] pixel-text">
        {t("certificate.notReadyDesc")}
      </p>
      <Link
        href={`/learn/${sessionId}`}
        className="flex items-center gap-2 px-6 py-4 text-xl font-bold transition-transform hover:scale-105 glass-panel pixel-border bg-[var(--primary)] text-white hover:bg-[var(--primary-light)]"
      >
        {t("certificate.continueLearning")}
      </Link>
    </div>
  );
}

export default function EvaluationPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null | undefined>(() => getSession(sessionId));

  if (session === undefined) return <LoadingState />;
  if (!session) return <NotFoundState />;
  if (session.progress.finalQuizPassed !== true) return <IncompleteState sessionId={sessionId} />;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-24 sm:px-6">
        <div className="mb-10 animate-fade-in text-center flex flex-col items-center">
          <Link
            href={`/certificate/${sessionId}`}
            className="mb-8 inline-flex items-center gap-2 text-lg font-bold transition-transform hover:scale-105 glass-panel pixel-border px-4 py-2 hover:bg-[var(--primary)] hover:text-white text-[var(--foreground)]"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
            Back to certificate
          </Link>
          <div>
            <div className="mb-4 inline-flex items-center px-4 py-2 text-lg font-bold bg-[var(--success)] text-white pixel-border animate-pulse shadow-md">
              Post-session evaluation
            </div>
            <h1 className="text-4xl font-extrabold sm:text-5xl pixel-text-strong tracking-wide text-[var(--foreground)]">
              {t("certificate.title")}
            </h1>
            <p className="mt-4 text-xl pixel-text text-[var(--muted)] font-medium">
              {session.metadata.title}
            </p>
          </div>
        </div>

        <PostSessionEcosystem session={session} onSessionUpdate={setSession} />
      </main>
    </div>
  );
}
