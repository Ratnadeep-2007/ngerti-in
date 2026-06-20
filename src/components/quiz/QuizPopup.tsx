"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { isRTL } from "@/lib/languages";
import type {
  Breakpoint,
  CodeQuestion,
  QuizQuestion,
  TranscriptSegment,
  TextQuestion,
  VoiceQuestion,
} from "@/lib/types";
import QuizOption from "./QuizOption";
import { useTranslation } from "@/contexts/UILanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizPopupProps {
  breakpoint: Breakpoint;
  breakpointIndex: number;
  totalBreakpoints: number;
  targetLocale: string;
  contextTranscript?: TranscriptSegment[];
  onPass: (result: QuizResult) => void;
  onClose: (result?: QuizResult) => void;
  isRetry: boolean;
  isFinalQuiz?: boolean;
}

export interface QuizResult {
  correct: number;
  total: number;
  passed: boolean;
}

// Internal per-question answer state
interface AnswerState {
  selectedIndex: number | null;
  textValue: string;
  codeValue: string;
  voiceText: string;
  voiceScore: number | null;
  voiceFeedback: string;
  gradeReason: string;
  isRevealed: boolean;
  isCorrect: boolean | null;
}

type Phase = "answering" | "reviewing" | "passed" | "failed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialAnswers(count: number): AnswerState[] {
  return Array.from({ length: count }, () => ({
    selectedIndex: null,
    textValue: "",
    codeValue: "",
    voiceText: "",
    voiceScore: null,
    voiceFeedback: "",
    gradeReason: "",
    isRevealed: false,
    isCorrect: null,
  }));
}

function getBreakpointQuestions(breakpoint: Breakpoint, isRetry: boolean): QuizQuestion[] {
  if (breakpoint.questions?.length) return breakpoint.questions;
  if (isRetry && breakpoint.retryQuestions?.length) return breakpoint.retryQuestions;
  if (breakpoint.primaryQuestions?.length) return breakpoint.primaryQuestions;
  return [];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isOpenEndedQuestionType(type: QuizQuestion["type"]): boolean {
  return type === "text" || type === "voice";
}

function isVoiceQuestion(question: QuizQuestion | undefined): question is VoiceQuestion {
  return question?.type === "voice";
}

function getRequiredCorrect(total: number, isFinalQuiz: boolean): number {
  if (total <= 0) return 0;
  return isFinalQuiz ? Math.max(1, Math.ceil(total * 0.5)) : total;
}

function getMonacoLanguage(language: string): string {
  const normalized = language.toLowerCase().trim();
  if (normalized === "py" || normalized === "python") return "python";
  if (normalized === "js" || normalized === "javascript") return "javascript";
  if (normalized === "ts" || normalized === "typescript") return "typescript";
  if (normalized === "c++" || normalized === "cpp") return "cpp";
  if (normalized === "c#") return "csharp";
  if (normalized === "c") return "c";
  if (normalized === "java") return "java";
  if (normalized === "go" || normalized === "golang") return "go";
  if (normalized === "rust") return "rust";
  if (normalized === "json") return "json";
  return "javascript";
}



// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated checkmark drawn with SVG stroke-dashoffset trick */
function SuccessCheck() {
  return (
    <svg
      className="mx-auto"
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="32"
        r="30"
        stroke="var(--success)"
        strokeWidth="3"
        fill="rgba(0,184,148,0.12)"
        style={{
          animation: "quiz-circle-in 0.4s ease-out forwards",
        }}
      />
      <polyline
        points="18,33 27,42 46,22"
        stroke="var(--success)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{
          strokeDasharray: 40,
          strokeDashoffset: 40,
          animation: "quiz-check-draw 0.35s ease-out 0.25s forwards",
        }}
      />
    </svg>
  );
}

export default function QuizPopup(props: QuizPopupProps) {
  const resetKey = [
    props.breakpoint.timestamp,
    props.breakpoint.topic,
    props.isRetry ? "retry" : "primary",
    props.breakpoint.questions?.map((q) => q.type).join(",") ?? "",
    props.breakpoint.primaryQuestions.length,
    props.breakpoint.retryQuestions.length,
  ].join("|");

  return <QuizPopupInner key={resetKey} {...props} />;
}

/** Progress dots row showing quiz questions completion */
function ProgressDots({
  total,
  current,
  answers,
}: {
  total: number;
  current: number;
  answers: AnswerState[];
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2" role="list" aria-label="Question progress">
      {Array.from({ length: total }, (_, i) => {
        const answer = answers[i];
        const isDone = answer?.isRevealed;
        const isGood = answer?.isCorrect;
        const isCurrent = i === current && !isDone;

        let dotClass =
          "h-2 rounded-full transition-all duration-300 ";
        if (isDone && isGood) {
          dotClass += "w-5 bg-success";
        } else if (isDone && !isGood) {
          dotClass += "w-5 bg-error";
        } else if (isCurrent) {
          dotClass += "w-5 bg-primary";
        } else {
          dotClass += "w-2 bg-border";
        }

        return (
          <span
            key={i}
            className={dotClass}
            role="listitem"
            aria-label={
              isDone
                ? isGood
                  ? t("quiz.questionCorrect", { index: i + 1 })
                  : t("quiz.questionIncorrect", { index: i + 1 })
                : isCurrent
                ? t("quiz.questionCurrent", { index: i + 1 })
                : t("quiz.questionUpcoming", { index: i + 1 })
            }
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ReviewCard({
  question,
  answer,
}: {
  question: QuizQuestion;
  answer: AnswerState;
}) {
  return (
    <div
      className="rounded-xl border px-4 py-3.5 flex flex-col gap-2.5"
      style={{
        background: "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(17,24,39,0.96) 100%)",
        borderColor: "rgba(148,163,184,0.28)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-100 leading-relaxed">
          <span className="text-slate-400 mr-1">◆</span>
          {question.question}
        </p>
        <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border border-slate-600 text-slate-300">
          {question.type}
        </span>
      </div>

      {question.type === "mcq" && (
        <div className="flex flex-col gap-1.5">
          {question.options.map((opt, oi) => {
            const isCorrectOpt = oi === question.correct;
            const isUserPick = oi === answer.selectedIndex;
            const isWrongPick = isUserPick && !isCorrectOpt;
            if (!isCorrectOpt && !isWrongPick) return null;
            return (
              <div
                key={oi}
                className="flex items-start gap-2 text-xs"
                style={{
                  color: isCorrectOpt ? "var(--success)" : "var(--error)",
                }}
              >
                <span className="shrink-0 mt-0.5 font-bold">
                  {isCorrectOpt ? "✓" : "✗"}
                </span>
                <span className="leading-relaxed">{opt}</span>
              </div>
            );
          })}
        </div>
      )}

      {question.type === "text" && (
        <div className="flex flex-col gap-1 text-xs text-slate-200/90">
          <p>
            <span className="font-semibold text-slate-100">Your answer:</span>{" "}
            {answer.textValue || "No answer"}
          </p>
          {question.expectedAnswer && (
            <p>
              <span className="font-semibold text-slate-100">Expected answer:</span>{" "}
              {question.expectedAnswer}
            </p>
          )}
        </div>
      )}

      {question.type === "code" && (
        <div className="flex flex-col gap-1 text-xs text-slate-200/90">
          <p>
            <span className="font-semibold text-slate-100">Language:</span>{" "}
            {question.language}
          </p>
          <pre className="rounded-lg border border-slate-700 bg-slate-950/80 p-3 overflow-x-auto text-[11px] leading-relaxed text-slate-100">
            <code>{answer.codeValue || question.initialCode}</code>
          </pre>
          {question.solution && (
            <p>
              <span className="font-semibold text-slate-100">Expected answer:</span>{" "}
              {question.solution}
            </p>
          )}
        </div>
      )}

      {question.type === "voice" && (
        <div className="flex flex-col gap-1.5 text-xs text-slate-200/90">
          <p>
            <span className="font-semibold text-slate-100">Your summary:</span>{" "}
            {answer.voiceText || "No transcript captured"}
          </p>
          {typeof answer.voiceScore === "number" && (
            <p>
              <span className="font-semibold text-slate-100">Score:</span>{" "}
              {answer.voiceScore}/10
            </p>
          )}
          {answer.voiceFeedback && (
            <p className="leading-relaxed">
              <span className="font-semibold text-slate-100">Feedback:</span>{" "}
              {answer.voiceFeedback}
            </p>
          )}
        </div>
      )}

      {question.explanation && (
        <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-700 pt-2">
          💡 {question.explanation}
        </p>
      )}

      {answer.gradeReason && (
        <p className="text-xs text-slate-200 leading-relaxed border-t border-slate-700 pt-2">
          AI feedback: {answer.gradeReason}
        </p>
      )}
    </div>
  );
}

function SolutionSummary({
  questions,
  answers,
}: {
  questions: QuizQuestion[];
  answers: AnswerState[];
}) {
  const { t } = useTranslation();
  return (
    <div className="w-full flex flex-col gap-4 mt-2">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider text-center">
        {t("quiz.reviewAnswers")}
      </p>
      {questions.map((question, i) => (
        <ReviewCard key={i} question={question} answer={answers[i]} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function QuizPopupInner({
  breakpoint,
  breakpointIndex,
  totalBreakpoints,
  targetLocale,
  contextTranscript = [],
  onPass,
  onClose,
  isRetry,
  isFinalQuiz = false,
}: QuizPopupProps) {
  const rtl = isRTL(targetLocale);
  const { t } = useTranslation();
  const questions: QuizQuestion[] = getBreakpointQuestions(breakpoint, isRetry);

  if (!questions || questions.length === 0) {
    return null;
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    buildInitialAnswers(questions.length).map((answer, index) => {
      const question = questions[index];
      if (!question) return answer;

      if (question.type === "code") {
        return { ...answer, codeValue: question.initialCode || "" };
      }

      return answer;
    })
  );
  const [phase, setPhase] = useState<Phase>("answering");
  const [scoreCount, setScoreCount] = useState<{ correct: number; total: number } | null>(null);
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [voiceStage, setVoiceStage] = useState<"idle" | "recording" | "transcribing" | "grading">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];
  const isVoiceFlow = isVoiceQuestion(currentQuestion);

  // Focus trap + initial focus
  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (answers[currentIndex].isRevealed) return;
      setAnswers((prev) =>
        prev.map((a, i) =>
          i === currentIndex ? { ...a, selectedIndex: optionIndex } : a
        )
      );
    },
    [answers, currentIndex]
  );

  const handleTextChange = useCallback((value: string) => {
    setAnswers((prev) =>
      prev.map((answer, index) =>
        index === currentIndex ? { ...answer, textValue: value } : answer
      )
    );
  }, [currentIndex]);

  const handleCodeChange = useCallback((value: string) => {
    setAnswers((prev) =>
      prev.map((answer, index) =>
        index === currentIndex ? { ...answer, codeValue: value } : answer
      )
    );
  }, [currentIndex]);

  const resetVoiceCapture = useCallback(() => {
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    voiceChunksRef.current = [];
    setVoiceStage("idle");
  }, []);

  const recordVoiceAnswer = useCallback(async () => {
    if (!isVoiceFlow || !currentQuestion) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      setVoiceError(null);
      setVoiceStage("recording");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(voiceChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        resetVoiceCapture();

        if (blob.size === 0) {
          setVoiceError("No audio was captured. Please try again.");
          return;
        }

        setVoiceStage("transcribing");

        try {
          const formData = new FormData();
          formData.append(
            "audio",
            new File([blob], "voice-summary.webm", { type: blob.type || "audio/webm" })
          );

          const transcribeResponse = await fetch("/api/transcribe-audio", {
            method: "POST",
            body: formData,
          });
          const transcribeData = (await transcribeResponse.json()) as {
            transcript?: string;
            error?: string;
          };

          if (!transcribeResponse.ok) {
            throw new Error(transcribeData.error || "Transcription failed");
          }

          const spokenAnswer = (transcribeData.transcript ?? "").trim();
          if (!spokenAnswer) {
            throw new Error("No speech was detected. Please try again.");
          }

          setVoiceStage("grading");
          const gradeResponse = await fetch("/api/grade-voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: currentQuestion,
              spokenAnswer,
              transcriptContext: contextTranscript,
            }),
          });

          const gradeData = (await gradeResponse.json()) as {
            score?: number;
            feedback?: string;
            error?: string;
          };

          if (!gradeResponse.ok) {
            throw new Error(gradeData.error || "Voice grading failed");
          }

          const score = Number.isFinite(gradeData.score) ? Math.max(0, Math.min(10, Number(gradeData.score))) : 0;
          const feedback = typeof gradeData.feedback === "string" && gradeData.feedback.trim()
            ? gradeData.feedback.trim()
            : "No feedback was returned.";

          setAnswers((prev) =>
            prev.map((answer, index) =>
              index === currentIndex
                ? {
                    ...answer,
                    voiceText: spokenAnswer,
                    voiceScore: score,
                    voiceFeedback: feedback,
                    isRevealed: true,
                    isCorrect: score >= 7,
                  }
                : answer
            )
          );
          setPhase("reviewing");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Voice check failed.";
          setVoiceError(message);
          setPhase("answering");
        } finally {
          setVoiceStage("idle");
        }
      };

      recorder.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start recording.";
      setVoiceError(message);
      resetVoiceCapture();
    }
  }, [contextTranscript, currentIndex, currentQuestion, isVoiceFlow, resetVoiceCapture]);

  const stopVoiceAnswer = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setVoiceStage("transcribing");
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!currentQuestion) return;
    if (isCheckingAnswer) return;
    if (currentQuestion.type === "voice") return;

    if (isFinalQuiz) {
      setAnswers((prev) =>
        prev.map((a, i) =>
          i === currentIndex
            ? {
                ...a,
                isRevealed: true,
                isCorrect: true,
                gradeReason: "Final quiz accepted.",
              }
            : a
        )
      );
      setPhase("reviewing");
      return;
    }

    let isCorrect = false;
    let gradeReason = "";

    if (currentQuestion.type === "mcq") {
      if (currentAnswer.selectedIndex === null) return;
      isCorrect = currentAnswer.selectedIndex === currentQuestion.correct;
    } else if (currentQuestion.type === "text" || currentQuestion.type === "code") {
      setIsCheckingAnswer(true);
      const answerPayload = currentQuestion.type === "text" ? currentAnswer.textValue : currentAnswer.codeValue;
      try {
        const response = await fetch("/api/grade-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: currentQuestion,
            answer: answerPayload,
            transcriptContext: contextTranscript,
            isFinalQuiz,
          }),
        });
        if (response.ok) {
          const result = (await response.json()) as { correct?: boolean; reason?: string };
          isCorrect = Boolean(result.correct);
          gradeReason = typeof result.reason === "string" ? result.reason : "";
        } else {
          isCorrect = false; // Graceful fallback on API failure
          gradeReason = "The AI grader could not evaluate this answer.";
        }
      } catch {
        isCorrect = false; // Graceful fallback on network failure
        gradeReason = "The AI grader could not be reached.";
      } finally {
        setIsCheckingAnswer(false);
      }
    }

    setAnswers((prev) =>
      prev.map((a, i) =>
        i === currentIndex
          ? { ...a, isRevealed: true, isCorrect, gradeReason }
          : a
      )
    );
    setPhase("reviewing");
  }, [contextTranscript, currentAnswer, currentIndex, currentQuestion, isCheckingAnswer, isFinalQuiz]);

  const handleNext = useCallback(() => {
    if (currentQuestion?.type === "voice") {
      const result = {
        correct: currentAnswer?.isCorrect === false ? 0 : 1,
        total: 1,
        passed: currentAnswer?.isCorrect !== false,
      };
      setLastResult(result);
      onPass(result);
      return;
    }
    const isLast = currentIndex === questions.length - 1;

    if (isLast) {
      // Evaluate overall pass / fail
      const updatedAnswers = answers.map((a, i) =>
        i === currentIndex ? { ...a, isRevealed: true } : a
      );
      const correctCount = updatedAnswers.filter((a) => a.isCorrect === true).length;
      const total = updatedAnswers.length;
      const passed = isFinalQuiz ? true : correctCount >= getRequiredCorrect(total, isFinalQuiz);
      const result = { correct: correctCount, total, passed };
      setScoreCount({ correct: correctCount, total });
      setLastResult(result);
      setPhase(passed ? "passed" : "failed");
      if (passed) {
        // Slight delay so the "passed" animation has a moment to render
        setTimeout(() => onPass(result), 1800);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setPhase("answering");
    }
  }, [answers, currentAnswer?.isCorrect, currentIndex, currentQuestion, isFinalQuiz, onPass, questions.length]);

  const handleTryAgain = useCallback(() => {
    if (currentQuestion?.type === "voice") {
      setAnswers((prev) =>
        prev.map((answer, index) =>
          index === currentIndex
            ? {
                ...answer,
                voiceText: "",
                voiceScore: null,
                voiceFeedback: "",
                isRevealed: false,
                isCorrect: null,
              }
            : answer
        )
      );
      setVoiceError(null);
      setPhase("answering");
      resetVoiceCapture();
      return;
    }
    onClose(lastResult ?? (scoreCount ? { ...scoreCount, passed: false } : undefined)); // Parent will re-open with isRetry=true
  }, [currentIndex, currentQuestion?.type, lastResult, onClose, resetVoiceCapture, scoreCount]);

  const continueAfterPass = useCallback(() => {
    onPass(lastResult ?? {
      correct: scoreCount?.correct ?? questions.length,
      total: scoreCount?.total ?? questions.length,
      passed: true,
    });
  }, [lastResult, onPass, questions.length, scoreCount]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const isSubmitDisabled =
    currentAnswer.isRevealed ||
    isCheckingAnswer ||
    (currentQuestion?.type === "mcq" && currentAnswer.selectedIndex === null) ||
    (isOpenEndedQuestionType(currentQuestion?.type ?? "text") && currentAnswer.textValue.trim().length === 0) ||
    (currentQuestion?.type === "code" && currentAnswer.codeValue.trim().length === 0);

  const isLastQuestion = currentIndex === questions.length - 1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* --- Keyframe injections (scoped, avoids globals.css pollution) --- */}
      <style>{`
        @keyframes quiz-backdrop-in {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to   { opacity: 1; backdrop-filter: blur(8px); }
        }
        @keyframes quiz-modal-in {
          from { opacity: 0; transform: translateY(40px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes quiz-circle-in {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes quiz-check-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes quiz-success-pop {
          0%   { transform: scale(0.85); opacity: 0; }
          60%  { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes quiz-fail-shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        .quiz-success-panel { animation: quiz-success-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .quiz-fail-panel    { animation: quiz-fail-shake 0.45s ease-out forwards; }
        .quiz-explanation   { animation: fadeIn 0.3s ease-out; }
      `}</style>

      {/* --- Backdrop --- */}
      <div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4"
        style={{
          animation: "quiz-backdrop-in 0.3s ease-out forwards",
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Quiz: ${breakpoint.topic}`}
        dir={rtl ? "rtl" : "ltr"}
      >
        {/* --- Modal panel --- */}
        <div
          ref={modalRef}
          className="relative flex w-full flex-col overflow-hidden border shadow-2xl rounded-t-2xl sm:rounded-2xl text-slate-100"
          style={{
            animation: "quiz-modal-in 0.4s cubic-bezier(0.22,1,0.36,1) forwards",
            maxHeight: "calc(100dvh - 0.75rem)",
            maxWidth: "min(48rem, calc(100vw - 0.75rem))",
            background:
              "linear-gradient(180deg, rgba(14,19,32,0.98) 0%, rgba(22,28,42,0.98) 100%)",
            borderColor: "rgba(148,163,184,0.24)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Decorative top gradient stripe */}
          <div
            className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
            style={{
              background:
                "linear-gradient(90deg, var(--primary), var(--accent))",
            }}
            aria-hidden="true"
          />

          {/* ----------------------------------------------------------------
              HEADER
          ---------------------------------------------------------------- */}
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex flex-col gap-1 min-w-0">
              {/* Breakpoint label */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: isRetry
                      ? "rgba(245,158,11,0.16)"
                      : "rgba(96,165,250,0.16)",
                    color: isRetry ? "#fbbf24" : "#93c5fd",
                    border: `1px solid ${isRetry ? "rgba(245,158,11,0.35)" : "rgba(96,165,250,0.35)"}`,
                  }}
                >
                  {isRetry ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                      {t("quiz.retry")}
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      {t("quiz.quiz")}
                    </>
                  )}
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {t("quiz.breakpoint", { current: breakpointIndex + 1, total: totalBreakpoints })}
                </span>
              </div>

              {/* Topic title */}
              <h2 className="text-sm font-semibold text-slate-100 leading-snug truncate">
                {breakpoint.topic}
              </h2>
            </div>

            {/* Close button */}
            <button
              ref={firstFocusRef}
              type="button"
              onClick={() => onClose()}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-white/10 transition-colors duration-150"
              aria-label="Close quiz"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ----------------------------------------------------------------
              BODY (scrollable)
          ---------------------------------------------------------------- */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4 sm:gap-5 text-slate-100">

            {/* === PASSED PANEL === */}
            {phase === "passed" && (
              <div className="quiz-success-panel flex flex-col items-center gap-4 py-6 text-center">
                <SuccessCheck />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-bold text-success">
                    {isFinalQuiz ? t("quiz.youPassed") : t("quiz.perfectScore")}
                  </h3>
                  {scoreCount && (
                    <p className="text-sm font-semibold text-success/80">
                      {t("quiz.passedScore", { correct: scoreCount.correct, total: scoreCount.total })}
                    </p>
                  )}
                  {!isFinalQuiz && (
                    <p className="text-sm text-slate-300 max-w-xs">
                      {t("quiz.perfectScoreDesc")}
                    </p>
                  )}
                </div>
                {/* Animated confetti dots */}
                <div className="flex items-center gap-2 mt-1" aria-hidden="true">
                  {["bg-primary", "bg-accent", "bg-success", "bg-warning", "bg-primary-light"].map(
                    (color, i) => (
                      <span
                        key={i}
                        className={`h-2 w-2 rounded-full ${color}`}
                        style={{
                          animation: `quiz-success-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms both`,
                        }}
                      />
                    )
                  )}
                </div>
                {isFinalQuiz && scoreCount && (
                  <SolutionSummary questions={questions} answers={answers} />
                )}
              </div>
            )}

            {/* === FAILED PANEL === */}
            {phase === "failed" && (
              <div className="quiz-fail-panel flex flex-col items-center gap-4 py-6 text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full mx-auto"
                  style={{
                    background: "rgba(225,112,85,0.12)",
                    border: "2px solid rgba(225,112,85,0.4)",
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-bold text-error">
                    {t("quiz.notQuite")}
                  </h3>
                  {isFinalQuiz && scoreCount ? (
                    <p className="text-sm text-slate-300 max-w-xs">
                      {t("quiz.failedScore", {
                        correct: scoreCount.correct,
                        total: scoreCount.total,
                        required: getRequiredCorrect(scoreCount.total, true),
                      })}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-300 max-w-xs">
                      {t("quiz.notQuiteDesc")}
                    </p>
                  )}
                </div>
                {isFinalQuiz && scoreCount && (
                  <SolutionSummary questions={questions} answers={answers} />
                )}
              </div>
            )}

            {/* === QUESTION AREA (answering / reviewing) === */}
            {(phase === "answering" || phase === "reviewing") && currentQuestion && (
              <>
                {/* Progress dots */}
                {questions.length > 1 && (
                  <ProgressDots
                    total={questions.length}
                    current={currentIndex}
                    answers={answers}
                  />
                )}

                {/* Question counter */}
                <p className="text-xs text-slate-300 font-medium text-center">
                  {t("quiz.questionOf", { current: currentIndex + 1, total: questions.length })}
                </p>

                {/* Question text */}
                <div
                  className="rounded-2xl border border-white/10 bg-[#0f1724]/95 px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(15,23,36,0.98) 0%, rgba(20,26,40,0.94) 100%)",
                  }}
                >
                  <p className="text-base sm:text-lg font-semibold text-white leading-7 tracking-tight">
                    {currentQuestion.question}
                  </p>
                </div>

                {currentQuestion.type === "mcq" && (
                  <div className="flex flex-col gap-2.5">
                    {currentQuestion.options.map((option, i) => {
                      const isCorrectOption =
                        currentAnswer.isRevealed &&
                        i === currentQuestion.correct;
                      const isIncorrectSelected =
                        currentAnswer.isRevealed &&
                        currentAnswer.selectedIndex === i &&
                        i !== currentQuestion.correct;

                      return (
                        <QuizOption
                          key={i}
                          text={option}
                          index={i}
                          isSelected={currentAnswer.selectedIndex === i}
                          isCorrect={
                            isCorrectOption
                              ? true
                              : isIncorrectSelected
                              ? false
                              : null
                          }
                          isRevealed={currentAnswer.isRevealed}
                          onSelect={handleSelect}
                        />
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === "text" && (
                  <div className="flex flex-col gap-2.5">
                    <textarea
                      value={currentAnswer.textValue}
                      onChange={(e) => handleTextChange(e.target.value)}
                      disabled={currentAnswer.isRevealed}
                      rows={5}
                      placeholder={currentQuestion.placeholder || "Type your answer here..."}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-[15px] leading-6 text-white placeholder:text-slate-400 outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(108,92,231,0.18)] disabled:opacity-60"
                    />
                    <p className="text-[11px] text-slate-300">
                      Short answers are checked against the expected response or key ideas.
                    </p>
                  </div>
                )}

                {currentQuestion.type === "code" && (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="font-semibold uppercase tracking-wider">
                        Language: {currentQuestion.language}
                      </span>
                      <span className="rounded-full border border-slate-600/80 px-2 py-0.5 text-slate-100 bg-slate-900/70">
                        Monaco Editor
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
                      <Editor
                        height="320px"
                        defaultLanguage={getMonacoLanguage(currentQuestion.language)}
                        language={getMonacoLanguage(currentQuestion.language)}
                        theme="vs-dark"
                        value={currentAnswer.codeValue}
                        onChange={(value) => handleCodeChange(value ?? "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          wordWrap: "on",
                          automaticLayout: true,
                          padding: { top: 12, bottom: 12 },
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-300">
                      This is a code editor scaffold for now. Execution and linting can be added next.
                    </p>
                  </div>
                )}

                {currentQuestion.type === "voice" && (
                  <div className="flex flex-col gap-3">
                    <div
                      className="rounded-2xl border border-white/10 px-4 py-4 text-sm text-slate-200"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(15,23,36,0.95) 0%, rgba(20,26,40,0.9) 100%)",
                      }}
                    >
                      <p className="font-semibold text-white leading-6">
                        Speak a short summary of what you learned so far.
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300/90">
                        We will transcribe your audio, then grade the factual accuracy against the video context only.
                      </p>
                    </div>

                    {voiceError && (
                      <div className="rounded-xl border border-[rgba(225,112,85,0.35)] bg-[rgba(225,112,85,0.08)] px-4 py-3 text-sm text-[var(--error)]">
                        {voiceError}
                      </div>
                    )}

                    {(voiceStage === "transcribing" || voiceStage === "grading") && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                        {voiceStage === "transcribing" ? "Transcribing your voice..." : "Grading your summary..."}
                      </div>
                    )}

                    {currentAnswer.voiceText && (
                      <div className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold mb-1">
                          Transcript
                        </p>
                        <p className="text-sm leading-6 text-foreground/90">
                          {currentAnswer.voiceText}
                        </p>
                      </div>
                    )}

                    {currentAnswer.isRevealed && currentAnswer.voiceFeedback && (
                      <div
                        className="rounded-2xl border px-4 py-4"
                        style={{
                          borderColor: "rgba(0,184,148,0.28)",
                          background: "rgba(0,184,148,0.08)",
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-success">
                            Score
                          </p>
                          {typeof currentAnswer.voiceScore === "number" && (
                            <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-sm font-bold text-success">
                              {currentAnswer.voiceScore}/10
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-foreground/90">
                          {currentAnswer.voiceFeedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isCheckingAnswer && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                    Checking your answer...
                  </div>
                )}

                {/* Explanation (shown after submit) */}
                {currentAnswer.isRevealed && currentQuestion.explanation && (
                  <div
                    className="quiz-explanation rounded-xl border px-4 py-3.5 flex gap-3"
                    style={{
                      borderColor: currentAnswer.isCorrect
                        ? "rgba(0,184,148,0.35)"
                        : "rgba(225,112,85,0.35)",
                      background: currentAnswer.isCorrect
                        ? "rgba(0,184,148,0.07)"
                        : "rgba(225,112,85,0.07)",
                    }}
                  >
                    <span
                      className="shrink-0 mt-0.5"
                      style={{
                        color: currentAnswer.isCorrect
                          ? "var(--success)"
                          : "var(--error)",
                      }}
                      aria-hidden="true"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </span>
                    <p className="text-xs leading-relaxed text-slate-200">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ----------------------------------------------------------------
              FOOTER — actions
          ---------------------------------------------------------------- */}
          <div className="shrink-0 border-t border-border px-4 py-4 sm:px-5 flex gap-3">
            {/* Answering phase: Submit */}
            {phase === "answering" && !isVoiceFlow && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isSubmitDisabled
                    ? "var(--surface-light)"
                    : "linear-gradient(135deg, var(--primary) 0%, #8b7cf8 100%)",
                  boxShadow: isSubmitDisabled
                    ? "none"
                    : "0 4px 14px rgba(108,92,231,0.35)",
                }}
              >
                {isCheckingAnswer ? "Checking..." : t("quiz.submitAnswer")}
              </button>
            )}

            {phase === "answering" && isVoiceFlow && (
              <>
                <button
                  type="button"
                  onClick={recordVoiceAnswer}
                  disabled={voiceStage !== "idle"}
                  className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      voiceStage !== "idle"
                        ? "var(--surface-light)"
                        : "linear-gradient(135deg, var(--primary) 0%, #8b7cf8 100%)",
                    boxShadow:
                      voiceStage !== "idle" ? "none" : "0 4px 14px rgba(108,92,231,0.35)",
                  }}
                >
                  Start Speaking
                </button>
                <button
                  type="button"
                  onClick={stopVoiceAnswer}
                  disabled={voiceStage !== "recording"}
                  className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      voiceStage !== "recording"
                        ? "var(--surface-light)"
                        : "linear-gradient(135deg, var(--warning) 0%, #f0b429 100%)",
                    boxShadow:
                      voiceStage !== "recording" ? "none" : "0 4px 14px rgba(253,203,110,0.35)",
                    color: voiceStage !== "recording" ? "var(--muted)" : "#1a1a24",
                  }}
                >
                  Stop Speaking
                </button>
              </>
            )}

            {/* Reviewing phase: Next / Finish */}
            {phase === "reviewing" && !isVoiceFlow && (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200"
                style={{
                  background: currentAnswer.isCorrect
                    ? "linear-gradient(135deg, var(--success) 0%, #00d4a8 100%)"
                    : "linear-gradient(135deg, var(--primary) 0%, #8b7cf8 100%)",
                  boxShadow: currentAnswer.isCorrect
                    ? "0 4px 14px rgba(0,184,148,0.35)"
                    : "0 4px 14px rgba(108,92,231,0.35)",
                }}
              >
                {isLastQuestion ? t("quiz.seeResults") : t("quiz.nextQuestion")}
              </button>
            )}

            {phase === "reviewing" && isVoiceFlow && (
              <>
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="rounded-2xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:text-white hover:border-slate-400"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, var(--success) 0%, #00d4a8 100%)",
                    boxShadow: "0 4px 14px rgba(0,184,148,0.35)",
                  }}
                >
                  Continue
                </button>
              </>
            )}

            {/* Passed phase: Continue (auto-closes, but give user manual control) */}
            {phase === "passed" && (
              <button
                type="button"
                onClick={continueAfterPass}
                className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200"
                style={{
                  background:
                    "linear-gradient(135deg, var(--success) 0%, #00d4a8 100%)",
                  boxShadow: "0 4px 14px rgba(0,184,148,0.35)",
                }}
              >
                {t("quiz.continue")}
              </button>
            )}

            {/* Failed phase: Try Again + Close */}
            {phase === "failed" && (
              <>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:text-white hover:border-slate-400 transition-colors duration-150"
                >
                  {t("quiz.close")}
                </button>
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--warning) 0%, #f0b429 100%)",
                    boxShadow: "0 4px 14px rgba(253,203,110,0.3)",
                    color: "#1a1a24",
                  }}
                >
                  {t("quiz.tryAgain")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
