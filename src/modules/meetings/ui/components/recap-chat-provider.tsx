import React from "react";
import { authClient } from "@/lib/auth-client";
import LoadingState from "@/components/loading-state";
import { RecapChatUI } from "./recap-chat-ui";

interface RecapChatProviderProps {
  meetingId: string;
  meetingName: string;
  agentName?: string;
  agentId?: string;
}

export const RecapChatProvider = ({ meetingId, meetingName, agentName, agentId }: RecapChatProviderProps) => {
  const { data, isPending } = authClient.useSession();

  if (isPending || !data?.user) {
    return (
      <LoadingState
        title="Loading..."
        description="Please wait while we load the chat."
      />
    );
  }

  return (
    <>
      <RecapChatUI
        meetingId={meetingId}
        meetingName={meetingName}
        userId={data.user.id}
        userName={data.user.name}
        userImage={data.user.image ? data.user.image : undefined}
        agentName={agentName || "AI Tutor"}
        agentId={agentId}
      />
    </>
  );
};
