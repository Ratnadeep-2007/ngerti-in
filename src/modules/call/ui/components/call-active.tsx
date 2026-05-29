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
} from "lucide-react";
import { useCallback } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEmotionDetection } from "../../hooks/use-emotion-detection";

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
  const queryClient = useQueryClient();
  const { mutateAsync: updateMeeting } = useMutation(
    trpc.meetings.update.mutationOptions(),
  );

  const isOwner = userId === creatorId;

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

      {/* Custom Call Controls */}
      <div className="bg-[#101213] rounded-full px-6 py-4 flex items-center justify-center gap-4">
        {/* Microphone Toggle */}
        <button
          onClick={handleMicToggle}
          className={`p-3 rounded-full transition-all duration-200 ${
            isMicMute
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
          title={isMicMute ? "Unmute" : "Mute"}
        >
          {isMicMute ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={handleCameraToggle}
          className={`p-3 rounded-full transition-all duration-200 ${
            isCameraMute
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
          title={isCameraMute ? "Turn Camera On" : "Turn Camera Off"}
        >
          {isCameraMute ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </button>

        {/* Screen Share Toggle */}
        {/* <button
          onClick={handleScreenShareToggle}
          className={`p-3 rounded-full transition-all duration-200 ${
            isScreenShareOn 
              ? 'bg-blue-500 hover:bg-blue-600 text-white' 
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isScreenShareOn ? "Stop sharing" : "Share screen"}
        >
          {isScreenShareOn ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button> */}

        {/* Whiteboard Toggle */}
        <button
          onClick={onWhiteboardToggle}
          className={`p-3 rounded-full transition-all duration-200 ${
            isWhiteboardOpen
              ? "bg-purple-500 hover:bg-purple-600 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
          title={isWhiteboardOpen ? "Close whiteboard" : "Open whiteboard"}
        >
          <Palette className="w-5 h-5" />
        </button>

        {/* I'm Confused Button */}
        <button
          onClick={() => handleConfused("manual")}
          className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200"
          title="I'm Confused"
        >
          <Frown className="w-5 h-5" />
        </button>

        {/* Invite Button */}
        <button
          onClick={handleInvite}
          className="p-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200"
          title="Invite Others"
        >
          <UserPlus className="w-5 h-5" />
        </button>

        {/* Leave Call */}
        <button
          onClick={handleLeave}
          className="p-3 rounded-full bg-yellow-600 hover:bg-yellow-700 text-white transition-all duration-200"
          title="Leave call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>

        {/* End Meeting (Owner only) */}
        {isOwner && (
          <>
            <button
              onClick={handleEndMeeting}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200"
              title="End meeting for everyone"
            >
              <Power className="w-5 h-5" />
            </button>
            <button
              onClick={handleRemove}
              className="p-3 rounded-full bg-gray-800 hover:bg-black text-white transition-all duration-200"
              title="Delete meeting permanently"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
