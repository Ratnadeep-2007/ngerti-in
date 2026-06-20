import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { TextQuestion, CodeQuestion, TranscriptSegment } from "@/lib/types";

const GROQ_GRADE_MODEL =
  process.env.GROQ_GRADE_MODEL ??
  process.env.GROQ_QUIZ_MODEL ??
  "llama-3.1-8b-instant";

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

function formatTranscriptContext(transcriptContext: TranscriptSegment[]): string {
  return transcriptContext
    .map((segment) => `[${segment.start}-${segment.end}] ${segment.text}`)
    .join("\n");
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
  answer: string,
  transcriptContext: TranscriptSegment[] = [],
  isFinalQuiz = false
): Promise<{ correct: boolean; reason: string } | null> {
  const client = getClient();
  
  const isCode = question.type === "code";
  const systemRolePrompt = isCode
    ? "You are an expert software engineer and code reviewer evaluating a student's code snippet."
    : "You are a careful semantic grader for an educational platform.";
    
  const finalQuizRules = isFinalQuiz
    ? `Final quiz grading mode:
- This is a mastery check, not an exact-answer test.
- Be generous when the learner demonstrates the required concept.
- Do not punish a learner for choosing a different valid variable name, string value, example value, or formatting style.
- Mark correct when the answer is a valid instance of the concept, even if it differs from the reference answer.
- For code answers, accept near-correct beginner code when the intended operations are clear and only minor formatting or line-break issues remain.`
    : "";

  const rules = isCode
    ? `- Evaluate if the code syntactically resembles the expected language.
- Be very lenient. This is a beginner educational platform.
- Mark correct if the code solves the core logic of the prompt's request, even if it lacks print statements, imports, or a main function wrapper.
- Mark incorrect if they obviously wrote code in a completely different language (e.g. wrote Python when asked for C).
- Mark incorrect if the code is completely unrelated nonsense or fails to answer the prompt.`
    : `- Accept paraphrases and semantically equivalent answers.
- Compare the learner's answer against the 'Correct Concept / Explanation' and the transcript context, not just exact wording.
- If the 'Expected Answer' is omitted or vague, use your own expert judgment to determine if the learner's answer is factually correct.
- The learner's answer may be shorter than the expected answer and still be correct if it preserves the same meaning.
- Mark correct if the answer demonstrates the same concept, even if phrased differently or partially abbreviated.
- Mark incorrect if it is unrelated, contradicts the lesson, or is too vague.
- Mark incorrect if the user intentionally gives a wrong or nonsense answer.`;

  const prompt = `${systemRolePrompt}
Return ONLY valid JSON with:
{
  "correct": boolean,
  "reason": string
}

Rules:
${finalQuizRules}
${rules}
- Explain your reasoning briefly.

General grading examples:
- If the question asks for a valid syntax pattern, any valid concrete example of that pattern is correct.
- If the reference answer uses one variable name or value, another valid variable name or value can still be correct.
- If the learner uses a comparison operator where assignment is required, or calls a function without doing the requested operation, that is incorrect.
- If code contains a minor line-break or formatting issue but clearly demonstrates the requested beginner concept, final quiz mode may mark it correct.

Question Context:
Question: ${question.question}
Correct Concept / Explanation: ${question.explanation ?? "N/A"}
${question.type === "text" && question.expectedAnswer ? `Expected Answer (reference only; not exact wording required): ${question.expectedAnswer}` : ""}
${question.type === "text" && question.acceptedKeywords?.length ? `Accepted Keywords: ${question.acceptedKeywords.join(", ")}` : ""}
${transcriptContext.length ? `Transcript Context:\n${formatTranscriptContext(transcriptContext)}` : ""}

Learner answer:
${answer}`;

  async function requestJsonGrade(useResponseFormat: boolean): Promise<{ correct: boolean; reason: string } | null> {
    const response = await client.chat.completions.create({
      model: GROQ_GRADE_MODEL,
      messages: [
        { role: "system", content: "You are an automated grading assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 256,
      ...(useResponseFormat ? { response_format: { type: "json_object" as const } } : {}),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const candidates = [content];
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) candidates.unshift(fenced[1]);

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as { correct?: unknown; reason?: unknown };
        if (typeof parsed.correct !== "boolean") continue;
        return {
          correct: parsed.correct,
          reason:
            typeof parsed.reason === "string" && parsed.reason.trim()
              ? parsed.reason.trim()
              : parsed.correct
              ? "Answer accepted."
              : "Answer rejected.",
        };
      } catch {
        continue;
      }
    }

    const normalized = content.toLowerCase();
    if (normalized.includes("correct")) {
      return { correct: true, reason: content.trim() };
    }
    if (normalized.includes("incorrect") || normalized.includes("wrong")) {
      return { correct: false, reason: content.trim() };
    }

    return null;
  }

  try {
    return await requestJsonGrade(true) ?? await requestJsonGrade(false);
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
      transcriptContext?: unknown;
      isFinalQuiz?: unknown;
    };

    if (!isOpenEndedQuestion(body.question) || typeof body.answer !== "string") {
      return NextResponse.json(
        { error: "question and answer are required" },
        { status: 400 }
      );
    }

    const answer = body.answer.trim();
    const transcriptContext = Array.isArray(body.transcriptContext)
      ? body.transcriptContext.filter(
          (segment): segment is TranscriptSegment =>
            typeof segment === "object" &&
            segment !== null &&
            typeof (segment as TranscriptSegment).start === "number" &&
            typeof (segment as TranscriptSegment).end === "number" &&
            typeof (segment as TranscriptSegment).text === "string"
        )
      : [];

    const groqResult = await gradeWithGroq(
      body.question,
      answer,
      transcriptContext,
      body.isFinalQuiz === true
    );
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
