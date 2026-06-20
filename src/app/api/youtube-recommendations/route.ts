import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title");
    
    if (!title) {
      return NextResponse.json({ error: "Missing title parameter" }, { status: 400 });
    }

    const YOUTUBE_DATA_API_KEY = "AIzaSyCihdhOvX1zDZdjhfF-sbHxe3qu9NVQqmk";
    
    // Extract a concise query from the title to get better results
    const query = encodeURIComponent(title.split("|")[0].slice(0, 50));
    
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=4&q=${query}&type=video&key=${YOUTUBE_DATA_API_KEY}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`YouTube API error: ${res.statusText}`);
    }
    
    const data = await res.json();
    const recommendations = data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
    }));

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("YouTube recommendation error:", error);
    return NextResponse.json({ error: "Failed to fetch YouTube recommendations" }, { status: 500 });
  }
}
