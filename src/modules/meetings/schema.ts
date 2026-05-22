import { z } from "zod";

export const meetingsInsertSchema = z.object({
  name: z.string().min(1, "Name is required"),
  agentId: z.string().min(1, "Agent ID is required"),
  isPublic: z.boolean(),
  currentPrompt: z.string().optional(),
});

export const meetingsUpdateSchema = meetingsInsertSchema.partial().extend({
  id: z.string().min(1, "Meeting ID is required"),
});
