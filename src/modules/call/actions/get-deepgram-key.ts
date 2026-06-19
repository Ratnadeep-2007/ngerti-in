"use server";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

export async function getDeepgramKey() {
  let key = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY;

  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
      if (parsed.NEXT_PUBLIC_DEEPGRAM_API_KEY || parsed.DEEPGRAM_API_KEY) {
        key = parsed.NEXT_PUBLIC_DEEPGRAM_API_KEY || parsed.DEEPGRAM_API_KEY;
      }
    }
  } catch (e) {}

  if (!key) {
    throw new Error("Missing DEEPGRAM_API_KEY or NEXT_PUBLIC_DEEPGRAM_API_KEY");
  }
  return key;
}
