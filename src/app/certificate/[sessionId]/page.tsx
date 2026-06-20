"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { WarningCircle, Certificate, SealCheck } from "@phosphor-icons/react";
import { getSession } from "@/lib/session";
import { getLanguageName } from "@/lib/languages";
import { getCompanion } from "@/lib/companions";
import type { Session } from "@/lib/types";
import { useTranslation } from "@/contexts/UILanguageContext";
import PostSessionEcosystem from "@/components/recap/PostSessionEcosystem";

// ---- Date formatter ----

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---- Certificate Design Component ----

interface CertificateProps {
  session: Session;
}

const CertificateDisplay = ({ session }: CertificateProps) => {
  const { t } = useTranslation();
  const labels = session.translatedContent.certificateLabels;
  const companion = session.companionId ? getCompanion(session.companionId) : null;
  const languageName = getLanguageName(session.targetLocale);
  const completionDate = formatDate(session.completedAt ?? session.createdAt);

  return (
    <div 
      id="certificate-content"
      className="relative w-full max-w-[900px] overflow-hidden rounded-[36px] border border-[var(--hairline)] bg-white p-3 shadow-[var(--product-shadow)]"
    >
      {/* Decorative Outer Border Wrap */}
      <div className="relative flex flex-col items-center overflow-hidden rounded-[30px] border border-[var(--hairline)] bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f9_100%)] p-8 text-center sm:p-12">
        
        {/* Floating Companion - Fixed layout */}
        {companion && (
          <div className="pointer-events-none absolute left-4 top-4 z-0 h-32 w-32 opacity-15 sm:h-40 sm:w-40 sm:opacity-70">
            <img 
              src={companion.idleGif} 
              alt={companion.name} 
              className="h-full w-full object-contain apple-product-shadow"
            />
          </div>
        )}

        {/* Corner Accents */}
        <div className="absolute left-0 top-0 z-10 h-10 w-10 border-l-2 border-t-2 border-[var(--primary)]" />
        <div className="absolute right-0 top-0 z-10 h-10 w-10 border-r-2 border-t-2 border-[var(--primary)]" />
        <div className="absolute bottom-0 left-0 z-10 h-10 w-10 border-b-2 border-l-2 border-[var(--primary)]" />
        <div className="absolute bottom-0 right-0 z-10 h-10 w-10 border-b-2 border-r-2 border-[var(--primary)]" />

        <div className="relative z-10 flex flex-col items-center w-full">
          {/* Top Emblem / Header */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-parchment)] text-[var(--primary)]">
              <Certificate size={34} weight="duotone" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-0.5 w-12 bg-[var(--primary)] opacity-50" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--primary-text)]">
                {t("certificate.protocol")}
              </span>
              <div className="h-0.5 w-12 bg-[var(--primary)] opacity-50" />
            </div>
          </div>

          {/* Certificate title */}
          <div className="mb-4">
            <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-6xl text-[var(--foreground)]">
              {labels.title}
            </h1>
            <div className="h-1 w-24 bg-[var(--accent)] mx-auto mt-2 opacity-80" />
          </div>

          <p className="mb-8 text-sm font-semibold uppercase tracking-[0.28em] text-[var(--muted)] opacity-80">
            {labels.awardedTo}
          </p>

          {/* User name Section */}
          <div className="mb-10 relative">
            <p className="px-4 text-center text-5xl font-semibold tracking-[-0.06em] text-[var(--accent-text)] sm:text-7xl">
              {session.userName}
            </p>
            <div className="absolute -bottom-2 left-0 right-0 h-1 bg-[var(--accent)] opacity-30 blur-[1px]" />
          </div>

          {/* For completing label + video title */}
          <div className="mb-10 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
              {labels.forCompleting}
            </p>
            <div className="relative inline-block max-w-lg rounded-[22px] border border-[var(--hairline)] bg-white px-8 py-4">
              <p className="text-2xl font-semibold italic leading-tight text-[var(--foreground)]">
                &ldquo;{session.metadata.title}&rdquo;
              </p>
            </div>
          </div>

          {/* Meta info grid - Badges */}
          <div className="grid w-full grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="flex flex-col items-center rounded-[20px] border border-[var(--hairline)] bg-white p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary-text)]">
                {labels.completionDate}
              </p>
              <p className="text-lg font-semibold text-[var(--foreground)]">
                {completionDate}
              </p>
            </div>
            <div className="flex flex-col items-center rounded-[20px] border border-[var(--hairline)] bg-white p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary-text)]">
                {labels.language}
              </p>
              <p className="text-lg font-semibold text-[var(--foreground)]">
                {languageName}
              </p>
            </div>
            <div className="flex flex-col items-center rounded-[20px] border border-[var(--hairline)] bg-white p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary-text)]">
                {t("certificate.mode")}
              </p>
              <p className="text-lg font-semibold capitalize text-[var(--foreground)]">
                {session.mode}
              </p>
            </div>
          </div>

          {/* Footer Seal */}
          <div className="mt-4 flex w-full items-center justify-between border-t border-[var(--hairline)] pt-8">
            <div className="text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("certificate.verificationId")}</p>
              <p className="text-xs font-mono text-[var(--primary-text)]">{session.id.slice(0, 8).toUpperCase()}</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-parchment)] text-[var(--primary)]">
                <SealCheck size={20} weight="duotone" />
              </div>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {labels.poweredBy}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("certificate.status")}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--success-text)]">{t("certificate.verifiedLead")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Action Buttons ----

interface ActionBarProps {
  session: Session;
}

function ActionBar({ session }: ActionBarProps) {
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const { t } = useTranslation();

  async function handleDownloadPDF() {
    const content = document.getElementById("certificate-content");
    if (!content) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      // Set explicit dimensions for capture to avoid responsive layout shifts
      const originalWidth = content.offsetWidth;
      const originalHeight = content.offsetHeight;

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#12122a",
        width: originalWidth,
        height: originalHeight,
        windowWidth: 1200, // Force a desktop-like width for cleaner layout in PDF
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [originalWidth, originalHeight],
      });

      pdf.addImage(imgData, "PNG", 0, 0, originalWidth, originalHeight);
      pdf.save(`LingoDev_Certificate_${session.userName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-4">
      {/* Download PDF */}
      <button
        type="button"
        onClick={handleDownloadPDF}
        disabled={downloading}
        className="apple-pill"
        style={{
          opacity: downloading ? 0.7 : 1,
          cursor: downloading ? "not-allowed" : "pointer",
        }}
      >
        {downloading ? t("certificate.downloading") : t("certificate.downloadPDF")}
      </button>
      {downloadError && (
        <p className="text-xs mt-2 text-center" style={{ color: "var(--error)" }}>
          Download failed. Try again or use your browser&apos;s print function.
        </p>
      )}

      {/* Share */}
      <button
        type="button"
        onClick={handleShare}
        className="apple-pill-secondary"
      >
        {copying ? t("certificate.linkCopied") : t("certificate.share")}
      </button>
    </div>
  );
}

// ---- Incomplete state ----

function IncompletePage({ sessionId }: { sessionId: string }) {
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

// ---- Not found state ----

function NotFoundPage() {
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

// ---- Main Page ----

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function CertificatePage({ params }: PageProps) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const { t } = useTranslation();

  useEffect(() => {
    const s = getSession(sessionId);
    setSession(s);
  }, [sessionId]);

  // Loading
  if (session === undefined) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--background)" }}
      >
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

  // Not found
  if (!session) return <NotFoundPage />;

  // Check completion — requires final quiz to be passed
  const isComplete = session.progress.finalQuizPassed === true;

  if (!isComplete) return <IncompletePage sessionId={sessionId} />;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-24 sm:px-6">
        {/* Header */}
        <div className="mb-10 animate-fade-in text-center flex flex-col items-center">
          <Link
            href="/my-learnings"
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
            {t("certificate.backToMyLearnings")}
          </Link>

          <div>
            <div className="mb-4 inline-flex items-center rounded-full bg-[var(--success)] px-4 py-2 text-sm font-semibold text-white">
              {t("certificate.courseCompleted")}
            </div>

            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] sm:text-5xl">
              {t("certificate.title")}
            </h1>
            <p className="mt-4 text-xl font-medium text-[var(--muted)]">
              {t("certificate.congratulations", { name: session.userName })}
            </p>
          </div>
        </div>

        {/* The Certificate */}
        <div className="animate-slide-up flex justify-center w-full">
          <CertificateDisplay session={session} />
        </div>

        {/* Action buttons */}
        <ActionBar session={session} />

        {/* Footer note */}
        <p className="mt-12 border-t border-[var(--hairline)] pt-8 text-center text-lg text-[var(--muted)]">
          {t("certificate.shareOrDownload")}
        </p>

        <PostSessionEcosystem session={session} onSessionUpdate={setSession} />
      </main>
    </div>
  );
}
