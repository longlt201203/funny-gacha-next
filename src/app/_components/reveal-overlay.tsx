"use client";

import { useEffect, useRef, useState } from "react";
import type { PullResult } from "@/lib/gacha";
import { RevealCard } from "./reveal-card";
import { RevealFeaturedIntro } from "./reveal-featured-intro";
import {
  animateCardExit,
  animateItemReveal,
  animateRevealEntrance,
} from "./reveal-animation";

// Fixed layouts for the S-tier reveal particles (kept out of render so it stays pure).
const S_PARTICLE_COLORS = [
  "bg-amber-200 shadow-[0_0_12px_rgba(253,224,71,0.95)]",
  "bg-yellow-100 shadow-[0_0_12px_rgba(254,249,195,0.95)]",
  "bg-orange-300 shadow-[0_0_12px_rgba(251,146,60,0.9)]",
  "bg-pink-300 shadow-[0_0_12px_rgba(244,114,182,0.9)]",
  "bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]",
];
const S_PARTICLES = Array.from({ length: 36 }, (_, index) => ({
  color: S_PARTICLE_COLORS[index % S_PARTICLE_COLORS.length],
  size: 4 + (index % 4) * 3,
}));
const S_FLOAT_SPARKS = Array.from({ length: 16 }, (_, index) => ({
  left: 3 + index * 6,
  size: 3 + (index % 3) * 2,
  delay: (index * 470) % 3600,
}));

const REVEAL_TILT_MAX_DEG = 12;

/**
 * Full-screen reveal of one pulled item at a time. Clicking plays the card's exit (when another item
 * follows) and then calls `onAdvance`; the parent decides what comes next.
 */
export function RevealOverlay({
  item,
  hasMore,
  onAdvance,
  onSkip,
}: {
  item: PullResult;
  hasMore: boolean;
  onAdvance: () => void;
  onSkip: () => void;
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isS = item.rarity === 5;
  const featured = isS && item.featured;

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const anime = await import("animejs");
      if (!disposed && modalRef.current) {
        animateRevealEntrance(anime, modalRef.current);
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const anime = await import("animejs");
      if (disposed || !cardRef.current) {
        return;
      }

      if (tiltRef.current) {
        tiltRef.current.style.transform = "";
        tiltRef.current.style.setProperty("--tilt-glare", "0");
      }
      animateItemReveal(
        anime,
        {
          overlay: overlayRef.current,
          modal: modalRef.current,
          card: cardRef.current,
        },
        item,
      );
    })();

    return () => {
      disposed = true;
    };
  }, [item]);

  const handleClick = async () => {
    if (isAnimating) {
      return;
    }
    if (hasMore && cardRef.current) {
      setIsAnimating(true);
      const anime = await import("animejs");
      animateCardExit(anime, cardRef.current);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 230);
      });
      setIsAnimating(false);
    }
    onAdvance();
  };

  // S cards lean toward the cursor; written straight to the DOM so pointer moves don't re-render.
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const tilt = tiltRef.current;
    const bounds = modalRef.current?.getBoundingClientRect();
    if (
      !tilt ||
      !bounds ||
      !isS ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    tilt.style.transform = `perspective(1200px) rotateX(${(0.5 - y) * 2 * REVEAL_TILT_MAX_DEG}deg) rotateY(${(x - 0.5) * 2 * REVEAL_TILT_MAX_DEG}deg)`;
    tilt.style.setProperty("--tilt-x", `${x * 100}%`);
    tilt.style.setProperty("--tilt-y", `${y * 100}%`);
    tilt.style.setProperty("--tilt-glare", "1");
  };

  const resetTilt = () => {
    const tilt = tiltRef.current;
    if (tilt) {
      tilt.style.transform = "";
      tilt.style.setProperty("--tilt-glare", "0");
    }
  };

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-40 flex cursor-pointer items-center justify-center overflow-hidden p-4 ${
        featured
          ? "bg-[radial-gradient(circle_at_center,#451a03_0%,#1c1917_45%,#030712_85%)]"
          : isS
            ? "bg-[radial-gradient(circle_at_center,#78350f_0%,#1c1917_45%,#09090b_85%)]"
            : "bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_70%)]"
      }`}
      onClick={() => void handleClick()}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
    >
      {featured ? <RevealFeaturedIntro /> : null}
      {isS ? (
        <>
          {featured ? null : (
            <div
              data-s-fx="screen-flash"
              className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle,#fffbeb_0%,rgba(253,224,71,0.9)_35%,rgba(251,146,60,0.45)_100%)] opacity-0"
            />
          )}
          {S_FLOAT_SPARKS.map((spark) => (
            <span
              key={spark.left}
              className="pointer-events-none absolute bottom-0 rounded-full bg-amber-200 opacity-0 shadow-[0_0_10px_rgba(253,224,71,0.9)] motion-safe:animate-s-float"
              style={{
                left: `${spark.left}%`,
                width: spark.size,
                height: spark.size,
                animationDelay: `${spark.delay}ms`,
              }}
            />
          ))}
        </>
      ) : null}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSkip();
        }}
        className="absolute right-6 top-6 z-20 rounded-lg border border-rose-300/70 bg-rose-500/25 px-4 py-1.5 text-sm font-bold tracking-wide text-rose-100 transition hover:bg-rose-500/40"
      >
        Skip
      </button>

      <div
        ref={modalRef}
        className="pointer-events-none relative w-full max-w-5xl will-change-transform"
      >
        {isS ? (
          <>
            {featured ? null : (
              /* Outer wrapper is animated by animejs; the inner layer spins via CSS so the transforms don't fight. */
              <div
                data-s-fx="rays"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[124vmax] w-[124vmax] -translate-x-1/2 -translate-y-1/2 opacity-0"
              >
                <div className="h-full w-full rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(253,224,71,0.32)_0deg_5deg,transparent_5deg_15deg)] mask-[radial-gradient(closest-side,black_15%,transparent_97%)] motion-safe:animate-s-spin" />
              </div>
            )}
            <div
              data-s-fx="backdrop-pulse"
              className={`pointer-events-none absolute inset-[-15%] rounded-full opacity-0 ${
                featured
                  ? "bg-[radial-gradient(circle,rgba(255,251,235,0.75)_0%,rgba(253,224,71,0.55)_25%,rgba(245,158,11,0.35)_48%,rgba(15,23,42,0)_72%)]"
                  : "bg-[radial-gradient(circle,rgba(251,191,36,0.6)_0%,rgba(244,114,182,0.3)_35%,rgba(15,23,42,0)_70%)]"
              }`}
            />
            {featured ? null : (
              <>
                {[0, 1, 2].map((ring) => (
                  <div
                    key={ring}
                    data-s-fx="ring"
                    className="pointer-events-none absolute left-1/2 top-1/2 ml-[-30vmin] mt-[-30vmin] h-[60vmin] w-[60vmin] rounded-full border-4 border-amber-200/90 opacity-0 shadow-[0_0_40px_rgba(253,224,71,0.8),inset_0_0_40px_rgba(253,224,71,0.6)]"
                  />
                ))}
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-20">
                  {S_PARTICLES.map((particle, index) => (
                    <span
                      key={index}
                      data-s-fx="particle"
                      className={`absolute -ml-1 -mt-1 rounded-full opacity-0 ${particle.color}`}
                      style={{
                        width: particle.size,
                        height: particle.size,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}
        {/* Separate wrapper for the cursor tilt, so it never fights the animejs transforms on the card. */}
        <div
          ref={tiltRef}
          className="relative transition-transform duration-200 ease-out will-change-transform"
        >
          <RevealCard ref={cardRef} item={item} featured={featured} />
        </div>
      </div>
    </div>
  );
}
