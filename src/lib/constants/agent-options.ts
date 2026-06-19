export const AGENT_SUBJECT_OPTIONS = [
  "Maths",
  "English",
  "Python",
  "Soft Skills",
] as const;

export type AgentSubject = (typeof AGENT_SUBJECT_OPTIONS)[number];

export const AGENT_LANGUAGE_OPTIONS = [
  "English (Formal)",
  "English (Informal)",
  "Hindi",
  "Marathi",
] as const;

export type AgentLanguage = (typeof AGENT_LANGUAGE_OPTIONS)[number];
