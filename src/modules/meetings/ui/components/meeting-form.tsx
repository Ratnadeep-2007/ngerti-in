import React from "react";
import { MeetingGetOne } from "../../types";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { meetingsInsertSchema } from "../../schema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormItem,
  FormField,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { CommandSelect } from "@/components/command-select";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { NewAgentDialog } from "@/modules/agents/ui/components/new-agent-dialog";
import { Switch } from "@/components/ui/switch";
// import { tr } from "date-fns/locale";

interface MeetingFormProps {
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
  initialValues?: MeetingGetOne;
}

export const MeetingForm = ({
  onSuccess,
  onCancel,
  initialValues,
}: MeetingFormProps) => {
  const trpc = useTRPC();
  const [agentSearch, setAgentSearch] = useState("");
  const [openANewAgentDialog, setOpenNewAgentDialog] = useState(false);

  const queryClient = useQueryClient();

  const agent = useQuery(
    trpc.agents.getMany.queryOptions({
      pageSize: 100, // Adjust as needed
      search: agentSearch, // Use the search term from state
    }),
  );

  const createMeeting = useMutation(
    trpc.meetings.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          trpc.meetings.getMany.queryOptions({}),
        );

        onSuccess?.(data.id);
      },
      onError: (error) => {
        toast.error(error.message);
        const fieldErrors = (error.data as any)?.zodError?.fieldErrors;
        if (fieldErrors) {
          Object.entries(fieldErrors).forEach(([key, messages]) => {
            form.setError(key as any, {
              type: "server",
              message: Array.isArray(messages)
                ? messages.join(", ")
                : "Invalid value",
            });
          });
        }
      },
    }),
  );

  const updateMeeting = useMutation(
    trpc.meetings.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.meetings.getMany.queryOptions({}),
        );

        if (initialValues?.id) {
          queryClient.invalidateQueries(
            trpc.meetings.getOne.queryOptions({ id: initialValues.id }),
          );
        }
        onSuccess?.();
      },
      onError: (error) => {
        toast.error(error.message);
        const fieldErrors = (error.data as any)?.zodError?.fieldErrors;
        if (fieldErrors) {
          Object.entries(fieldErrors).forEach(([key, messages]) => {
            form.setError(key as any, {
              type: "server",
              message: Array.isArray(messages)
                ? messages.join(", ")
                : "Invalid value",
            });
          });
        }
      },
    }),
  );

  const form = useForm<z.infer<typeof meetingsInsertSchema>>({
    resolver: zodResolver(meetingsInsertSchema) as any,
    defaultValues: {
      name: initialValues?.name || "",
      agentId: initialValues?.agentId || "",
      isPublic: initialValues?.isPublic || false,
      currentPrompt: initialValues?.currentPrompt || undefined,
      status: initialValues?.status || undefined,
      endedAt: initialValues?.endedAt ? new Date(initialValues.endedAt) : undefined,
    },
  });

  const isEdit = !!initialValues?.id;
  const isPending = createMeeting.isPending || updateMeeting.isPending;
  const onSubmit = (values: z.infer<typeof meetingsInsertSchema>) => {
    if (isEdit) {
      updateMeeting.mutate({
        ...values,
        id: initialValues.id,
      });
    } else {
      createMeeting.mutate(values);
    }
  };

  return (
    <>
      <NewAgentDialog
        open={openANewAgentDialog}
        onOpenChange={setOpenNewAgentDialog}
      />
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit as any)}>
          <FormField
            name="name"
            control={form.control as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter meeting name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="agentId"
            control={form.control as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tutor</FormLabel>
                <FormControl>
                  <CommandSelect
                    options={(agent.data?.items ?? []).map((agent) => ({
                      id: agent.id,
                      value: agent.id,
                      children: (
                        <div className="flex items-center gap-2">
                          <GeneratedAvatar
                            seed={agent.name}
                            variant="botttsNeutral"
                            className="border size-6"
                          />
                          <span>{agent.name}</span>
                        </div>
                      ),
                    }))}
                    onSelect={field.onChange}
                    onSearch={setAgentSearch}
                    value={field.value}
                    placeholder="Select an agent"
                  />
                </FormControl>

                <FormDescription>
                  Not Found what you are looking for?{" "}
                  <button
                    type="button"
                    onClick={() => setOpenNewAgentDialog(true)}
                    className="text-primary hover:underline"
                  >
                    Create new Tutor
                  </button>
                </FormDescription>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="isPublic"
            control={form.control as any}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-xs">
                <div className="space-y-0.5">
                  <FormLabel>Public Meeting</FormLabel>
                  <FormDescription>
                    Allow other students to discover and join your study
                    session.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-x-2">
            {onCancel && (
              <Button
                variant="ghost"
                disabled={isPending}
                type="button"
                onClick={() => onCancel()}
              >
                Cancel
              </Button>
            )}
            <Button isLoading={isPending} type="submit">
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};
