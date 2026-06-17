import { useState, useEffect, useRef, useCallback } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Call } from "@stream-io/video-react-sdk";
import confetti from "canvas-confetti";

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
  const praiseKeywords = ["correct", "great job", "spot on", "awesome", "perfect", "excellent", "well done", "amazing", "wonderful", "fantastic", "spot-on"];
  const lowerText = text.toLowerCase();
  const hasPraise = praiseKeywords.some(keyword => lowerText.includes(keyword));
  
  if (hasPraise) {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.5 }
      });
    } catch (err) {
      console.error("Failed to run confetti:", err);
    }
  }
};

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
  
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  const lastSpeakTimeRef = useRef<number>(0);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestInterimTranscriptRef = useRef<string>("");
  const lastSentTextRef = useRef<string>("");
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const lastActiveAudioTimeRef = useRef<number>(0);
  
  // Stable refs for state to prevent recreation of SpeechRecognition
  const isTutorEnabledRef = useRef(false);
  const isListeningRef = useRef(false);
  const isThinkingRef = useRef(false);
  const personalityRef = useRef(personality);
  const languageRef = useRef(language || "en-US");

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

  const { mutateAsync: talkToAgent } = useMutation(
    trpc.meetings.talkToAgent.mutationOptions(),
  );

  // Safely attempt starting speech recognition
  const startSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn("SpeechRecognition start ignored:", err);
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, []);

  // Safely stop speech recognition
  const stopSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.warn("SpeechRecognition stop ignored:", err);
    }
  }, []);

  useEffect(() => {
    languageRef.current = language || "en-US";
    if (recognitionRef.current) {
      recognitionRef.current.lang = language || "en-US";
      if (isListeningRef.current) {
        stopSpeechRecognition();
        setTimeout(() => {
          if (isTutorEnabledRef.current && !isThinkingRef.current && !isSpeakingRef.current) {
            startSpeechRecognition();
          }
        }, 100);
      }
    }
  }, [language, startSpeechRecognition, stopSpeechRecognition]);

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
      setIsSpeaking(false);
      maybeRestart();
      return;
    }

    // Set speaking active immediately to prevent race conditions
    isSpeakingRef.current = true;
    setIsSpeaking(true);
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
    utterance.lang = languageRef.current;
    
    // Choose a friendly voice matching the language if available
    const voices = window.speechSynthesis.getVoices();
    let voice = voices.find(v => v.lang.toLowerCase() === languageRef.current.toLowerCase());
    if (!voice) {
      const langPrefix = languageRef.current.split("-")[0].toLowerCase();
      voice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    }
    
    if (languageRef.current.startsWith("en")) {
      const friendlyVoice = voices.find(
        (v) =>
          v.name.includes("Google US English") ||
          v.name.includes("Natural") ||
          v.name.includes("Samantha"),
      );
      if (friendlyVoice) voice = friendlyVoice;
    }
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      lastSpeakTimeRef.current = Date.now();
      stopSpeechRecognition();
    };

    const handleSpeechEnd = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
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
        const { cleanText } = extractAndStripDrawing(payload.text);
        setLastSpeech({ speaker: agentName, text: cleanText });
        // Play speech for everyone if it wasn't played locally by the sender (e.g. whiteboard RAG vision response)
        const isSender = event.user.id === call.currentUserId;
        if (!isSender || !payload.senderPlayedLocally) {
          speakText(cleanText);
        }
        // Trigger confetti for praise words
        checkPraiseAndTriggerConfetti(cleanText);
      }
    };

    const unsubscribe = call.on("custom", handleCustomEvent);
    return () => {
      unsubscribe();
    };
  }, [call, agentName, speakText]);

  // Handle sending text to AI agent
  const handleSendToAI = async (text: string) => {
    if (!text.trim() || isThinkingRef.current || !call) {
      console.warn(`[useLiveTutor] handleSendToAI skipped. Text length: ${text?.trim()?.length}, isThinking: ${isThinkingRef.current}, callInitialized: ${!!call}`);
      return;
    }

    console.log(`[useLiveTutor] Sending text to AI tutor for meeting: ${meetingId}. Text: "${text}"`);
    // Stop listening during processing
    stopSpeechRecognition();

    setIsThinking(true);
    // Broadcast AI is thinking
    call.sendCustomEvent({
      type: "ai-thinking",
      payload: { active: true },
    }).catch(err => {
      console.error("[useLiveTutor] Failed to broadcast ai-thinking (active) custom event:", err);
    });

    try {
      // Query Gemini via tRPC
      const response = await talkToAgent({
        meetingId,
        text,
        personality: personalityRef.current,
        language: languageRef.current,
      });

      console.log(`[useLiveTutor] Received response from tRPC agent for meeting: ${meetingId}`);
      const { cleanText, elements } = extractAndStripDrawing(response.text);

      // Play locally for the sender immediately to reduce latency feel
      speakText(cleanText);
      setLastSpeech({ speaker: agentName, text: cleanText });

      // Broadcast the response so other participants hear and see it
      call.sendCustomEvent({
        type: "ai-voice",
        payload: { text: cleanText, senderPlayedLocally: true },
      }).catch(err => {
        console.error("[useLiveTutor] Failed to broadcast ai-voice response custom event:", err);
      });

      // Broadcast drawing elements to the whiteboard
      if (elements && elements.length > 0) {
        console.log(`[useLiveTutor] Broadcasting ${elements.length} Excalidraw elements for meeting: ${meetingId}`);
        call.sendCustomEvent({
          type: "ai-draw",
          payload: { elements },
        }).catch(err => {
          console.error("[useLiveTutor] Failed to broadcast ai-draw custom event:", err);
        });
      }

    } catch (err) {
      console.error(`[useLiveTutor] Error talking to AI tutor for meeting ${meetingId}:`, err);
      toast.error("Failed to get response from AI Tutor");
      maybeRestart();
    } finally {
      setIsThinking(false);
      call.sendCustomEvent({
        type: "ai-thinking",
        payload: { active: false },
      }).catch(err => {
        console.error("[useLiveTutor] Failed to broadcast ai-thinking (inactive) custom event:", err);
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

  // Interrupt AI speaking if user starts speaking
  useEffect(() => {
    if (isLocalParticipantSpeaking && isSpeakingRef.current) {
      console.log("[useLiveTutor] User started speaking. Interrupting AI speech synthesis.");
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      if (call) {
        call.sendCustomEvent({
          type: "ai-thinking",
          payload: { active: false },
        }).catch(err => {
          console.error("[useLiveTutor] Failed to broadcast ai-thinking (inactive) custom event on interruption:", err);
        });
      }

      // Start speech recognition immediately so we can capture the user's speech
      startSpeechRecognition();
    }
  }, [isLocalParticipantSpeaking, call, startSpeechRecognition]);

  const stopVolumeAnalyzer = useCallback(() => {
    if (audioProcessorRef.current) {
      try {
        audioProcessorRef.current.disconnect();
      } catch (e) {}
      audioProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      audioStreamRef.current = null;
    }
  }, []);

  const startVolumeAnalyzer = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      stopVolumeAnalyzer();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        
        // Threshold: 0.015 (1.5% of max volume)
        const threshold = 0.015;
        const aboveThreshold = rms > threshold;
        
        if (aboveThreshold) {
          lastActiveAudioTimeRef.current = Date.now();
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.warn("[useLiveTutor] Failed to start volume analyzer:", err);
    }
  }, [stopVolumeAnalyzer]);

  // Initialize browser Speech Recognition exactly once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = languageRef.current;

    rec.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      setTranscript("");
      setInterimTranscript("");
      lastSentTextRef.current = "";
    };

    // Immediately stop synthesis when user starts speaking (barge-in interruption)
    const handleInterruption = () => {
      const timeSinceSpeak = Date.now() - lastSpeakTimeRef.current;
      // Cooldown of 1.5 seconds to avoid AI interrupting itself with its own voice echo
      if (isSpeakingRef.current && timeSinceSpeak > 1500 && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        
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
      let interimTrans = "";
      let finalTrans = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTrans += event.results[i][0].transcript;
        } else {
          interimTrans += event.results[i][0].transcript;
        }
      }

      const timeSinceActiveAudio = Date.now() - lastActiveAudioTimeRef.current;
      const isVoiceActive = timeSinceActiveAudio < 1500;

      if (!isVoiceActive) {
        // If we haven't detected voice above the threshold, ignore this interim transcript
        setInterimTranscript("");
        latestInterimTranscriptRef.current = "";
        return;
      }

      // Clear any pending silence timer
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      if (interimTrans) {
        setInterimTranscript(interimTrans);
        latestInterimTranscriptRef.current = interimTrans;

        // Start a timer to manually finalize after 900ms of silence
        silenceTimeoutRef.current = setTimeout(async () => {
          const textToSend = latestInterimTranscriptRef.current.trim();
          if (textToSend && !isSpeakingRef.current && !isThinkingRef.current) {
            console.log(`[useLiveTutor] Silence detected. Manually finalising transcript: "${textToSend}"`);
            
            // Stop recognition immediately
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop();
              } catch (e) {}
            }
            setIsListening(false);
            isListeningRef.current = false;
            setInterimTranscript("");
            latestInterimTranscriptRef.current = "";
            lastSentTextRef.current = textToSend;

            // Send to AI
            const currentCall = callRef.current;
            if (currentCall) {
              currentCall.sendCustomEvent({
                type: "user-speech",
                payload: {
                  text: textToSend,
                  userName: currentCall.state.localParticipant?.name || "Student",
                },
              });
              setLastSpeech({
                speaker: currentCall.state.localParticipant?.name || "Student",
                text: textToSend,
              });
              await handleSendToAIRef.current(textToSend);
            }
          }
        }, 900);
      }

      if (finalTrans.trim()) {
        const text = finalTrans.trim();
        // Clear silence timeout since we got the final result
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        
        // Skip duplicate sending if we already manual-finalized it
        if (
          lastSentTextRef.current === text || 
          lastSentTextRef.current.startsWith(text) || 
          text.startsWith(lastSentTextRef.current)
        ) {
          console.log("[useLiveTutor] Ignoring duplicate final transcript:", text);
          setInterimTranscript("");
          latestInterimTranscriptRef.current = "";
          return;
        }

        setInterimTranscript("");
        latestInterimTranscriptRef.current = "";
        lastSentTextRef.current = text;
        setTranscript(text);

        // Final fallback to cancel speech when transcription result is parsed
        if (isSpeakingRef.current && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          isSpeakingRef.current = false;
          setIsSpeaking(false);
        }

        const currentCall = callRef.current;
        if (currentCall) {
          currentCall.sendCustomEvent({
            type: "user-speech",
            payload: {
              text,
              userName: currentCall.state.localParticipant?.name || "Student",
            },
          });
          setLastSpeech({
            speaker: currentCall.state.localParticipant?.name || "Student",
            text,
          });
          await handleSendToAIRef.current(text);
        }
      }
    };

    rec.onerror = (e: any) => {
      const errorType = e.error;
      setInterimTranscript("");
      if (errorType !== "aborted" && errorType !== "no-speech") {
        console.error("Speech recognition error:", errorType);
        
        // Disable tutor on critical capture/permission/network errors to prevent loops
        if (
          errorType === "audio-capture" || 
          errorType === "not-allowed" || 
          errorType === "service-not-allowed" ||
          errorType === "network"
        ) {
          toast.error(
            `Speech recognition failed: ${
              errorType === "network"
                ? "network connectivity issue"
                : errorType === "audio-capture"
                ? "microphone already in use or disabled"
                : errorType
            }. Talk to AI disabled.`
          );
          setIsTutorEnabled(false);
          isTutorEnabledRef.current = false;
          setIsListening(false);
          isListeningRef.current = false;
          stopSpeechRecognition();
          stopVolumeAnalyzer();
          if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          setIsThinking(false);
          isThinkingRef.current = false;
          return;
        }
      }
      setIsListening(false);
      isListeningRef.current = false;
    };

    rec.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      setInterimTranscript("");
      maybeRestartRef.current();
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {}
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      stopVolumeAnalyzer();
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
      startVolumeAnalyzer();
    } else {
      stopSpeechRecognition();
      stopVolumeAnalyzer();
      setIsListening(false);
      isListeningRef.current = false;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setIsThinking(false);
      isThinkingRef.current = false;
      setInterimTranscript("");
    }
  }, [startSpeechRecognition, stopSpeechRecognition]);

  return {
    isTutorEnabled,
    isListening,
    isThinking,
    isSpeaking,
    transcript,
    interimTranscript,
    lastSpeech,
    toggleTutor,
    speakText,
    handleSendToAI,
  };
};
