"use client";

import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import { motion } from "framer-motion";
import { updateSession } from "@/lib/session";
import type { RecapChatMessage, Session, YouTubeRecommendation } from "@/lib/types";

interface RecapDashboardProps {
  session: Session;
  onSessionUpdate: (session: Session) => void;
}

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

export default function RecapDashboard({ session, onSessionUpdate }: RecapDashboardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const recap = session.recap ?? { chatMessages: [] };
  const focus = session.focusEvaluation;
  const transcript = useMemo(
    () => session.rawTranscript ?? session.originalTranscript,
    [session.rawTranscript, session.originalTranscript]
  );
  const quizScores = useMemo(
    () => session.progress.quizScores ?? [],
    [session.progress.quizScores]
  );

  const checkpointAverage = useMemo(() => {
    if (!quizScores.length) return null;
    const total = quizScores.reduce((sum, score) => sum + score.correct / Math.max(1, score.total), 0);
    return Math.round((total / quizScores.length) * 100);
  }, [quizScores]);

  useEffect(() => {
    if (recap.summaryMarkdown || isGenerating) return;

    async function generateRecap() {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const recapRes = await fetch("/api/session-recap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            videoTitle: session.metadata.title,
            transcript,
            quizScores,
          }),
        });

        const recapData = await recapRes.json() as {
          summaryMarkdown?: string;
          nextSteps?: string[];
          recommendedQueries?: string[];
          error?: string;
        };
        if (!recapRes.ok) throw new Error(recapData.error || "Recap generation failed");

        let recommendations: YouTubeRecommendation[] = [];
        let recommendationsError: string | undefined;

        try {
          const youtubeRes = await fetch("/api/youtube-recommendations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ queries: recapData.recommendedQueries ?? [] }),
          });

          const youtubeData = await youtubeRes.json() as {
            recommendations?: YouTubeRecommendation[];
            error?: string;
          };
          if (!youtubeRes.ok) throw new Error(youtubeData.error || "YouTube recommendations failed");
          recommendations = youtubeData.recommendations ?? [];
        } catch (error) {
          recommendationsError = error instanceof Error ? error.message : "YouTube recommendations failed";
        }

        const updated = updateSession(session.id, {
          recap: {
            summaryMarkdown: recapData.summaryMarkdown,
            nextSteps: recapData.nextSteps ?? [],
            recommendations,
            recommendationsError,
            chatMessages: recap.chatMessages,
            generatedAt: new Date().toISOString(),
          },
        });

        if (updated) onSessionUpdate(updated);
      } catch (error) {
        setGenerationError(error instanceof Error ? error.message : "Recap generation failed");
      } finally {
        setIsGenerating(false);
      }
    }

    generateRecap();
  }, [
    isGenerating,
    onSessionUpdate,
    quizScores,
    recap.chatMessages,
    recap.summaryMarkdown,
    session.id,
    session.metadata.title,
    transcript,
  ]);

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || isChatting) return;

    const userMessage: RecapChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...recap.chatMessages, userMessage];
    setChatInput("");
    setIsChatting(true);

    const optimistic = updateSession(session.id, {
      recap: { ...recap, chatMessages: nextMessages },
    });
    if (optimistic) onSessionUpdate(optimistic);

    try {
      const res = await fetch("/api/recap-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: session.metadata.title,
          transcript,
          summaryMarkdown: recap.summaryMarkdown,
          messages: nextMessages,
        }),
      });

      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Chat failed");

      const assistantMessage: RecapChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message ?? "",
        createdAt: new Date().toISOString(),
      };

      const updated = updateSession(session.id, {
        recap: { ...recap, chatMessages: [...nextMessages, assistantMessage] },
      });
      if (updated) onSessionUpdate(updated);
    } catch (error) {
      const assistantMessage: RecapChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: error instanceof Error ? error.message : "The recap chat is unavailable right now.",
        createdAt: new Date().toISOString(),
      };
      const updated = updateSession(session.id, {
        recap: { ...recap, chatMessages: [...nextMessages, assistantMessage] },
      });
      if (updated) onSessionUpdate(updated);
    } finally {
      setIsChatting(false);
    }
  }

  return (
    <section className="mt-16 space-y-8" aria-label="Post-session recap">
      <motion.div {...reveal} className="rounded-2xl border border-border bg-surface/70 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary-text)]">Session Summary</p>
        <div className="mt-4 max-w-none text-sm leading-7 text-[var(--foreground)]">
          {isGenerating && !recap.summaryMarkdown ? (
            <p className="text-muted">Generating your AI recap...</p>
          ) : generationError ? (
            <p className="text-sm" style={{ color: "var(--error)" }}>{generationError}</p>
          ) : (
            <Markdown
              components={{
                h1: ({ children }) => <h2 className="mb-3 text-2xl font-black">{children}</h2>,
                h2: ({ children }) => <h3 className="mb-2 mt-5 text-xl font-bold">{children}</h3>,
                h3: ({ children }) => <h4 className="mb-2 mt-4 text-base font-bold">{children}</h4>,
                p: ({ children }) => <p className="mb-3 text-muted">{children}</p>,
                ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5 text-muted">{children}</ul>,
                ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5 text-muted">{children}</ol>,
                code: ({ children }) => <code className="rounded bg-black/30 px-1.5 py-0.5 text-[var(--accent-text)]">{children}</code>,
                a: ({ href, children }) => <a className="text-[var(--primary-text)] underline" href={href} target="_blank" rel="noreferrer">{children}</a>,
              }}
            >
              {recap.summaryMarkdown ?? "No recap generated yet."}
            </Markdown>
          )}
        </div>
      </motion.div>

      <motion.div {...reveal} className="grid gap-4 md:grid-cols-4">
        <ScoreCard label="Focus Score" value={focus?.focusScore} fallback="No camera data" />
        <ScoreCard label="Calmness Score" value={focus?.calmnessScore} fallback="No camera data" />
        <ScoreCard label="Posture Score" value={focus?.postureScore} fallback="No camera data" />
        <ScoreCard label="Quiz Average" value={checkpointAverage ?? undefined} fallback="No quiz score data" />
      </motion.div>

      <motion.div {...reveal} className="rounded-2xl border border-border bg-surface/70 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary-text)]">Next Steps</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(recap.nextSteps ?? []).length > 0 ? (
            recap.nextSteps?.map((step, index) => (
              <div key={`${index}-${step}`} className="rounded-xl border border-border bg-background/40 p-4">
                <p className="text-sm font-bold text-[var(--accent-text)]">Step {index + 1}</p>
                <p className="mt-2 text-sm text-muted">{step}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Next steps will appear after the recap is generated.</p>
          )}
        </div>
      </motion.div>

      <motion.div {...reveal} className="rounded-2xl border border-border bg-surface/70 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary-text)]">Talk to AI</p>
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
          {recap.chatMessages.length === 0 && (
            <p className="text-sm text-muted">Ask anything about the completed video.</p>
          )}
          {recap.chatMessages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
              <div className="inline-block max-w-[85%] rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground">
                {message.content}
              </div>
            </div>
          ))}
          {isChatting && <p className="text-sm text-muted">AI Tutor is thinking...</p>}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void sendChatMessage();
            }}
            placeholder="Ask a follow-up question..."
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
          />
          <button
            type="button"
            onClick={() => void sendChatMessage()}
            disabled={isChatting}
            className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </motion.div>

      <motion.div {...reveal} className="rounded-2xl border border-border bg-surface/70 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary-text)]">Similar YouTube Videos</p>
        {recap.recommendationsError && (
          <p className="mt-3 text-sm" style={{ color: "var(--error)" }}>{recap.recommendationsError}</p>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(recap.recommendations ?? []).map((video) => (
            <a
              key={video.videoId}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-xl border border-border bg-background/40 transition-transform hover:scale-[1.01]"
            >
              {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />}
              <div className="p-4">
                <p className="line-clamp-2 text-sm font-bold text-foreground">{video.title}</p>
                <p className="mt-1 text-xs text-muted">{video.channelTitle}</p>
                <p className="mt-3 text-xs text-[var(--accent-text)]">{video.conceptTags.join(", ")}</p>
              </div>
            </a>
          ))}
          {!recap.recommendationsError && (recap.recommendations ?? []).length === 0 && (
            <p className="text-sm text-muted">Recommendations will appear after the recap is generated.</p>
          )}
        </div>
      </motion.div>
    </section>
  );
}

function ScoreCard({ label, value, fallback }: { label: string; value?: number; fallback: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-3 text-3xl font-black text-foreground">{typeof value === "number" ? `${value}%` : "--"}</p>
      <p className="mt-2 text-xs text-muted">{typeof value === "number" ? "Session measured" : fallback}</p>
    </div>
  );
}
