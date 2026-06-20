"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { getSession } from "@/lib/session";
import type { Session } from "@/lib/types";
import RecapChat from "@/components/recap/RecapChat";

export default function RecapDashboardPage() {
  const params = useParams();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const [session, setSession] = useState<Session | null>(null);

  const [summary, setSummary] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [youtubeRecommendations, setYoutubeRecommendations] = useState<any[]>([]);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingNextSteps, setLoadingNextSteps] = useState(true);
  const [loadingYoutube, setLoadingYoutube] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (s) {
      setSession(s);
      
      const transcriptWindow = s.rawTranscript || s.originalTranscript;
      
      // Fetch summary
      fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptWindow, title: s.metadata.title })
      }).then(res => res.json()).then(data => {
        if (data.summary) setSummary(data.summary);
      }).catch(console.error).finally(() => setLoadingSummary(false));

      // Fetch next steps
      fetch("/api/generate-next-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionData: s })
      }).then(res => res.json()).then(data => {
        if (data.nextSteps) setNextSteps(data.nextSteps);
      }).catch(console.error).finally(() => setLoadingNextSteps(false));

      // Fetch youtube recommendations
      fetch(`/api/youtube-recommendations?title=${encodeURIComponent(s.metadata.title)}`)
        .then(res => res.json()).then(data => {
          if (data.recommendations) setYoutubeRecommendations(data.recommendations);
        }).catch(console.error).finally(() => setLoadingYoutube(false));
    }
  }, [sessionId]);

  const transcriptContextText = useMemo(() => {
    if (!session) return "";
    return (session.rawTranscript || session.originalTranscript)
      .map(s => `[${s.start}] ${s.text}`).join("\\n");
  }, [session]);

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Post-Session Recap</h1>
            <p className="text-sm text-muted mt-1">{session.metadata.title}</p>
          </div>
          <Link href="/my-learnings" className="bg-surface-light border border-border px-4 py-2 rounded-lg font-medium hover:bg-surface transition-colors">
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Summary & Next Steps */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              📝 Session Summary
            </h2>
            {loadingSummary ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-surface-light rounded w-3/4"></div>
                <div className="h-4 bg-surface-light rounded w-full"></div>
                <div className="h-4 bg-surface-light rounded w-5/6"></div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none prose-pre:bg-surface-light prose-pre:border prose-pre:border-border">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            )}
          </section>

          <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              🚀 Next Steps (Learning Path)
            </h2>
            {loadingNextSteps ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-surface-light rounded w-1/2"></div>
                <div className="h-4 bg-surface-light rounded w-2/3"></div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{nextSteps}</ReactMarkdown>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              📺 Similar YouTube Recommendations
            </h2>
            {loadingYoutube ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="animate-pulse bg-surface border border-border rounded-xl h-48"></div>
                ))}
              </div>
            ) : youtubeRecommendations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {youtubeRecommendations.map(video => (
                  <a
                    key={video.id}
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex flex-col bg-surface border border-border rounded-xl overflow-hidden hover:border-primary transition-colors shadow-sm"
                  >
                    <div className="aspect-video relative overflow-hidden bg-surface-light">
                      <img src={video.thumbnail} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors" dangerouslySetInnerHTML={{ __html: video.title }}></h3>
                      <p className="text-xs text-muted mt-2">{video.channelTitle}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-muted">No recommendations found.</p>
            )}
          </section>
        </div>

        {/* Right Column: Recap Chat */}
        <div className="lg:col-span-1 h-[600px] lg:h-[calc(100vh-140px)] sticky top-24">
          <div className="h-full flex flex-col">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              💬 Talk to AI
            </h2>
            <div className="flex-1 min-h-0">
              <RecapChat summaryContext={summary} transcriptContext={transcriptContextText} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
