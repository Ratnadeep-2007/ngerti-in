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
  MessageSquareText,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEmotionDetection } from "../../hooks/use-emotion-detection";
import { useRouter } from "next/navigation";
import { useDeepgramAgent } from "../../hooks/use-deepgram-agent";

interface CallActiveProps {
  meetingName: string;
  onWhiteboardToggle?: () => void;
  isWhiteboardOpen?: boolean;
  agentId?: string;
  meetingId: string;
  creatorId: string;
  userId: string;
}

export const CallActive = ({
  meetingName,
  onWhiteboardToggle,
  isWhiteboardOpen,
  agentId,
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

  const [showCaptions, setShowCaptions] = useState(false);
  const { captions, isAgentThinking } = useDeepgramAgent({
    meetingId,
    agentId: agentId || "",
    enabled: !!agentId,
  });

  const { useMicrophoneState, useCameraState } = useCallStateHooks();
  const { microphone, isMute: isMicMute } = useMicrophoneState();
  const { camera, isMute: isCameraMute } = useCameraState();

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

  const { videoRef, isModelsLoaded } = useEmotionDetection(() =>
    handleConfused("proactive"),
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
    <div className="flex flex-col justify-between p-4 h-full text-white relative">
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

      {/* Captions Overlay */}
      {showCaptions && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-black/60 backdrop-blur-md rounded-2xl p-4 flex flex-col gap-2 max-h-48 overflow-y-auto pointer-events-auto border border-white/10 z-10">
          {captions.map((cap) => (
            <div
              key={cap.id}
              className={`flex flex-col ${cap.speaker === "You" ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] text-white/50 mb-1">{cap.speaker}</span>
              <span
                className={`text-sm px-3 py-2 rounded-xl ${
                  cap.speaker === "You"
                    ? "bg-blue-500/20 text-blue-100"
                    : "bg-purple-500/20 text-purple-100"
                }`}
              >
                {cap.text}
              </span>
            </div>
          ))}
          {isAgentThinking && (
            <div className="flex flex-col items-start mt-2 animate-pulse">
              <span className="text-[10px] text-white/50 mb-1">AI</span>
              <span className="text-sm px-3 py-2 rounded-xl bg-purple-500/10 text-purple-200/50 italic">
                Thinking...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Custom Call Controls */}
      <div className="bg-[#101213]/90 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-4 flex items-center justify-center gap-6 shadow-2xl">
        {/* Microphone Toggle */}
        <button
          onClick={handleMicToggle}
          className="flex flex-col items-center gap-2 group"
          title={isMicMute ? "Unmute" : "Mute"}
        >
          <div className={`p-4 rounded-xl transition-all duration-200 ${
            isMicMute
              ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20 border border-white/5"
          }`}>
            {isMicMute ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </div>
          <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">
            {isMicMute ? "Unmute" : "Mute"}
          </span>
        </button>

        {/* Camera Toggle */}
        <button
          onClick={handleCameraToggle}
          className="flex flex-col items-center gap-2 group"
          title={isCameraMute ? "Turn Camera On" : "Turn Camera Off"}
        >
          <div className={`p-4 rounded-xl transition-all duration-200 ${
            isCameraMute
              ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20 border border-white/5"
          }`}>
            {isCameraMute ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </div>
          <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">
            {isCameraMute ? "Start Video" : "Stop Video"}
          </span>
        </button>

        {/* Whiteboard Toggle */}
        <button
          onClick={onWhiteboardToggle}
          className="flex flex-col items-center gap-2 group"
          title={isWhiteboardOpen ? "Close whiteboard" : "Open whiteboard"}
        >
          <div className={`p-4 rounded-xl transition-all duration-200 ${
            isWhiteboardOpen
              ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30"
              : "bg-white/10 text-white hover:bg-white/20 border border-white/5"
          }`}>
            <Palette className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">
            Whiteboard
          </span>
        </button>

        {/* Captions Toggle */}
        <button
          onClick={() => setShowCaptions((prev) => !prev)}
          className="flex flex-col items-center gap-2 group"
          title={showCaptions ? "Hide Captions" : "Show Captions"}
        >
          <div className={`p-4 rounded-xl transition-all duration-200 ${
            showCaptions
              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
              : "bg-white/10 text-white hover:bg-white/20 border border-white/5"
          }`}>
            <MessageSquareText className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">
            Captions
          </span>
        </button>

        <div className="w-[1px] h-12 bg-white/10 mx-2" />

        {/* I'm Confused Button */}
        <button
          onClick={() => handleConfused("manual")}
          className="flex flex-col items-center gap-2 group"
          title="I need help"
        >
          <div className="p-4 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 transition-all duration-200">
            <Frown className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">
            Confused?
          </span>
        </button>

        {/* Invite Button */}
        <button
          onClick={handleInvite}
          className="flex flex-col items-center gap-2 group"
          title="Invite Others"
        >
          <div className="p-4 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all duration-200">
            <UserPlus className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">
            Invite
          </span>
        </button>

        <div className="w-[1px] h-12 bg-white/10 mx-2" />

        {/* End / Leave Call */}
        {isOwner ? (
          <button
            onClick={handleEndMeeting}
            className="flex flex-col items-center gap-2 group"
            title="End meeting for everyone"
          >
            <div className="p-4 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-200">
              <Power className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-red-400 group-hover:text-red-300 transition-colors">
              End Call
            </span>
          </button>
        ) : (
          <button
            onClick={handleLeave}
            className="flex flex-col items-center gap-2 group"
            title="Leave call"
          >
            <div className="p-4 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-200">
              <PhoneOff className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-red-400 group-hover:text-red-300 transition-colors">
              Leave
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
