import Link from "next/link";
import Image from "next/image";
import {
  SpeakerLayout,
  useCallStateHooks,
  useCall,
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
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEmotionDetection } from "../../hooks/use-emotion-detection";
import { useRouter } from "next/navigation";
import { useLiveTutor } from "../../hooks/use-live-tutor";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatProvider } from "@/modules/meetings/ui/components/chat-provider";

interface CallActiveProps {
  meetingName: string;
  onWhiteboardToggle?: () => void;
  isWhiteboardOpen?: boolean;
  agentId?: string;
  agentName?: string;
  meetingId: string;
  creatorId: string;
  userId: string;
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

  const { useMicrophoneState, useCameraState } = useCallStateHooks();
  const { microphone, isMute: isMicMute, hasBrowserPermission: hasMicPermission } = useMicrophoneState();
  const { camera, isMute: isCameraMute } = useCameraState();

  const {
    isTutorEnabled,
    isListening,
    isThinking,
    lastSpeech,
    toggleTutor,
  } = useLiveTutor({
    meetingId,
    agentId: agentId || "",
    agentName: agentName || "AI Tutor",
    call: call || undefined,
    hasMicPermission,
  });

  const handleConfused = useCallback(
    async (source: "manual" | "proactive" = "manual") => {
      if (!meetingId) return;

      try {
        const contextMessage =
          source === "manual"
            ? "The student just clicked the 'I am confused' button. Please pause, check in with them warmly, and offer to explain the current topic in a simpler way."
            : "The AI emotion detector noticed the student looks confused or concerned. Please pause, check in with them warmly, and offer to explain the current topic in a simpler way.";

        await updateMeeting({
          id: meetingId,
          currentPrompt: contextMessage,
        });

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
      } catch (err) {
        console.error(err);
        if (source === "manual") {
          toast.error("Failed to notify AI tutor");
        }
      }
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
        <SpeakerLayout />

        {/* AI Tutor Overlay widgets */}
        <div className="flex flex-col gap-2 z-10 w-full max-w-xl mx-auto absolute bottom-28 left-1/2 -translate-x-1/2 px-4 pointer-events-none">
          {isListening && (
            <div className="flex items-center gap-3 px-4 py-2 bg-red-600/35 border border-red-500/45 backdrop-blur-md rounded-full shadow-lg text-sm text-red-100 w-fit mx-auto animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="font-medium tracking-wide">Listening to you...</span>
            </div>
          )}

          {isThinking && (
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
