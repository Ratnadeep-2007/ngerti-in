"use client";

import { use, useState } from "react";
import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";
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
      <h1 className="mb-4 text-4xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
        {t("certificate.sessionNotFound")}
      </h1>
      <p className="mb-8 text-lg text-[var(--muted)]">
        {t("certificate.sessionNotFoundDesc")}
      </p>
      <Link href="/my-learnings" className="text-lg font-medium text-[var(--primary-text)] hover:underline">
        {t("certificate.backToMyLearnings")}
      </Link>
    </div>
  );
}

function IncompleteState({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-parchment)] text-[var(--error)]">
        <WarningCircle size={34} weight="duotone" />
      </div>
      <h1 className="mb-4 text-4xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
        {t("certificate.notReady")}
      </h1>
      <p className="mb-8 max-w-sm text-lg leading-relaxed text-[var(--muted)]">
        {t("certificate.notReadyDesc")}
      </p>
      <Link
        href={`/learn/${sessionId}`}
        className="apple-pill"
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
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
            Back to certificate
          </Link>
          <div>
            <div className="mb-4 inline-flex items-center rounded-full bg-[var(--success)] px-4 py-2 text-sm font-semibold text-white">
              Post-session evaluation
            </div>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] sm:text-5xl">
              {t("certificate.title")}
            </h1>
            <p className="mt-4 text-xl font-medium text-[var(--muted)]">
              {session.metadata.title}
            </p>
          </div>
        </div>

        <PostSessionEcosystem session={session} onSessionUpdate={setSession} />
      </main>
    </div>
  );
}
