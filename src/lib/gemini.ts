import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL_CANDIDATES = [
  "models/gemini-2.5-flash-lite",
  "models/gemini-2.5-flash",
  "models/gemini-2.0-flash",
];

export const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");

export const getGeminiModel = (
  modelName: string = DEFAULT_MODEL_CANDIDATES[0],
  config?: any,
) => {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  const { systemInstruction, ...generationConfig } = config || {};
  return genAI.getGenerativeModel({ 
    model: modelName, 
    systemInstruction,
    generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
  });
};

export const getGeminiModelCandidates = (preferredModel?: string) => {
  const candidates = [preferredModel, ...DEFAULT_MODEL_CANDIDATES].filter(
    (model): model is string => Boolean(model),
  );
  return Array.from(new Set(candidates));
};
