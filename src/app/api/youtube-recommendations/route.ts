import { NextRequest, NextResponse } from "next/server";
import type { YouTubeRecommendation } from "@/lib/types";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

function getYoutubeApiKey(): string | null {
  return process.env.YOUTUBE_DATA_API_KEY ?? null;
}

function normalizeQuery(value: string): string {
  return value.split("|")[0].replace(/\s+/g, " ").trim();
}

function extractKeywords(text: string, limit = 5): string[] {
  const stopwords = new Set([
    "the", "and", "for", "with", "from", "into", "your", "this", "that", "what", "when",
    "where", "why", "how", "use", "using", "video", "tutorial", "guide", "learn", "lesson",
    "course", "beginner", "advanced", "python", "javascript", "coding", "code",
  ]);

  return text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g)
    ?.filter((token) => !stopwords.has(token))
    .slice(0, limit) ?? [];
}

function buildConceptTags(query: string, title: string, description: string, tags: string[] = []): string[] {
  const keywordPool = [
    ...extractKeywords(query, 3),
    ...extractKeywords(title, 4),
    ...extractKeywords(description, 4),
    ...tags.slice(0, 4).map((tag) => tag.toLowerCase()),
  ];

  const unique: string[] = [];
  for (const keyword of keywordPool) {
    if (!unique.includes(keyword)) unique.push(keyword);
    if (unique.length >= 5) break;
  }
  return unique;
}

async function fetchSearchResults(query: string, apiKey: string) {
  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "4");
  url.searchParams.set("q", normalizeQuery(query));
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`YouTube search failed: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        channelTitle?: string;
        thumbnails?: {
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
  };

  return data.items ?? [];
}

async function fetchVideoDetails(videoIds: string[], apiKey: string) {
  if (!videoIds.length) return [];

  const url = new URL(YOUTUBE_VIDEOS_URL);
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`YouTube video lookup failed: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        description?: string;
        channelTitle?: string;
        tags?: string[];
        thumbnails?: {
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
      contentDetails?: { duration?: string };
    }>;
  };

  return data.items ?? [];
}

async function buildRecommendations(queries: string[]): Promise<YouTubeRecommendation[]> {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) {
    throw new Error("YOUTUBE_DATA_API_KEY is not configured");
  }

  const recommendations: YouTubeRecommendation[] = [];
  const seenVideoIds = new Set<string>();

  for (const query of queries.slice(0, 3)) {
    const searchItems = await fetchSearchResults(query, apiKey);
    const videoIds = searchItems
      .map((item) => item.id?.videoId)
      .filter((videoId): videoId is string => typeof videoId === "string" && videoId.length > 0)
      .filter((videoId) => !seenVideoIds.has(videoId));

    const detailedItems = await fetchVideoDetails(videoIds, apiKey);
    for (const item of detailedItems) {
      const videoId = item.id;
      const snippet = item.snippet;
      if (!videoId || !snippet?.title || !snippet.channelTitle) continue;
      if (seenVideoIds.has(videoId)) continue;

      seenVideoIds.add(videoId);
      const title = snippet.title;
      const description = snippet.description ?? "";
      const rawTags = snippet.tags ?? [];
      const conceptTags = buildConceptTags(query, title, description, rawTags);

      recommendations.push({
        videoId,
        title,
        channelTitle: snippet.channelTitle,
        thumbnailUrl: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        conceptTags,
        reason: `Matched the learning theme "${normalizeQuery(query)}" and shares overlapping technical keywords.`,
      });

      if (recommendations.length >= 6) break;
    }

    if (recommendations.length >= 6) break;
  }

  if (recommendations.length > 0) return recommendations.slice(0, 6);

  return [];
}

async function generateFallbackQueries(queries: string[]): Promise<string[]> {
  if (queries.length > 0) return queries;
  return ["technical tutorial", "beginner project walkthrough", "concept recap"];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { queries?: unknown };
    const queries = Array.isArray(body.queries)
      ? body.queries.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)
      : [];

    const finalQueries = await generateFallbackQueries(queries);
    const recommendations = await buildRecommendations(finalQueries);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("YouTube recommendation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch YouTube recommendations" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "Missing title parameter" }, { status: 400 });
  }

  try {
    const recommendations = await buildRecommendations([title]);
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("YouTube recommendation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch YouTube recommendations" },
      { status: 500 }
    );
  }
}
