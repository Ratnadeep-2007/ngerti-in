"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import ErrorState from "@/components/error-state";
import LoadingState from "@/components/loading-state";
import { DataTable } from "@/components/data-table";
import { columns } from "../components/column";
import { EmptyState } from "@/components/empty-state";
import { useRouter } from "next/navigation";
import { useMeetingsFilters } from "../../hooks/use-meeting-filters";
import { DataPagination } from "@/components/data-pagination";
import { toast } from "sonner";
import { Trash } from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";

export const MeetingsView = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = useMeetingsFilters();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    trpc.meetings.getMany.queryOptions({ ...filters }),
  );

  const { mutateAsync: removeMeeting } = useMutation(
    trpc.meetings.remove.mutationOptions(),
  );

  const handleDelete = async (e: Event, id: string) => {
    e.stopPropagation();
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this meeting permanently? This action cannot be undone.",
    );
    if (!confirmDelete) return;

    try {
      await removeMeeting({ id });
      toast.success("Meeting deleted successfully");
      queryClient.invalidateQueries(trpc.meetings.getMany.queryFilter());
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete meeting");
    }
  };

  return (
    <div className="max-h-126 h-full pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <DataTable
        type="meeting"
        data={data.items}
        columns={columns}
        onRowClick={(row) => router.push(`/dashboard/meetings/${row.id}`)}
        renderContextMenu={(row) => (
          <ContextMenuContent>
            <ContextMenuItem
              className="text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer"
              onSelect={(e) => handleDelete(e, row.id)}
            >
              <Trash className="w-4 h-4 mr-2" />
              Delete Meeting
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
    </div>
  );
};

export const MeetingViewsLoading = () => {
  return (
    <LoadingState
      title="Loading Meetings"
      description="This may take a few seconds..."
    />
  );
};

export const MeetingViewsError = () => {
  return (
    <ErrorState
      title="Failed to load meetings"
      description="Please try again later."
    />
  );
};
