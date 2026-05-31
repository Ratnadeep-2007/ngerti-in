import React, { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { GeneratedAvatar } from "@/components/generated-avatar";
import Markdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RecapChatUIProps {
  meetingId: string;
  meetingName: string;
  userId: string;
  userName: string;
  userImage: string | undefined;
  agentName: string;
  agentId?: string;
}

export const RecapChatUI = ({
  meetingId,
  meetingName,
  userId,
  userImage,
  userName,
  agentName,
  agentId,
}: RecapChatUIProps) => {
  const trpc = useTRPC();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { mutateAsync: askAI, isPending: isThinking } = useMutation(
    trpc.meetings.askPostMeetingAI.mutationOptions(),
  );

  // Set initial welcome message
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Hi ${userName}! I am your AI Tutor, **${agentName}**. We've wrapped up our session on **${meetingName}**. 

I have analyzed the transcript and summary of our meeting. How can I help you review, clarify, or explain anything we went over?`,
      },
    ]);
  }, [agentName, meetingName, userName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message locally
    const updatedMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(updatedMessages);

    try {
      // Send chat history to backend AI (excluding the first welcome message)
      const apiMessages = updatedMessages.slice(1);

      const response = await askAI({
        meetingId,
        messages: apiMessages,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.text },
      ]);
    } catch (error) {
      console.error("Error asking AI:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="bg-[#101213] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[550px] shadow-2xl relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center relative">
            <Sparkles className="size-5 text-purple-400" />
            <span className="absolute bottom-0 right-0 size-2.5 bg-emerald-500 border-2 border-[#101213] rounded-full animate-pulse"></span>
          </div>
          <div>
            <h3 className="font-bold text-gray-100">{agentName}</h3>
            <p className="text-xs text-purple-400/90 font-medium">Ask questions about your meeting</p>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/5">
        {messages.map((msg, index) => {
          const isAI = msg.role === "assistant";
          return (
            <div
              key={index}
              className={`flex gap-4 max-w-[85%] ${isAI ? "" : "ml-auto flex-row-reverse"}`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                {isAI ? (
                  <GeneratedAvatar
                    seed={agentName}
                    variant="botttsNeutral"
                    className="size-8 rounded-full border border-purple-500/30"
                  />
                ) : (
                  <GeneratedAvatar
                    seed={userName}
                    variant="initials"
                    className="size-8 rounded-full border border-white/10"
                  />
                )}
              </div>

              {/* Message Bubble */}
              <div className="flex flex-col gap-1">
                <span className={`text-[10px] font-semibold tracking-wider uppercase ${isAI ? "text-purple-400" : "text-gray-400"} ${isAI ? "" : "text-right"}`}>
                  {isAI ? agentName : "You"}
                </span>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-md ${
                    isAI
                      ? "bg-white/5 border border-white/5 text-gray-100 rounded-tl-none"
                      : "bg-purple-600 text-white rounded-tr-none"
                  }`}
                >
                  {isAI ? (
                    <div className="prose prose-invert max-w-none text-gray-100 prose-sm prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/5">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex gap-4 max-w-[85%]">
            <div className="flex-shrink-0">
              <GeneratedAvatar
                seed={agentName}
                variant="botttsNeutral"
                className="size-8 rounded-full border border-purple-500/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-purple-400">
                {agentName}
              </span>
              <div className="px-4 py-3 bg-white/5 border border-white/5 text-purple-300 rounded-2xl rounded-tl-none flex items-center gap-2.5 text-sm shadow-md">
                <Loader2 className="size-4 animate-spin text-purple-400" />
                <span>Typing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-white/5">
        <div className="relative flex items-center bg-[#171a1c] border border-white/5 rounded-xl px-4 py-2 focus-within:border-purple-500/50 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${agentName} anything about this session...`}
            rows={1}
            disabled={isThinking}
            className="flex-1 bg-transparent text-white placeholder-gray-500 border-none outline-none focus:ring-0 text-sm resize-none pr-12 max-h-24 overflow-y-auto"
            style={{ height: "auto" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="absolute right-3 p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:bg-white/5 disabled:text-gray-500 transition-colors"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
