import { LingoDotDevEngine } from "@lingo.dev/_sdk";
import {
  TranscriptSegment,
  Breakpoint,
  CompanionDialogue,
  CertificateLabels,
  TranslatedContent,
  QuizQuestion,
  MCQQuestion,
  TextQuestion,
  CodeQuestion,
} from "./types";

function getEngine() {
  return new LingoDotDevEngine({
    apiKey: process.env.LINGODOTDEV_API_KEY!,
    ...(process.env.LINGODOTDEV_ENGINE_ID && { engineId: process.env.LINGODOTDEV_ENGINE_ID }),
  });
}

function pickTranslated(translated: string | undefined, fallback: string): string {
  const value = typeof translated === "string" ? translated.trim() : "";
  return value.length > 0 ? value : fallback;
}

export async function detectLocale(text: string): Promise<string> {
  const engine = getEngine();
  return engine.recognizeLocale(text);
}

export async function translateText(
  text: string,
  sourceLocale: string,
  targetLocale: string
): Promise<string> {
  const engine = getEngine();
  return engine.localizeText(text, { sourceLocale, targetLocale });
}

export async function translateTranscript(
  segments: TranscriptSegment[],
  sourceLocale: string,
  targetLocale: string
): Promise<TranscriptSegment[]> {
  if (segments.length === 0) return [];
  const engine = getEngine();
  const texts = segments.map((s) => s.text);
  
  // Chunking to avoid payload too large errors
  const chunkSize = 50;
  const PARALLEL_BATCH = 3;
  const translated: string[] = [];
  const chunks: string[][] = [];
  for (let i = 0; i < texts.length; i += chunkSize) {
    chunks.push(texts.slice(i, i + chunkSize));
  }

  for (let i = 0; i < chunks.length; i += PARALLEL_BATCH) {
    const batch = chunks.slice(i, i + PARALLEL_BATCH);
    const results = await Promise.all(
      batch.map(chunk => engine.localizeStringArray(chunk, { sourceLocale, targetLocale }))
    );
    results.forEach(r => translated.push(...r));
  }

  return segments.map((seg, i) => ({
    ...seg,
    text: translated[i],
  }));
}

export async function translateBreakpoints(
  breakpoints: Breakpoint[],
  sourceLocale: string,
  targetLocale: string
): Promise<Breakpoint[]> {
  if (breakpoints.length === 0) return [];
  const engine = getEngine();

  async function translateQuestion(question: QuizQuestion): Promise<QuizQuestion> {
    switch (question.type) {
      case "mcq": {
        const translated = await engine.localizeStringArray(
          [question.question, question.explanation || "", ...question.options],
          { sourceLocale, targetLocale }
        );
        const [translatedQuestion, translatedExplanation, ...translatedOptions] = translated;
        const normalized: MCQQuestion = {
          ...question,
          question: pickTranslated(translatedQuestion, question.question),
          explanation: pickTranslated(translatedExplanation, question.explanation ?? ""),
          options: [
            pickTranslated(translatedOptions[0], question.options[0]),
            pickTranslated(translatedOptions[1], question.options[1]),
            pickTranslated(translatedOptions[2], question.options[2]),
            pickTranslated(translatedOptions[3], question.options[3]),
          ],
        };
        return normalized;
      }
      case "text": {
        const payload = [
          question.question,
          question.explanation || "",
          question.expectedAnswer || "",
          question.placeholder || "",
          ...(question.acceptedKeywords || []),
        ];
        const translated = await engine.localizeStringArray(payload, { sourceLocale, targetLocale });
        const [translatedQuestion, translatedExplanation, translatedExpectedAnswer, translatedPlaceholder, ...translatedKeywords] = translated;
        const normalized: TextQuestion = {
          ...question,
          question: pickTranslated(translatedQuestion, question.question),
          explanation: pickTranslated(translatedExplanation, question.explanation ?? ""),
          expectedAnswer: pickTranslated(translatedExpectedAnswer, question.expectedAnswer ?? ""),
          placeholder: pickTranslated(translatedPlaceholder, question.placeholder ?? ""),
          acceptedKeywords: translatedKeywords.length > 0 ? translatedKeywords : question.acceptedKeywords,
        };
        return normalized;
      }
      case "code": {
        const translated = await engine.localizeStringArray(
          [question.question, question.explanation || ""],
          { sourceLocale, targetLocale }
        );
        const [translatedQuestion, translatedExplanation] = translated;
        const normalized: CodeQuestion = {
          ...question,
          question: pickTranslated(translatedQuestion, question.question),
          explanation: pickTranslated(translatedExplanation, question.explanation ?? ""),
        };
        return normalized;
      }
      default:
        return question;
    }
  }

  return Promise.all(
    breakpoints.map(async (bp) => {
      const mixedQuestions = bp.questions.length > 0
        ? bp.questions
        : [...bp.primaryQuestions, ...bp.retryQuestions];

      const translatedQuestions = await Promise.all(
        mixedQuestions.map((question) => translateQuestion(question))
      );
      const primaryQuestions = translatedQuestions.filter(
        (question): question is MCQQuestion => question.type === "mcq"
      );

      const topicTranslation = await engine.localizeText(bp.topic, { sourceLocale, targetLocale });

      return {
        ...bp,
        topic: pickTranslated(topicTranslation, bp.topic),
        questions: translatedQuestions,
        primaryQuestions,
        retryQuestions: primaryQuestions,
      };
    })
  );
}

export async function translateCompanionDialogue(
  sourceLocale: string,
  targetLocale: string
): Promise<CompanionDialogue> {
  const engine = getEngine();
  const defaultDialogue: CompanionDialogue = {
    quizPass: "Great job! You got it right!",
    quizFail: "Don't worry, try again!",
    breakpointReached: "Time for a quick check!",
    videoComplete: "Amazing! You completed the video!",
    encouragement: "You can do this!",
    greeting: "Let's learn together!",
    almostThere: "Almost there, keep going!",
    keepGoing: "Keep up the great work!",
  };

  const translated = await engine.localizeObject(
    defaultDialogue as unknown as Record<string, string>,
    { sourceLocale: "en", targetLocale }
  );

  return translated as unknown as CompanionDialogue;
}

export async function translateCertificateLabels(
  sourceLocale: string,
  targetLocale: string
): Promise<CertificateLabels> {
  const engine = getEngine();
  const defaultLabels: CertificateLabels = {
    title: "Certificate of Completion",
    awardedTo: "Awarded to",
    forCompleting: "for completing",
    completionDate: "Completion Date",
    language: "Language",
    poweredBy: "Powered by LingoLearn",
  };

  const translated = await engine.localizeObject(
    defaultLabels as unknown as Record<string, string>,
    { sourceLocale: "en", targetLocale }
  );

  return translated as unknown as CertificateLabels;
}

export async function translateUIStrings(
  strings: Record<string, string>,
  targetLocale: string
): Promise<Record<string, string>> {
  const engine = getEngine();
  return engine.localizeObject(strings, { sourceLocale: "en", targetLocale }) as Promise<Record<string, string>>;
}

export async function translateAllContent(
  transcript: TranscriptSegment[],
  breakpoints: Breakpoint[],
  sourceLocale: string,
  targetLocale: string
): Promise<TranslatedContent> {
  // Run all translations in parallel
  const [
    translatedTranscript,
    translatedBreakpoints,
    companionDialogue,
    certificateLabels,
  ] = await Promise.all([
    translateTranscript(transcript, sourceLocale, targetLocale),
    translateBreakpoints(breakpoints, sourceLocale, targetLocale),
    translateCompanionDialogue(sourceLocale, targetLocale),
    translateCertificateLabels(sourceLocale, targetLocale),
  ]);

  return {
    transcript: translatedTranscript,
    breakpoints: translatedBreakpoints,
    companionDialogue,
    certificateLabels,
  };
}
