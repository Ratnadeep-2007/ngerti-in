"use client";

import ReactMarkdown from "react-markdown";
import type { FocusEvaluation } from "@/lib/types";

export default function FaceTrackingReport({ focus }: { focus?: FocusEvaluation }) {
  const report = focus?.groqEvaluation;

  if (!report) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface/70 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary-text)]">
          Groq Face Review
        </p>
        <span className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-xs text-muted">
          {focus.sampleCount} samples
        </span>
        <span className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-xs text-muted">
          Face presence {Math.round(focus.facePresenceRatio * 100)}%
        </span>
      </div>

      <h3 className="mt-4 text-xl font-black text-foreground">{report.headline}</h3>

      <div className="mt-4 max-w-none text-sm leading-7 text-muted">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-3">{children}</p>,
            ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5">{children}</ol>,
            strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
          }}
        >
          {report.summaryMarkdown}
        </ReactMarkdown>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ReportList title="Strengths" items={report.strengths} />
        <ReportList title="Concerns" items={report.concerns} />
        <ReportList title="Suggestions" items={report.suggestions} />
      </div>
    </section>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary-text)]">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="rounded-lg border border-border/60 bg-surface/40 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
