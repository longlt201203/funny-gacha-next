"use client";

import { useEffect, useState } from "react";

const SOUND_VOLUME_STORAGE_KEY = "gacha-sound-volume";
const SOUND_VOLUME_COOKIE_KEY = "gacha_sound_volume";

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=")[1] ?? "") : null;
}

function clampVolume(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function persistSoundVolume(value: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = clampVolume(value);
  window.localStorage.setItem(SOUND_VOLUME_STORAGE_KEY, String(normalized));
  document.cookie = `${SOUND_VOLUME_COOKIE_KEY}=${encodeURIComponent(
    String(normalized),
  )}; path=/; max-age=31536000; samesite=lax`;
}

/** Volume as 0–100, restored from localStorage (or the cookie) and persisted on every change. */
export function useSoundVolume(): [number, (next: number) => void] {
  const [soundVolume, setSoundVolume] = useState(70);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const savedVolume =
      window.localStorage.getItem(SOUND_VOLUME_STORAGE_KEY) ??
      readCookieValue(SOUND_VOLUME_COOKIE_KEY);
    if (!savedVolume) {
      return;
    }
    const parsed = Number(savedVolume);
    if (Number.isFinite(parsed)) {
      const normalized = clampVolume(parsed);
      setSoundVolume(normalized);
      persistSoundVolume(normalized);
    }
  }, []);

  const changeSoundVolume = (next: number) => {
    const normalized = clampVolume(next);
    setSoundVolume(normalized);
    persistSoundVolume(normalized);
  };

  return [soundVolume, changeSoundVolume];
}
