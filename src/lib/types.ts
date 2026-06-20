export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export type QuestionType = "mcq" | "text" | "code" | "voice";
export type QuizDifficulty = "easy" | "medium" | "hard";
export type CheckpointMode = "sandbox" | "reverse";

interface BaseQuestion {
  type: QuestionType;
  question: string;
  explanation?: string;
}

export interface MCQQuestion extends BaseQuestion {
  type: "mcq";
  options: [string, string, string, string];
  correct: number; // index of correct option
}

export interface TextQuestion extends BaseQuestion {
  type: "text";
  expectedAnswer?: string;
  acceptedKeywords?: string[];
  placeholder?: string;
}

export interface CodeQuestion extends BaseQuestion {
  type: "code";
  language: string;
  initialCode: string;
  solution?: string;
  expectedOutput?: string;
}

export interface VoiceQuestion extends BaseQuestion {
  type: "voice";
  expectedAnswer?: string;
  keyIdeas?: string[];
}

export type QuizQuestion = MCQQuestion | TextQuestion | CodeQuestion | VoiceQuestion;

export interface VideoMetadata {
  title: string;
  duration: number; // seconds
  thumbnail: string;
  channelName: string;
}

export interface Breakpoint {
  timestamp: number; // seconds into video
  topic: string;
  questions: QuizQuestion[];
  primaryQuestions: MCQQuestion[];
  retryQuestions: MCQQuestion[];
  checkpointMode?: CheckpointMode;
}

export interface QuizFrequency {
  maxBreakpoints: number;
  questionsPerBreakpoint: number;
}

export interface TranslatedContent {
  transcript: TranscriptSegment[];
  breakpoints: Breakpoint[];
  companionDialogue: CompanionDialogue;
  certificateLabels: CertificateLabels;
}

export interface CompanionDialogue {
  quizPass: string;
  quizFail: string;
  breakpointReached: string;
  videoComplete: string;
  encouragement: string;
  greeting: string;
  almostThere: string;
  keepGoing: string;
}

export interface CertificateLabels {
  title: string; // "Certificate of Completion"
  awardedTo: string; // "Awarded to"
  forCompleting: string; // "for completing"
  completionDate: string; // "Completion Date"
  language: string; // "Language"
  poweredBy: string; // "Powered by LingoDev"
}

export type LearningMode = "jolly" | "focus";

export type SessionStatus = "pending" | "ongoing" | "completed";

export interface FocusMetricSample {
  timestampMs: number;
  faceDetected: boolean;
  headX: number;
  headY: number;
  headZ: number;
  eyeFocus: number;
  postureShift: number;
}

export interface FocusEvaluation {
  startedAt: string;
  endedAt?: string;
  permission: "granted" | "denied" | "unavailable";
  sampleCount: number;
  facePresenceRatio: number;
  focusScore: number;
  calmnessScore: number;
  postureScore: number;
  fidgetingVariance: number;
  gazeWanderingRatio: number;
  bodyMovementVariance: number;
  groqEvaluation?: FaceTrackingGroqEvaluation;
}

export interface FaceTrackingGroqEvaluation {
  headline: string;
  summaryMarkdown: string;
  strengths: string[];
  concerns: string[];
  suggestions: string[];
}

export interface QuizPerformanceScore {
  breakpointIndex: number;
  topic: string;
  correct: number;
  total: number;
  passed: boolean;
  completedAt: string;
}

export interface RecapChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface YouTubeRecommendation {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  url: string;
  conceptTags: string[];
  reason: string;
}

export interface SessionRecap {
  summaryMarkdown?: string;
  nextSteps?: string[];
  recommendations?: YouTubeRecommendation[];
  recommendationsError?: string;
  chatMessages: RecapChatMessage[];
  generatedAt?: string;
}

export interface CompanionCharacter {
  id: string;
  name: string;
  description?: string;
  idleGif: string;
  celebrationGif: string;
  encouragementGif: string;
}

export interface Session {
  id: string;
  videoUrl: string;
  metadata: VideoMetadata;
  sourceLocale: string;
  targetLocale: string;
  mode: LearningMode;
  companionId: string | null;
  originalTranscript: TranscriptSegment[];
  translatedContent: TranslatedContent;
  originalBreakpoints: Breakpoint[];
  quizFrequency: QuizFrequency;
  quizDifficulty: QuizDifficulty;
  progress: SessionProgress;
  status: SessionStatus;
  createdAt: string;
  completedAt?: string;
  userName: string;
  focusEvaluation?: FocusEvaluation;
  recap?: SessionRecap;
  rawTranscript?: TranscriptSegment[];       // full transcript for lazy prefetch calls
  quizzesGeneratedUpTo?: number;              // high-water mark (seconds)
  finalQuiz?: Breakpoint | null;             // undefined = not generated, null = no questions
}

export interface SessionProgress {
  breakpointsCleared: boolean[];
  attemptsPerBreakpoint: number[];
  currentBreakpointIndex: number;
  lastPlaybackPosition: number;
  finalQuizPassed?: boolean;
  quizScores?: QuizPerformanceScore[];
}

export interface ExtractTranscriptResponse {
  transcript: TranscriptSegment[];
  metadata: VideoMetadata;
}

export interface GenerateQuizzesResponse {
  breakpoints: Breakpoint[];
}

export interface TranslateResponse {
  translatedContent: TranslatedContent;
}
