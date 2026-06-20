"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { FocusEvaluation, FocusMetricSample } from "@/lib/types";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SAMPLE_INTERVAL_MS = 120;
const DISTRACTION_THRESHOLD_MS = 4000;
const DISTRACTION_MIN_FACE_FOCUS = 0.55;
const DISTRACTION_HEAD_DRIFT_X = 0.22;
const DISTRACTION_HEAD_DRIFT_Y = 0.18;
const DISTRACTION_HEAD_DRIFT_Z = 0.18;
const DISTRACTION_VARIANCE_THRESHOLD = 0.012;
const MEDIAPIPE_BANNER = "Created TensorFlow Lite XNNPACK delegate for CPU.";

type FaceLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => {
    faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
  };
  close?: () => void;
};

export type FaceLandmarkPoint = { x: number; y: number; z?: number };

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = average(values);
  return average(values.map((value) => (value - avg) ** 2));
}

function sampleLooksDistracted(sample: FocusMetricSample, recentSamples: FocusMetricSample[]): boolean {
  if (!sample.faceDetected) return true;

  const recentDetected = recentSamples.filter((entry) => entry.faceDetected);
  const movement = recentDetected.map((entry) => Math.abs(entry.headX) + Math.abs(entry.headY) + Math.abs(entry.headZ));
  const posture = recentDetected.map((entry) => entry.postureShift);
  const movementVariance = variance(movement);
  const postureVariance = variance(posture);

  return (
    sample.eyeFocus < DISTRACTION_MIN_FACE_FOCUS ||
    Math.abs(sample.headX) > DISTRACTION_HEAD_DRIFT_X ||
    Math.abs(sample.headY) > DISTRACTION_HEAD_DRIFT_Y ||
    Math.abs(sample.headZ) > DISTRACTION_HEAD_DRIFT_Z ||
    movementVariance > DISTRACTION_VARIANCE_THRESHOLD ||
    postureVariance > DISTRACTION_VARIANCE_THRESHOLD
  );
}

function installMediaPipeBannerFilter(): () => void {
  const originalError = console.error;
  const originalInfo = console.info;

  const shouldMute = (args: unknown[]) =>
    args.some((value) => typeof value === "string" && value.includes(MEDIAPIPE_BANNER));

  console.error = (...args: unknown[]) => {
    if (shouldMute(args)) return;
    originalError(...args);
  };
  console.info = (...args: unknown[]) => {
    if (shouldMute(args)) return;
    originalInfo(...args);
  };

  return () => {
    console.error = originalError;
    console.info = originalInfo;
  };
}

function buildEvaluation(
  startedAt: string,
  permission: FocusEvaluation["permission"],
  samples: FocusMetricSample[]
): FocusEvaluation {
  if (permission !== "granted" || samples.length === 0) {
    return {
      startedAt,
      endedAt: new Date().toISOString(),
      permission,
      sampleCount: 0,
      facePresenceRatio: 0,
      focusScore: 0,
      calmnessScore: 0,
      postureScore: 0,
      fidgetingVariance: 0,
      gazeWanderingRatio: 0,
      bodyMovementVariance: 0,
    };
  }

  const detected = samples.filter((sample) => sample.faceDetected);
  const movement = detected.map((sample) => Math.abs(sample.headX) + Math.abs(sample.headY) + Math.abs(sample.headZ));
  const posture = detected.map((sample) => sample.postureShift);
  const eyeFocusValues = detected.map((sample) => sample.eyeFocus);
  const fidgetingVariance = variance(movement);
  const bodyMovementVariance = variance(posture);
  const gazeWanderingRatio = detected.filter((sample) => sample.eyeFocus < 0.55).length / Math.max(1, detected.length);
  const facePresenceRatio = detected.length / samples.length;
  const focusScore = clampPercent(facePresenceRatio * average(eyeFocusValues) * 100);
  const calmnessScore = clampPercent(100 - Math.min(100, fidgetingVariance * 900));
  const postureScore = clampPercent(100 - Math.min(100, bodyMovementVariance * 1200));

  return {
    startedAt,
    endedAt: new Date().toISOString(),
    permission,
    sampleCount: samples.length,
    facePresenceRatio,
    focusScore,
    calmnessScore,
    postureScore,
    fidgetingVariance,
    gazeWanderingRatio,
    bodyMovementVariance,
  };
}

function sampleFromLandmarks(
  timestampMs: number,
  landmarks: Array<{ x: number; y: number; z?: number }> | undefined,
  previous: FocusMetricSample | null
): FocusMetricSample {
  if (!landmarks?.length) {
    return {
      timestampMs,
      faceDetected: false,
      headX: 0,
      headY: 0,
      headZ: 0,
      eyeFocus: 0,
      postureShift: 0,
    };
  }

  const nose = landmarks[1] ?? landmarks[0];
  const leftEye = landmarks[33] ?? landmarks[0];
  const rightEye = landmarks[263] ?? landmarks[landmarks.length - 1] ?? landmarks[0];
  const eyeDistance = Math.abs((rightEye?.x ?? 0.5) - (leftEye?.x ?? 0.5));
  const headX = (nose?.x ?? 0.5) - 0.5;
  const headY = (nose?.y ?? 0.5) - 0.5;
  const headZ = (nose?.z ?? 0) + eyeDistance;
  const centerDrift = Math.abs(headX) * 1.8 + Math.abs(headY) * 1.4;
  const eyeFocus = Math.max(0, Math.min(1, 1 - centerDrift));
  const postureShift = previous?.faceDetected
    ? Math.abs(headX - previous.headX) + Math.abs(headY - previous.headY) + Math.abs(headZ - previous.headZ)
    : 0;

  return {
    timestampMs,
    faceDetected: true,
    headX,
    headY,
    headZ,
    eyeFocus,
    postureShift,
  };
}

export function useFocusTracker() {
  const startedAtRef = useRef(new Date().toISOString());
  const permissionRef = useRef<FocusEvaluation["permission"]>("unavailable");
  const samplesRef = useRef<FocusMetricSample[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef(0);
  const hasStartedRef = useRef(false);
  const hasShownToastRef = useRef(false);
  const distractionSinceRef = useRef<number | null>(null);
  const distractionToastShownRef = useRef(false);
  const restoreConsoleRef = useRef<(() => void) | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [latestFaceLandmarks, setLatestFaceLandmarks] = useState<FaceLandmarkPoint[] | null>(null);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    startedAtRef.current = new Date().toISOString();

    if (!navigator.mediaDevices?.getUserMedia) {
      permissionRef.current = "unavailable";
      return;
    }

    restoreConsoleRef.current = installMediaPipeBannerFilter();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      permissionRef.current = "granted";
      streamRef.current = stream;
      setPreviewStream(stream);

      if (!hasShownToastRef.current) {
        toast.success("Camera is on");
        hasShownToastRef.current = true;
      }

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      videoRef.current = video;

      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 1,
      }) as FaceLandmarkerInstance;

      const tick = () => {
        const now = performance.now();
        const videoEl = videoRef.current;
        const landmarker = landmarkerRef.current;

        if (
          videoEl &&
          videoEl.readyState >= 2 &&
          videoEl.videoWidth > 0 &&
          videoEl.videoHeight > 0 &&
          landmarker &&
          now - lastSampleAtRef.current >= SAMPLE_INTERVAL_MS
        ) {
          lastSampleAtRef.current = now;
          try {
            const result = landmarker.detectForVideo(videoEl, now);
            const previous = samplesRef.current[samplesRef.current.length - 1] ?? null;
            const faceLandmarks = result.faceLandmarks?.[0] ?? null;
            setLatestFaceLandmarks(faceLandmarks);
            const nextSample = sampleFromLandmarks(now, faceLandmarks ?? undefined, previous);
            samplesRef.current.push(nextSample);

            const recentSamples = samplesRef.current.slice(-Math.ceil(DISTRACTION_THRESHOLD_MS / SAMPLE_INTERVAL_MS));
            const isDistracted = sampleLooksDistracted(nextSample, recentSamples);

            if (isDistracted) {
              if (distractionSinceRef.current === null) {
                distractionSinceRef.current = now;
              }

              if (
                !distractionToastShownRef.current &&
                distractionSinceRef.current !== null &&
                now - distractionSinceRef.current >= DISTRACTION_THRESHOLD_MS
              ) {
                toast.warning("You are distracted");
                distractionToastShownRef.current = true;
              }
            } else {
              distractionSinceRef.current = null;
              distractionToastShownRef.current = false;
            }
          } catch {
            // MediaPipe can throw while the camera is warming up; skip that frame.
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      permissionRef.current = "denied";
      restoreConsoleRef.current?.();
      restoreConsoleRef.current = null;
      setPreviewStream(null);
    }
  }, []);

  const stopAndEvaluate = useCallback((): FocusEvaluation => {
    stopLoop();
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRef.current = null;
    setPreviewStream(null);
    setLatestFaceLandmarks(null);
    restoreConsoleRef.current?.();
    restoreConsoleRef.current = null;

    return buildEvaluation(startedAtRef.current, permissionRef.current, samplesRef.current);
  }, [stopLoop]);

  return { start, stopAndEvaluate, previewStream, latestFaceLandmarks };
}
