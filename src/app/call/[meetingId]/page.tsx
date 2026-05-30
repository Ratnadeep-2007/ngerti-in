import { headers } from "next/headers";
import { auth, getSessionCore } from "@/lib/auth";
import React from "react";
import { redirect } from "next/navigation";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CallView } from "@/modules/call/ui/views/call-view";

interface PageProps {
  params: Promise<{
    meetingId: string;
  }>;
}

const page = async ({ params }: PageProps) => {
  const session = await getSessionCore(await headers());
  if (!session) {
    redirect("/sign-in");
  }

  const { meetingId } = await params;

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.meetings.getOne.queryOptions({ id: meetingId }),
  );

  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CallView meetingId={meetingId} />
      </HydrationBoundary>
    </>
  );
};

export default page;
