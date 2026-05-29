import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");

export const getGeminiModel = (
  modelName: string = "models/gemini-3.5-flash",
  config?: any,
) => {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  return genAI.getGenerativeModel({ model: modelName, generationConfig: config });
};
