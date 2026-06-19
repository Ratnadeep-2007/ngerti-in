import React from "react";
// import { AgentGetOne } from "../../types";

import { useTRPC } from "@/trpc/client";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import z from "zod";
import { agentsInsertSchema } from "../../schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormItem,
  FormField,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { AgentGetOne } from "../../types";
import {
  AGENT_LANGUAGE_OPTIONS,
  AGENT_SUBJECT_OPTIONS,
} from "@/lib/constants/agent-options";

interface AgentFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialValues?: AgentGetOne;
}

export const AgentForm = ({
  onSuccess,
  onCancel,
  initialValues,
}: AgentFormProps) => {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const createAgent = useMutation(
    trpc.agents.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.agents.getMany.queryOptions({}),
        );

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

  const updateAgent = useMutation(
    trpc.agents.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.agents.getMany.queryOptions({}),
        );

        if (initialValues?.id) {
          queryClient.invalidateQueries(
            trpc.agents.getOne.queryOptions({ id: initialValues.id }),
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

  const form = useForm<z.infer<typeof agentsInsertSchema>>({
    resolver: zodResolver(agentsInsertSchema),
    defaultValues: {
      name: initialValues?.name || "",
      subject:
        (initialValues?.subject as (typeof AGENT_SUBJECT_OPTIONS)[number] | undefined) ||
        "Maths",
      prompt: initialValues?.prompt || "",
      language:
        (initialValues?.language as (typeof AGENT_LANGUAGE_OPTIONS)[number] | undefined) ||
        "English (Formal)",
    },
  });
  //   const [showCustomSubject, setShowCustomSubject] = useState(
  //     form.getValues("subject") === "Other"
  //   );

  const isEdit = !!initialValues?.id;
  const isPending = createAgent.isPending || updateAgent.isPending;
  const onSubmit = (values: z.infer<typeof agentsInsertSchema>) => {
    if (isEdit) {
      updateAgent.mutate({
        ...values,
        id: initialValues.id,
        prompt: values.prompt,
      });
    } else {
      createAgent.mutate(values);
    }
  };
  return (
    <>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <GeneratedAvatar
            seed={form.watch("name") ?? ""}
            variant="botttsNeutral"
            className="border size-16"
          />
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Tutor name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="subject"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <Select
                  defaultValue={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {AGENT_SUBJECT_OPTIONS.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="language"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <Select
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {AGENT_LANGUAGE_OPTIONS.map((language) => (
                      <SelectItem key={language} value={language}>
                        {language}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* {showCustomSubject && (
            <FormField
              name="customSubject"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter custom subject" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )} */}
          {/* 
          <FormField
            name="description"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="You are a helpful assistant that can answer questions and help with tasks."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}

          {isEdit && (
            <FormField
              name="prompt"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter custom prompt for this agent"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div>
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
