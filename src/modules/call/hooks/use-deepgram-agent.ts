import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { getDeepgramKey } from "../actions/get-deepgram-key";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { StreamVideoClient, Call } from "@stream-io/video-react-sdk";

export interface Caption {
  id: string;
  speaker: "You" | "AI";
  text: string;
}

const RELEASE_FINALIZE_WAIT_MS = 150;

export const useDeepgramAgent = ({
  meetingId,
  agentId,
  enabled,
  isHolding,
}: {
  meetingId: string;
  agentId: string;
  enabled: boolean;
  isHolding: boolean;
}) => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isTutorReady, setIsTutorReady] = useState(false);

  const resumeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      console.log("[useDeepgramAgent] Resuming AudioContext via direct user gesture...");
      await audioContextRef.current.resume();
      console.log(`[useDeepgramAgent] AudioContext state after user gesture resume: ${audioContextRef.current.state}`);
    }
  }, []);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const isThinkingRef = useRef(false);

  const lastSpeechReceivedRef = useRef<number>(0);
  const accumulatedTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isHoldingRef = useRef(isHolding);
  const prevHoldingRef = useRef(isHolding);

  // Periodic heartbeat & KeepAlive to prevent Deepgram timeout
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const isActivelyHearing = Date.now() - lastSpeechReceivedRef.current < 5000;
      if (isActivelyHearing) {
        console.log("[AI Tutor Indicator] Successfully receiving and transcribing user speech...");
      }

      if (
        deepgramSocketRef.current &&
        deepgramSocketRef.current.readyState === WebSocket.OPEN
      ) {
        console.log("[useDeepgramAgent] Sending KeepAlive control message to Deepgram...");
        try {
          deepgramSocketRef.current.send(JSON.stringify({ type: "KeepAlive" }));
        } catch (err) {
          console.warn("[useDeepgramAgent] Failed to send KeepAlive control message:", err);
        }
      }
    }, 8000); // Check/send every 8 seconds

    return () => clearInterval(interval);
  }, [enabled]);

  const connectionIdRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);

  const agentClientRef = useRef<StreamVideoClient | null>(null);
  const agentCallRef = useRef<Call | null>(null);
  const agentAudioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const trpc = useTRPC();
  const { mutateAsync: generateAgentToken } = useMutation(
    trpc.meetings.generateAgentToken.mutationOptions()
  );

  // Play audio sequentially
  const playNextAudio = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAgentSpeaking(false);
      console.log("[AI Tutor State: Idle] Completed playing all audio responses.");
      return;
    }

    if (!audioContextRef.current) return;

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.warn("Failed to resume AudioContext during playback:", e);
      }
    }

    isPlayingRef.current = true;
    setIsAgentSpeaking(true);
    const buffer = audioQueueRef.current.shift()!;
    console.log("[AI Tutor State: Speaking] Playback started for response audio segment.");
    
    const sourceNode = audioContextRef.current.createBufferSource();
    sourceNode.buffer = buffer;
    
    // Route to agent participant stream (for others)
    if (agentAudioDestinationRef.current) {
      sourceNode.connect(agentAudioDestinationRef.current);
    }
    // Route to local speakers (for host)
    sourceNode.connect(audioContextRef.current.destination);

    sourceNode.onended = () => {
      console.log("[AI Tutor State: Speaking] Completed playing response segment.");
      playNextAudio();
    };

    sourceNode.start();
  };

  const processAIResponse = async (text: string) => {
    const startedAt = performance.now();
    console.log(`[AI Tutor State: Thinking] Converting response text to speech: "${text}"`);

    setCaptions((prev) => [
      ...prev,
      { id: Date.now().toString(), speaker: "AI", text },
    ]);

    try {
      const response = await fetch("/api/agent/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Failed to generate TTS: ${response.status} ${response.statusText} ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log(
        `[AI Tutor State: Thinking] TTS audio generated successfully. Bytes: ${arrayBuffer.byteLength}, elapsedMs=${Math.round(performance.now() - startedAt)}`,
      );

      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      console.log(
        `[AI Tutor State: Thinking] Audio decoding complete. durationMs=${Math.round(audioBuffer.duration * 1000)}, elapsedMs=${Math.round(performance.now() - startedAt)}`,
      );
      
      audioQueueRef.current.push(audioBuffer);
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch (err) {
      console.error("[AI Tutor Error] Deepgram TTS Error:", err);
      isPlayingRef.current = false;
      setIsAgentSpeaking(false);
    }
  };

  const submitToGemini = async (transcript: string) => {
    if (!transcript.trim()) return;

    const startedAt = performance.now();
    console.log(
      `[AI Tutor State: Thinking] Submitting user transcript to Gemini. Text: "${transcript.trim()}"`,
    );

    setCaptions((prev) => [
      ...prev,
      { id: Date.now().toString(), speaker: "You", text: transcript },
    ]);

    setIsAgentThinking(true);
    isThinkingRef.current = true;
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, meetingId, agentId }),
      });

      console.log(
        `[AI Tutor State: Thinking] Gemini responded. status=${response.status}, ok=${response.ok}, elapsedMs=${Math.round(performance.now() - startedAt)}`,
      );

      if (!response.ok) {
        let errorMsg = "Failed to get AI response";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {
          try {
            const txt = await response.text();
            if (txt) errorMsg = txt;
          } catch (_) {}
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.response) {
        console.log(
          `[AI Tutor State: Received Response] Gemini generated text response: "${data.response}"`,
        );
        await processAIResponse(data.response);
      } else {
        console.warn("[useDeepgramAgent] Agent chat API returned no response text.");
      }
    } catch (err: any) {
      console.error("Gemini Error:", err?.message || err);
      toast.error(`AI failed to respond: ${err?.message || "Unknown error"}`);
    } finally {
      setIsAgentThinking(false);
      isThinkingRef.current = false;
    }
  };

  const submitCapturedTranscript = useCallback(() => {
    const finalTranscript = accumulatedTranscriptRef.current.trim();
    const interimTranscript = interimTranscriptRef.current.trim();
    const transcriptToSubmit = finalTranscript || interimTranscript;

    if (!transcriptToSubmit) {
      console.warn("[useDeepgramAgent] PTT released but no STT transcript was available.");
      return;
    }

    if (!finalTranscript && interimTranscript) {
      console.warn(
        `[useDeepgramAgent] Submitting interim STT because Deepgram did not finalize in ${RELEASE_FINALIZE_WAIT_MS}ms. chars=${interimTranscript.length}`,
      );
    }

    console.log(
      `[useDeepgramAgent] PTT transcript ready after release. finalChars=${finalTranscript.length}, interimChars=${interimTranscript.length}`,
    );

    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    void submitToGemini(transcriptToSubmit);
  }, [agentId, meetingId]);

  useEffect(() => {
    isHoldingRef.current = isHolding;

    if (transcriptTimeoutRef.current) {
      clearTimeout(transcriptTimeoutRef.current);
      transcriptTimeoutRef.current = null;
    }

    if (enabled && isHolding && !prevHoldingRef.current) {
      accumulatedTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      console.log(
        `[useDeepgramAgent] PTT hold started. socketState=${deepgramSocketRef.current?.readyState ?? "none"}, thinking=${isThinkingRef.current}, speaking=${isPlayingRef.current}`,
      );
    }

    if (enabled && !isHolding && prevHoldingRef.current) {
      console.log(
        `[useDeepgramAgent] PTT released. finalChars=${accumulatedTranscriptRef.current.trim().length}, interimChars=${interimTranscriptRef.current.trim().length}`,
      );

      if (deepgramSocketRef.current?.readyState === WebSocket.OPEN) {
        try {
          deepgramSocketRef.current.send(JSON.stringify({ type: "Finalize" }));
          console.log("[useDeepgramAgent] Sent Deepgram Finalize control message.");
        } catch (err) {
          console.warn("[useDeepgramAgent] Failed to send Deepgram Finalize control message:", err);
        }
      }

      if (accumulatedTranscriptRef.current.trim() && !interimTranscriptRef.current.trim()) {
        submitCapturedTranscript();
      } else {
        transcriptTimeoutRef.current = setTimeout(
          submitCapturedTranscript,
          RELEASE_FINALIZE_WAIT_MS,
        );
      }

      prevHoldingRef.current = isHolding;
      return () => {
        if (transcriptTimeoutRef.current) {
          clearTimeout(transcriptTimeoutRef.current);
          transcriptTimeoutRef.current = null;
        }
      };
    }

    prevHoldingRef.current = isHolding;
  }, [isHolding, enabled, submitCapturedTranscript]);

  const initDeepgram = useCallback(async () => {
    const currentId = ++connectionIdRef.current;
    console.log(`[useDeepgramAgent] Initializing Deepgram Agent for meeting ${meetingId}. Connection ID: ${currentId}`);
    
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      console.log("[useDeepgramAgent] Microphone access granted successfully.");

      if (connectionIdRef.current !== currentId) return;

      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || await getDeepgramKey();
      console.log("[useDeepgramAgent] Deepgram API key successfully retrieved.");
      
      if (connectionIdRef.current !== currentId) return;

      // Make sure audioContext is initialized first for the local audio capture
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }

      // --- 1. Agent Participant Setup (Asynchronous background task) ---
      if (agentId) {
        // Spawn virtual participant asynchronously in background so it never blocks local voice capture
        (async () => {
          try {
            console.log(`[useDeepgramAgent] Spawning virtual participant for AI Agent: ${agentId}`);
            const agentToken = await generateAgentToken({ agentId });
            const streamApiKey = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!;
            const client = new StreamVideoClient({
              apiKey: streamApiKey,
              user: { id: agentId, name: "AI Tutor" },
              tokenProvider: () => Promise.resolve(agentToken),
            });
            agentClientRef.current = client;

            const call = client.call("default", meetingId);
            agentCallRef.current = call;
            call.camera.disable(); // Prevent hardware camera
            await call.join({ create: true });
            console.log("[useDeepgramAgent] Virtual AI Tutor participant joined Stream call.");

            if (audioContextRef.current) {
              agentAudioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
              await call.publishAudioStream(agentAudioDestinationRef.current.stream);
              console.log("[useDeepgramAgent] Virtual mic published to Stream call successfully.");
            }
          } catch (agentJoinErr) {
            console.error("[useDeepgramAgent] Warning: Failed to spawn virtual participant (AI will still listen locally):", agentJoinErr);
          }
        })();
      }
      // --------------------------------

      const sampleRate = audioContextRef.current?.sampleRate || 48000;
      console.log(`[useDeepgramAgent] Connecting to Deepgram WebSocket. Sample Rate: ${sampleRate}`);
      deepgramSocketRef.current = new WebSocket(
        `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=${sampleRate}&endpointing=150&interim_results=true&smart_format=true`,
        ["token", apiKey]
      );
      deepgramSocketRef.current.binaryType = "arraybuffer";

      deepgramSocketRef.current.onopen = async () => {
        console.log("[useDeepgramAgent] Deepgram WebSocket connection opened successfully.");
        setIsTutorReady(true);
        if (!audioContextRef.current) return;

        // Resume AudioContext if suspended (browser security autoplay policies)
        if (audioContextRef.current.state === "suspended") {
          console.log("[useDeepgramAgent] AudioContext is suspended. Resuming now...");
          await audioContextRef.current.resume();
          console.log(`[useDeepgramAgent] AudioContext state is now: ${audioContextRef.current.state}`);
        }

        const source = audioContextRef.current.createMediaStreamSource(
          mediaStreamRef.current!
        );
        const processor = audioContextRef.current.createScriptProcessor(
          4096,
          1,
          1
        );
        audioProcessorRef.current = processor; // Store reference to prevent garbage collection

        // Create a gain node with 0 volume to prevent local mic echo
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = 0;
        
        source.connect(processor);
        processor.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        console.log("[useDeepgramAgent] Audio context graph connected. Recording started.");

        let chunkCount = 0;
        let pttStartedLogged = false;
        processor.onaudioprocess = (e) => {
          if (
            deepgramSocketRef.current &&
            deepgramSocketRef.current.readyState === WebSocket.OPEN
          ) {
            const inputData = e.inputBuffer.getChannelData(0);

            // Return early if not holding the button or if the agent is busy
            if (isThinkingRef.current || isPlayingRef.current || !isHoldingRef.current) {
              if (pttStartedLogged) {
                console.log("[AI Tutor Audio Gate] User released button. Gating microphone audio (no longer streaming).");
                pttStartedLogged = false;
              }
              return;
            }

            if (!pttStartedLogged) {
              console.log("[AI Tutor Audio Gate] User held button. Microphone open, streaming audio to Deepgram...");
              pttStartedLogged = true;
            }

            const buffer = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              buffer[i] = inputData[i] * 32767;
            }
            deepgramSocketRef.current.send(buffer);

            chunkCount++;
            if (chunkCount === 1) {
              console.log("[useDeepgramAgent] First microphone audio chunk sent to Deepgram.");
            } else if (chunkCount % 100 === 0) {
              console.log(`[useDeepgramAgent] Streaming in progress: Sent ${chunkCount} audio chunks to Deepgram.`);
            }
          }
        };
      };

      deepgramSocketRef.current.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel?.alternatives[0]?.transcript;

        if (transcript) {
          console.log(`[AI Tutor State: Listening/Transcribing] Speech transcript chunk: "${transcript}" (is_final: ${received.is_final})`);
          lastSpeechReceivedRef.current = Date.now();
        }

        if (transcript && received.is_final) {
          accumulatedTranscriptRef.current += transcript + " ";
          interimTranscriptRef.current = "";
          console.log(
            `[useDeepgramAgent] Final STT buffered. totalChars=${accumulatedTranscriptRef.current.trim().length}`,
          );
        } else if (transcript) {
          interimTranscriptRef.current = transcript;
        }
      };

      deepgramSocketRef.current.onerror = (error) => {
        console.error("[useDeepgramAgent] Deepgram Socket Error:", error);
      };

      deepgramSocketRef.current.onclose = (event) => {
        console.warn(`[useDeepgramAgent] Deepgram Socket Closed. Code: ${event.code}, Reason: ${event.reason || "None"}`);
        setIsTutorReady(false);
      };
    } catch (err) {
      console.error("[useDeepgramAgent] Failed to initialize Deepgram Agent:", err);
    }
  }, [meetingId, agentId]);

  const cleanupDeepgram = useCallback(() => {
    connectionIdRef.current += 1; // Invalidate any pending init hooks
    setIsTutorReady(false);
    if (agentCallRef.current) {
      try {
        agentCallRef.current.leave().catch((e) => console.warn("Async leave error:", e.message));
      } catch (err: any) {
        console.warn("Sync leave error:", err?.message || err);
      }
      agentCallRef.current = null;
    }
    if (agentClientRef.current) {
      try {
        agentClientRef.current.disconnectUser().catch((e) => console.warn("Async disconnect error:", e.message));
      } catch (err: any) {
        console.warn("Sync disconnect error:", err?.message || err);
      }
      agentClientRef.current = null;
    }
    if (deepgramSocketRef.current) {
      deepgramSocketRef.current.close();
    }
    if (audioProcessorRef.current) {
      try {
        audioProcessorRef.current.disconnect();
      } catch (e) {}
      audioProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (transcriptTimeoutRef.current) {
      clearTimeout(transcriptTimeoutRef.current);
      transcriptTimeoutRef.current = null;
    }
    accumulatedTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsAgentSpeaking(false);
  }, []);

  useEffect(() => {
    if (enabled && !isInitializedRef.current) {
      isInitializedRef.current = true;
      initDeepgram();
    } else if (!enabled && isInitializedRef.current) {
      isInitializedRef.current = false;
      cleanupDeepgram();
    }
    
    return () => {
      if (isInitializedRef.current) {
        isInitializedRef.current = false;
        cleanupDeepgram();
      }
    };
  }, [enabled, initDeepgram, cleanupDeepgram]);

  return { captions, isAgentThinking, isAgentSpeaking, isTutorReady, resumeAudioContext };
};
