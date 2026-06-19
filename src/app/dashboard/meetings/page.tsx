import React from "react";

// import {
// AgentsView,
// AgentsViewLoading,
// AgentsViewError,
// } from "@/modules/agents/ui/views/agents-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { MeetingsListHeader } from "@/modules/meetings/ui/components/meetings-list-header";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs";
import { loadSearchParams } from "@/modules/agents/params";
import { createTRPCContext } from "@/trpc/init";
import {
  MeetingsView,
  MeetingViewsError,
  MeetingViewsLoading,
} from "@/modules/meetings/ui/views/meeting-views";

interface Props {
  searchParams: Promise<SearchParams>;
}

const page = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const { session } = await createTRPCContext();

  if (!session) {
    redirect("/sign-in");
  }

  const queryClient = getQueryClient();
  // Prefetch asynchronously to enable instant loading fallback streaming
  queryClient
    .prefetchQuery(trpc.meetings.getMany.queryOptions({ ...filters }))
    .catch((err) => console.error("Server-side prefetch error:", err));

  return (
    <>
      <MeetingsListHeader />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<MeetingViewsLoading />}>
          <ErrorBoundary fallback={<MeetingViewsError />}>
            <MeetingsView />
          </ErrorBoundary>
        </Suspense>
      </HydrationBoundary>
    </>
  );
};

export default page;
