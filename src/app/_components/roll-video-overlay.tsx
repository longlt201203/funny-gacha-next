"use client";

import { useEffect, useRef } from "react";

/** Full-screen roll video played before the reveal. `volume` is normalized to 0–1. */
export function RollVideoOverlay({
  src,
  hasS,
  volume,
  muted,
  onFinish,
}: {
  src: string;
  hasS: boolean;
  volume: number;
  muted: boolean;
  onFinish: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume, src]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black p-4">
      <div className="relative w-full max-w-5xl">
        {hasS ? (
          // Golden ambient light spilling around the video when the pull contains an S.
          // Softened with gradients/masks, not `blur()`: a blur on a spinning layer is re-run every frame.
          <>
            <div className="pointer-events-none absolute inset-[-14%] rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(253,224,71,0.55),rgba(245,158,11,0.3)_45%,transparent_72%)] motion-safe:animate-pulse" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[125%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(253,224,71,0.6),transparent_28%,rgba(251,146,60,0.5),transparent_58%,rgba(254,240,138,0.6),transparent_85%)] opacity-60 mask-[radial-gradient(closest-side,black_35%,transparent)] motion-safe:animate-s-spin" />
          </>
        ) : null}
        <video
          ref={videoRef}
          key={src}
          src={src}
          className={`relative h-auto w-full rounded-2xl border ${
            hasS
              ? "border-amber-200/70 shadow-[0_0_80px_rgba(253,224,71,0.45),0_0_160px_rgba(245,158,11,0.3)]"
              : "border-white/40 shadow-[0_0_60px_rgba(255,255,255,0.15)]"
          }`}
          autoPlay
          playsInline
          muted={muted}
          onEnded={onFinish}
          onError={onFinish}
        />
        <button
          type="button"
          onClick={onFinish}
          className="absolute right-4 top-4 rounded-lg border border-white/40 bg-black/70 px-3 py-1 text-sm font-semibold text-white transition hover:bg-black"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
