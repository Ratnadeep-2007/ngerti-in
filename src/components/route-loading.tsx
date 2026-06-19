import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export function DashboardOverviewSkeleton() {
  return (
    <div className="p-8 flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border bg-white/70 p-6 shadow-sm"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-10 w-20" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border bg-white/70 p-6 shadow-sm">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-[320px] w-full rounded-xl" />
        </div>
        <div className="space-y-4 rounded-2xl border bg-white/70 p-6 shadow-sm">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CollectionPageSkeleton({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-4 md:px-8">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      <div className="px-4 pb-4 md:px-8">
        <div className="rounded-2xl border bg-white/80 shadow-sm">
          <div className="border-b p-4">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="flex-1 px-4 py-4 md:px-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-72" />
        </div>
        <div className="rounded-2xl border bg-white/80 p-6 shadow-sm">
          <div className="space-y-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-card shadow-xl md:grid-cols-2">
        <div className="space-y-5 p-6 md:p-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
        <div className="hidden bg-muted/60 md:block" />
      </div>
    </div>
  );
}

export function CallPageSkeleton() {
  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-8">
      <div className="absolute inset-0">
        <div className="absolute left-16 top-16 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute bottom-16 right-16 h-80 w-80 rounded-full bg-blue-200/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 text-center">
        <div className="rounded-full border border-white/20 bg-white/10 p-4">
          <Loader2 className="size-10 animate-spin text-white" />
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-semibold text-white">
            Preparing your classroom
          </p>
          <p className="text-sm text-blue-100/90">
            Joining the call, loading assets, and syncing your tutor session.
          </p>
        </div>
      </div>
    </div>
  );
}
