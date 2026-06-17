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
import { useCall } from "@stream-io/video-react-sdk";

const extractAndStripDrawing = (text: string) => {
  const excalidrawRegex = /```excalidraw\n([\s\S]*?)\n```/;
  const match = text.match(excalidrawRegex);
  let elements: any[] = [];
  let cleanText = text;

  if (match) {
    try {
      elements = JSON.parse(match[1]);
      cleanText = text.replace(excalidrawRegex, "").trim();
    } catch (err) {
      console.error("Failed to parse Excalidraw JSON from AI response:", err);
    }
  }

  return { cleanText, elements };
};

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
  const call = useCall();
  const { mutateAsync: updateAgent } = useMutation(
    trpc.agents.update.mutationOptions(),
  );
  const { mutateAsync: updateMeeting } = useMutation(
    trpc.meetings.update.mutationOptions(),
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

  const lastSyncTextRef = useRef("");

  useEffect(() => {
    const currentText = (initialData?.elements || [])
      .filter((el: any) => el.type === "text" && el.text && el.text.trim())
      .map((el: any) => el.text)
      .join("\n");

    if (!currentText || currentText === lastSyncTextRef.current) return;

    const timer = setTimeout(async () => {
      try {
        lastSyncTextRef.current = currentText;
        await fetch("/api/ai-whiteboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            elements: initialData?.elements || [],
            meetingId,
          }),
        });
      } catch (err) {
        console.error("Failed to sync whiteboard text context:", err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [initialData?.elements, meetingId]);

  // Listen for AI Tutor drawing events
  useEffect(() => {
    if (!call) return;

    const handleCustomEvent = (event: any) => {
      const { type, payload } = event.custom;
      if (type === "ai-draw" && payload?.elements) {
        const api = excalidrawRef.current;
        if (api) {
          const currentElements = api.getSceneElements() || [];
          
          const newElements = payload.elements.map((el: any) => ({
            ...el,
            id: el.id || `ai-${Date.now()}-${Math.random()}`,
            seed: el.seed || Math.random(),
            updated: Date.now(),
          }));
          
          api.updateScene({
            elements: [...currentElements, ...newElements],
          });
        }
      }
    };

    const unsubscribe = call.on("custom", handleCustomEvent);
    return () => {
      unsubscribe();
    };
  }, [call]);

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
      let textElement: any = null;
      let elements: readonly any[] = [];
      if (api) {
        elements = api.getSceneElements();
        textElement = {
          type: "text",
          x: 100,
          y: 100,
          width: 400,
          height: 100,
          text: `Extracted Problem:\n${text}`,
          fontSize: 20,
          strokeColor: "#2563eb",
          backgroundColor: "transparent",
          fillStyle: "hachure",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          strokeSharpness: "sharp",
          fontFamily: 1,
          textAlign: "left",
          verticalAlign: "top",
          containerId: null,
          originalText: `Extracted Problem:\n${text}`,
          id: `ocr-${Date.now()}`,
          seed: Math.random(),
          groupIds: [],
          angle: 0,
          locked: false,
          link: null,
          boundElements: null,
          updated: Date.now(),
        } as any;

        api.updateScene({
          elements: [...elements, textElement],
        });
      }

      // 3. Update Meeting Prompt to trigger AI explanation
      const newPrompt = `[CONTEXT: Student just uploaded a homework image. Extracted text is below. Please explain this problem immediately in a step-by-step manner as if you are looking at it on the whiteboard.]\n\nProblem text:\n${text}`;

      await updateMeeting({
        id: meetingId,
        currentPrompt: newPrompt,
      });

      setAiResponse("Problem scanned! Generating explanation...");

      // Call whiteboard API to trigger tutor voice explanation
      const res = await fetch("/api/ai-whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elements: textElement ? [...elements, textElement] : elements,
          meetingId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response && call) {
          setAiResponse(data.response);
          call.sendCustomEvent({
            type: "ai-voice",
            payload: {
              text: data.response,
              senderPlayedLocally: false,
            },
          });
        }
      }
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
        mimeType: "image/jpeg",
        quality: 0.7,
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

      if (!res.ok) throw new Error("Failed to analyze whiteboard");

      const data = await res.json();
      if (data.response && call) {
        const { cleanText, elements: parsedElements } = extractAndStripDrawing(data.response);
        setAiResponse(cleanText);
        call.sendCustomEvent({
          type: "ai-voice",
          payload: {
            text: cleanText,
            senderPlayedLocally: false, // Let the custom event handler play it locally and for everyone
          },
        });
        if (parsedElements && parsedElements.length > 0) {
          call.sendCustomEvent({
            type: "ai-draw",
            payload: { elements: parsedElements },
          });
        }
      }
    } catch (error) {
      console.error("Error asking AI:", error);
      setAiResponse("AI failed to analyze the whiteboard.");
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

