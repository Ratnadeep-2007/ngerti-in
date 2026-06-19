import Groq from "groq-sdk";
import {
  Breakpoint,
  CodeQuestion,
  MCQQuestion,
  QuizQuestion,
  TextQuestion,
  TranscriptSegment,
  VoiceQuestion,
} from "./types";

const GROQ_QUIZ_MODEL = process.env.GROQ_QUIZ_MODEL ?? "llama-3.1-8b-instant";
const STOPWORDS = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "from",
  "have",
  "will",
  "your",
  "about",
  "into",
  "what",
  "when",
  "where",
  "which",
  "their",
  "there",
  "then",
  "them",
  "they",
  "were",
  "been",
  "being",
  "also",
  "just",
  "like",
  "over",
  "into",
  "than",
  "for",
  "your",
  "you",
  "are",
  "was",
  "has",
  "had",
  "can",
  "could",
  "would",
  "should",
  "does",
  "did",
  "doing",
  "done",
  "main",
  "difference",
  "between",
  "python",
]);

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getTranscriptDuration(transcript: TranscriptSegment[]): number {
  return transcript.reduce((max, segment) => Math.max(max, segment.end), 0);
}

function buildBreakpointSchedule(
  transcript: TranscriptSegment[],
  maxBreakpoints: number,
  startTime = 0,
  endTime = getTranscriptDuration(transcript)
): number[] {
  if (maxBreakpoints <= 0 || endTime <= startTime) return [];

  const usableCount = Math.max(1, Math.min(maxBreakpoints, Math.floor(maxBreakpoints)));
  const span = endTime - startTime;
  const spacing = span / (usableCount + 1);

  return Array.from({ length: usableCount }, (_, index) => {
    const timestamp = startTime + spacing * (index + 1);
    return Math.min(endTime - 1, Math.max(startTime + 1, Math.round(timestamp)));
  }).filter((timestamp, index, all) => all.indexOf(timestamp) === index);
}

function sliceTranscriptThrough(
  transcript: TranscriptSegment[],
  timestamp: number
): TranscriptSegment[] {
  return transcript.filter((segment) => segment.end <= timestamp);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry : String(entry ?? "")))
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean);
}

function clampIndex(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(3, Math.max(0, Math.floor(numeric)));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z0-9_+-]{3,}/g)
    ?.filter((token) => !STOPWORDS.has(token)) ?? [];
}

function extractKeywords(transcript: TranscriptSegment[], limit = 10): string[] {
  const counts = new Map<string, number>();

  for (const segment of transcript) {
    for (const token of tokenize(segment.text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([token]) => token)
    .slice(0, limit);
}

function hasProgrammingSignals(transcript: TranscriptSegment[]): boolean {
  const text = transcript.map((segment) => segment.text).join(" ").toLowerCase();
  return /(\bcode\b|\bfunction\b|\bclass\b|\bconst\b|\blet\b|\bvar\b|\breturn\b|\bloop\b|\barray\b|\bobject\b|\basync\b|\bawait\b|\bapi\b|\balgorithm\b|\bpython\b|\bjavascript\b|\btypescript\b|\breact\b|\bnext\.js\b)/i.test(text);
}

function buildFallbackQuestionSet(
  transcript: TranscriptSegment[],
  timestamp: number,
  questionCount: number
): QuizQuestion[] {
  const keywords = extractKeywords(transcript, 8);
  const topic = keywords[0] ?? "the lesson";
  const secondTopic = keywords[1] ?? topic;
  const thirdTopic = keywords[2] ?? secondTopic;
  const isProgrammingLesson = hasProgrammingSignals(transcript);
  const baseCount = Math.max(1, Math.floor(questionCount));
  const questions: QuizQuestion[] = [];

  questions.push({
    type: "mcq",
    question: `Which topic has been covered by ${formatTime(timestamp)}?`,
    explanation: `This question is grounded only in the transcript up to ${formatTime(timestamp)}.`,
    options: [
      topic,
      secondTopic === topic ? `${topic} basics` : secondTopic,
      thirdTopic === topic ? `${topic} details` : thirdTopic,
      "None of the above",
    ],
    correct: 0,
  });

  if (baseCount >= 2) {
    questions.push({
      type: "text",
      question: `In your own words, summarize what the lesson has established about ${topic} so far.`,
      explanation: "Short answer practice keeps the prompt tied to the visible transcript window.",
      expectedAnswer: topic,
      acceptedKeywords: keywords.slice(0, Math.min(4, keywords.length)),
      placeholder: "Type 1-2 sentences",
    });
  }

  if (baseCount >= 3 && isProgrammingLesson) {
    questions.push({
      type: "code",
      question: `Write a small example that uses ${topic} in the language shown in the lesson.`,
      explanation: "This scaffold is only used when the transcript clearly includes coding content.",
      language: "javascript",
      initialCode: "// Write a minimal example here\n",
      expectedOutput: undefined,
      solution: undefined,
    });
  } else if (baseCount >= 3) {
    questions.push({
      type: "voice",
      question: `Explain aloud how ${topic} fits into the lesson so far.`,
      explanation: "Voice questions are scaffolded for now and stay theory-focused.",
      expectedAnswer: topic,
      note: "Mock voice response",
    });
  }

  while (questions.length < baseCount) {
    questions.push({
      type: "text",
      question: `What is one important idea the lesson has introduced about ${secondTopic}?`,
      explanation: "The fallback keeps later questions grounded in the visible transcript.",
      expectedAnswer: secondTopic,
      acceptedKeywords: [secondTopic, topic].filter((value, index, array) => array.indexOf(value) === index),
      placeholder: "Write a short answer",
    });
  }

  return questions.slice(0, baseCount);
}

function questionLooksGrounded(question: QuizQuestion, transcriptWindow: TranscriptSegment[]): boolean {
  const keywords = extractKeywords(transcriptWindow, 12);
  if (keywords.length === 0) return true;

  const haystack = [
    question.question,
    question.explanation ?? "",
    question.type === "mcq" ? question.options.join(" ") : "",
    question.type === "code" ? question.initialCode : "",
    question.type === "text" ? question.expectedAnswer ?? "" : "",
    question.type === "voice" ? question.expectedAnswer ?? "" : "",
  ]
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword));
}

function questionLooksValid(question: QuizQuestion, transcriptWindow: TranscriptSegment[]): boolean {
  if (!question.question || question.question.length < 8) return false;

  if (question.type === "mcq") {
    return (
      question.options.length === 4 &&
      question.options.every((option) => option.trim().length > 0) &&
      question.correct >= 0 &&
      question.correct < 4 &&
      questionLooksGrounded(question, transcriptWindow)
    );
  }

  if (question.type === "text") {
    return true;
  }

  if (question.type === "code") {
    return question.language.trim().length > 0 && question.initialCode.trim().length > 0;
  }

  return true;
}

function normalizeQuestion(raw: unknown): QuizQuestion | null {
  if (!isRecord(raw)) return null;
  const question = typeof raw.question === "string" ? normalizeWhitespace(raw.question) : "";
  if (!question) return null;
  const explanation = typeof raw.explanation === "string" ? normalizeWhitespace(raw.explanation) : "";
  const type = raw.type;

  if (type === "text") {
    const normalized: TextQuestion = {
      type: "text",
      question,
      explanation,
      expectedAnswer: typeof raw.expectedAnswer === "string" ? raw.expectedAnswer : undefined,
      acceptedKeywords: toStringArray(raw.acceptedKeywords),
      placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
    };
    return normalized;
  }

  if (type === "code") {
    const normalized: CodeQuestion = {
      type: "code",
      question,
      explanation,
      language: typeof raw.language === "string" && raw.language.trim() ? normalizeWhitespace(raw.language) : "javascript",
      initialCode: typeof raw.initialCode === "string" ? raw.initialCode : "",
      solution: typeof raw.solution === "string" ? normalizeWhitespace(raw.solution) : undefined,
      expectedOutput: typeof raw.expectedOutput === "string" ? normalizeWhitespace(raw.expectedOutput) : undefined,
    };
    return normalized;
  }

  if (type === "voice") {
    const normalized: VoiceQuestion = {
      type: "voice",
      question,
      explanation,
      expectedAnswer: typeof raw.expectedAnswer === "string" ? normalizeWhitespace(raw.expectedAnswer) : undefined,
      note: typeof raw.note === "string" ? normalizeWhitespace(raw.note) : undefined,
    };
    return normalized;
  }

  const options = toStringArray(raw.options);
  const normalized: MCQQuestion = {
    type: "mcq",
    question,
    explanation,
    options: [
      options[0] ?? "",
      options[1] ?? "",
      options[2] ?? "",
      options[3] ?? "",
    ],
    correct: clampIndex(raw.correct),
  };
  return normalized;
}

function normalizeBreakpoint(
  raw: unknown,
  fallbackTimestamp: number,
  transcriptWindow: TranscriptSegment[],
  questionCount: number
): Breakpoint | null {
  if (!isRecord(raw)) {
    const fallbackQuestions = buildFallbackQuestionSet(transcriptWindow, fallbackTimestamp, questionCount);
    return {
      timestamp: fallbackTimestamp,
      topic: "Learning checkpoint",
      questions: fallbackQuestions,
      primaryQuestions: fallbackQuestions.filter((q): q is MCQQuestion => q.type === "mcq"),
      retryQuestions: fallbackQuestions.filter((q): q is MCQQuestion => q.type === "mcq"),
    };
  }
  const timestamp = typeof raw.timestamp === "number" ? raw.timestamp : fallbackTimestamp;
  const topic = typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : "Learning checkpoint";

  const mixedQuestionsSource =
    Array.isArray(raw.questions) && raw.questions.length > 0
      ? raw.questions
      : [...(Array.isArray(raw.primaryQuestions) ? raw.primaryQuestions : []), ...(Array.isArray(raw.retryQuestions) ? raw.retryQuestions : [])];

  const questions = mixedQuestionsSource
    .map(normalizeQuestion)
    .filter((q): q is QuizQuestion => Boolean(q))
    .filter((q) => questionLooksValid(q, transcriptWindow));

  const fallbackQuestions = buildFallbackQuestionSet(transcriptWindow, timestamp, questionCount);
  const finalQuestions = questions.length > 0 ? questions : fallbackQuestions;
  const mergedQuestions = finalQuestions.slice(0, Math.max(1, questionCount));
  const primaryQuestions = mergedQuestions.filter((q): q is MCQQuestion => q.type === "mcq");
  const retryQuestions = primaryQuestions.length > 0 ? [...primaryQuestions] : [];

  return {
    timestamp,
    topic,
    questions: mergedQuestions,
    primaryQuestions,
    retryQuestions,
  };
}

function buildSystemPrompt(timestamp: number, questionCount: number): string {
  return `You are an expert educational content analyzer for LingoLearn.

You will receive a transcript window that ONLY includes content from 00:00 up to ${formatTime(timestamp)}.
Do not use concepts, terminology, examples, or answers that are introduced after that point.

Task:
- Create exactly one breakpoint for this window.
- Generate exactly ${questionCount} questions in a mixed set.
- Always include at least one mcq question.
- Prefer a second text question when the lesson is conceptual or explanatory.
- Use code questions only when the transcript is clearly about programming, algorithms, debugging, or code examples.
- Use voice questions only as a scaffold for verbal / spoken-response practice; keep them simple and theory-based.
- Keep the questions grounded in the transcript window and avoid future knowledge.
- Use exact transcript facts or clearly implied ideas from the window.
- Do not invent options that are empty, vague, duplicated, or unrelated.
- Do not ask filler recap questions like "what was the topic"; ask about meaning, cause, effect, comparison, or application.
- Keep the questions concise, learner-friendly, and clearly phrased.
- If a code question is not strongly supported by the transcript, choose text instead.

Question schema:
{
  "type": "mcq" | "text" | "code" | "voice",
  "question": string,
  "explanation": string,
  "options": string[4],            // mcq only
  "correct": number,               // mcq only, 0-3
  "expectedAnswer": string,        // text and voice only, optional
  "acceptedKeywords": string[],    // text only, optional
  "placeholder": string,           // text only, optional
  "language": string,             // code only
  "initialCode": string,          // code only
  "solution": string,             // code only, optional
  "expectedOutput": string        // code only, optional
}

Return ONLY valid JSON with this shape:
{
  "breakpoints": [
    {
      "timestamp": ${timestamp},
      "topic": "short topic title",
      "questions": [ ... ]
    }
  ]
}`;
}

function extractBreakpoint(
  rawContent: string,
  timestamp: number,
  questionCount: number,
  transcriptWindow: TranscriptSegment[]
): Breakpoint | null {
  try {
    const parsed = JSON.parse(rawContent) as { breakpoints?: unknown[] };
    const first = Array.isArray(parsed.breakpoints) ? parsed.breakpoints[0] : null;
    return normalizeBreakpoint(first, timestamp, transcriptWindow, questionCount);
  } catch {
    console.error("Failed to parse Groq response:", rawContent);
    return normalizeBreakpoint(null, timestamp, transcriptWindow, questionCount);
  }
}

async function callGroq(
  client: Groq,
  transcriptWindow: TranscriptSegment[],
  timestamp: number,
  questionCount: number
): Promise<Breakpoint | null> {
  const chunkText = transcriptWindow
    .map((segment) => `[${formatTime(segment.start)}] ${segment.text}`)
    .join("\n");

  const response = await client.chat.completions.create({
    model: GROQ_QUIZ_MODEL,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(timestamp, questionCount),
      },
      {
        role: "user",
        content: `Transcript window:\n${chunkText}`,
      },
    ],
    temperature: 0.6,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return extractBreakpoint(content, timestamp, questionCount, transcriptWindow);
}

function is429(err: unknown): boolean {
  if (err && typeof err === "object") {
    const status = (err as Record<string, unknown>).status;
    return status === 429;
  }
  return false;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateBreakpointWithRetry(
  client: Groq,
  transcript: TranscriptSegment[],
  timestamp: number,
  questionCount: number
): Promise<Breakpoint | null> {
  const windowTranscript = sliceTranscriptThrough(transcript, timestamp);
  if (windowTranscript.length === 0) return null;

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      return await callGroq(client, windowTranscript, timestamp, questionCount);
    } catch (err) {
      if (is429(err) && attempt < 3) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`Rate limit hit, retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/3)`);
        await delay(backoffMs);
        continue;
      }
      if (!is429(err)) {
        console.error("Non-rate-limit error in breakpoint generation, skipping:", err);
        return null;
      }
      throw err;
    }
  }

  return null;
}

export async function generateQuizzes(
  transcript: TranscriptSegment[],
  maxBreakpoints: number,
  questionsPerBreakpoint: number
): Promise<Breakpoint[]> {
  const duration = getTranscriptDuration(transcript);
  return generateQuizzesForRange(transcript, 0, duration, maxBreakpoints, questionsPerBreakpoint);
}

export async function generateQuizzesForRange(
  transcript: TranscriptSegment[],
  startSec: number,
  endSec: number,
  maxBreakpoints: number,
  questionsPerBreakpoint: number
): Promise<Breakpoint[]> {
  const client = getClient();
  const schedule = buildBreakpointSchedule(transcript, maxBreakpoints, startSec, endSec);

  const results: Breakpoint[] = [];
  for (const timestamp of schedule) {
    const breakpoint = await generateBreakpointWithRetry(client, transcript, timestamp, questionsPerBreakpoint);
    if (breakpoint) {
      results.push(breakpoint);
    }
  }

  return results.sort((a, b) => a.timestamp - b.timestamp);
}
