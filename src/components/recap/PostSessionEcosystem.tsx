"use client";

import Link from "next/link";
import type { Session } from "@/lib/types";
import RecapDashboard from "@/components/recap/RecapDashboard";

interface PostSessionEcosystemProps {
  session: Session;
  onSessionUpdate: (session: Session) => void;
  showHeader?: boolean;
}

const FEATURES = [
  {
    title: "Session Summary",
    description:
      "A markdown recap of the core technical ideas, definitions, and syntax patterns covered in the tutorial.",
  },
  {
    title: "Talk to AI",
    description:
      "A follow-up chat that keeps the transcript and recap as context so learners can ask clarifying questions.",
  },
  {
    title: "Next Steps",
    description:
      "A personalized learning path based on checkpoint performance, weak spots, and areas worth revisiting.",
  },
  {
    title: "Similar YouTube Recommendations",
    description:
      "A curated set of related technical videos with metadata and concept tags to reinforce the lesson.",
  },
];

export default function PostSessionEcosystem({
  session,
  onSessionUpdate,
  showHeader = true,
}: PostSessionEcosystemProps) {
  return (
    <section className="mt-16 space-y-8">
      {showHeader && (
        <div className="rounded-3xl border border-border bg-surface/70 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[var(--primary-text)]">
            Post-Session Recap Ecosystem
          </p>
          <h2 className="mt-3 text-2xl font-black text-foreground sm:text-3xl">
            Everything that happens after the certificate
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            When the learning session ends, the platform keeps working for the learner instead of stopping at completion.
            The recap stack below turns the finished video into a summary, a conversation, a roadmap, and a recommendation feed.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature, index) => (
              <div key={feature.title} className="rounded-2xl border border-border bg-background/50 p-4">
                <p className="text-sm font-bold text-[var(--accent-text)]">
                  {index + 1}. {feature.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/evaluation/${session.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2 text-sm font-bold text-foreground transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)]"
            >
              Open evaluation page
            </Link>
            <Link
              href={`/recap/${session.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white transition-colors hover:opacity-90"
            >
              Open recap view
            </Link>
          </div>
        </div>
      )}

      <RecapDashboard session={session} onSessionUpdate={onSessionUpdate} />
    </section>
  );
}
