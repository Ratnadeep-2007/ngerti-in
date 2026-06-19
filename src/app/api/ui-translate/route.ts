import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const GEMINI_UI_TRANSLATE_MODEL = process.env.GEMINI_UI_TRANSLATE_MODEL ?? "gemini-2.5-flash";

async function translateWithGemini(
  strings: Record<string, string>,
  targetLocale: string
): Promise<Record<string, string> | null> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const prompt = `Translate the following JSON object values to the language with locale code "${targetLocale}".
Return ONLY a valid JSON object matching the input structure, with values translated.
Do not wrap the output in markdown code blocks.

Input JSON:
${JSON.stringify(strings, null, 2)}`;

  try {
    const response = await client.models.generateContent({
      model: GEMINI_UI_TRANSLATE_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    const content = response.text;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return parsed as Record<string, string>;
  } catch (error) {
    console.error("Gemini UI translation failed:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strings, targetLocale } = body as {
      strings?: Record<string, string>;
      targetLocale?: string;
    };

    if (!strings || !targetLocale || Object.keys(strings).length === 0) {
      return NextResponse.json(
        { error: "strings and targetLocale are required" },
        { status: 400 }
      );
    }

    // Try Gemini
    const geminiResult = await translateWithGemini(strings, targetLocale);
    if (geminiResult) {
      return NextResponse.json({ translations: geminiResult, source: "gemini" });
    }

    return NextResponse.json(
      { error: "Failed to translate strings" },
      { status: 500 }
    );
  } catch (error) {
    console.error("ui-translate API error:", error);
    return NextResponse.json(
      { error: "Failed to translate UI strings" },
      { status: 500 }
    );
  }
}
