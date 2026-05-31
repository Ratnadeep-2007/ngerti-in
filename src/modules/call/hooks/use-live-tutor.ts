import { useState, useEffect, useRef, useCallback } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Call } from "@stream-io/video-react-sdk";

interface UseLiveTutorProps {
  meetingId: string;
  agentId: string;
  agentName: string;
  call?: Call;
  hasMicPermission?: boolean;
}

export const useLiveTutor = ({
  meetingId,
  agentId,
  agentName,
  call,
  hasMicPermission = false,
}: UseLiveTutorProps) => {
  const trpc = useTRPC();
  const [isTutorEnabled, setIsTutorEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastSpeech, setLastSpeech] = useState<{ speaker: string; text: string } | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  const lastSpeakTimeRef = useRef<number>(0);
  
  // Stable refs for state to prevent recreation of SpeechRecognition
  const isTutorEnabledRef = useRef(false);
  const isListeningRef = useRef(false);
  const isThinkingRef = useRef(false);

  useEffect(() => {
    isTutorEnabledRef.current = isTutorEnabled;
  }, [isTutorEnabled]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  const { mutateAsync: talkToAgent } = useMutation(
    trpc.meetings.talkToAgent.mutationOptions(),
  );

  // Safely attempt starting speech recognition
  const startSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return;
    try {
      isListeningRef.current = true;
      recognitionRef.current.start();
    } catch (err) {
      console.warn("SpeechRecognition start ignored:", err);
    }
  }, []);

  // Safely stop speech recognition
  const stopSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current || !isListeningRef.current) return;
    try {
      isListeningRef.current = false;
      recognitionRef.current.stop();
    } catch (err) {
      console.warn("SpeechRecognition stop ignored:", err);
    }
  }, []);

  // Check and restart listening if applicable
  const maybeRestart = useCallback(() => {
    if (isTutorEnabledRef.current && !isThinkingRef.current && !isSpeakingRef.current) {
      setTimeout(() => {
        if (isTutorEnabledRef.current && !isThinkingRef.current && !isSpeakingRef.current) {
          startSpeechRecognition();
        }
      }, 300);
    }
  }, [startSpeechRecognition]);

  // Audio response synthesis (Text-to-Speech)
  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      isSpeakingRef.current = false;
      maybeRestart();
      return;
    }

    // Set speaking active immediately to prevent race conditions
    isSpeakingRef.current = true;
    lastSpeakTimeRef.current = Date.now();

    // Stop speech recognition while speaking to prevent feedback loop / self-interruption
    stopSpeechRecognition();

    // Clean up markdown/formatting before speaking
    const cleanText = text
      .replace(/[*#_`~[\]]/g, "") // remove formatting characters
      .replace(/\([^)]*\)/g, "") // remove parentheticals
      .trim();

    window.speechSynthesis.cancel(); // Stop any current speech

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";
    
    // Choose a friendly voice if available
    const voices = window.speechSynthesis.getVoices();
    const friendlyVoice = voices.find(
      (v) =>
        v.name.includes("Google US English") ||
        v.name.includes("Natural") ||
        v.name.includes("Samantha"),
    );
    if (friendlyVoice) utterance.voice = friendlyVoice;

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      lastSpeakTimeRef.current = Date.now();
      stopSpeechRecognition();
    };

    const handleSpeechEnd = () => {
      isSpeakingRef.current = false;
      maybeRestart();
    };

    utterance.onend = handleSpeechEnd;
    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      handleSpeechEnd();
    };

    window.speechSynthesis.speak(utterance);
  }, [stopSpeechRecognition, maybeRestart]);

  // Listen to Stream Call custom events for real-time synchronization
  useEffect(() => {
    if (!call) return;

    const handleCustomEvent = (event: any) => {
      const { type, payload } = event.custom;
      if (!payload) return;

      if (type === "ai-thinking") {
        setIsThinking(payload.active);
      } else if (type === "user-speech") {
        setLastSpeech({ speaker: payload.userName, text: payload.text });
      } else if (type === "ai-voice") {
        setLastSpeech({ speaker: agentName, text: payload.text });
        // Play speech for everyone if it wasn't played locally by the sender (e.g. whiteboard RAG vision response)
        const isSender = event.user.id === call.currentUserId;
        if (!isSender || !payload.senderPlayedLocally) {
          speakText(payload.text);
        }
      }
    };

    const unsubscribe = call.on("custom", handleCustomEvent);
    return () => {
      unsubscribe();
    };
  }, [call, agentName, speakText]);

  // Handle sending text to AI agent
  const handleSendToAI = async (text: string) => {
    if (!text.trim() || isThinkingRef.current || !call) return;

    // Stop listening during processing
    stopSpeechRecognition();

    setIsThinking(true);
    // Broadcast AI is thinking
    call.sendCustomEvent({
      type: "ai-thinking",
      payload: { active: true },
    });

    try {
      // Query Gemini via tRPC
      const response = await talkToAgent({
        meetingId,
        text,
      });

      // Play locally for the sender immediately to reduce latency feel
      speakText(response.text);
      setLastSpeech({ speaker: agentName, text: response.text });

      // Broadcast the response so other participants hear and see it
      call.sendCustomEvent({
        type: "ai-voice",
        payload: { text: response.text, senderPlayedLocally: true },
      });

    } catch (err) {
      console.error("Error talking to AI:", err);
      toast.error("Failed to get response from AI Tutor");
      maybeRestart();
    } finally {
      setIsThinking(false);
      call.sendCustomEvent({
        type: "ai-thinking",
        payload: { active: false },
      });
      // Fallback delay restart in case speech synthesis failed to invoke start/end events
      setTimeout(() => {
        maybeRestart();
      }, 500);
    }
  };

  // Sync refs to avoid re-triggering the SpeechRecognition initialization effect
  const handleSendToAIRef = useRef(handleSendToAI);
  const callRef = useRef(call);
  const maybeRestartRef = useRef(maybeRestart);

  useEffect(() => {
    handleSendToAIRef.current = handleSendToAI;
  }, [handleSendToAI]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    maybeRestartRef.current = maybeRestart;
  }, [maybeRestart]);

  // Initialize browser Speech Recognition exactly once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsListening(true);
      setTranscript("");
    };

    // Immediately stop synthesis when user starts speaking (barge-in interruption)
    const handleInterruption = () => {
      const timeSinceSpeak = Date.now() - lastSpeakTimeRef.current;
      // Cooldown of 1.5 seconds to avoid AI interrupting itself with its own voice echo
      if (isSpeakingRef.current && timeSinceSpeak > 1500 && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
        
        // Broadcast AI is silenced to other participants
        const currentCall = callRef.current;
        if (currentCall) {
          currentCall.sendCustomEvent({
            type: "ai-thinking",
            payload: { active: false },
          });
        }
      }
    };

    rec.onsoundstart = handleInterruption;
    rec.onspeechstart = handleInterruption;

    rec.onresult = async (event: any) => {
      const resultText = event.results[0][0].transcript;
      setTranscript(resultText);

      // Final fallback to cancel speech when transcription result is parsed
      if (isSpeakingRef.current && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
      }

      const currentCall = callRef.current;
      if (resultText.trim() && currentCall) {
        currentCall.sendCustomEvent({
          type: "user-speech",
          payload: {
            text: resultText,
            userName: currentCall.state.localParticipant?.name || "Student",
          },
        });
        setLastSpeech({
          speaker: currentCall.state.localParticipant?.name || "Student",
          text: resultText,
        });
        await handleSendToAIRef.current(resultText);
      }
    };

    rec.onerror = (e: any) => {
      const errorType = e.error;
      if (errorType !== "aborted" && errorType !== "no-speech") {
        console.error("Speech recognition error:", errorType);
        
        // Disable tutor on critical capture/permission errors to prevent loops
        if (
          errorType === "audio-capture" || 
          errorType === "not-allowed" || 
          errorType === "service-not-allowed"
        ) {
          toast.error(`Speech recognition failed: ${errorType === "audio-capture" ? "microphone already in use or disabled" : errorType}. Talk to AI disabled.`);
          setIsTutorEnabled(false);
          isTutorEnabledRef.current = false;
          setIsListening(false);
          isListeningRef.current = false;
          return;
        }
      }
      setIsListening(false);
      isListeningRef.current = false;
    };

    rec.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      maybeRestartRef.current();
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {}
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleTutor = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const nextState = !isTutorEnabledRef.current;
    setIsTutorEnabled(nextState);
    isTutorEnabledRef.current = nextState;

    if (nextState) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      isSpeakingRef.current = false;
      setIsThinking(false);
      isThinkingRef.current = false;
    }
  }, [startSpeechRecognition, stopSpeechRecognition]);

  return {
    isTutorEnabled,
    isListening,
    isThinking,
    transcript,
    lastSpeech,
    toggleTutor,
    speakText,
    handleSendToAI,
  };
};
