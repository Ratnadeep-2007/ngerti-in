"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { Camera, Upload, Scan, Loader2 } from "lucide-react";
import Tesseract from "tesseract.js";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ExcalidrawWrapperProps {
  initialData?: {
    elements: any[];
    appState: any;
  };
  onChange?: (elements: any, appState: any) => void;
  meetingId: string;
  agentId: string;
}

const ExcalidrawWrapper = ({
  initialData,
  onChange,
  meetingId,
  agentId,
}: ExcalidrawWrapperProps) => {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: updateAgent } = useMutation(
    trpc.agents.update.mutationOptions(),
  );

  // SOLUSI: Validasi aman di sini
  const safeInitialData = {
    elements: Array.isArray(initialData?.elements) ? initialData.elements : [],
    appState: initialData?.appState || {
      viewBackgroundColor: "#ffffff",
      currentItemFontFamily: 1,
      viewModeEnabled: false,
    },
  };

  const handleChange = useCallback(
    (elements: any, appState: any) => {
      if (!onChange) return;

      const safeElements = Array.isArray(elements) ? elements : [];

      onChange(safeElements, appState || { viewBackgroundColor: "#ffffff" });
    },
    [onChange],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleOcr(file);
    }
  };

  const handleOcr = async (file: File) => {
    setAiLoading(true);
    setOcrProgress(0);

    try {
      // 1. Perform OCR
      const {
        data: { text },
      } = await Tesseract.recognize(file, "eng+ind", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      if (!text.trim()) {
        throw new Error("No text found in image");
      }

      // 2. Add text to Excalidraw
      const api = excalidrawRef.current;
      if (api) {
        const elements = api.getSceneElements();
        const textElement = {
          type: "text",
          x: 100,
          y: 100,
          width: 400,
          text: `Extracted Problem:\n${text}`,
          fontSize: 20,
          strokeColor: "#2563eb",
          fontFamily: 1,
          id: `ocr-${Date.now()}`,
          seed: Math.random(),
          groupIds: [],
          angle: 0,
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          strokeSharpness: "sharp",
          locked: false,
        } as any;

        api.updateScene({
          elements: [...elements, textElement],
        });
      }

      // 3. Update Agent Prompt to trigger AI explanation
      const agent = await queryClient.fetchQuery(
        trpc.agents.getOne.queryOptions({ id: agentId }),
      );
      const newPrompt = `${agent.prompt}\n\n[CONTEXT: Student just uploaded a homework image. Extracted text is below. Please explain this problem immediately in a step-by-step manner as if you are looking at it on the whiteboard.]\n\nProblem text:\n${text}`;

      await updateAgent({
        id: agentId,
        name: agent.name,
        subject: agent.subject,
        prompt: newPrompt,
        language: agent.language,
      });

      setAiResponse("Problem scanned! The AI tutor is now analyzing it...");
      setTimeout(() => setAiResponse(null), 5000);
    } catch (error) {
      console.error("OCR Error:", error);
      setAiResponse("Failed to read image. Please try again.");
    } finally {
      setAiLoading(false);
      setOcrProgress(0);
    }
  };

  const handleAskAI = async () => {
    setAiLoading(true);
    setAiResponse(null);

    const api = excalidrawRef.current;
    if (!api) return;

    const elements = api.getSceneElements() || [];
    const appState = api.getAppState() || { viewBackgroundColor: "#ffffff" };

    try {
      const imageBlob = await exportToBlob({
        elements,
        appState,
        mimeType: "image/png",
        exportBackground: true,
        exportPadding: 20,
      });

      const arrayBuffer = await imageBlob.arrayBuffer();
      const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

      const res = await fetch("/api/ai-whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elements,
          appState,
          meetingId,
          imageBase64,
        }),
      });

      // const data = await res.json();
    } catch (error) {
      console.error("Error asking AI:", error);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="relative h-full w-full bg-white">
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawRef.current = api;
        }}
        initialData={safeInitialData} // Gunakan safeInitialData
        onChange={handleChange}
      />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Floating Action Buttons */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-50">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium disabled:cursor-not-allowed"
          disabled={aiLoading}
        >
          {aiLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{ocrProgress > 0 ? `Scanning ${ocrProgress}%` : "Processing..."}</span>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" />
              <span>Scan Homework</span>
            </>
          )}
        </button>

        <button
          onClick={handleAskAI}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium disabled:cursor-not-allowed"
          disabled={aiLoading}
        >
          {aiLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Scan className="w-5 h-5" />
          )}
          <span>Ask AI</span>
        </button>
      </div>

      {aiResponse && (
        <div className="absolute bottom-24 right-4 max-w-md bg-white shadow-2xl border border-gray-200 px-6 py-4 rounded-2xl text-black z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="font-bold text-blue-600 mb-1">Status:</div>
          <div className="whitespace-pre-line text-sm">{aiResponse}</div>
        </div>
      )}
    </div>
  );
};

export default ExcalidrawWrapper;

