"use client";

import { useEffect, useRef, useState } from "react";
import { useCallStateHooks } from "@stream-io/video-react-sdk";

type FaceApiModule = typeof import("face-api.js");

interface EmotionDetectionResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isModelsLoaded: boolean;
  currentEmotion: string | null;
}

export const useEmotionDetection = (
  onConfused: () => void,
  enabled: boolean = false,
): EmotionDetectionResult => {
  const { useCameraState } = useCallStateHooks();
  const { mediaStream } = useCameraState();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const faceApiRef = useRef<FaceApiModule | null>(null);
  const consecutiveConfusionCount = useRef(0);
  const onConfusedRef = useRef(onConfused);

  // Update the ref when onConfused changes
  useEffect(() => {
    onConfusedRef.current = onConfused;
  }, [onConfused]);

  // Load models on mount
  useEffect(() => {
    if (!enabled || isModelsLoaded) return;
    let isMounted = true;

    const loadModels = async () => {
      try {
        const faceapi = await import("face-api.js");
        faceApiRef.current = faceapi;

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);
        if (isMounted) {
          setIsModelsLoaded(true);
          console.log("Face-api models loaded successfully");
        }
      } catch (err) {
        console.error("Failed to load face-api models:", err);
      }
    };

    loadModels();

    return () => {
      isMounted = false;
    };
  }, [enabled, isModelsLoaded]);

  // Sync media stream to hidden video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream || null;
    }
  }, [mediaStream]);

  // Detection loop
  useEffect(() => {
    if (!isModelsLoaded || !enabled || !mediaStream) return;

    const runDetection = async () => {
      const faceapi = faceApiRef.current;
      if (!faceapi || !videoRef.current || videoRef.current.readyState !== 4) {
        return;
      }

      try {
        const detections = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions(),
          )
          .withFaceExpressions();

        if (detections) {
          const expressions = detections.expressions;

          const sorted = Object.entries(expressions).sort(
            (a, b) => b[1] - a[1],
          );
          const dominant = sorted[0][0];
          setCurrentEmotion(dominant);

          const confusionScore =
            expressions.sad + expressions.fearful + expressions.angry;

          if (confusionScore > 0.5) {
            consecutiveConfusionCount.current += 1;

            if (consecutiveConfusionCount.current >= 3) {
              onConfusedRef.current();
              consecutiveConfusionCount.current = 0;
            }
          } else {
            consecutiveConfusionCount.current = 0;
          }
        }
      } catch (err) {
        console.error("Error during face detection:", err);
      }
    };

    const intervalId = setInterval(runDetection, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isModelsLoaded, enabled, mediaStream]);

  return { videoRef, isModelsLoaded, currentEmotion };
};
