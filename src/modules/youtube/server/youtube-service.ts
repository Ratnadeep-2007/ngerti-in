import ytSearch from "yt-search";

export async function searchEducationalVideos(query: string) {
  try {
    const results = await ytSearch(query);
    // Return top 3 videos
    return results.videos.slice(0, 3).map((v) => ({
      title: v.title,
      url: v.url,
      thumbnail: v.thumbnail,
      duration: v.timestamp,
      author: v.author.name,
    }));
  } catch (error) {
    console.error("YouTube search error:", error);
    return [];
  }
}
