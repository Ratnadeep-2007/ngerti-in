import React, { use } from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Channel as StreamChannel } from "stream-chat";
import {
  useCreateChatClient,
  Chat,
  Channel,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { useTRPC } from "@/trpc/client";
import LoadingState from "@/components/loading-state";
import { MessageSquareText } from "lucide-react";
import "stream-chat-react/dist/css/v2/index.css";

interface ChatUIProps {
  meetingId: string;
  meetingName: string;
  userId: string;
  userName: string;
  userImage: string | undefined;
}

export const ChatUI = ({
  meetingId,
  meetingName,
  userId,
  userImage,
  userName,
}: ChatUIProps) => {
  const trpc = useTRPC();
  const { mutateAsync: generateChatToken } = useMutation(
    trpc.meetings.generateChatToken.mutationOptions(),
  );
  const [channel, setChannel] = useState<StreamChannel>();
  const client = useCreateChatClient({
    apiKey: process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
    tokenOrProvider: generateChatToken,
    userData: {
      id: userId,
      name: userName,
      image: userImage,
    },
  });

  useEffect(() => {
    if (!client) return;
    const channel = client.channel("livestream", meetingId, {
      name: meetingName,
      members: [userId],
    } as any);

    const initChannel = async () => {
      await channel.watch();
      setChannel(channel);
    };

    initChannel();
  }, [client, meetingId, userId, meetingName]);

  if (!client || !channel) {
    return (
      <div className="flex items-center justify-center h-full bg-white/5 backdrop-blur-md">
        <LoadingState
          title="Loading Chat"
          description="Connecting to meeting chat..."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#101213]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <MessageSquareText className="size-4 text-blue-400" />
          Meeting Chat
        </h3>
      </div>
      <div className="flex-1 min-h-0 h-full">
        <Chat client={client} theme="str-chat__theme-dark">
          <Channel channel={channel}>
            <div className="flex flex-col h-full justify-between">
              <div className="flex-1 overflow-y-auto min-h-0">
                <MessageList />
              </div>
              <div className="p-3 border-t border-white/10 bg-black/20">
                <MessageInput focus />
              </div>
            </div>
          </Channel>
        </Chat>
      </div>
    </div>
  );
};
