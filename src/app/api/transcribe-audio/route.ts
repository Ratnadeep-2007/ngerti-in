import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL ?? "nova-3";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Deepgram is not configured" }, { status: 500 });
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const response = await fetch(
      `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(DEEPGRAM_MODEL)}&punctuate=true&smart_format=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": audio.type || "audio/webm",
        },
        body: audioBuffer,
      }
    );

    const payload = await response.json().catch(async () => ({
      raw: await response.text(),
    }));

    if (!response.ok) {
      console.error("Deepgram transcription failed:", payload);
      return NextResponse.json(
        { error: "Failed to transcribe audio" },
        { status: response.status }
      );
    }

    const transcript =
      payload?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    return NextResponse.json({ transcript, raw: payload });
  } catch (error) {
    console.error("transcribe-audio error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
