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

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(value: string): string[] {
  return normalizeText(value).match(/[a-z0-9_+-]{3,}/g) ?? [];
}

function localSemanticFallback(
  question: TextQuestion | CodeQuestion,
  answer: string
): { correct: boolean; reason: string } {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) {
    return { correct: false, reason: "No answer was provided." };
  }

  if (question.type === "code") {
    // Basic local fallback for code: just ensure it's not empty and maybe contains standard characters
    if (answer.trim().length > 5) {
      return { correct: true, reason: "Code was submitted. (Fallback offline check)" };
    }
    return { correct: false, reason: "Code snippet too short." };
  }

  const expected = question.expectedAnswer ? normalizeText(question.expectedAnswer) : "";
  if (expected) {
    if (
      normalizedAnswer === expected ||
      normalizedAnswer.includes(expected) ||
      expected.includes(normalizedAnswer)
    ) {
      return { correct: true, reason: "Answer matches the expected response." };
    }
  }

  const referenceTokens = new Set<string>([
    ...tokenize(question.question),
    ...tokenize(question.explanation ?? ""),
    ...(question.expectedAnswer ? tokenize(question.expectedAnswer) : []),
    ...(question.acceptedKeywords ?? []).flatMap((keyword) => tokenize(keyword)),
  ]);
  const answerTokens = tokenize(answer);
  const shared = answerTokens.filter((token) => referenceTokens.has(token));
  const score = referenceTokens.size > 0 ? shared.length / referenceTokens.size : 0;

  if (shared.length >= 3 && score >= 0.35) {
    return { correct: true, reason: "Answer shares the core idea of the expected response." };
  }

  return {
    correct: false,
    reason: "The answer does not closely match the expected idea.",
  };
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
- Mark incorrect if they obviously wrote code in a completely different language (e.g. wrote Python when asked for C).
- Mark correct if the code solves the prompt's request, even if it is simple or basic.
- Mark incorrect if the code is completely unrelated nonsense or fails to answer the prompt.`
    : `- Accept paraphrases and semantically equivalent answers.
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
${JSON.stringify({
  question: question.question,
  explanation: question.explanation ?? "",
  expectedAnswer: (question as TextQuestion).expectedAnswer ?? "",
  acceptedKeywords: (question as TextQuestion).acceptedKeywords ?? [],
  type: question.type,
})}

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
    const localResult = localSemanticFallback(body.question, answer);
    const groqResult = await gradeWithGroq(body.question, answer);
    const result =
      groqResult === null
        ? localResult
        : groqResult.correct || localResult.correct
        ? {
            correct: true,
            reason: localResult.correct ? localResult.reason : groqResult.reason,
          }
        : groqResult;

    return NextResponse.json(result);
  } catch (error) {
    console.error("grade-answer error:", error);
    return NextResponse.json(
      { error: "Failed to grade answer" },
      { status: 500 }
    );
  }
}
