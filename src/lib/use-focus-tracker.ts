"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { FocusEvaluation, FocusMetricSample } from "@/lib/types";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const SAMPLE_INTERVAL_MS = 80;
const CALIBRATION_WINDOW_MS = 2400;
const FACE_LOST_GRACE_MS = 1200;
const DISTRACTION_RESET_MS = 900;
const DISTRACTION_REPEAT_MS = 3000;
const DISTRACTION_SCORE_THRESHOLD = 0.58;
const DISTRACTION_MESSAGES = [
  { afterMs: 4000, message: "Please look at the screen." },
  { afterMs: 7000, message: "Please concentrate on the screen." },
  { afterMs: 10000, message: "Stay with the lesson." },
  { afterMs: 14000, message: "You are still distracted." },
] as const;

const MEDIAPIPE_BANNER = "Created TensorFlow Lite XNNPACK delegate for CPU.";

type Matrix = {
  rows: number;
  columns: number;
  data: number[];
};

type FaceLandmarkerResult = {
  faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
  facialTransformationMatrixes?: Matrix[];
};

type FaceLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerResult;
  close?: () => void;
};

export type FaceLandmarkPoint = { x: number; y: number; z?: number };

type PoseSnapshot = {
  yaw: number;
  pitch: number;
  roll: number;
  tx: number;
  ty: number;
  tz: number;
  available: boolean;
};

type CalibrationSnapshot = {
  centerX: number;
  centerY: number;
  faceScale: number;
  gazeX: number;
  gazeY: number;
  yaw: number;
  pitch: number;
  roll: number;
  motionEnergy: number;
  eyeFocus: number;
};

type MetricBundle = {
  sample: FocusMetricSample;
  distractionScore: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampPercent(value: number): number {
  return Math.round(clamp01(value / 100) * 100);
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

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function distance(
  left: { x: number; y: number; z?: number },
  right: { x: number; y: number; z?: number }
): number {
  const dx = (left.x ?? 0) - (right.x ?? 0);
  const dy = (left.y ?? 0) - (right.y ?? 0);
  const dz = (left.z ?? 0) - (right.z ?? 0);
  return Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
}

function getPoint(
  landmarks: Array<{ x: number; y: number; z?: number }>,
  index: number
): { x: number; y: number; z?: number } {
  return landmarks[index] ?? landmarks[0] ?? { x: 0.5, y: 0.5, z: 0 };
}

function meanPoint(
  landmarks: Array<{ x: number; y: number; z?: number }>,
  indexes: number[]
): { x: number; y: number; z: number } {
  const points = indexes.map((index) => getPoint(landmarks, index));
  return {
    x: average(points.map((point) => point.x)),
    y: average(points.map((point) => point.y)),
    z: average(points.map((point) => point.z ?? 0)),
  };
}

function matrixToPose(matrix?: Matrix): PoseSnapshot {
  if (!matrix || matrix.rows < 4 || matrix.columns < 4 || matrix.data.length < 16) {
    return {
      yaw: 0,
      pitch: 0,
      roll: 0,
      tx: 0,
      ty: 0,
      tz: 0,
      available: false,
    };
  }

  const values = matrix.data;
  const r00 = values[0];
  const r01 = values[1];
  const r20 = values[8];
  const r21 = values[9];
  const r22 = values[10];

  return {
    yaw: Math.atan2(r20, r22),
    pitch: Math.atan2(-r21, Math.sqrt(r20 * r20 + r22 * r22)),
    roll: Math.atan2(r01, r00),
    tx: values[12] ?? 0,
    ty: values[13] ?? 0,
    tz: values[14] ?? 0,
    available: true,
  };
}

function extractEyeRegion(
  landmarks: Array<{ x: number; y: number; z?: number }>,
  isLeft: boolean
): {
  center: { x: number; y: number; z: number };
  width: number;
  height: number;
  irisCenter?: { x: number; y: number; z: number };
} {
  const eyeIndexes = isLeft ? [33, 133, 159, 145] : [362, 263, 386, 374];
  const irisIndexes = isLeft ? [468, 469, 470, 471, 472] : [473, 474, 475, 476, 477];
  const center = meanPoint(landmarks, eyeIndexes);
  const width = distance(getPoint(landmarks, eyeIndexes[0]), getPoint(landmarks, eyeIndexes[1]));
  const height = distance(getPoint(landmarks, eyeIndexes[2]), getPoint(landmarks, eyeIndexes[3]));

  if (landmarks.length < 478) {
    return { center, width, height };
  }

  return {
    center,
    width,
    height,
    irisCenter: meanPoint(landmarks, irisIndexes),
  };
}

function buildCalibrationSnapshot(
  sample: FocusMetricSample,
  landmarks: Array<{ x: number; y: number; z?: number }>
): CalibrationSnapshot {
  const faceCenter = meanPoint(landmarks, [1, 33, 263, 61, 291, 152]);
  const faceScale = Math.max(
    0.0001,
    average([
      distance(getPoint(landmarks, 33), getPoint(landmarks, 263)),
      distance(getPoint(landmarks, 10), getPoint(landmarks, 152)),
      distance(getPoint(landmarks, 61), getPoint(landmarks, 291)),
    ])
  );

  return {
    centerX: faceCenter.x,
    centerY: faceCenter.y,
    faceScale,
    gazeX: sample.gazeOffsetX ?? 0,
    gazeY: sample.gazeOffsetY ?? 0,
    yaw: sample.poseYaw ?? 0,
    pitch: sample.posePitch ?? 0,
    roll: sample.poseRoll ?? 0,
    motionEnergy: sample.motionEnergy ?? 0,
    eyeFocus: sample.eyeFocus,
  };
}

function mergeCalibration(
  current: CalibrationSnapshot,
  next: CalibrationSnapshot
): CalibrationSnapshot {
  return {
    centerX: current.centerX * 0.7 + next.centerX * 0.3,
    centerY: current.centerY * 0.7 + next.centerY * 0.3,
    faceScale: current.faceScale * 0.8 + next.faceScale * 0.2,
    gazeX: current.gazeX * 0.75 + next.gazeX * 0.25,
    gazeY: current.gazeY * 0.75 + next.gazeY * 0.25,
    yaw: current.yaw * 0.75 + next.yaw * 0.25,
    pitch: current.pitch * 0.75 + next.pitch * 0.25,
    roll: current.roll * 0.75 + next.roll * 0.25,
    motionEnergy: current.motionEnergy * 0.8 + next.motionEnergy * 0.2,
    eyeFocus: current.eyeFocus * 0.8 + next.eyeFocus * 0.2,
  };
}

function sampleFromLandmarks(
  timestampMs: number,
  landmarks: Array<{ x: number; y: number; z?: number }> | undefined,
  previous: FocusMetricSample | null,
  calibration: CalibrationSnapshot | null,
  matrix?: Matrix
): MetricBundle {
  if (!landmarks?.length) {
    const sample: FocusMetricSample = {
      timestampMs,
      faceDetected: false,
      headX: 0,
      headY: 0,
      headZ: 0,
      eyeFocus: 0,
      postureShift: 1,
    };
    return { sample, distractionScore: 1 };
  }

  const pose = matrixToPose(matrix);
  const faceCenter = meanPoint(landmarks, [1, 33, 263, 61, 291, 152]);
  const faceScale = Math.max(
    0.0001,
    average([
      distance(getPoint(landmarks, 33), getPoint(landmarks, 263)),
      distance(getPoint(landmarks, 10), getPoint(landmarks, 152)),
      distance(getPoint(landmarks, 61), getPoint(landmarks, 291)),
    ])
  );

  const leftEye = extractEyeRegion(landmarks, true);
  const rightEye = extractEyeRegion(landmarks, false);
  const irisOffsets = [leftEye, rightEye]
    .map((eye) => {
      if (!eye.irisCenter || eye.width <= 0 || eye.height <= 0) return null;
      return {
        x: (eye.irisCenter.x - eye.center.x) / Math.max(0.0001, eye.width / 2),
        y: (eye.irisCenter.y - eye.center.y) / Math.max(0.0001, eye.height / 2),
      };
    })
    .filter((entry): entry is { x: number; y: number } => entry !== null);

  const gazeOffsetX = irisOffsets.length ? average(irisOffsets.map((entry) => entry.x)) : pose.yaw * 0.85;
  const gazeOffsetY = irisOffsets.length ? average(irisOffsets.map((entry) => entry.y)) : pose.pitch * 0.9;

  const baseline = calibration;
  const centerX = baseline ? (faceCenter.x - baseline.centerX) / Math.max(0.0001, baseline.faceScale) : faceCenter.x - 0.5;
  const centerY = baseline ? (faceCenter.y - baseline.centerY) / Math.max(0.0001, baseline.faceScale) : faceCenter.y - 0.5;
  const centerZ = baseline ? (faceCenter.z - 0) / Math.max(0.0001, baseline.faceScale) : 0;

  const yaw = baseline ? pose.yaw - baseline.yaw : pose.yaw;
  const pitch = baseline ? pose.pitch - baseline.pitch : pose.pitch;
  const roll = baseline ? pose.roll - baseline.roll : pose.roll;
  const motionEnergy = previous?.faceDetected
    ? Math.abs(centerX - previous.headX) +
      Math.abs(centerY - previous.headY) +
      Math.abs(centerZ - previous.headZ) +
      Math.abs(yaw - (previous.poseYaw ?? 0)) +
      Math.abs(pitch - (previous.posePitch ?? 0)) +
      Math.abs(roll - (previous.poseRoll ?? 0))
    : 0;

  const eyeFocus = clamp01(
    1 -
      (Math.min(1, Math.abs(gazeOffsetX) / 0.55) * 0.45 +
        Math.min(1, Math.abs(gazeOffsetY) / 0.45) * 0.35 +
        Math.min(1, Math.abs(yaw) / 0.35) * 0.12 +
        Math.min(1, Math.abs(pitch) / 0.28) * 0.08)
  );

  const postureShift = previous?.faceDetected
    ? Math.abs(centerX - previous.headX) +
      Math.abs(centerY - previous.headY) +
      Math.abs(yaw - (previous.poseYaw ?? 0)) +
      Math.abs(pitch - (previous.posePitch ?? 0))
    : 0;

  const sample: FocusMetricSample = {
    timestampMs,
    faceDetected: true,
    headX: centerX,
    headY: centerY,
    headZ: centerZ,
    eyeFocus,
    postureShift,
    poseYaw: yaw,
    posePitch: pitch,
    poseRoll: roll,
    gazeOffsetX,
    gazeOffsetY,
    motionEnergy,
    faceScale,
  };

  const posePenalty = Math.min(1, Math.abs(yaw) / 0.45) * 0.35 + Math.min(1, Math.abs(pitch) / 0.35) * 0.3;
  const gazePenalty = Math.min(1, Math.hypot(gazeOffsetX, gazeOffsetY) / 0.75) * 0.35;
  const motionPenalty = Math.min(1, motionEnergy / 0.12) * 0.2;
  const distractionScore = clamp01(posePenalty + gazePenalty + motionPenalty);

  return { sample, distractionScore };
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
      attentionScore: 0,
    };
  }

  const detected = samples.filter((sample) => sample.faceDetected);
  const facePresenceRatio = detected.length / samples.length;
  const focusScores = detected.map((sample) => sample.eyeFocus);
  const movement = detected.map((sample) => Math.abs(sample.headX) + Math.abs(sample.headY) + Math.abs(sample.headZ));
  const posture = detected.map((sample) => sample.postureShift);
  const attentionScores = detected.map((sample) => {
    const posePenalty = Math.min(1, Math.abs(sample.poseYaw ?? 0) / 0.45) * 0.35 + Math.min(1, Math.abs(sample.posePitch ?? 0) / 0.35) * 0.3;
    const gazePenalty = Math.min(1, Math.hypot(sample.gazeOffsetX ?? 0, sample.gazeOffsetY ?? 0) / 0.75) * 0.35;
    const motionPenalty = Math.min(1, (sample.motionEnergy ?? 0) / 0.12) * 0.2;
    return clamp01(1 - (posePenalty + gazePenalty + motionPenalty));
  });
  const fidgetingVariance = variance(movement);
  const bodyMovementVariance = variance(posture);
  const gazeWanderingRatio = detected.filter((sample) => sample.eyeFocus < 0.62).length / Math.max(1, detected.length);
  const focusScore = clampPercent(facePresenceRatio * average(focusScores) * 100);
  const calmnessScore = clampPercent(100 - Math.min(100, fidgetingVariance * 850));
  const postureScore = clampPercent(100 - Math.min(100, bodyMovementVariance * 1000));
  const attentionScore = clampPercent(average(attentionScores) * 100);

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
    attentionScore,
  };
}

export function useFocusTracker() {
  const startedAtRef = useRef(new Date().toISOString());
  const permissionRef = useRef<FocusEvaluation["permission"]>("unavailable");
  const samplesRef = useRef<FocusMetricSample[]>([]);
  const calibrationSamplesRef = useRef<CalibrationSnapshot[]>([]);
  const calibrationRef = useRef<CalibrationSnapshot | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef(0);
  const startedAtPerfRef = useRef(0);
  const hasStartedRef = useRef(false);
  const hasShownToastRef = useRef(false);
  const distractionSinceRef = useRef<number | null>(null);
  const distractionStageRef = useRef<number>(-1);
  const lastToastAtRef = useRef(0);
  const lastFaceSeenAtRef = useRef(0);
  const restoreConsoleRef = useRef<(() => void) | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [latestFaceLandmarks, setLatestFaceLandmarks] = useState<FaceLandmarkPoint[] | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isDistracted, setIsDistracted] = useState(false);
  const [latestSample, setLatestSample] = useState<FocusMetricSample | null>(null);

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
    startedAtPerfRef.current = performance.now();
    calibrationRef.current = null;
    calibrationSamplesRef.current = [];
    samplesRef.current = [];
    distractionSinceRef.current = null;
    distractionStageRef.current = -1;
    lastToastAtRef.current = 0;
    lastFaceSeenAtRef.current = 0;

    if (!navigator.mediaDevices?.getUserMedia) {
      permissionRef.current = "unavailable";
      return;
    }

    restoreConsoleRef.current = installMediaPipeBannerFilter();

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      permissionRef.current = "granted";
      streamRef.current = cameraStream;
      setPreviewStream(cameraStream);
      setStream(cameraStream);

      if (!hasShownToastRef.current) {
        toast.success("Camera is on");
        hasShownToastRef.current = true;
      }

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = cameraStream;
      await video.play();
      videoRef.current = video;

      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      landmarkerRef.current = (await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputFacialTransformationMatrixes: true,
      })) as FaceLandmarkerInstance;

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
            const matrix = result.facialTransformationMatrixes?.[0];

            setLatestFaceLandmarks(faceLandmarks);

            const bundle = sampleFromLandmarks(
              now,
              faceLandmarks ?? undefined,
              previous,
              calibrationRef.current,
              matrix
            );
            const sample = bundle.sample;
            const distractionScore = bundle.distractionScore;

            if (sample.faceDetected) {
              lastFaceSeenAtRef.current = now;
            }

            if (!calibrationRef.current && sample.faceDetected) {
              calibrationSamplesRef.current.push(buildCalibrationSnapshot(sample, faceLandmarks ?? []));
              if (
                now - startedAtPerfRef.current >= CALIBRATION_WINDOW_MS ||
                calibrationSamplesRef.current.length >= 16
              ) {
                const samples = calibrationSamplesRef.current;
                if (samples.length > 0) {
                  calibrationRef.current = {
                    centerX: median(samples.map((entry) => entry.centerX)),
                    centerY: median(samples.map((entry) => entry.centerY)),
                    faceScale: Math.max(0.0001, median(samples.map((entry) => entry.faceScale))),
                    gazeX: median(samples.map((entry) => entry.gazeX)),
                    gazeY: median(samples.map((entry) => entry.gazeY)),
                    yaw: median(samples.map((entry) => entry.yaw)),
                    pitch: median(samples.map((entry) => entry.pitch)),
                    roll: median(samples.map((entry) => entry.roll)),
                    motionEnergy: median(samples.map((entry) => entry.motionEnergy)),
                    eyeFocus: median(samples.map((entry) => entry.eyeFocus)),
                  };
                }
              }
            }

            if (calibrationRef.current && sample.faceDetected && distractionScore < 0.35) {
              calibrationRef.current = mergeCalibration(
                calibrationRef.current,
                buildCalibrationSnapshot(sample, faceLandmarks ?? [])
              );
            }

            samplesRef.current.push(sample);
            if (samplesRef.current.length > 1200) {
              samplesRef.current = samplesRef.current.slice(-900);
            }

            setLatestSample(sample);

            const recentScores = samplesRef.current.slice(-8).map((entry) => {
              if (!entry.faceDetected) return 1;
              const posePenalty = Math.min(1, Math.abs(entry.poseYaw ?? 0) / 0.45) * 0.35 + Math.min(1, Math.abs(entry.posePitch ?? 0) / 0.35) * 0.3;
              const gazePenalty = Math.min(1, Math.hypot(entry.gazeOffsetX ?? 0, entry.gazeOffsetY ?? 0) / 0.75) * 0.35;
              const motionPenalty = Math.min(1, (entry.motionEnergy ?? 0) / 0.12) * 0.2;
              return clamp01(posePenalty + gazePenalty + motionPenalty);
            });

            const smoothedDistraction = average(recentScores);
            const faceMissingFor = now - lastFaceSeenAtRef.current;
            const hasWarmupFinished = calibrationRef.current !== null;
            const isCurrentlyDistracted =
              hasWarmupFinished &&
              (smoothedDistraction >= DISTRACTION_SCORE_THRESHOLD ||
                faceMissingFor >= FACE_LOST_GRACE_MS);

            if (isCurrentlyDistracted) {
              if (distractionSinceRef.current === null) {
                distractionSinceRef.current = now;
                distractionStageRef.current = -1;
              }

              const sustainedMs = now - distractionSinceRef.current;
              const stageIndex = DISTRACTION_MESSAGES.reduce((latest, entry, index) => (
                sustainedMs >= entry.afterMs ? index : latest
              ), -1);

              if (
                stageIndex > distractionStageRef.current &&
                now - lastToastAtRef.current >= DISTRACTION_REPEAT_MS
              ) {
                toast.warning(DISTRACTION_MESSAGES[stageIndex].message);
                distractionStageRef.current = stageIndex;
                lastToastAtRef.current = now;
              }

              setIsDistracted(sustainedMs >= 1400);
            } else {
              if (
                distractionSinceRef.current !== null &&
                now - distractionSinceRef.current >= DISTRACTION_RESET_MS
              ) {
                distractionSinceRef.current = null;
                distractionStageRef.current = -1;
              }
              setIsDistracted(false);
            }
          } catch {
            // MediaPipe can throw while the camera is warming up; skip that frame.
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error("Camera startup failed", err);
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
    setStream(null);
    videoRef.current = null;
    setPreviewStream(null);
    setLatestFaceLandmarks(null);
    restoreConsoleRef.current?.();
    restoreConsoleRef.current = null;
    setIsDistracted(false);
    setLatestSample(null);
    hasStartedRef.current = false;

    return buildEvaluation(startedAtRef.current, permissionRef.current, samplesRef.current);
  }, [stopLoop]);

  return {
    start,
    stopAndEvaluate,
    previewStream,
    stream,
    isDistracted,
    latestSample,
    latestFaceLandmarks,
  };
}
