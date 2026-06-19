import { useState, useEffect, useRef, useCallback } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Call } from "@stream-io/video-react-sdk";
import confetti from "canvas-confetti";
import { getDeepgramKey } from "../actions/get-deepgram-key";

const extractAndStripDrawing = (text: string) => {
  const excalidrawRegex = /```excalidraw\n([\s\S]*?)\n```/;
  const match = text.match(excalidrawRegex);
  let elements: any[] = [];
  let cleanText = text;

  if (match) {
    try {
      elements = JSON.parse(match[1]);
      cleanText = text.replace(excalidrawRegex, "").trim();
    } catch (err) {
      console.error("Failed to parse Excalidraw JSON from AI response:", err);
    }
  }

  return { cleanText, elements };
};

const checkPraiseAndTriggerConfetti = (text: string) => {
  const praiseKeywords = [
    "correct",
    "great job",
    "spot on",
    "awesome",
    "perfect",
    "excellent",
    "well done",
    "amazing",
    "wonderful",
    "fantastic",
    "spot-on",
  ];
  const lowerText = text.toLowerCase();
  const hasPraise = praiseKeywords.some((keyword) => lowerText.includes(keyword));

  if (hasPraise) {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.5 },
      });
    } catch (err) {
      console.error("Failed to run confetti:", err);
    }
  }
};

const resolveDeepgramLanguage = (language?: string) => {
  if (!language) return undefined;
  if (language.startsWith("hi")) return "hi";
  if (language.startsWith("en")) return "en";
  return undefined;
};

const resolveDeepgramTtsModel = (_language?: string) => "aura-2-thalia-en";

interface UseLiveTutorProps {
  meetingId: string;
  agentId: string;
  agentName: string;
  call?: Call;
  hasMicPermission?: boolean;
  personality?: "socratic" | "eli5" | "coach";
  language?: string;
  isLocalParticipantSpeaking?: boolean;
}

export const useLiveTutor = ({
  meetingId,
  agentId,
  agentName,
  call,
  hasMicPermission = false,
  personality,
  language,
  isLocalParticipantSpeaking = false,
}: UseLiveTutorProps) => {
  const trpc = useTRPC();
  const [isTutorEnabled, setIsTutorEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastSpeech, setLastSpeech] = useState<{ speaker: string; text: string } | null>(null);

  const [isHoldToTalkActive, setIsHoldToTalkActive] = useState(false);

  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureAudioContextRef = useRef<AudioContext | null>(null);
  const captureProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const captureGainRef = useRef<GainNode | null>(null);
  const ttsAudioContextRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFinalizeRef = useRef(false);
  const transcriptBufferRef = useRef("");
  const latestInterimTranscriptRef = useRef("");
  const lastSentTextRef = useRef("");

  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isTutorEnabledRef = useRef(false);
  const personalityRef = useRef(personality);
  const languageRef = useRef(language || "en-US");
  const callRef = useRef(call);
  const handleSendToAIRef = useRef<(text: string) => Promise<void>>(async () => {});

  useEffect(() => {
    personalityRef.current = personality;
  }, [personality]);

  useEffect(() => {
    isTutorEnabledRef.current = isTutorEnabled;
  }, [isTutorEnabled]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    languageRef.current = language || "en-US";
  }, [language]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const { mutateAsync: talkToAgent } = useMutation(
    trpc.meetings.talkToAgent.mutationOptions(),
  );

  const clearFinalizeTimer = useCallback(() => {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
  }, []);

  const stopTtsPlayback = useCallback(() => {
    if (ttsSourceRef.current) {
      try {
        ttsSourceRef.current.stop();
      } catch (err) {}
      try {
        ttsSourceRef.current.disconnect();
      } catch (err) {}
      ttsSourceRef.current = null;
    }
  }, []);

  const cleanupTtsSession = useCallback(() => {
    stopTtsPlayback();
    if (ttsAudioContextRef.current) {
      try {
        ttsAudioContextRef.current.close();
      } catch (err) {}
      ttsAudioContextRef.current = null;
    }
  }, [stopTtsPlayback]);

  const stopCaptureInput = useCallback(() => {
    if (captureProcessorRef.current) {
      try {
        captureProcessorRef.current.disconnect();
      } catch (err) {}
      captureProcessorRef.current = null;
    }

    if (captureSourceRef.current) {
      try {
        captureSourceRef.current.disconnect();
      } catch (err) {}
      captureSourceRef.current = null;
    }

    if (captureGainRef.current) {
      try {
        captureGainRef.current.disconnect();
      } catch (err) {}
      captureGainRef.current = null;
    }

    if (captureAudioContextRef.current) {
      try {
        captureAudioContextRef.current.close();
      } catch (err) {}
      captureAudioContextRef.current = null;
    }

    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach((track) => track.stop());
      captureStreamRef.current = null;
    }
  }, []);

  const cleanupCaptureSession = useCallback(() => {
    clearFinalizeTimer();

    if (deepgramSocketRef.current) {
      try {
        deepgramSocketRef.current.onopen = null;
        deepgramSocketRef.current.onmessage = null;
        deepgramSocketRef.current.onerror = null;
        deepgramSocketRef.current.onclose = null;
        deepgramSocketRef.current.close();
      } catch (err) {}
      deepgramSocketRef.current = null;
    }

    stopCaptureInput();
  }, [clearFinalizeTimer, stopCaptureInput]);

  const finalizeAndSendTranscript = useCallback(async () => {
    const textToSend = transcriptBufferRef.current.trim();
    pendingFinalizeRef.current = false;
    transcriptBufferRef.current = "";
    latestInterimTranscriptRef.current = "";
    setInterimTranscript("");
    setIsListening(false);
    setIsHoldToTalkActive(false);
    isListeningRef.current = false;

    cleanupCaptureSession();

    if (!textToSend || isThinkingRef.current) {
      return;
    }

    if (callRef.current) {
      try {
        callRef.current.sendCustomEvent({
          type: "user-speech",
          payload: {
            text: textToSend,
            userName: callRef.current.state.localParticipant?.name || "Student",
          },
        });
      } catch (err) {
        console.error("[useLiveTutor] Failed to broadcast user-speech event:", err);
      }
    }

    setLastSpeech({
      speaker: callRef.current?.state.localParticipant?.name || "Student",
      text: textToSend,
    });

    lastSentTextRef.current = textToSend;
    await handleSendToAIRef.current(textToSend);
  }, [cleanupCaptureSession]);

  const playDeepgramTts = useCallback(
    async (text: string) => {
      if (typeof window === "undefined") return;

      cleanupTtsSession();

      const apiKey = await getDeepgramKey();
      const model = resolveDeepgramTtsModel(languageRef.current);

      const response = await fetch(
        `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        },
      );

      if (!response.ok) {
        throw new Error(`Deepgram TTS failed with status ${response.status}`);
      }

      const audioContext =
        ttsAudioContextRef.current || new window.AudioContext();
      ttsAudioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        if (ttsSourceRef.current === source) {
          ttsSourceRef.current = null;
        }
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      };
      ttsSourceRef.current = source;
      source.start(0);
    },
    [stopTtsPlayback],
  );

  const speakText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      if (typeof window === "undefined") return;

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setIsThinking(false);
      isThinkingRef.current = false;

      try {
        await playDeepgramTts(
          text
            .replace(/[*#_`~[\]]/g, "")
            .replace(/\([^)]*\)/g, "")
            .trim(),
        );
      } catch (err) {
        console.error("Deepgram TTS Error:", err);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
    },
    [playDeepgramTts],
  );

  const handleSendToAI = useCallback(
    async (text: string) => {
      if (!text.trim() || isThinkingRef.current || !call) {
        console.warn(
          `[useLiveTutor] handleSendToAI skipped. Text length: ${text?.trim()?.length}, isThinking: ${isThinkingRef.current}, callInitialized: ${!!call}`,
        );
        return;
      }

      console.log(
        `[useLiveTutor] Sending text to AI tutor for meeting: ${meetingId}. Text: "${text}"`,
      );

      setIsThinking(true);
      isThinkingRef.current = true;

      call.sendCustomEvent({
        type: "ai-thinking",
        payload: { active: true },
      }).catch((err) => {
        console.error(
          "[useLiveTutor] Failed to broadcast ai-thinking (active) custom event:",
          err,
        );
      });

      try {
        const response = await talkToAgent({
          meetingId,
          text,
          personality: personalityRef.current,
          language: languageRef.current,
        });

        console.log(
          `[useLiveTutor] Received response from tRPC agent for meeting: ${meetingId}`,
        );
        const { cleanText, elements } = extractAndStripDrawing(response.text);

        await speakText(cleanText);
        setLastSpeech({ speaker: agentName, text: cleanText });

        call.sendCustomEvent({
          type: "ai-voice",
          payload: { text: cleanText, senderPlayedLocally: true },
        }).catch((err) => {
          console.error(
            "[useLiveTutor] Failed to broadcast ai-voice response custom event:",
            err,
          );
        });

        if (elements && elements.length > 0) {
          console.log(
            `[useLiveTutor] Broadcasting ${elements.length} Excalidraw elements for meeting: ${meetingId}`,
          );
          call.sendCustomEvent({
            type: "ai-draw",
            payload: { elements },
          }).catch((err) => {
            console.error(
              "[useLiveTutor] Failed to broadcast ai-draw custom event:",
              err,
            );
          });
        }
      } catch (err) {
        console.error(
          `[useLiveTutor] Error talking to AI tutor for meeting ${meetingId}:`,
          err,
        );
        toast.error("Failed to get response from AI Tutor");
      } finally {
        setIsThinking(false);
        isThinkingRef.current = false;
        call.sendCustomEvent({
          type: "ai-thinking",
          payload: { active: false },
        }).catch((err) => {
          console.error(
            "[useLiveTutor] Failed to broadcast ai-thinking (inactive) custom event:",
            err,
          );
        });
      }
    },
    [agentName, call, meetingId, speakText, talkToAgent],
  );

  useEffect(() => {
    handleSendToAIRef.current = handleSendToAI;
  }, [handleSendToAI]);

  const scheduleFinalizeFlush = useCallback(() => {
    clearFinalizeTimer();
    finalizeTimerRef.current = setTimeout(() => {
      void finalizeAndSendTranscript();
    }, 350);
  }, [clearFinalizeTimer, finalizeAndSendTranscript]);

  const startHoldToTalk = useCallback(async () => {
    if (!isTutorEnabledRef.current || isListeningRef.current || isThinkingRef.current) {
      return;
    }

    if (typeof window === "undefined") return;

    try {
      clearFinalizeTimer();
      pendingFinalizeRef.current = false;
      transcriptBufferRef.current = "";
      latestInterimTranscriptRef.current = "";
      lastSentTextRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      setIsListening(true);
      isListeningRef.current = true;
      setIsHoldToTalkActive(true);
      stopTtsPlayback();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      captureStreamRef.current = stream;

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser.");
      }
      const audioContext = new AudioContextClass();
      captureAudioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const apiKey = await getDeepgramKey();
      const dgLanguage = resolveDeepgramLanguage(languageRef.current);
      const socketUrl = new URL("wss://api.deepgram.com/v1/listen");
      socketUrl.searchParams.set("model", "nova-3");
      socketUrl.searchParams.set("interim_results", "true");
      socketUrl.searchParams.set("smart_format", "true");
      socketUrl.searchParams.set("punctuate", "true");
      socketUrl.searchParams.set("endpointing", "500");
      socketUrl.searchParams.set("encoding", "linear16");
      socketUrl.searchParams.set("sample_rate", String(audioContext.sampleRate));
      socketUrl.searchParams.set("channels", "1");
      if (dgLanguage) {
        socketUrl.searchParams.set("language", dgLanguage);
      }

      const socket = new WebSocket(socketUrl.toString(), ["token", apiKey]);
      deepgramSocketRef.current = socket;

      socket.onopen = () => {
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0;

        captureSourceRef.current = source;
        captureProcessorRef.current = processor;
        captureGainRef.current = gainNode;

        source.connect(processor);
        processor.connect(gainNode);
        gainNode.connect(audioContext.destination);

        processor.onaudioprocess = (event) => {
          if (
            deepgramSocketRef.current &&
            deepgramSocketRef.current.readyState === WebSocket.OPEN
          ) {
            const inputData = event.inputBuffer.getChannelData(0);
            const buffer = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const sample = Math.max(-1, Math.min(1, inputData[i]));
              buffer[i] = sample < 0 ? sample * 32768 : sample * 32767;
            }
            deepgramSocketRef.current.send(buffer.buffer);
          }
        };
      };

      socket.onmessage = (message) => {
        try {
          const received = JSON.parse(message.data);
          const transcript = received?.channel?.alternatives?.[0]?.transcript?.trim();

          if (!transcript) return;

          if (received.is_final || received.speech_final || received.from_finalize) {
            transcriptBufferRef.current = `${transcriptBufferRef.current}${transcript} `;
            setInterimTranscript("");
            latestInterimTranscriptRef.current = "";

            if (pendingFinalizeRef.current) {
              scheduleFinalizeFlush();
            }
          } else {
            setInterimTranscript(transcript);
            latestInterimTranscriptRef.current = transcript;
          }
        } catch (err) {
          console.error("Failed to parse Deepgram transcript message:", err);
        }
      };

      socket.onerror = (error) => {
        console.error("Deepgram Socket Error", error);
        toast.error("Deepgram speech capture failed.");
      };

      socket.onclose = () => {
        setIsListening(false);
        isListeningRef.current = false;
        setIsHoldToTalkActive(false);
      };
    } catch (err) {
      console.error("Failed to initialize Deepgram capture:", err);
      toast.error("Could not start speech capture. Check microphone permissions.");
      cleanupCaptureSession();
      setIsListening(false);
      isListeningRef.current = false;
      setIsHoldToTalkActive(false);
    }
  }, [
    clearFinalizeTimer,
    cleanupCaptureSession,
    cleanupTtsSession,
    scheduleFinalizeFlush,
    stopTtsPlayback,
    stopCaptureInput,
  ]);

  const stopHoldToTalk = useCallback(() => {
    if (!isListeningRef.current && !deepgramSocketRef.current) {
      setIsHoldToTalkActive(false);
      return;
    }

    pendingFinalizeRef.current = true;
    setIsListening(false);
    isListeningRef.current = false;
    setIsHoldToTalkActive(false);
    stopCaptureInput();

    if (deepgramSocketRef.current && deepgramSocketRef.current.readyState === WebSocket.OPEN) {
      try {
        deepgramSocketRef.current.send(JSON.stringify({ type: "Finalize" }));
      } catch (err) {
        console.error("Failed to send Deepgram finalize message:", err);
      }
    }

    clearFinalizeTimer();
    finalizeTimerRef.current = setTimeout(() => {
      void finalizeAndSendTranscript();
    }, 900);
  }, [clearFinalizeTimer, finalizeAndSendTranscript]);

  const toggleTutor = useCallback(() => {
    if (!hasMicPermission) {
      toast.error("Microphone permission is required for Talk to AI.");
      return;
    }

    const nextState = !isTutorEnabledRef.current;
    setIsTutorEnabled(nextState);
    isTutorEnabledRef.current = nextState;

    if (!nextState) {
      pendingFinalizeRef.current = false;
      transcriptBufferRef.current = "";
      latestInterimTranscriptRef.current = "";
      lastSentTextRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      setIsListening(false);
      setIsHoldToTalkActive(false);
      setIsThinking(false);
      setIsSpeaking(false);
      isListeningRef.current = false;
      isThinkingRef.current = false;
      isSpeakingRef.current = false;
      cleanupCaptureSession();
      cleanupTtsSession();
    }
  }, [cleanupCaptureSession, cleanupTtsSession, hasMicPermission]);

  useEffect(() => {
    if (!call) return;

    const handleCustomEvent = (event: any) => {
      const { type, payload } = event.custom;
      if (!payload) return;

      if (type === "ai-thinking") {
        setIsThinking(payload.active);
        isThinkingRef.current = payload.active;
      } else if (type === "user-speech") {
        setLastSpeech({ speaker: payload.userName, text: payload.text });
      } else if (type === "ai-voice") {
        const { cleanText } = extractAndStripDrawing(payload.text);
        setLastSpeech({ speaker: agentName, text: cleanText });
        const isSender = event.user.id === call.currentUserId;
        if (!isSender || !payload.senderPlayedLocally) {
          void speakText(cleanText);
        }
        checkPraiseAndTriggerConfetti(cleanText);
      }
    };

    const unsubscribe = call.on("custom", handleCustomEvent);
    return () => {
      unsubscribe();
    };
  }, [agentName, call, speakText]);

  useEffect(() => {
    if (isLocalParticipantSpeaking && isSpeakingRef.current) {
      stopTtsPlayback();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [isLocalParticipantSpeaking, stopTtsPlayback]);

  useEffect(() => {
    return () => {
      cleanupCaptureSession();
      cleanupTtsSession();
    };
  }, [cleanupCaptureSession, cleanupTtsSession]);

  return {
    isTutorEnabled,
    isListening,
    isThinking,
    isSpeaking,
    transcript,
    interimTranscript,
    lastSpeech,
    isHoldToTalkActive,
    toggleTutor,
    startHoldToTalk,
    stopHoldToTalk,
    speakText,
    handleSendToAI,
  };
};
