"use client";

import { useTRPC } from "@/trpc/client";
import { YouTubeVideo } from "@/lib/youtube";
import { Youtube, ExternalLink, Play } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";

interface YouTubeSuggestionsProps {
  meetingId: string;
}

export const YouTubeSuggestions = ({ meetingId }: YouTubeSuggestionsProps) => {
  const trpc = useTRPC();
  const { data: meeting } = trpc.meetings.getOne.useQuery({ id: meetingId }, {
    refetchInterval: 10000, // Poll every 10 seconds for new suggestions
  });

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);

  useEffect(() => {
    if (meeting?.suggestedVideos) {
      try {
        const parsed = JSON.parse(meeting.suggestedVideos);
        setVideos(parsed);
      } catch (e) {
        console.error("Failed to parse suggested videos", e);
      }
    }
  }, [meeting?.suggestedVideos]);

  if (videos.length === 0) return null;

  return (
    <div className="absolute top-24 left-4 z-40 max-w-[280px] space-y-3">
      <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3 text-red-500">
          <Youtube className="size-5" />
          <h5 className="text-sm font-bold text-white uppercase tracking-wider">Suggested for you</h5>
        </div>
        
        <div className="space-y-3">
          {videos.map((video, i) => (
            <a
              key={i}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block relative overflow-hidden rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/20"
            >
              <div className="aspect-video relative overflow-hidden bg-neutral-800">
                {video.thumbnail && (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-red-600 rounded-full p-2 text-white">
                    <Play className="size-4 fill-current" />
                  </div>
                </div>
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-neutral-200 line-clamp-2 group-hover:text-white transition-colors">
                  {video.title}
                </p>
                <div className="mt-1 flex items-center text-[10px] text-neutral-500 font-bold uppercase tracking-tighter">
                  Watch on YouTube
                  <ExternalLink className="size-2 ml-1" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
