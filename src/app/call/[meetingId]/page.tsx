import React from "react";
import { redirect } from "next/navigation";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CallView } from "@/modules/call/ui/views/call-view";
import { LoaderCircle } from "lucide-react";
import { createTRPCContext } from "@/trpc/init";

interface PageProps {
  params: Promise<{
    meetingId: string;
  }>;
}

const page = async ({ params }: PageProps) => {
  const { session } = await createTRPCContext();
  if (!session) {
    redirect("/sign-in");
  }

  const { meetingId } = await params;

  const queryClient = getQueryClient();
  await queryClient
    .prefetchQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }))
    .catch((err) => console.error("Server-side prefetch error:", err));

  return (
    <>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-8 relative overflow-hidden">
              {/* Background decorative elements */}
              <div className="absolute inset-0">
                <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 rounded-full blur-2xl"></div>
              </div>

              {/* Main content */}
              <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-white/20 rounded-full"></div>
                  <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
                  <LoaderCircle className="absolute inset-0 m-auto size-8 text-white/80 animate-pulse" />
                </div>

                <div className="text-center space-y-2">
                  <h2 className="text-white text-2xl font-semibold tracking-wide">
                    Connecting to your call
                  </h2>
                  <p className="text-blue-100/80 text-base font-medium max-w-sm">
                    Please wait while we prepare your classroom
                  </p>
                </div>
              </div>
            </div>
          }
        >
          <CallView meetingId={meetingId} />
        </Suspense>
      </HydrationBoundary>
    </>
  );
};

export default page;
