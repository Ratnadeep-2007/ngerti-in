"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RecapChatProps {
  summaryContext: string;
  transcriptContext: string;
  isContextReady?: boolean;
  sessionTitle?: string;
}

export default function RecapChat({
  summaryContext,
  transcriptContext,
  isContextReady = true,
  sessionTitle = "this session",
}: RecapChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/recap-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          summaryContext: summaryContext || `The user watched a video titled: "${sessionTitle}"`,
          transcriptContext: transcriptContext || "",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const { reply } = await res.json();
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `⚠️ I couldn't fetch a response right now. ${errMsg.includes("Token") ? "The AI is rate-limited — please try again in a moment." : `Error: ${errMsg}`}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const canSend = input.trim().length > 0 && !isLoading && isContextReady;

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-border overflow-hidden">
      {/* Context loading banner */}
      {!isContextReady && (
        <div className="px-4 py-2 text-xs text-muted bg-surface-light border-b border-border flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Loading session context — AI chat will be ready shortly…
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted mt-10 space-y-2">
            <p className="text-2xl">💬</p>
            <p className="text-sm font-medium">Ask me anything about the session!</p>
            {!isContextReady && (
              <p className="text-xs opacity-70">
                Context is still loading — you can ask once it&apos;s ready.
              </p>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : "bg-surface-light border border-border text-foreground rounded-bl-md"
              }`}
            >
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-black/30 prose-pre:text-xs prose-code:text-xs">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-light border border-border rounded-2xl rounded-bl-md px-4 py-3 text-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-surface-light">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
            placeholder={isContextReady ? "Type your question…" : "Waiting for session context…"}
            value={input}
            disabled={!isContextReady}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className="bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
