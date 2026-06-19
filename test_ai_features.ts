import "dotenv/config";
import { getGeminiModel } from "@/lib/gemini";
import { suggestYouTubeVideos } from "@/lib/youtube";

async function testYouTubeSuggestions() {
  console.log("--- Testing suggestYouTubeVideos ---");
  try {
    const videos = await suggestYouTubeVideos("Basic algebra and solving linear equations");
    console.log("SUCCESS! Suggested videos:", JSON.stringify(videos, null, 2));
  } catch (err: any) {
    console.error("FAILED YouTube suggestions:", err.message || err);
  }
}

async function testGeneralGeneration() {
  console.log("--- Testing general text generation ---");
  try {
    const model = getGeminiModel("models/gemini-3.5-flash", {
      systemInstruction: "You are a helpful science tutor.",
    });
    const result = await model.generateContent("Explain photosynthesis in one sentence.");
    console.log("SUCCESS! Science explanation:", result.response.text().trim());
  } catch (err: any) {
    console.error("FAILED general generation:", err.message || err);
  }
}

async function run() {
  await testGeneralGeneration();
  await testYouTubeSuggestions();
}

run();
