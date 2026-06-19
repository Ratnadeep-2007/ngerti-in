import { z } from "zod";
import {
  AGENT_LANGUAGE_OPTIONS,
  AGENT_SUBJECT_OPTIONS,
} from "@/lib/constants/agent-options";

export const agentsInsertSchema = z.object({
  name: z.string(),
  subject: z.enum(AGENT_SUBJECT_OPTIONS),
  prompt: z.string().optional(),
  language: z.enum(AGENT_LANGUAGE_OPTIONS),
});

export const agentsUpdateSchema = agentsInsertSchema.extend({
  id: z.string().min(1, "Agent ID is required"),
});
