import { NextRequest, NextResponse } from "next/server";
import type { YouTubeRecommendation } from "@/lib/types";

interface YouTubeSearchItem {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      medium?: { url?: string };
      high?: { url?: string };
      default?: { url?: string };
    };
  };
}

function getTags(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 4);
}

async function searchYouTube(query: string, key: string): Promise<YouTubeRecommendation[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "3",
    q: query,
    relevanceLanguage: "en",
    safeSearch: "moderate",
    key,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const payload = await response.json() as { items?: YouTubeSearchItem[]; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || "YouTube Data API request failed");
  }

  return (payload.items ?? [])
    .map((item): YouTubeRecommendation | null => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title;
      if (!videoId || !title) return null;

      return {
        videoId,
        title,
        channelTitle: item.snippet?.channelTitle ?? "YouTube",
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        conceptTags: getTags(query),
        reason: `Recommended for reinforcing: ${query}`,
      };
    })
    .filter((item): item is YouTubeRecommendation => Boolean(item));
}

export async function POST(request: NextRequest) {
  try {
    const { queries } = (await request.json()) as { queries?: string[] };
    const key = process.env.YOUTUBE_DATA_API_KEY;

    if (!key) {
      return NextResponse.json(
        { error: "YOUTUBE_DATA_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const cleanQueries = (queries ?? [])
      .map((query) => query.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (!cleanQueries.length) {
      return NextResponse.json({ recommendations: [] });
    }

    const batches = await Promise.all(cleanQueries.map((query) => searchYouTube(query, key)));
    const seen = new Set<string>();
    const recommendations = batches
      .flat()
      .filter((video) => {
        if (seen.has(video.videoId)) return false;
        seen.add(video.videoId);
        return true;
      })
      .slice(0, 6);

    return NextResponse.json({ recommendations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch YouTube recommendations";
    console.error("YouTube recommendation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
