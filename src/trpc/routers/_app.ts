import { z } from "zod";
import { createTRPCRouter } from "../init";
import { agentsRouter } from "@/modules/agents/server/procedures";
import { meetingsRouter } from "@/modules/meetings/server/procedures";
import { knowledgeBaseRouter } from "@/modules/agents/knowledge-base/server/procedures";

export const appRouter = createTRPCRouter({
  agents: agentsRouter,
  meetings: meetingsRouter,
  knowledgeBase: knowledgeBaseRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
