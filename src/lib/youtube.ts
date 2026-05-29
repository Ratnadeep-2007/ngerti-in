import { getGeminiModel } from "@/lib/gemini";

export interface YouTubeVideo {
  title: string;
  url: string;
  thumbnail: string;
}

/**
 * Uses AI to generate a search query and find relevant YouTube videos.
 */
export async function suggestYouTubeVideos(
  context: string,
): Promise<YouTubeVideo[]> {
  try {
    const model = getGeminiModel("models/gemini-3.5-flash");
    const prompt = `
      You are an educational assistant. Given a context from a study session, suggest exactly 3 relevant educational YouTube videos. 
      Respond in valid JSON array of objects: {"videos": [{"title": "...", "url": "...", "thumbnail": "..."}]}. 
      Use realistic YouTube URLs (e.g. https://www.youtube.com/watch?v=...) and high-quality educational thumbnails if known, otherwise use a placeholder. 
      Focus on top creators like Khan Academy, Crash Course, etc.
      
      Context: ${context}
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const response = result.response;
    const content = response.text() || "{\"videos\": []}";
    const data = JSON.parse(content);
    return data.videos || data;
  } catch (error) {
    console.error("YouTube Suggestion Error:", error);
    return [];
  }
}
