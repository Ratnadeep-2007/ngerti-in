import Groq from "groq-sdk";
import {
  Breakpoint,
  CodeQuestion,
  MCQQuestion,
  QuizDifficulty,
  QuizQuestion,
  TextQuestion,
  TranscriptSegment,
} from "./types";
import { buildSmartPauseSchedule } from "./smart-pauses";

const GROQ_QUIZ_MODEL = process.env.GROQ_QUIZ_MODEL ?? "llama-3.1-8b-instant";
const STOPWORDS = new Set([
  "the", "and", "that", "this", "with", "from", "have", "will", "your", "about",
  "into", "what", "when", "where", "which", "their", "there", "then", "them", "they",
  "were", "been", "being", "also", "just", "like", "over", "into", "than", "for",
  "your", "you", "are", "was", "has", "had", "can", "could", "would", "should",
  "does", "did", "doing", "done", "main", "difference", "between", "python",
  "going", "know", "want", "think", "make", "good", "time", "much", "very", "really",
  "things", "thing", "because", "we're", "you're", "they're", "it's", "that's", "i'm",
  "get", "got", "take", "give", "look", "see", "say", "said", "way", "well", "now",
  "right", "people", "use", "using", "used", "need", "like", "let", "let's", "come",
  "some", "how", "why", "who", "whom", "whose", "here", "out", "our", "ours", "put",
  "those", "these", "not", "but", "all", "any", "one", "two", "three", "first", "new"
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



function hasDuplicateOrGenericOptions(options: string[]): boolean {
  const normalized = options.map((option) => normalizeWhitespace(option).toLowerCase());
  if (normalized.some((option) => !option)) return true;

  const unique = new Set(normalized);
  if (unique.size !== normalized.length) return true;

  const genericOptionPatterns = [
    /^option\s*[a-d]$/i,
    /^answer\s+unavailable$/i,
    /^option\s+unavailable$/i,
    /^none of the above$/i,
    /^all of the above$/i,
  ];

  return normalized.some((option) => genericOptionPatterns.some((pattern) => pattern.test(option)));
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
  ]
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword));
}

function questionLooksValid(question: QuizQuestion, transcriptWindow: TranscriptSegment[]): boolean {
  if (!question.question || question.question.length < 8) return false;

  const genericPatterns = [
    /main goal/i,
    /designed this course/i,
    /ideal for kids/i,
    /who has designed/i,
    /what is the course about/i,
    /what is the video about/i,
    /what is the purpose of adding an underscore/i,
  ];
  if (genericPatterns.some((pattern) => pattern.test(question.question))) return false;

  if (question.type === "mcq") {
    return (
      question.options.length === 4 &&
      question.options.every((option) => option.trim().length > 0) &&
      !hasDuplicateOrGenericOptions(question.options) &&
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
  timestamp: number,
  transcriptWindow: TranscriptSegment[],
  questionCount: number,
  difficulty: QuizDifficulty
): Breakpoint {
  if (!isRecord(raw)) {
    return {
      timestamp,
      topic: "Upcoming Checkpoint",
      questions: [],
      primaryQuestions: [],
      retryQuestions: [],
    };
  }

  const topic = typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : "Learning Checkpoint";
  const checkpointMode = raw.checkpointMode === "reverse" || raw.checkpointMode === "sandbox" ? raw.checkpointMode : undefined;

  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  
  const questions = rawQuestions
    .map(normalizeQuestion)
    .filter((q): q is QuizQuestion => Boolean(q))
    .filter((q) => questionLooksValid(q, transcriptWindow));

  const mergedQuestions = questions.slice(0, Math.max(1, questionCount));
  const mcqQuestions = mergedQuestions.filter((q): q is MCQQuestion => q.type === "mcq");

  return {
    timestamp,
    topic,
    questions: mergedQuestions,
    primaryQuestions: mcqQuestions,
    retryQuestions: mcqQuestions,
    checkpointMode,
  };
}

function buildSystemPrompt(timestamp: number, questionCount: number, difficulty: QuizDifficulty, videoTitle: string): string {
  return `You are an expert educational evaluator for LingoLearn.

You will receive a transcript window that ONLY includes content from 00:00 up to ${formatTime(timestamp)}.
Do not use concepts, terminology, examples, or answers that are introduced after that point.

Video Title: ${videoTitle}
Difficulty: ${difficulty}

Task:
- Create exactly one breakpoint for this window.
- Generate exactly ${questionCount} questions in a mixed set.
- CRITICAL RULE: NEVER ask about the video's aims, goals, creator, speaker, channel, subscribers, likes, intro/outro, or "what the video is about". You must ONLY ask about the ACTUAL SUBJECT MATTER (e.g. definitions, code syntax, technical concepts, frameworks, math, theories).
- If the transcript is just a generic intro (e.g. "Welcome to my channel..."), do NOT ask about it. Ask about the first technical or subject-matter concept mentioned, or infer the primary subject and ask a fundamental question about it.
- For easy, prioritize straightforward recall and vocabulary checks from the syllabus.
- For medium, ask comprehension and application questions from the syllabus.
- For hard, ask inference, comparison, debugging, output prediction, or "what changes if" questions.
- Always include at least one 'mcq' question.
- Prefer a second 'text' question when the lesson is conceptual or explanatory.
- If the video contains ANY programming terms, algorithms, or code examples, you MUST include at least one 'code' question.
- When you use a code question, infer the precise programming language (e.g. 'python', 'c', 'cpp', 'javascript', 'go', 'java') based on the Video Title and transcript. Output this exactly in the 'language' field.
- Provide a starting snippet in the 'initialCode' field appropriate for the language (e.g., '// Write code here').
- Keep the questions grounded in the transcript window and avoid future knowledge.
- Do not invent options that are empty, vague, duplicated, or unrelated.
- Keep the questions concise, learner-friendly, and clearly phrased.
- If a code question is not strongly supported by the transcript, choose text instead.

Question schema:
{
  "type": "mcq" | "text" | "code",
  "question": string,
  "explanation": string,
  "options": string[4],            // mcq only
  "correct": number,               // mcq only, 0-3
  "expectedAnswer": string,        // text only, optional
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
  transcriptWindow: TranscriptSegment[],
  difficulty: QuizDifficulty
): Breakpoint | null {
  try {
    const parsed = JSON.parse(rawContent) as { breakpoints?: unknown[] };
    const first = Array.isArray(parsed.breakpoints) ? parsed.breakpoints[0] : null;
    return normalizeBreakpoint(first, timestamp, transcriptWindow, questionCount, difficulty);
  } catch {
    console.error("Failed to parse Groq response:", rawContent);
    return normalizeBreakpoint(null, timestamp, transcriptWindow, questionCount, difficulty);
  }
}

async function callGroq(
  client: Groq,
  transcriptWindow: TranscriptSegment[],
  timestamp: number,
  questionCount: number,
  difficulty: QuizDifficulty,
  videoTitle: string
): Promise<Breakpoint | null> {
  const chunkText = transcriptWindow
    .map((segment) => `[${formatTime(segment.start)}] ${segment.text}`)
    .join("\n");

  const response = await client.chat.completions.create({
    model: GROQ_QUIZ_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(timestamp, questionCount, difficulty, videoTitle) },
      { role: "user", content: `Transcript window:\n${chunkText}` },
    ],
    temperature: 0.6,
    max_tokens: 1024,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return extractBreakpoint(content, timestamp, questionCount, transcriptWindow, difficulty);
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

export async function generateSingleBreakpoint(
  transcript: TranscriptSegment[],
  startSec: number,
  endSec: number,
  questionsPerBreakpoint: number,
  difficulty: QuizDifficulty = "medium",
  videoTitle: string
): Promise<Breakpoint | null> {
  const client = getClient();
  
  // Dramatically reduce latency by only sending the last 3 minutes of transcript
  const effectiveStart = Math.max(startSec, endSec - 180);
  const windowTranscript = transcript.filter(s => s.start >= effectiveStart && s.start <= endSec);
  
  if (windowTranscript.length === 0) return null;

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      return await callGroq(client, windowTranscript, endSec, questionsPerBreakpoint, difficulty, videoTitle);
    } catch (err) {
      if (is429(err) && attempt < 3) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`Rate limit hit, retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/3)`);
        await delay(backoffMs);
        continue;
      }
      if (!is429(err)) {
        console.error("Non-rate-limit error in breakpoint generation:", err);
        return null;
      }
      throw err;
    }
  }

  return null;
}
