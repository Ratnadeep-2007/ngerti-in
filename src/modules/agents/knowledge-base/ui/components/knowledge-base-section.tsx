"use client";

import { useState, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeBaseSectionProps {
  agentId: string;
}

export const KnowledgeBaseSection = ({ agentId }: KnowledgeBaseSectionProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { data: knowledgeItems, isLoading } = useQuery(
    trpc.knowledgeBase.getForAgent.queryOptions({
      agentId,
    }),
  );

  const createKnowledge = useMutation(
    trpc.knowledgeBase.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.knowledgeBase.getForAgent.queryOptions({ agentId }),
        );
        toast.success("Textbook uploaded and indexed!");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to index textbook");
      },
    }),
  );

  const removeKnowledge = useMutation(
    trpc.knowledgeBase.remove.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.knowledgeBase.getForAgent.queryOptions({ agentId }),
        );
        toast.success("Resource removed");
      },
    }),
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to parse PDF");

      const { text, filename } = await response.json();

      if (!text || text.trim().length === 0) {
        throw new Error("No text content found in PDF");
      }

      await createKnowledge.mutateAsync({
        agentId,
        filename,
        content: text,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload textbook");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Knowledge Base (Textbooks)</h3>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf"
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          variant="outline"
          size="sm"
          className="flex items-center gap-x-2"
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Upload PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {knowledgeItems?.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 border rounded-lg bg-neutral-50"
          >
            <div className="flex items-center gap-x-3 overflow-hidden">
              <FileText className="size-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm font-medium truncate">{item.filename}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
              onClick={() => removeKnowledge.mutate({ id: item.id })}
              disabled={removeKnowledge.isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        {knowledgeItems?.length === 0 && !isLoading && (
          <div className="col-span-full py-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-neutral-500">
            <p>No textbooks uploaded yet.</p>
            <p className="text-xs">Upload PDFs to give your AI tutor specific knowledge.</p>
          </div>
        )}

        {isLoading && (
          <div className="col-span-full py-8 flex justify-center">
            <Loader2 className="size-6 animate-spin text-blue-600" />
          </div>
        )}
      </div>
    </div>
  );
};
