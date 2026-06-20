import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { Session } from "@/lib/types";

const GROQ_QUIZ_MODEL = process.env.GROQ_QUIZ_MODEL ?? "llama-3.1-8b-instant";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

export async function POST(req: Request) {
  try {
    const { sessionData } = (await req.json()) as { sessionData: Session };

    if (!sessionData) {
      return NextResponse.json({ error: "No session data provided" }, { status: 400 });
    }

    const { metadata, progress, translatedContent } = sessionData;
    const totalBreakpoints = translatedContent.breakpoints.length;
    const attempts = progress.attemptsPerBreakpoint;
    
    // Simple logic: if attempts > 1, that checkpoint was tricky.
    const trickyTopics = translatedContent.breakpoints
      .filter((bp, idx) => (attempts[idx] || 0) > 1)
      .map(bp => bp.topic)
      .slice(0, 5);

    const client = getClient();
    const prompt = `You are a personalized learning roadmap generator for LingoLearn.
The user just finished studying the video: "${metadata.title}".
Total checkpoints: ${totalBreakpoints}.
They struggled with the following topics: ${trickyTopics.length > 0 ? trickyTopics.join(", ") : "None! They aced everything."}

Generate a concise markdown roadmap of the next 3 steps the student should take. Format as a bulleted list. 
If they struggled with specific topics, recommend reviewing related foundational concepts. 
If they aced it, suggest advanced topics or projects to build using the skills learned.`;

    const response = await client.chat.completions.create({
      model: GROQ_QUIZ_MODEL,
      messages: [
        { role: "system", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 400,
    });

    const nextSteps = response.choices[0]?.message?.content || "Next steps could not be generated.";

    return NextResponse.json({ nextSteps });
  } catch (error) {
    console.error("Generate next steps error:", error);
    return NextResponse.json({ error: "Failed to generate next steps" }, { status: 500 });
  }
}
