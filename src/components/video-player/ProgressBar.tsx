"use client";

import { useRef, useCallback } from "react";
import type { Breakpoint } from "@/lib/types";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  breakpoints: Breakpoint[];
  breakpointsCleared: boolean[];
  onSeek: (seconds: number) => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = String(s % 60).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export default function ProgressBar({
  currentTime,
  duration,
  breakpoints,
  breakpointsCleared,
  onSeek,
}: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Guard against 0-duration before the video is ready
  const safeDuration = duration > 0 ? duration : 1;
  const progress = Math.min((currentTime / safeDuration) * 100, 100);

  const getSeekSeconds = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      return ratio * safeDuration;
    },
    [safeDuration]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onSeek(getSeekSeconds(e.clientX));
    },
    [getSeekSeconds, onSeek]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 30 : 5;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onSeek(Math.min(currentTime + step, safeDuration));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSeek(Math.max(currentTime - step, 0));
      }
    },
    [currentTime, safeDuration, onSeek]
  );

  /**
   * Determine diamond fill/stroke for a breakpoint marker.
   *   cleared  → success green (solid)
   *   current  → warning yellow (solid) — the first uncleared checkpoint
   *   upcoming → muted outline only
   */
  const getMarkerStyle = (index: number): { fill: string; stroke: string } => {
    if (breakpointsCleared[index]) {
      return { fill: "#00b894", stroke: "#00b894" };
    }
    const firstUncleared = breakpointsCleared.findIndex((c) => !c);
    if (firstUncleared === index) {
      return { fill: "#fdcb6e", stroke: "#fdcb6e" };
    }
    return { fill: "transparent", stroke: "#6b6b8d" };
  };

  return (
    <div className="flex flex-col gap-1.5 w-full select-none">
      {/* Seekable track */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={Math.floor(safeDuration)}
        aria-valuenow={Math.floor(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(safeDuration)}`}
        tabIndex={0}
        className="relative h-8 flex items-center cursor-pointer group outline-none"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Rail */}
        <div className="relative w-full h-1.5 rounded-full bg-border overflow-hidden">
          {/* Filled portion */}
          <div
            className="absolute left-0 top-0 h-full bg-primary"
            style={{ width: `${progress}%` }}
          />

          {/* Breakpoint segments */}
          {breakpoints.map((bp, i) => {
            const currentPct = (bp.timestamp / safeDuration) * 100;
            const prevPct = i === 0 ? 0 : (breakpoints[i - 1].timestamp / safeDuration) * 100;
            const widthPct = currentPct - prevPct;
            const { fill, stroke } = getMarkerStyle(i);
            const isFirstUncleared = breakpointsCleared.findIndex((c) => !c) === i;
            
            return (
              <div
                key={i}
                className="absolute top-0 h-full border-r-2 border-background/50 transition-all duration-300"
                style={{ 
                  left: `${prevPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: fill === "transparent" ? "transparent" : fill,
                  opacity: fill === "transparent" ? 1 : 0.85,
                  boxShadow: isFirstUncleared ? `inset 0 0 8px 2px ${fill}` : "none",
                  cursor: "pointer"
                }}
                title={bp.topic}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(bp.timestamp);
                }}
              />
            );
          })}
        </div>

        {/* Playhead thumb — appears on hover/focus outside the overflow-hidden rail */}
        <div
          className="
            absolute top-1/2 -translate-y-1/2 -translate-x-1/2
            w-3.5 h-3.5 rounded-full bg-primary-light
            shadow-[0_0_8px_rgba(162,155,254,0.65)]
            border-2 border-primary
            opacity-0 group-hover:opacity-100 group-focus:opacity-100
            transition-opacity duration-150 pointer-events-none z-20
          "
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Time stamps + checkpoint counter */}
      <div className="flex justify-between items-center px-0.5">
        <span className="text-xs text-muted tabular-nums font-mono">
          {formatTime(currentTime)}
        </span>

        {breakpoints.length > 0 && (
          <span className="text-xs text-muted">
            {breakpointsCleared.filter(Boolean).length}&nbsp;/&nbsp;{breakpoints.length} checkpoints
          </span>
        )}

        <span className="text-xs text-muted tabular-nums font-mono">
          {formatTime(safeDuration)}
        </span>
      </div>
    </div>
  );
}
