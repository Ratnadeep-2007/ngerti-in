import { getQueryClient, trpc } from "@/trpc/server";
import React from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { redirect } from "next/navigation";
import {
  AgentIdView,
  AgentsIdViewError,
  AgentsIdViewLoading,
} from "@/modules/agents/ui/views/agent-id-view";
import { createTRPCContext } from "@/trpc/init";

interface Props {
  params: Promise<{
    agentId: string;
  }>;
}

const page = async ({ params }: Props) => {
  const { session } = await createTRPCContext();

  if (!session) {
    redirect("/sign-in");
  }

  const { agentId } = await params;

  const queryClient = getQueryClient();
  // Prefetch asynchronously to enable instant loading fallback streaming
  await queryClient
    .prefetchQuery(trpc.agents.getOne.queryOptions({ id: agentId }))
    .catch((err) => console.error("Server-side prefetch error:", err));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AgentsIdViewLoading />}>
        <ErrorBoundary fallback={<AgentsIdViewError />}>
          <AgentIdView agentId={agentId} />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default page;
