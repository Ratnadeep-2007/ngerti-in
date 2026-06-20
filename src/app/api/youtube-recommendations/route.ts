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

  const data = await response.json() as {
    items?: { id?: { videoId?: string }; snippet?: { title?: string } }[];
  };
  return data.items ?? [];
}

async function fetchVideoDetails(videoIds: string[], apiKey: string) {
  if (videoIds.length === 0) return [];

  const url = new URL(YOUTUBE_VIDEOS_URL);
  url.searchParams.set("part", "snippet,contentDetails,statistics");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`YouTube video details failed: ${response.statusText}`);
  }

  const data = await response.json() as { items?: any[] };
  return data.items ?? [];
}

async function buildRecommendations(queries: string[]): Promise<YouTubeRecommendation[]> {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) throw new Error("YOUTUBE_DATA_API_KEY is not configured.");

  const results: YouTubeRecommendation[] = [];
  const seenVideoIds = new Set<string>();

  for (const query of queries) {
    if (results.length >= 4) break;

    const searchItems = await fetchSearchResults(query, apiKey);
    const videoIds = searchItems
      .map((item) => item.id?.videoId)
      .filter((videoId): videoId is string => typeof videoId === "string" && videoId.length > 0)
      .filter((videoId) => !seenVideoIds.has(videoId));

    const detailedItems = await fetchVideoDetails(videoIds, apiKey);
    for (const item of detailedItems) {
      if (results.length >= 4) break;

      const videoId: string = item.id;
      if (!videoId || seenVideoIds.has(videoId)) continue;

      seenVideoIds.add(videoId);
      const snippet = item.snippet ?? {};
      const tags: string[] = snippet.tags ?? [];
      const title: string = snippet.title ?? "Untitled";
      const description: string = snippet.description ?? "";

      const thumbnailUrl: string =
        snippet.thumbnails?.medium?.url ??
        snippet.thumbnails?.default?.url ??
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

      results.push({
        videoId,
        title,
        channelTitle: snippet.channelTitle ?? "Unknown Channel",
        thumbnailUrl,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        conceptTags: buildConceptTags(query, title, description, tags),
        reason: `Recommended because it covers related concepts from your session: ${query}`,
      });
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title");
    const description = searchParams.get("description");
    const tagsParam = searchParams.get("tags");

    if (!title) {
      return NextResponse.json({ error: "Missing title parameter" }, { status: 400 });
    }

    const primaryQuery = normalizeQuery(title);
    const queries: string[] = [primaryQuery];

    if (description) {
      const descKeywords = extractKeywords(description, 4).join(" ");
      if (descKeywords) queries.push(`${primaryQuery} ${descKeywords}`.trim());
    }

    if (tagsParam) {
      const tags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) queries.push(tags.slice(0, 3).join(" "));
    }

    const recommendations = await buildRecommendations(queries);
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("YouTube recommendation error:", error);
    return NextResponse.json(
      { error: "Failed to fetch YouTube recommendations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { queries } = await req.json();
    if (!queries || !Array.isArray(queries)) {
      return NextResponse.json({ error: "Missing or invalid queries parameter" }, { status: 400 });
    }
    const recommendations = await buildRecommendations(queries);
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("YouTube recommendation POST error:", error);
    return NextResponse.json(
      { error: "Failed to fetch YouTube recommendations" },
      { status: 500 }
    );
  }
}

