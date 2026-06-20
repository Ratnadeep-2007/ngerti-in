import { pgTable, text, boolean, integer } from "drizzle-orm/pg-core";

export const meetings = pgTable("meetings", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  host: text("host").notNull(),
  createdAt: text("created_at").notNull(),
  active: boolean("active").notNull().default(true),
});

export const leaderboard = pgTable("leaderboard", {
  username: text("username").primaryKey(),
  role: text("role").notNull(),
  dailyScore: integer("daily_score").notNull(),
  weeklyScore: integer("weekly_score").notNull(),
  avatar: text("avatar").notNull().default("🎓"),
});
