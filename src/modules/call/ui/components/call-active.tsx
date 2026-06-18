import Link from "next/link";
import Image from "next/image";
import {
  SpeakerLayout,
  useCallStateHooks,
  useCall,
  ParticipantView,
  ParticipantsAudio,
} from "@stream-io/video-react-sdk";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Palette,
  Frown,
  Brain,
  BrainCircuit,
  UserPlus,
  Power,
  Trash2,
  Loader2Icon,
  MessageSquare,
  X,
  Volume2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { generatedAvatarUri } from "@/lib/avatar";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEmotionDetection } from "../../hooks/use-emotion-detection";
import { useRouter } from "next/navigation";
import { useDeepgramAgent } from "../../hooks/use-deepgram-agent";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatProvider } from "@/modules/meetings/ui/components/chat-provider";

const AITutorCard = ({
  agentName,
  isListening,
  isThinking,
  isSpeaking,
  lastSpeech,
  personality = "socratic",
}: {
  agentName: string;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  lastSpeech: { speaker: string; text: string } | null;
  personality?: "socratic" | "eli5" | "coach";
}) => {
  // Determine Dicebear style variant
  let avatarVariant: "botttsNeutral" | "bottts" | "lorelei" | "shapes" = "botttsNeutral";
  if (personality === "socratic") {
    avatarVariant = "lorelei";
  } else if (personality === "eli5") {
    avatarVariant = "shapes";
  } else if (personality === "coach") {
    avatarVariant = "bottts";
  }

  const avatarUrl = generatedAvatarUri({
    seed: agentName || "AI Tutor",
    variant: avatarVariant,
  });

  let statusClass = "tutor-avatar-idle";
  let statusText = "Ready";
  let statusColor = "bg-gray-400";

  if (isSpeaking) {
    statusClass = "tutor-avatar-speaking";
    statusText = "Speaking";
    statusColor = "bg-green-500";
  } else if (isThinking) {
    statusClass = "tutor-avatar-thinking";
    statusText = "Thinking";
    statusColor = "bg-purple-500";
  } else if (isListening) {
    statusClass = "tutor-avatar-listening";
    statusText = "Listening";
    statusColor = "bg-blue-500";
  }

  const tutorSpeechText = lastSpeech && lastSpeech.speaker === agentName ? lastSpeech.text : null;

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden min-h-[350px] transition-all duration-300">
      <div className={`absolute -inset-10 opacity-20 blur-[80px] transition-all duration-700 pointer-events-none rounded-full ${
        isSpeaking ? "bg-green-500/20" : isThinking ? "bg-purple-500/20" : isListening ? "bg-blue-500/20" : "bg-zinc-500/5"
      }`} />

      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
          <Brain className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">AI Participant</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-black/45 border border-white/5 rounded-full">
          <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-300">{statusText}</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 w-full gap-6 mt-4">
        <div className="relative">
          <div className={`w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden flex items-center justify-center bg-zinc-900 border-4 transition-all duration-300 ${statusClass}`}>
            <img 
              src={avatarUrl} 
              alt={agentName} 
              className="w-24 h-24 md:w-28 md:h-28 object-contain"
            />
          </div>

          <div className={`absolute -bottom-2 -right-2 p-2.5 rounded-full border text-white shadow-lg transition-all duration-300 ${
            isSpeaking ? "bg-green-600 border-green-500 scale-110" :
            isThinking ? "bg-purple-600 border-purple-500 scale-110" :
            isListening ? "bg-blue-600 border-blue-500 scale-110" :
            "bg-zinc-800 border-zinc-700"
          }`}>
            {isSpeaking ? <Volume2 className="w-5 h-5 animate-bounce" /> :
             isThinking ? <Loader2Icon className="w-5 h-5 animate-spin" /> :
             isListening ? <Mic className="w-5 h-5 animate-pulse" /> :
             <BrainCircuit className="w-5 h-5" />}
          </div>
        </div>

        <div className="text-center z-10 w-full">
          <h3 className="text-lg font-bold tracking-tight text-white">{agentName}</h3>
          <p className="text-xs text-zinc-400 mt-1 font-medium mb-3">
            {isSpeaking ? "Explaining topic..." :
             isThinking ? "Thinking..." :
             isListening ? "Listening closely..." :
             "Standing by"}
          </p>

          {isSpeaking && (
            <div className="soundwave animate-in fade-in zoom-in-95 duration-200 mt-2">
              <div className="soundwave-bar" />
              <div className="soundwave-bar" />
              <div className="soundwave-bar" />
              <div className="soundwave-bar" />
              <div className="soundwave-bar" />
              <div className="soundwave-bar" />
              <div className="soundwave-bar" />
              <div className="soundwave-bar" />
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-md mt-auto z-10 min-h-[80px] flex items-end">
        {tutorSpeechText ? (
          <div className="w-full p-4 bg-zinc-950/80 border border-purple-500/30 rounded-2xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
            <div className="absolute -top-3 left-4 px-2 py-0.5 bg-purple-600 border border-purple-400 rounded-md text-[9px] font-extrabold uppercase tracking-widest text-white">
              {agentName}
            </div>
            <p className="text-sm font-medium text-zinc-200 leading-relaxed pt-1 max-h-24 overflow-y-auto pr-1">
              {tutorSpeechText}
            </p>
          </div>
        ) : isListening ? (
          <div className="w-full py-3 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/20">
            <p className="text-xs italic text-zinc-500">Go ahead, speak to me...</p>
          </div>
        ) : (
          <div className="w-full py-3 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/20">
            <p className="text-xs text-zinc-500">Enable "Talk to AI" below to start the conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface CallActiveProps {
  meetingName: string;
  onWhiteboardToggle?: () => void;
  isWhiteboardOpen?: boolean;
  agentId?: string;
  agentName?: string;
  meetingId: string;
  creatorId: string;
  userId: string;
  agentLanguage?: string;
}

export const CallActive = ({
  meetingName,
  onWhiteboardToggle,
  isWhiteboardOpen,
  agentId,
  agentName,
  meetingId,
  creatorId,
  userId,
  agentLanguage,
}: CallActiveProps) => {
  const call = useCall();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutateAsync: updateMeeting } = useMutation(
    trpc.meetings.update.mutationOptions(),
  );
  const { mutateAsync: removeMeeting } = useMutation(
    trpc.meetings.remove.mutationOptions(),
  );

  const isOwner = userId === creatorId;
  const [showChat, setShowChat] = useState(false);
  const [personality, setPersonality] = useState<"socratic" | "eli5" | "coach">("socratic");
  const [language, setLanguage] = useState<string>(() => {
    if (agentLanguage === "English") return "en-US";
    if (agentLanguage === "Standard" || agentLanguage === "Javanese" || agentLanguage === "Sundanese" || agentLanguage === "Slang") {
      return "id-ID";
    }
    return "en-US";
  });

  const { useMicrophoneState, useCameraState, useLocalParticipant, useParticipants } = useCallStateHooks();
  const { microphone, isMute: isMicMute, hasBrowserPermission: hasMicPermission } = useMicrophoneState();
  const { camera, isMute: isCameraMute } = useCameraState();
  const localParticipant = useLocalParticipant();
  const participants = useParticipants();

  const [isTutorEnabled, setIsTutorEnabled] = useState(false);
  const toggleTutor = () => setIsTutorEnabled((prev) => !prev);

  const { captions, isAgentThinking } = useDeepgramAgent({
    meetingId,
    agentId: agentId || "",
    enabled: isTutorEnabled,
  });

  const isListening = isTutorEnabled && !isAgentThinking;
  const isThinking = isAgentThinking;
  const isSpeaking = false;
  const interimTranscript = "";

  const lastCaption = captions[captions.length - 1];
  const lastSpeech = lastCaption
    ? {
        speaker: lastCaption.speaker === "You" ? "Student" : (agentName || "AI Tutor"),
        text: lastCaption.text,
      }
    : null;

  const handleConfused = useCallback(
    async (source: "manual" | "proactive" = "manual") => {
      if (!meetingId) return;

      const contextMessage =
        source === "manual"
          ? "The student just clicked the 'I am confused' button. Please pause, check in with them warmly, and offer to explain the current topic in a simpler way."
          : "The AI emotion detector noticed the student looks confused or concerned. Please pause, check in with them warmly, and offer to explain the current topic in a simpler way.";

      // Optimistic UI response to the user
      if (source === "manual") {
        toast.success("AI tutor has been notified that you're confused!");
      } else {
        toast.info(
          "AI tutor noticed you might be confused and is adapting...",
          {
            icon: <Brain className="size-4" />,
          },
        );
      }

      // Run database update in the background (non-blocking)
      updateMeeting({
        id: meetingId,
        currentPrompt: contextMessage,
      }).catch((err) => {
        console.error("Failed to notify AI tutor in database:", err);
      });
    },
    [meetingId, updateMeeting],
  );

  const { videoRef, isModelsLoaded } = useEmotionDetection(
    () => handleConfused("proactive"),
    !isCameraMute,
  );

  const handleMicToggle = async () => {
    try {
      if (isMicMute) {
        await microphone.enable();
      } else {
        await microphone.disable();
      }
    } catch (err) {
      console.error(err);
      toast.error(
        "Could not access microphone. Please check your browser permissions.",
      );
    }
  };

  const handleCameraToggle = async () => {
    try {
      if (isCameraMute) {
        await camera.enable();
      } else {
        await camera.disable();
      }
    } catch (err) {
      console.error(err);
      toast.error(
        "Could not access camera. Please check your browser permissions.",
      );
    }
  };

  const handleLeave = async () => {
    await call?.leave();
  };

  const handleEndMeeting = async () => {
    if (!call) return;
    try {
      await updateMeeting({
        id: meetingId,
        status: "completed",
        endedAt: new Date().toISOString() as any,
      });
      await call.endCall();
      toast.success("Meeting ended for everyone");
    } catch (err) {
      console.error(err);
      toast.error("Failed to end meeting");
    }
  };

  const handleInvite = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Meeting link copied to clipboard!");
  };

  const handleRemove = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this meeting permanently? This action cannot be undone.",
    );
    if (!confirmDelete) return;

    try {
      await removeMeeting({ id: meetingId });
      await call?.leave();
      toast.success("Meeting deleted successfully");
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete meeting");
    }
  };

  return (
    <div className="flex h-full text-white relative overflow-hidden">
      <ParticipantsAudio participants={participants} />
      <div className={`flex flex-col justify-between p-4 flex-1 transition-all duration-300 ${showChat ? 'mr-[350px]' : ''}`}>
        {/* Hidden Video for Emotion Detection */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="hidden absolute -z-50 opacity-0 pointer-events-none"
        />

        {/* Header */}
        <div className="bg-[#101213] rounded-full p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={"/"}
              className="flex items-center p-1 bg-white/10 rounded-full w-fit hover:bg-white/20 transition-colors"
            >
              <Image src={"/logo.svg"} width={22} height={22} alt="logo" />
            </Link>
            <h4 className="text-base font-medium">{meetingName}</h4>
          </div>

          {/* Emotion Detection Status */}
          {isModelsLoaded && (
            <div
              className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full animate-pulse"
              title="AI Emotion Detection Active"
            >
              <BrainCircuit className="size-4 text-blue-400" />
              <span className="text-xs font-medium text-blue-100">AI Active</span>
            </div>
          )}
        </div>

        {/* Video Layout */}
        {localParticipant ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 relative z-10 mb-4 items-stretch">
            {/* User Camera Tile */}
            <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#1e2022]/40 backdrop-blur-md shadow-2xl flex items-center justify-center h-full min-h-[300px]">
              <ParticipantView 
                participant={localParticipant} 
                ParticipantViewUI={null}
              />
              
              {/* Interim Captions Bubble */}
              {interimTranscript && (
                <div className="absolute top-4 left-4 right-4 z-20 p-3 bg-black/85 border border-white/15 rounded-2xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">Captions (Live)</p>
                  <p className="text-sm font-medium text-white/95 leading-relaxed italic">
                    "{interimTranscript}..."
                  </p>
                </div>
              )}

              {/* User Name Tag overlay */}
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 border border-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-white/90">
                You ({localParticipant.name || "Student"})
              </div>
            </div>

            {/* Custom AI Tutor Card */}
            <AITutorCard
              agentName={agentName || "AI Tutor"}
              isListening={isListening}
              isThinking={isThinking}
              isSpeaking={isSpeaking}
              lastSpeech={lastSpeech}
              personality={personality}
            />
          </div>
        ) : (
          <SpeakerLayout />
        )}

        {/* AI Tutor Overlay widgets */}
        <div className="flex flex-col gap-2 z-10 w-full max-w-xl mx-auto absolute bottom-28 left-1/2 -translate-x-1/2 px-4 pointer-events-none">
          {isTutorEnabled && isListening && (
            <div className="flex items-center gap-3 px-4 py-2 bg-red-600/35 border border-red-500/45 backdrop-blur-md rounded-full shadow-lg text-sm text-red-100 w-fit mx-auto animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="font-medium tracking-wide">Listening to you...</span>
            </div>
          )}

          {isTutorEnabled && isThinking && (
            <div className="flex items-center gap-3 px-4 py-2 bg-purple-600/35 border border-purple-500/45 backdrop-blur-md rounded-full shadow-lg text-sm text-purple-100 w-fit mx-auto">
              <Loader2Icon className="size-4 animate-spin text-purple-400" />
              <span className="font-semibold tracking-wide">{agentName || "AI Tutor"} is thinking...</span>
            </div>
          )}

          {lastSpeech && (
            <div className="text-center px-6 py-2.5 bg-black/85 border border-white/10 backdrop-blur-md rounded-2xl shadow-xl max-h-24 overflow-y-auto pointer-events-auto">
              <p className="text-xs font-semibold text-purple-400 tracking-widest uppercase mb-1">{lastSpeech.speaker}</p>
              <p className="text-sm font-medium text-white/95 leading-relaxed">{lastSpeech.text}</p>
            </div>
          )}
        </div>

        {/* Custom Call Controls */}
        <div className="bg-[#101213]/90 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-4 flex items-center justify-center gap-4 shadow-2xl z-20">
          {/* Microphone Toggle */}
          <button
            onClick={handleMicToggle}
            className={`p-3 rounded-xl transition-all duration-200 ${
              isMicMute || !hasMicPermission
                ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/5"
            }`}
            title={isMicMute || !hasMicPermission ? "Unmute" : "Mute"}
          >
            {isMicMute || !hasMicPermission ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={handleCameraToggle}
            className={`p-3 rounded-xl transition-all duration-200 ${
              isCameraMute
                ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/5"
            }`}
            title={isCameraMute ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isCameraMute ? (
              <VideoOff className="w-5 h-5" />
            ) : (
              <Video className="w-5 h-5" />
            )}
          </button>

          {/* Whiteboard Toggle */}
          <button
            onClick={onWhiteboardToggle}
            className={`p-3 rounded-xl transition-all duration-200 ${
              isWhiteboardOpen
                ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/5"
            }`}
            title={isWhiteboardOpen ? "Close whiteboard" : "Open whiteboard"}
          >
            <Palette className="w-5 h-5" />
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => setShowChat((prev) => !prev)}
            className={`p-3 rounded-xl transition-all duration-200 ${
              showChat
                ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/5"
            }`}
            title={showChat ? "Hide Chat" : "Show Chat"}
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Talk to AI Toggle Switch */}
          <div className={`flex items-center gap-3 px-4 py-2 bg-[#171a1c] border border-purple-500/20 rounded-full transition-all duration-200 shadow-md`}>
            <BrainCircuit className={`w-5 h-5 transition-colors duration-200 ${isTutorEnabled ? "text-purple-400" : "text-gray-400"} ${isListening ? "text-red-400 animate-pulse" : ""}`} />
            <span className="text-sm font-semibold text-gray-200 tracking-wide select-none">Talk to AI</span>
            <Switch
              checked={isTutorEnabled}
              onCheckedChange={toggleTutor}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          {/* Personality Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#171a1c] border border-white/10 rounded-full hover:border-purple-500/30 transition-all duration-200 shadow-md">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest pl-1 select-none">Style:</span>
            <select
              value={personality}
              onChange={(e) => setPersonality(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-2 border-none focus:ring-0"
            >
              <option value="socratic" className="bg-[#101213] text-white font-medium">🤔 Socratic</option>
              <option value="eli5" className="bg-[#101213] text-white font-medium">👶 ELI5</option>
              <option value="coach" className="bg-[#101213] text-white font-medium">💻 Coach</option>
            </select>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#171a1c] border border-white/10 rounded-full hover:border-purple-500/30 transition-all duration-200 shadow-md">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest pl-1 select-none">Lang:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-2 border-none focus:ring-0"
            >
              <option value="en-US" className="bg-[#101213] text-white font-medium">🇺🇸 English</option>
              <option value="id-ID" className="bg-[#101213] text-white font-medium">🇮🇩 Indonesian</option>
              <option value="es-ES" className="bg-[#101213] text-white font-medium">🇪🇸 Spanish</option>
              <option value="hi-IN" className="bg-[#101213] text-white font-medium">🇮🇳 Hindi</option>
            </select>
          </div>

          <div className="w-[1px] h-10 bg-white/10 mx-1" />

          {/* I'm Confused Button */}
          <button
            onClick={() => handleConfused("manual")}
            className="p-3 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 transition-all duration-200"
            title="I'm Confused"
          >
            <Frown className="w-5 h-5" />
          </button>

          {/* Invite Button */}
          <button
            onClick={handleInvite}
            className="p-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all duration-200"
            title="Invite Others"
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <div className="w-[1px] h-10 bg-white/10 mx-1" />

          {/* Leave Call */}
          {isOwner ? (
            <button
              onClick={handleEndMeeting}
              className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-200"
              title="End meeting for everyone"
            >
              <Power className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-200"
              title="Leave call"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          )}

          {isOwner && (
            <button
              onClick={handleRemove}
              className="p-3 rounded-xl bg-gray-800 hover:bg-black text-white border border-white/5 transition-all duration-200"
              title="Delete meeting permanently"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Sidebar Overlay */}
      {showChat && (
        <div className="absolute top-0 right-0 h-full w-[350px] z-30 animate-in slide-in-from-right duration-300">
          <ChatProvider meetingId={meetingId} meetingName={meetingName} />
          {/* Close button for sidebar */}
          <button 
            onClick={() => setShowChat(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all z-40"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
};
