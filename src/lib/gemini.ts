import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");

export const getGeminiModel = (
  modelName: string = "models/gemini-2.5-flash",
  config?: any,
) => {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  const finalModel = modelName === "models/gemini-3.5-flash"
    ? "models/gemini-2.5-flash"
    : modelName;
  const { systemInstruction, ...generationConfig } = config || {};
  return genAI.getGenerativeModel({ 
    model: finalModel, 
    systemInstruction,
    generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
  });
};
