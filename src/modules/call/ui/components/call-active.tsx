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
  PhoneOff,
  Palette,
  Frown,
  Brain,
  BrainCircuit,
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
}

export const CallActive = ({
  meetingName,
  onWhiteboardToggle,
  isWhiteboardOpen,
  agentId,
  meetingId,
}: CallActiveProps) => {
  const call = useCall();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: updateMeeting } = useMutation(
    trpc.meetings.update.mutationOptions(),
  );

  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();

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
    if (isMute) {
      await microphone.enable();
    } else {
      await microphone.disable();
    }
  };

  const handleLeave = async () => {
    await call?.leave();
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
            isMute
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
          title={isMute ? "Unmute" : "Mute"}
        >
          {isMute ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
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
          onClick={handleConfused}
          className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200"
          title="I'm Confused"
        >
          <Frown className="w-5 h-5" />
        </button>

        {/* Leave Call */}
        <button
          onClick={handleLeave}
          className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200"
          title="Leave call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
