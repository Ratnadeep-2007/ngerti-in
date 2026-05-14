import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export interface YouTubeVideo {
  title: string;
  url: string;
  thumbnail: string;
}

/**
 * Uses AI to generate a search query and find relevant YouTube videos.
 */
export async function suggestYouTubeVideos(context: string): Promise<YouTubeVideo[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an educational assistant. Given a context from a study session, suggest exactly 3 relevant educational YouTube videos. Respond in valid JSON array of objects: [{title, url, thumbnail}]. Use realistic YouTube URLs (e.g. https://www.youtube.com/watch?v=...) and high-quality educational thumbnails if known, otherwise use a placeholder. Focus on top creators like Khan Academy, Crash Course, etc."
        },
        {
          role: "user",
          content: `Context: ${context}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content || "{\"videos\": []}";
    const data = JSON.parse(content);
    return data.videos || data;
  } catch (error) {
    console.error("YouTube Suggestion Error:", error);
    return [];
  }
}
