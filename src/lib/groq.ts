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

function hasProgrammingSignals(transcript: TranscriptSegment[]): boolean {
  const text = transcript.map((segment) => segment.text).join(" ").toLowerCase();
  return /(\bcode\b|\bcoding\b|\bprogram\b|\bprogramming\b|\bsyntax\b|\bfunction\b|\bclass\b|\bconst\b|\blet\b|\bvar\b|\breturn\b|\bloop\b|\barray\b|\bobject\b|\bstring\b|\bnumber\b|\bboolean\b|\bvariable\b|\bmethod\b|\bmodule\b|\bimport\b|\bexport\b|\basync\b|\bawait\b|\bapi\b|\balgorithm\b|\bpython\b|\bjavascript\b|\btypescript\b|\breact\b|\bnext\.js\b|\bnode\b|\bexpress\b|\bhtml\b|\bcss\b|\bsql\b|\bquery\b|\bprint\b|\bconsole\.log\b|\bterminal\b|\bcompiler\b|\bruntime\b)/i.test(text);
}

function inferProgrammingLanguage(transcript: TranscriptSegment[]): string {
  const text = transcript.map((segment) => segment.text).join(" ").toLowerCase();
  if (/\bpython\b/.test(text)) return "python";
  if (/\bjavascript\b|\bjs\b|\bnode\b/.test(text)) return "javascript";
  if (/\btypescript\b|\bts\b/.test(text)) return "typescript";
  if (/\bc\+\+\b|\bcpp\b/.test(text)) return "cpp";
  if (/\bc language\b|\b c \b|\bc\b/.test(text)) return "c";
  if (/\bhtml\b/.test(text)) return "html";
  if (/\bcss\b/.test(text)) return "css";
  if (/\bsql\b|\bquery\b/.test(text)) return "sql";
  if (/\bjava\b/.test(text)) return "java";
  if (/\brust\b/.test(text)) return "rust";
  if (/\bgo\b|\bgolang\b/.test(text)) return "go";
  return "javascript";
}

function buildFallbackQuestionSet(
  transcript: TranscriptSegment[],
  timestamp: number,
  questionCount: number,
  difficulty: QuizDifficulty
): QuizQuestion[] {
  const keywords = extractKeywords(transcript, 8);
  const topic = keywords[0] ?? "the lesson";
  const secondTopic = keywords[1] ?? topic;
  const thirdTopic = keywords[2] ?? secondTopic;
  const isProgrammingLesson = hasProgrammingSignals(transcript);
  const programmingLanguage = inferProgrammingLanguage(transcript);
  const baseCount = Math.max(1, Math.floor(questionCount));
  const questions: QuizQuestion[] = [];

  questions.push({
    type: "mcq",
    question:
      difficulty === "hard"
        ? `Which idea is most directly supported by the transcript so far?`
        : `Which topic has been covered by ${formatTime(timestamp)}?`,
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
    if (isProgrammingLesson) {
      questions.push({
        type: "code",
        question:
          difficulty === "hard"
            ? `Write a short ${programmingLanguage} example that demonstrates ${topic}.`
            : `Write a small ${programmingLanguage} example using ${topic}.`,
        explanation: "This scaffold is only used when the transcript clearly includes coding content.",
        language: programmingLanguage,
        initialCode: `// Write a minimal ${programmingLanguage} example here\n`,
        expectedOutput: undefined,
        solution: undefined,
      });
    } else {
      questions.push({
        type: "text",
        question:
          difficulty === "hard"
            ? `How would you apply the idea of ${topic} to a new example?`
            : `Explain the lesson's current idea about ${topic} in your own words.`,
        explanation: "Short answer practice keeps the prompt tied to the visible transcript window.",
        expectedAnswer: topic,
        acceptedKeywords: keywords.slice(0, Math.min(4, keywords.length)),
        placeholder: "Type 1-2 sentences",
      });
    }
  }

  if (baseCount >= 3) {
    questions.push({
      type: "text",
      question:
        difficulty === "hard"
          ? `What would change if the lesson's main rule about ${topic} were reversed?`
          : `Why is ${topic} important in this lesson?`,
      explanation: "This fallback keeps the prompt grounded in the visible transcript.",
      expectedAnswer: topic,
      acceptedKeywords: [secondTopic, topic].filter((value, index, array) => array.indexOf(value) === index),
      placeholder: "Write a short answer",
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

function buildProgrammingCodeQuestion(
  transcript: TranscriptSegment[],
  timestamp: number,
  difficulty: QuizDifficulty
): CodeQuestion {
  const keywords = extractKeywords(transcript, 8);
  const topic = keywords[0] ?? "the concept";
  const language = inferProgrammingLanguage(transcript);

  return {
    type: "code",
    question:
      difficulty === "hard"
        ? `Write a small ${language} example that demonstrates ${topic} without using future concepts.`
        : `Write a short ${language} example based on what the transcript has taught so far.`,
    explanation: `This code prompt is grounded only in the transcript up to ${formatTime(timestamp)}.`,
    language,
    initialCode:
      language === "python"
        ? `# Write a minimal Python example here\n`
        : language === "javascript"
        ? `// Write a minimal JavaScript example here\n`
        : language === "typescript"
        ? `// Write a minimal TypeScript example here\n`
        : language === "cpp"
        ? `// Write a minimal C++ example here\n`
        : language === "c"
        ? `/* Write a minimal C example here */\n`
        : language === "java"
        ? `// Write a minimal Java example here\n`
        : language === "html"
        ? `<!-- Write a minimal HTML example here -->\n`
        : language === "css"
        ? `/* Write a minimal CSS example here */\n`
        : `// Write a minimal ${language} example here\n`,
    expectedOutput: undefined,
    solution: undefined,
  };
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
  fallbackTimestamp: number,
  transcriptWindow: TranscriptSegment[],
  questionCount: number,
  difficulty: QuizDifficulty
): Breakpoint | null {
  if (!isRecord(raw)) {
    const fallbackQuestions = buildFallbackQuestionSet(
      transcriptWindow,
      fallbackTimestamp,
      questionCount,
      difficulty
    );
    return {
      timestamp: fallbackTimestamp,
      topic: "Learning checkpoint",
      questions: fallbackQuestions,
      primaryQuestions: fallbackQuestions.filter((q): q is MCQQuestion => q.type === "mcq"),
      retryQuestions: fallbackQuestions.filter((q): q is MCQQuestion => q.type === "mcq"),
      checkpointMode: "sandbox",
    };
  }
  const timestamp = typeof raw.timestamp === "number" ? raw.timestamp : fallbackTimestamp;
  const topic = typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : "Learning checkpoint";
  const checkpointMode =
    raw.checkpointMode === "reverse" || raw.checkpointMode === "sandbox"
      ? raw.checkpointMode
      : undefined;

  const mixedQuestionsSource =
    Array.isArray(raw.questions) && raw.questions.length > 0
      ? raw.questions
      : [...(Array.isArray(raw.primaryQuestions) ? raw.primaryQuestions : []), ...(Array.isArray(raw.retryQuestions) ? raw.retryQuestions : [])];

  const questions = mixedQuestionsSource
    .map(normalizeQuestion)
    .filter((q): q is QuizQuestion => Boolean(q))
    .filter((q) => questionLooksValid(q, transcriptWindow));

  const fallbackQuestions = buildFallbackQuestionSet(
    transcriptWindow,
    timestamp,
    questionCount,
    difficulty
  );
  const baseQuestions = questions.length > 0 ? questions : fallbackQuestions;
  const programmingLesson = hasProgrammingSignals(transcriptWindow);
  let mergedQuestions = baseQuestions.slice(0, Math.max(1, questionCount));

  if (programmingLesson && !mergedQuestions.some((question) => question.type === "code")) {
    const codeQuestion = buildProgrammingCodeQuestion(transcriptWindow, timestamp, difficulty);
    if (mergedQuestions.length >= Math.max(1, questionCount)) {
      mergedQuestions = [
        mergedQuestions[0],
        codeQuestion,
        ...mergedQuestions.slice(2),
      ].slice(0, Math.max(1, questionCount));
    } else {
      mergedQuestions = [...mergedQuestions, codeQuestion].slice(0, Math.max(1, questionCount));
    }
  }

  if (programmingLesson && !mergedQuestions.some((question) => question.type === "code")) {
    mergedQuestions = [buildProgrammingCodeQuestion(transcriptWindow, timestamp, difficulty), ...mergedQuestions]
      .slice(0, Math.max(1, questionCount));
  }

  const primaryQuestions = mergedQuestions.filter((q): q is MCQQuestion => q.type === "mcq");
  const retryQuestions = primaryQuestions.length > 0 ? [...primaryQuestions] : [];

  return {
    timestamp,
    topic,
    questions: mergedQuestions,
    primaryQuestions,
    retryQuestions,
    checkpointMode,
  };
}

function buildSystemPrompt(timestamp: number, questionCount: number, difficulty: QuizDifficulty): string {
  return `You are an expert educational evaluator for LingoLearn.

You will receive a transcript window that ONLY includes content from 00:00 up to ${formatTime(timestamp)}.
Do not use concepts, terminology, examples, or answers that are introduced after that point.

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
- When you use a code question, match the language to the language clearly mentioned or implied by the transcript.
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
  difficulty: QuizDifficulty
): Promise<Breakpoint | null> {
  const chunkText = transcriptWindow
    .map((segment) => `[${formatTime(segment.start)}] ${segment.text}`)
    .join("\n");

  const response = await client.chat.completions.create({
    model: GROQ_QUIZ_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(timestamp, questionCount, difficulty) },
      { role: "user", content: `Transcript window:\n${chunkText}` },
    ],
    temperature: 0.6,
    max_tokens: 4096,
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

async function generateBreakpointWithRetry(
  client: Groq,
  transcript: TranscriptSegment[],
  timestamp: number,
  questionCount: number,
  difficulty: QuizDifficulty
): Promise<Breakpoint | null> {
  const windowTranscript = sliceTranscriptThrough(transcript, timestamp);
  if (windowTranscript.length === 0) return null;

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      return await callGroq(client, windowTranscript, timestamp, questionCount, difficulty);
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
  questionsPerBreakpoint: number,
  difficulty: QuizDifficulty = "medium"
): Promise<Breakpoint[]> {
  const duration = getTranscriptDuration(transcript);
  return generateQuizzesForRange(transcript, 0, duration, maxBreakpoints, questionsPerBreakpoint, difficulty);
}

export async function generateQuizzesForRange(
  transcript: TranscriptSegment[],
  startSec: number,
  endSec: number,
  maxBreakpoints: number,
  questionsPerBreakpoint: number,
  difficulty: QuizDifficulty = "medium",
  aiWindowEndSec: number = Infinity
): Promise<Breakpoint[]> {
  const client = getClient();
  const schedule = buildSmartPauseSchedule(startSec, endSec, difficulty, maxBreakpoints);

  const results: Breakpoint[] = [];
  const chunkSize = 5;
  for (let i = 0; i < schedule.length; i += chunkSize) {
    const chunk = schedule.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(({ timestamp, checkpointMode }) => {
        if (timestamp > aiWindowEndSec) {
          const bp = normalizeBreakpoint(null, timestamp, sliceTranscriptThrough(transcript, timestamp), questionsPerBreakpoint, difficulty);
          return Promise.resolve(bp ? { ...bp, checkpointMode } : null);
        }
        return generateBreakpointWithRetry(
          client,
          transcript,
          timestamp,
          questionsPerBreakpoint,
          difficulty
        ).then((breakpoint) =>
          breakpoint ? { ...breakpoint, checkpointMode } : null
        );
      })
    );
    for (const res of chunkResults) {
      if (res) results.push(res);
    }
  }

  return results.sort((a, b) => a.timestamp - b.timestamp);
}
