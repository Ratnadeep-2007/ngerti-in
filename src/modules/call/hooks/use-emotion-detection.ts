"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { useCallStateHooks } from "@stream-io/video-react-sdk";

interface EmotionDetectionResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isModelsLoaded: boolean;
  currentEmotion: string | null;
}

export const useEmotionDetection = (
  onConfused: () => void,
  enabled: boolean = true,
): EmotionDetectionResult => {
  const { useCameraState } = useCallStateHooks();
  const { mediaStream } = useCameraState();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  
  const consecutiveConfusionCount = useRef(0);
  const onConfusedRef = useRef(onConfused);

  // Update the ref when onConfused changes
  useEffect(() => {
    onConfusedRef.current = onConfused;
  }, [onConfused]);

  // Load models on mount
  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      try {
        // Models are served from public/models
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
  }, []);

  // Sync media stream to hidden video element
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  // Detection loop
  useEffect(() => {
    if (!isModelsLoaded || !enabled || !mediaStream) return;

    const runDetection = async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;

      try {
        const detections = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions(),
          )
          .withFaceExpressions();

        if (detections) {
          const expressions = detections.expressions;
          
          // Find dominant emotion
          const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
          const dominant = sorted[0][0];
          setCurrentEmotion(dominant);

          // Logic for confusion: high sadness, fear, or frustration (angry)
          // We trigger if negative emotions are high
          const confusionScore = expressions.sad + expressions.fearful + expressions.angry;
          
          if (confusionScore > 0.5) {
            consecutiveConfusionCount.current += 1;
            
            // Trigger after ~6 seconds of consistent confusion (3 frames * 2s)
            if (consecutiveConfusionCount.current >= 3) {
              console.log("Proactive confusion detected, triggering intervention...");
              onConfusedRef.current();
              consecutiveConfusionCount.current = 0; // Reset after trigger
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
