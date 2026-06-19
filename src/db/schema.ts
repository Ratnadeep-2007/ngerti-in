import { pgTable, text, timestamp, boolean, pgEnum, customType, index } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { use } from "react";
import { AGENT_LANGUAGE_OPTIONS, AGENT_SUBJECT_OPTIONS } from "@/lib/constants/agent-options";

// Add vector type for pgvector
const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value.slice(1, -1).split(",").map(Number);
    }
    return value as number[];
  },
});

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});

const prompt = {
  Maths:
    "You are a thoughtful Maths teacher for middle and high school students. Explain concepts step by step in a clear and calm manner. Use simple language, but do not skip important ideas. Give real-life examples when possible, like shopping, time, money, or sports. Encourage students to think logically, guide them through problem-solving with patience, and never rush to the final answer if they can reason it out themselves.",
  English:
    "You are an English teacher for middle and high school students. Teach reading, writing, grammar, vocabulary, and conversation in a clear, encouraging, and practical way. Use everyday examples, short dialogues, and simple explanations. If the student is unsure, ask guiding questions and help them improve step by step.",
  Python:
    "You are a Python teacher for middle and high school students. Teach programming fundamentals, syntax, debugging, and problem-solving in a simple, structured way. Break down code into small parts, explain why each line matters, and encourage the student to think through the solution before giving the full answer.",
  "Soft Skills":
    "You are a Soft Skills coach for middle and high school students. Teach communication, teamwork, confidence, time management, interview preparation, and public speaking in a practical, friendly, and supportive way. Use real-world scenarios and ask reflective questions so the student can think and respond actively.",
};

export const agents = pgTable("agents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  // description: text("description"), // Optional, e.g., "Math tutor for high school"
  subject: text("subject").notNull(),
  language: text("language").notNull().default("English (Formal)"),
  prompt: text("prompt").notNull(), // The instruction / behavior guide for the agent
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});

export const knowledgeBase = pgTable("knowledge_base", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
}, (table) => [
  index("idx_kb_agent_id").on(table.agentId),
]);

export const meetingStatus = pgEnum("meeting_status", [
  "upcoming",
  "active",
  "completed",
  "processing",
  "cancelled",
]);

export const meetings = pgTable("meetings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  status: meetingStatus("status").notNull().default("upcoming"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  transcriptUrl: text("transcript_url"),
  recordingUrl: text("recording_url"),
  summary: text("summary"),
  quiz: text("quiz"), // JSON string of quiz questions
  learningPath: text("learning_path"), // JSON string of recommended next steps
  suggestedVideos: text("suggested_videos"), // JSON string of [{title, url, thumbnail}]
  topics: text("topics"), // JSON string of ["Topic A", "Topic B"]
  whiteboardSnapshot: text("whiteboard_snapshot"), // Base64 image snapshot of final whiteboard
  currentPrompt: text("current_prompt"), // Transient session-specific instructions
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
}, (table) => [
  index("idx_meetings_user_id").on(table.userId),
  index("idx_meetings_agent_id").on(table.agentId),
  index("idx_meetings_status").on(table.status),
]);
