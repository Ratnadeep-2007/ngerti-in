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

export const useDeepgramAgent = ({
  meetingId,
  agentId,
  enabled,
}: {
  meetingId: string;
  agentId: string;
  enabled: boolean;
}) => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const accumulatedTranscriptRef = useRef("");
  const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    if (!audioContextRef.current) return;

    isPlayingRef.current = true;
    const buffer = audioQueueRef.current.shift()!;
    
    const sourceNode = audioContextRef.current.createBufferSource();
    sourceNode.buffer = buffer;
    
    // Route to agent participant stream (for others)
    if (agentAudioDestinationRef.current) {
      sourceNode.connect(agentAudioDestinationRef.current);
    }
    // Route to local speakers (for host)
    sourceNode.connect(audioContextRef.current.destination);

    sourceNode.onended = () => {
      playNextAudio();
    };

    sourceNode.start();
  };

  const processAIResponse = async (text: string) => {
    setCaptions((prev) => [
      ...prev,
      { id: Date.now().toString(), speaker: "AI", text },
    ]);

    try {
      const apiKey = await getDeepgramKey();

      const response = await fetch(
        "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Failed to generate TTS: ${response.status} ${response.statusText} ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!audioContextRef.current) {
         audioContextRef.current = new window.AudioContext();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      audioQueueRef.current.push(audioBuffer);
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch (err) {
      console.error("Deepgram TTS Error:", err);
    }
  };

  const submitToGemini = async (transcript: string) => {
    if (!transcript.trim()) return;

    setCaptions((prev) => [
      ...prev,
      { id: Date.now().toString(), speaker: "You", text: transcript },
    ]);

    setIsAgentThinking(true);
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, meetingId, agentId }),
      });

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
        await processAIResponse(data.response);
      }
    } catch (err: any) {
      console.error("Gemini Error:", err?.message || err);
      toast.error(`AI failed to respond: ${err?.message || "Unknown error"}`);
    } finally {
      setIsAgentThinking(false);
    }
  };

  const initDeepgram = useCallback(async () => {
    const currentId = ++connectionIdRef.current;
    console.log(`[useDeepgramAgent] Initializing Deepgram Agent for meeting ${meetingId}. Connection ID: ${currentId}`);
    
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      console.log("[useDeepgramAgent] Microphone access granted successfully.");

      if (connectionIdRef.current !== currentId) return;

      const apiKey = await getDeepgramKey();
      console.log("[useDeepgramAgent] Deepgram API key successfully retrieved.");
      
      if (connectionIdRef.current !== currentId) return;

      // --- 1. Agent Participant Setup ---
      if (agentId) {
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
          // DO NOT disable microphone here, otherwise Stream backend hard-mutes the participant 
          // overriding our custom audio stream.
          await call.join({ create: true });
          console.log("[useDeepgramAgent] Virtual AI Tutor participant joined Stream call.");

          // Set up the virtual microphone for the agent to broadcast TTS
          audioContextRef.current = new window.AudioContext();
          agentAudioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
          await call.publishAudioStream(agentAudioDestinationRef.current.stream);
          console.log("[useDeepgramAgent] Virtual mic published to Stream call successfully.");
        } catch (agentJoinErr) {
          console.error("[useDeepgramAgent] Warning: Failed to spawn virtual participant (AI will still listen locally):", agentJoinErr);
          if (!audioContextRef.current) {
            audioContextRef.current = new window.AudioContext();
          }
        }
      } else if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }
      // --------------------------------

      const sampleRate = audioContextRef.current?.sampleRate || 48000;
      console.log(`[useDeepgramAgent] Connecting to Deepgram WebSocket. Sample Rate: ${sampleRate}`);
      deepgramSocketRef.current = new WebSocket(
        `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=${sampleRate}&endpointing=300&smart_format=true`,
        ["token", apiKey]
      );

      deepgramSocketRef.current.onopen = async () => {
        console.log("[useDeepgramAgent] Deepgram WebSocket connection opened successfully.");
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
        processor.onaudioprocess = (e) => {
          if (
            deepgramSocketRef.current &&
            deepgramSocketRef.current.readyState === WebSocket.OPEN
          ) {
            const inputData = e.inputBuffer.getChannelData(0);
            const buffer = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              buffer[i] = inputData[i] * 32767;
            }
            deepgramSocketRef.current.send(buffer.buffer);

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
          console.log(`[useDeepgramAgent] Speech segment: "${transcript}" (is_final: ${received.is_final})`);
        }

        if (transcript && received.is_final) {
          accumulatedTranscriptRef.current += transcript + " ";

          if (transcriptTimeoutRef.current) {
            clearTimeout(transcriptTimeoutRef.current);
          }

          // If user pauses speaking for 0.8 seconds, send it to Gemini
          transcriptTimeoutRef.current = setTimeout(() => {
            if (accumulatedTranscriptRef.current.trim()) {
              console.log(`[useDeepgramAgent] Silence timeout reached. Submitting: "${accumulatedTranscriptRef.current.trim()}"`);
              submitToGemini(accumulatedTranscriptRef.current);
              accumulatedTranscriptRef.current = "";
            }
          }, 800);
        }
      };

      deepgramSocketRef.current.onerror = (error) => {
        console.error("[useDeepgramAgent] Deepgram Socket Error:", error);
      };

      deepgramSocketRef.current.onclose = (event) => {
        console.warn(`[useDeepgramAgent] Deepgram Socket Closed. Code: ${event.code}, Reason: ${event.reason || "None"}`);
      };
    } catch (err) {
      console.error("[useDeepgramAgent] Failed to initialize Deepgram Agent:", err);
    }
  }, [meetingId, agentId]);

  const cleanupDeepgram = useCallback(() => {
    connectionIdRef.current += 1; // Invalidate any pending init hooks
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
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
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

  return { captions, isAgentThinking };
};
