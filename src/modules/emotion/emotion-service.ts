import * as faceapi from '@vladmandic/face-api';

export async function loadModels(publicPath: string = '/models') {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(publicPath),
    faceapi.nets.faceExpressionNet.loadFromUri(publicPath)
  ]);
}

export async function detectEmotion(videoElement: HTMLVideoElement) {
  if (!videoElement) return null;

  const detections = await faceapi.detectAllFaces(
    videoElement,
    new faceapi.TinyFaceDetectorOptions()
  ).withFaceExpressions();

  return detections;
}
