import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { TextQuestion, CodeQuestion } from "@/lib/types";

const GROQ_GRADE_MODEL = process.env.GROQ_GRADE_MODEL ?? "llama-3.1-70b-versatile";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

function isOpenEndedQuestion(
  question: unknown
): question is TextQuestion {
  return (
    typeof question === "object" &&
    question !== null &&
    ("type" in question && ((question as { type?: string }).type === "text" || (question as { type?: string }).type === "code"))
  );
}



async function gradeWithGroq(
  question: TextQuestion | CodeQuestion,
  answer: string
): Promise<{ correct: boolean; reason: string } | null> {
  const client = getClient();
  
  const isCode = question.type === "code";
  const systemRolePrompt = isCode
    ? "You are an expert software engineer and code reviewer evaluating a student's code snippet."
    : "You are a strict but fair semantic grader for an educational platform.";
    
  const rules = isCode
    ? `- Evaluate if the code syntactically resembles the expected language.
- Be very lenient. This is a beginner educational platform.
- Mark correct if the code solves the core logic of the prompt's request, even if it lacks print statements, imports, or a main function wrapper.
- Mark incorrect if they obviously wrote code in a completely different language (e.g. wrote Python when asked for C).
- Mark incorrect if the code is completely unrelated nonsense or fails to answer the prompt.`
    : `- Accept paraphrases and semantically equivalent answers.
- Compare the learner's answer against the 'Correct Concept / Explanation' or 'Expected Answer'.
- If the 'Expected Answer' is omitted or vague, use your own expert world knowledge to determine if the learner's answer factually and correctly answers the Question.
- The learner's answer may be a specific technical term, command, or code snippet that correctly satisfies the definition in the Concept/Explanation.
- Do not require exact wording.
- Mark correct if the answer demonstrates the same concept, even if phrased differently.
- Mark incorrect if it is unrelated, contradicts the lesson, or is too vague.
- Mark incorrect if the user intentionally gives a wrong or nonsense answer.`;

  const prompt = `${systemRolePrompt}
Return ONLY valid JSON with:
{
  "correct": boolean,
  "reason": string
}

Rules:
${rules}
- Explain your reasoning briefly.

Question Context:
Question: ${question.question}
Correct Concept / Explanation: ${question.explanation ?? "N/A"}
${(question as TextQuestion).expectedAnswer ? `Expected Answer: ${(question as TextQuestion).expectedAnswer}` : ""}
${(question as TextQuestion).acceptedKeywords?.length ? `Accepted Keywords: ${(question as TextQuestion).acceptedKeywords?.join(", ")}` : ""}

Learner answer:
${answer}`;

  try {
    const response = await client.chat.completions.create({
      model: GROQ_GRADE_MODEL,
      messages: [
        { role: "system", content: "You are an automated grading assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 256,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { correct?: unknown; reason?: unknown };
    if (typeof parsed.correct !== "boolean") return null;
    return {
      correct: parsed.correct,
      reason: typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : parsed.correct
        ? "Answer accepted."
        : "Answer rejected.",
    };
  } catch (error) {
    console.error("Groq grading failed:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: unknown;
      answer?: unknown;
    };

    if (!isOpenEndedQuestion(body.question) || typeof body.answer !== "string") {
      return NextResponse.json(
        { error: "question and answer are required" },
        { status: 400 }
      );
    }

    const answer = body.answer.trim();
    const groqResult = await gradeWithGroq(body.question, answer);
    const result = groqResult !== null ? groqResult : { correct: false, reason: "Grading system offline. Please try again." };

    return NextResponse.json(result);
  } catch (error) {
    console.error("grade-answer error:", error);
    return NextResponse.json(
      { error: "Failed to grade answer" },
      { status: 500 }
    );
  }
}
