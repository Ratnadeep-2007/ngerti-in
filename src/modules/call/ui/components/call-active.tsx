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
  Monitor,
  MonitorOff,
  Palette,
  Frown,
} from "lucide-react";
// import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CallActiveProps {
  meetingName: string;
  onWhiteboardToggle?: () => void;
  isWhiteboardOpen?: boolean;
  agentId?: string;
}

export const CallActive = ({
  meetingName,
  onWhiteboardToggle,
  isWhiteboardOpen,
  agentId,
}: CallActiveProps) => {
  const call = useCall();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: updateAgent } = useMutation(
    trpc.agents.update.mutationOptions(),
  );

  const { useMicrophoneState, useScreenShareState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  // const { screenShare, isScreenShareOn } = useScreenShareState();

  const handleConfused = async () => {
    if (!agentId) return;

    try {
      const agent = await queryClient.fetchQuery(
        trpc.agents.getOne.queryOptions({ id: agentId }),
      );
      const newPrompt = `${agent.prompt}\n\n[CONTEXT: The student just clicked the 'I am confused' button. Please pause, check in with them warmly, and offer to explain the current topic in a simpler way.]`;

      await updateAgent({
        id: agentId,
        name: agent.name,
        subject: agent.subject,
        prompt: newPrompt,
        language: agent.language,
      });

      toast.success("AI tutor has been notified that you're confused!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to notify AI tutor");
    }
  };

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
    <div className="flex flex-col justify-between p-4 h-full text-white">
      {/* Header */}
      <div className="bg-[#101213] rounded-full p-4 flex items-center gap-4">
        <Link
          href={"/"}
          className="flex items-center p-1 bg-white/10 rounded-full w-fit hover:bg-white/20 transition-colors"
        >
          <Image src={"/logo.svg"} width={22} height={22} alt="logo" />
        </Link>
        <h4 className="text-base font-medium">{meetingName}</h4>
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
