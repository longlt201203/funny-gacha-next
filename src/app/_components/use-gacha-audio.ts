"use client";

import { useEffect, useRef } from "react";
import type { PullResult } from "@/lib/gacha";
import {
  FEATURED_INTRO_MS,
  GOLDEN_SIGN_SFX,
  REVEAL_SFX_BY_RARITY,
} from "./gacha-config";

/** Golden-sign music and per-item reveal stings. `volume` is normalized to 0–1. */
export function useGachaAudio(volume: number) {
  const goldenSignAudioRef = useRef<HTMLAudioElement | null>(null);
  const goldenSignActiveRef = useRef(false);
  const revealAudioRef = useRef<Partial<Record<3 | 4 | 5, HTMLAudioElement>>>(
    {},
  );
  const delayedSfxRef = useRef<number | null>(null);

  // The golden-sign music runs from the pull click until the reveal is finished. Some browsers pause
  // one audio element when another starts (e.g. a reveal sting), so resume it unless we stopped it ourselves.
  const playGoldenSign = () => {
    if (typeof Audio === "undefined") {
      return;
    }
    let audio = goldenSignAudioRef.current;
    if (!audio) {
      const created = new Audio(GOLDEN_SIGN_SFX);
      created.loop = true;
      created.addEventListener("pause", () => {
        if (goldenSignActiveRef.current) {
          void created.play().catch(() => {
            return;
          });
        }
      });
      goldenSignAudioRef.current = created;
      audio = created;
    }
    goldenSignActiveRef.current = true;
    audio.volume = volume;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      return;
    });
  };

  const stopGoldenSign = () => {
    goldenSignActiveRef.current = false;
    const audio = goldenSignAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  const cancelDelayedSfx = () => {
    if (delayedSfxRef.current !== null) {
      window.clearTimeout(delayedSfxRef.current);
      delayedSfxRef.current = null;
    }
  };

  const playRevealSfx = (rarity: number) => {
    const resolvedRarity: 3 | 4 | 5 = rarity >= 5 ? 5 : rarity >= 4 ? 4 : 3;
    if (typeof Audio === "undefined") {
      return;
    }

    let audio = revealAudioRef.current[resolvedRarity];
    if (!audio) {
      audio = new Audio(REVEAL_SFX_BY_RARITY[resolvedRarity]);
      audio.preload = "auto";
      audio.volume = volume;
      revealAudioRef.current[resolvedRarity] = audio;
    }

    audio.volume = volume;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      return;
    });
  };

  const playItemRevealSfx = (item: PullResult) => {
    cancelDelayedSfx();
    if (item.rarity === 5 && item.featured) {
      // Hold the 5★ sting until the featured reveal's intro finishes.
      delayedSfxRef.current = window.setTimeout(
        () => playRevealSfx(5),
        FEATURED_INTRO_MS,
      );
    } else {
      playRevealSfx(item.rarity);
    }
  };

  useEffect(() => {
    if (goldenSignAudioRef.current) {
      goldenSignAudioRef.current.volume = volume;
    }
    for (const audio of Object.values(revealAudioRef.current)) {
      if (audio) {
        audio.volume = volume;
      }
    }
  }, [volume]);

  return { playGoldenSign, stopGoldenSign, playItemRevealSfx, cancelDelayedSfx };
}
