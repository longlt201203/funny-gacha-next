"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GachaEngine,
  getFallbackBannerCatalog,
  mapApiBannersToCatalog,
  type BannerApiEntry,
  type BannerCatalogEntry,
  type PullResult,
} from "@/lib/gacha";

const fallbackCatalog = getFallbackBannerCatalog();
const SINGLE_ROLL_VIDEO_BY_RARITY: Record<3 | 4 | 5, string> = {
  3: "/videos/3star-single.mp4",
  4: "/videos/4star-single.mp4",
  5: "/videos/5star-single.mp4",
};

const MULTI_ROLL_VIDEO_BY_TOP_RARITY: Record<4 | 5, string> = {
  4: "/videos/4star-multi.mp4",
  5: "/videos/5star-multi.mp4",
};

// Replaces the roll video's own audio whenever the pull contains an S item.
const GOLDEN_SIGN_SFX = "/sfx/zzz-golden-sign.mp3";

const REVEAL_SFX_BY_RARITY: Record<3 | 4 | 5, string> = {
  3: "/sfx/reveal-3star.ogg",
  4: "/sfx/reveal-4star.ogg",
  5: "/sfx/reveal-5star.ogg",
};
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

// Featured S reveal: a black-screen five-star intro of this length runs before the card opens.
const FEATURED_INTRO_MS = 700;
// Gold dust scattered across the black intro screen (fixed layout; brightness and drift are randomized per reveal).
const INTRO_DUST = Array.from({ length: 40 }, (_, index) => ({
  left: (index * 53 + 11) % 100,
  top: (index * 29 + 7) % 100,
  size: 1 + (index % 3),
}));
const INTRO_SPARKS_PER_STAR = 6;
const GOLD_SHIMMER_TEXT =
  "bg-[linear-gradient(90deg,#b45309,#fde68a,#fffbeb,#fbbf24,#b45309)] bg-size-[200%_auto] bg-clip-text text-transparent motion-safe:animate-s-prism";
const FEATURED_LETTERS = "FEATURED".split("");

const REVEAL_TILT_MAX_DEG = 12;

const RESOURCE_PER_PULL = 160;
// Every pull goes through the one-by-one reveal and a single POST /api/pulls, so keep batches bounded.
const MAX_PULL_COUNT = 5000;

function parsePullCount(value: string): number | null {
  const parsed = Number(value);
  return value.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= 1 &&
    parsed <= MAX_PULL_COUNT
    ? parsed
    : null;
}

function formatResource(pity: number): string {
  return Math.round(pity * RESOURCE_PER_PULL).toLocaleString();
}

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

type RecordedPull = {
  id: number;
  bannerName: string;
  pullBatchId: string;
  pullOrder: number;
  rarity: number;
  itemType: "WEAPON" | "CHARACTER";
  itemName: string;
  itemImage: string;
  featured: boolean;
  createdAt: string;
};

type PullPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
};

type SPityPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
};

type SPityEntry = {
  id: number;
  itemName: string;
  pity: number;
  featured: boolean;
  createdAt: string;
};

type PullStatistics = {
  totalPulls: number;
  totalS: number;
  averagePity: number;
  maxPity: number;
  lastSPity: number | null;
  entries: SPityEntry[];
  pagination: SPityPagination;
};

const DEFAULT_HISTORY_PAGE_SIZE = 12;
const DEFAULT_S_PITY_PAGE_SIZE = 12;
type PersistedPityState = {
  bannerName: string;
  currentPity: number;
  fourStarPity: number;
  totalPity: number;
  guaranteedFeatured: boolean;
};

export default function Home() {
  const getAnimate = async () => {
    const animeModule = await import("animejs");
    return animeModule.animate;
  };

  const [catalog, setCatalog] = useState<BannerCatalogEntry[]>(fallbackCatalog);
  const [banner, setBanner] = useState(fallbackCatalog[0].name);
  const [totalPity, setTotalPity] = useState(0);
  const [history, setHistory] = useState<PullResult[]>([]);
  const [recordedHistory, setRecordedHistory] = useState<RecordedPull[]>([]);
  const [recordPagination, setRecordPagination] = useState<PullPagination>({
    page: 1,
    pageSize: DEFAULT_HISTORY_PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [pullStatistics, setPullStatistics] = useState<PullStatistics | null>(
    null,
  );
  const [sPityPage, setSPityPage] = useState(1);
  const [dataError, setDataError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [pityError, setPityError] = useState<string | null>(null);
  const [pullCountInput, setPullCountInput] = useState("10");
  const [isRolling, setIsRolling] = useState(false);
  const [rollVideoSrc, setRollVideoSrc] = useState<string | null>(null);
  const [soundVolume, setSoundVolume] = useState(70);
  const [pendingResults, setPendingResults] = useState<PullResult[] | null>(
    null,
  );
  const [revealBatch, setRevealBatch] = useState<PullResult[] | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isRevealAnimating, setIsRevealAnimating] = useState(false);

  const engineRef = useRef(new GachaEngine(fallbackCatalog[0]));
  const rollVideoRef = useRef<HTMLVideoElement | null>(null);
  const goldenSignAudioRef = useRef<HTMLAudioElement | null>(null);
  const goldenSignActiveRef = useRef(false);
  const revealAudioRef = useRef<Partial<Record<3 | 4 | 5, HTMLAudioElement>>>(
    {},
  );
  const revealModalRef = useRef<HTMLDivElement | null>(null);
  const revealCardRef = useRef<HTMLDivElement | null>(null);
  const revealOverlayRef = useRef<HTMLDivElement | null>(null);
  const revealTiltRef = useRef<HTMLDivElement | null>(null);
  const delayedSfxRef = useRef<number | null>(null);
  const [currentPity, setCurrentPity] = useState(
    engineRef.current.getCurrentPity(),
  );
  const [fourStarPity, setFourStarPity] = useState(
    engineRef.current.getFourStarPity(),
  );

  const bannerOptions = useMemo(
    () => catalog.map((item) => item.name),
    [catalog],
  );
  const selectedBannerEntry = useMemo(
    () => catalog.find((entry) => entry.name === banner) ?? fallbackCatalog[0],
    [banner, catalog],
  );
  const latest = history[0] ?? null;
  const normalizedSoundVolume = soundVolume / 100;
  const isRevealingBatch = revealBatch !== null;
  const rollHasS = pendingResults?.some((item) => item.rarity === 5) ?? false;
  const pullCount = parsePullCount(pullCountInput);
  const lastRevealedItem =
    revealBatch && revealedCount > 0
      ? revealBatch[Math.min(revealedCount, revealBatch.length) - 1]
      : null;
  const isFeaturedReveal =
    lastRevealedItem?.rarity === 5 && lastRevealedItem.featured;

  const applyRollResults = (created: PullResult[]) => {
    stopGoldenSign();
    if (created.length === 0) {
      return;
    }
    setTotalPity((prev) => prev + created.length);
    setHistory((prev) => [...created.reverse(), ...prev].slice(0, 30));
    syncPityCounters();
    void recordPullHistory(created);
    void persistPityState(
      banner,
      engineRef.current.getCurrentPity(),
      engineRef.current.getFourStarPity(),
      totalPity + created.length,
      engineRef.current.getGuaranteedFeatured(),
    );
  };

  const hydrateBannerPityState = async (bannerName: string) => {
    const response = await fetch(
      `/api/pity?bannerName=${encodeURIComponent(bannerName)}`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) {
      setPityError("Failed to load pity state from database.");
      return;
    }

    const state = (await response.json()) as PersistedPityState;
    engineRef.current.hydratePityState(
      state.currentPity,
      state.fourStarPity,
      state.guaranteedFeatured,
    );
    setCurrentPity(state.currentPity);
    setFourStarPity(state.fourStarPity);
    setTotalPity(state.totalPity);
    setPityError(null);
  };

  const persistPityState = async (
    bannerName: string,
    nextCurrentPity: number,
    nextFourStarPity: number,
    nextTotalPity: number,
    nextGuaranteedFeatured: boolean,
  ) => {
    const response = await fetch("/api/pity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bannerName,
        currentPity: nextCurrentPity,
        fourStarPity: nextFourStarPity,
        totalPity: nextTotalPity,
        guaranteedFeatured: nextGuaranteedFeatured,
      }),
    });

    if (!response.ok) {
      setPityError("Pity updated locally, but failed to persist to database.");
      return;
    }

    setPityError(null);
  };

  const loadRecordedHistory = async (
    page?: number,
    bannerName?: string,
    nextSPityPage?: number,
  ) => {
    const targetPage = page ?? recordPagination.page;
    const targetBanner = bannerName ?? banner;
    const targetSPityPage = nextSPityPage ?? sPityPage;
    const searchParams = new URLSearchParams({
      page: String(targetPage),
      pageSize: String(DEFAULT_HISTORY_PAGE_SIZE),
      withSStats: "1",
      sPage: String(targetSPityPage),
      sPageSize: String(DEFAULT_S_PITY_PAGE_SIZE),
    });
    if (targetBanner) {
      searchParams.set("bannerName", targetBanner);
    }
    const response = await fetch(`/api/pulls?${searchParams.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setRecordError("Failed to load recorded pull history.");
      return;
    }

    const data = (await response.json()) as {
      items: RecordedPull[];
      pagination: PullPagination;
      statistics?: PullStatistics;
    };
    setRecordedHistory(data.items);
    setRecordPagination(data.pagination);
    setPullStatistics(data.statistics ?? null);
    if (data.statistics?.pagination) {
      setSPityPage(data.statistics.pagination.page);
    } else {
      setSPityPage(1);
    }
    setRecordError(null);
  };

  const recordPullHistory = async (created: PullResult[]) => {
    const response = await fetch("/api/pulls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bannerName: banner,
        pulls: created.map((pull) => ({
          name: pull.name,
          itemType: pull.itemType,
          itemImage: pull.itemImage,
          rarity: pull.rarity,
          featured: pull.featured,
        })),
      }),
    });

    if (!response.ok) {
      setRecordError(
        "Pull completed, but failed to record history in database.",
      );
      return;
    }

    await loadRecordedHistory(1, banner, 1);
  };

  const clearRecordedHistoryForBanner = async (bannerName: string) => {
    const response = await fetch(
      `/api/pulls?bannerName=${encodeURIComponent(bannerName)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      setRecordError(
        "Reset completed, but failed to clear pull history in database.",
      );
      return;
    }

    setRecordError(null);
    await loadRecordedHistory(1, bannerName, 1);
  };

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
    audio.volume = normalizedSoundVolume;
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

  // The golden-sign music keeps playing into the reveal; applyRollResults stops it once the pull is done.
  const finalizeRoll = () => {
    if (!pendingResults) {
      stopGoldenSign();
      setIsRolling(false);
      setRollVideoSrc(null);
      return;
    }

    const created = pendingResults;
    setPendingResults(null);
    setRollVideoSrc(null);
    setIsRolling(false);
    if (created.length > 0) {
      // Reveal the first item right away; the rest are revealed one click at a time.
      setRevealBatch(created);
      setRevealedCount(1);
      playItemRevealSfx(created[0]);
      return;
    }
    applyRollResults(created);
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

  const handleRevealNext = async () => {
    if (!revealBatch || isRevealAnimating) {
      return;
    }

    if (revealedCount < revealBatch.length) {
      if (revealedCount > 0 && revealCardRef.current) {
        setIsRevealAnimating(true);
        const animate = await getAnimate();

        if (typeof animate === "function") {
          animate(revealCardRef.current, {
            opacity: [1, 0],
            scale: [1, 0.94],
            rotateZ: [0, -1.5],
            duration: 220,
            ease: "inQuad",
          });
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 230);
          });
        }
        setIsRevealAnimating(false);
      }
      playItemRevealSfx(revealBatch[revealedCount]);
      setRevealedCount((prev) => prev + 1);
      return;
    }

    const completedBatch = revealBatch;
    setRevealBatch(null);
    setRevealedCount(0);
    applyRollResults(completedBatch);
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
      audio.volume = normalizedSoundVolume;
      revealAudioRef.current[resolvedRarity] = audio;
    }

    audio.volume = normalizedSoundVolume;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      return;
    });
  };

  // S cards lean toward the cursor; written straight to the DOM so pointer moves don't re-render the page.
  const handleRevealPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const tilt = revealTiltRef.current;
    const bounds = revealModalRef.current?.getBoundingClientRect();
    if (
      !tilt ||
      !bounds ||
      lastRevealedItem?.rarity !== 5 ||
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

  const resetRevealTilt = () => {
    const tilt = revealTiltRef.current;
    if (tilt) {
      tilt.style.transform = "";
      tilt.style.setProperty("--tilt-glare", "0");
    }
  };

  const handleSkipReveal = () => {
    if (!revealBatch) {
      return;
    }
    cancelDelayedSfx();

    const completedBatch = revealBatch;
    setRevealBatch(null);
    setRevealedCount(0);
    applyRollResults(completedBatch);
  };

  const pickRollVideo = (
    created: PullResult[],
    count: number,
  ): string | null => {
    if (created.length === 0) {
      return null;
    }

    if (count === 1) {
      return SINGLE_ROLL_VIDEO_BY_RARITY[created[0].rarity];
    }

    const topRarity = created.reduce(
      (max, item) => (item.rarity > max ? item.rarity : max),
      3,
    );
    if (topRarity >= 5) {
      return MULTI_ROLL_VIDEO_BY_TOP_RARITY[5];
    }
    if (topRarity >= 4) {
      return MULTI_ROLL_VIDEO_BY_TOP_RARITY[4];
    }
    return MULTI_ROLL_VIDEO_BY_TOP_RARITY[4];
  };

  const syncPityCounters = () => {
    setCurrentPity(engineRef.current.getCurrentPity());
    setFourStarPity(engineRef.current.getFourStarPity());
  };

  const applyBannerEngine = (entry: BannerCatalogEntry) => {
    engineRef.current = new GachaEngine(entry);
    setBanner(entry.name);
    setHistory([]);
    setCurrentPity(0);
    setFourStarPity(0);
    setTotalPity(0);
    setSPityPage(1);
    void hydrateBannerPityState(entry.name);
    void loadRecordedHistory(1, entry.name, 1);
  };

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

  useEffect(() => {
    if (rollVideoRef.current) {
      rollVideoRef.current.volume = normalizedSoundVolume;
    }
    if (goldenSignAudioRef.current) {
      goldenSignAudioRef.current.volume = normalizedSoundVolume;
    }
    for (const audio of Object.values(revealAudioRef.current)) {
      if (audio) {
        audio.volume = normalizedSoundVolume;
      }
    }
  }, [normalizedSoundVolume, rollVideoSrc]);

  useEffect(() => {
    if (!isRevealingBatch || !revealModalRef.current) {
      return;
    }

    let disposed = false;
    void (async () => {
      const animate = await getAnimate();
      if (disposed || !revealModalRef.current) {
        return;
      }

      if (typeof animate !== "function") {
        return;
      }

      animate(revealModalRef.current, {
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 420,
        ease: "outExpo",
      });
    })();

    return () => {
      disposed = true;
    };
  }, [isRevealingBatch]);

  useEffect(() => {
    if (!isRevealingBatch || revealedCount === 0) {
      return;
    }

    let disposed = false;
    void (async () => {
      const { animate, stagger } = await import("animejs");
      if (disposed) {
        return;
      }

      if (!revealCardRef.current || !lastRevealedItem) {
        return;
      }

      // The featured reveal leaves a glow filter and clip-path on the shared card element; clear them per item.
      revealCardRef.current.style.filter = "";
      revealCardRef.current.style.clipPath = "";
      if (revealTiltRef.current) {
        revealTiltRef.current.style.transform = "";
        revealTiltRef.current.style.setProperty("--tilt-glare", "0");
      }

      if (lastRevealedItem.rarity === 5) {
        const card = revealCardRef.current;
        // Featured S: a calm black-screen five-star intro, then the card opens into a golden glow at time `t`.
        const featured = lastRevealedItem.featured;
        const t = featured ? FEATURED_INTRO_MS : 0;
        const fx = (name: string) =>
          Array.from(
            revealOverlayRef.current?.querySelectorAll<HTMLElement>(
              `[data-s-fx="${name}"]`,
            ) ?? [],
          );
        // Hide targets up front so delayed tweens (and leftovers from a previous S) don't show early.
        const run = (
          targets: HTMLElement[],
          params: Parameters<typeof animate>[1],
        ) => {
          if (targets.length > 0) {
            for (const target of targets) {
              target.style.opacity = "0";
            }
            animate(targets, params);
          }
        };

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          animate(card, { opacity: [0, 1], duration: 400, ease: "outQuad" });
          run(
            [
              ...fx("rank"),
              ...fx("star"),
              ...fx("name"),
              ...fx("headline"),
              ...fx("rays"),
            ],
            { opacity: [0, 1], duration: 400, ease: "outQuad" },
          );
          return;
        }

        if (featured) {
          card.style.opacity = "0";
          // Intro: cut to black, five stars light up one by one, then gather into a line where the card opens.
          run(fx("vignette"), {
            opacity: [
              { to: 1, duration: 150 },
              { to: 1, duration: t - 150 },
              { to: 0, duration: 700 },
            ],
            ease: "outQuad",
          });
          // Pop timings scale with the intro length so all five stars land before they gather at `t - gather`.
          const introStars = fx("intro-star");
          const gather = Math.min(320, t * 0.22);
          const popDuration = Math.min(550, t * 0.35);
          const popStart = t * 0.06;
          const popStagger =
            (t - gather - popDuration - popStart) /
            Math.max(1, introStars.length - 1);
          run(introStars, {
            opacity: [0, 1],
            scale: [0, 1.5, 1],
            rotateZ: [-120, 0],
            duration: popDuration,
            delay: stagger(popStagger, { start: popStart }),
            ease: "outBack",
          });

          // Ambient layers in the dark: gold dust, a halo bloom, and a horizon line the stars gather into.
          run(fx("intro-dust"), {
            opacity: () => [0, 0.4 + Math.random() * 0.6, 0],
            translateY: () => [0, -(10 + Math.random() * 30)],
            scale: [0.5, 1.2],
            duration: () => t + 300 + Math.random() * 400,
            delay: () => Math.random() * t * 0.5,
            ease: "outSine",
          });
          run(fx("intro-halo"), {
            opacity: [
              { to: 1, duration: t, ease: "outQuad" },
              { to: 0, duration: 600, ease: "outQuad" },
            ],
            scale: [
              { from: 0.4, to: 1.1, duration: t, ease: "outQuad" },
              { to: 1.6, duration: 600, ease: "outExpo" },
            ],
          });
          run(fx("intro-line"), {
            scaleX: [{ from: 0, to: 1, duration: t - popStart, ease: "outExpo" }],
            opacity: [
              { to: 1, duration: Math.min(200, t * 0.3) },
              { to: 1, duration: t - popStart - Math.min(200, t * 0.3) },
              { to: 0, duration: 500 },
            ],
            delay: popStart,
          });

          // As each star lands: a four-point glint flashes behind it and a few sparks scatter.
          introStars.forEach((_, index) => {
            const landAt = popStart + index * popStagger + popDuration * 0.45;
            run(fx(`intro-glint-${index}`), {
              opacity: [0, 1, 0],
              scale: [0.2, 1.3],
              rotateZ: [0, 45],
              duration: Math.max(260, popDuration),
              delay: landAt,
              ease: "outQuad",
            });
            const sparks = fx(`intro-spark-${index}`);
            const offset = Math.random() * Math.PI;
            run(sparks, {
              translateX: (_target: unknown, i = 0) => [
                0,
                Math.cos(offset + (i / sparks.length) * Math.PI * 2) * (36 + Math.random() * 30),
              ],
              translateY: (_target: unknown, i = 0) => [
                0,
                Math.sin(offset + (i / sparks.length) * Math.PI * 2) * (36 + Math.random() * 30),
              ],
              opacity: [1, 0],
              scale: [1.2, 0],
              duration: 420,
              delay: landAt,
              ease: "outExpo",
            });
          });

          const centerX = window.innerWidth / 2;
          animate(introStars, {
            translateX: (target: unknown) => {
              const rect = (target as HTMLElement).getBoundingClientRect();
              return centerX - (rect.left + rect.width / 2);
            },
            scaleX: 3,
            scaleY: 0.1,
            opacity: 0,
            duration: gather,
            delay: t - gather,
            ease: "inBack",
          });

          // The card opens like a door of light from the stars' line, settling into a lasting golden glow.
          animate(card, {
            opacity: [{ to: 1, duration: 120 }],
            clipPath: [
              "inset(48% 0% 48% 0% round 16px)",
              "inset(0% 0% 0% 0% round 16px)",
            ],
            scale: [1.2, 1],
            filter: [
              "brightness(4) saturate(0.3) drop-shadow(0px 0px 90px rgba(253,224,71,1))",
              "brightness(1.4) saturate(1.1) drop-shadow(0px 0px 60px rgba(253,224,71,0.85))",
              "brightness(1) saturate(1) drop-shadow(0px 0px 28px rgba(251,191,36,0.55))",
            ],
            duration: 1300,
            delay: t,
            ease: "outExpo",
          });
        } else {
          // Impact: gold flash plus a short camera shake.
          run(fx("screen-flash"), {
            opacity: [
              { to: 0.9, duration: 220 },
              { to: 0, duration: 530 },
            ],
            ease: "outQuad",
          });
          if (revealModalRef.current) {
            animate(revealModalRef.current, {
              translateX: [0, -16, 13, -10, 7, -4, 2, 0],
              translateY: [0, 8, -6, 5, -3, 2, 0, 0],
              duration: 560,
              ease: "linear",
            });
          }

          // Card bursts out of an overexposed blur.
          animate(card, {
            opacity: [0, 1],
            scale: [0.5, 1.08, 1],
            rotateZ: [-5, 1.5, 0],
            filter: [
              "brightness(3) blur(14px)",
              "brightness(1.5) blur(0px)",
              "brightness(1) blur(0px)",
            ],
            duration: 1100,
            ease: "outExpo",
          });
          run(fx("card-flash"), {
            opacity: [1, 0],
            duration: 700,
            ease: "outExpo",
          });
          run(fx("rays"), {
            opacity: [0, 1],
            scale: [0.3, 1],
            duration: 1400,
            ease: "outExpo",
          });
          run(fx("ring"), {
            opacity: [1, 0],
            scale: [0.15, 2.4],
            duration: 1200,
            delay: stagger(150),
            ease: "outCirc",
          });

          const particles = fx("particle");
          const vectors = particles.map((_, index) => {
            const angle =
              (index / particles.length) * Math.PI * 2 + Math.random() * 0.4;
            const distance = 220 + Math.random() * 380;
            return {
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
            };
          });
          run(particles, {
            translateX: (_target: unknown, index = 0) => [0, vectors[index].x],
            translateY: (_target: unknown, index = 0) => [
              0,
              vectors[index].y + 90,
            ],
            scale: [{ to: 1.6, duration: 160 }, { to: 0 }],
            opacity: [{ to: 1, duration: 80 }, { to: 0 }],
            duration: () => 1000 + Math.random() * 800,
            delay: stagger(8, { start: 60 }),
            ease: "outExpo",
          });
        }

        // Golden aura swells behind the card.
        run(fx("backdrop-pulse"), {
          opacity: [0, 1, 0.55],
          scale: [0.6, 1.25, 1.1],
          duration: 1400,
          delay: t,
          ease: "outExpo",
        });

        // Title card: (featured) FEATURED letters rise in gently, the rank slams, stars pop, then the name sweeps in.
        const titleStart = t + (featured ? 500 : 0);
        run(fx("headline"), {
          opacity: [0, 1],
          translateY: [24, 0],
          duration: 700,
          delay: stagger(70, { start: t + 250 }),
          ease: "outQuad",
        });
        run(fx("rank"), {
          opacity: [0, 1],
          scale: [4, 0.85, 1],
          rotateZ: [-30, 4, 0],
          duration: 800,
          delay: titleStart + 300,
          ease: "outExpo",
        });
        run(fx("star"), {
          opacity: [0, 1],
          scale: [0, 1.6, 1],
          rotateZ: [-180, 0],
          duration: 650,
          delay: stagger(110, { start: titleStart + 560 }),
          ease: "outBack",
        });
        run(fx("name"), {
          opacity: [0, 1],
          translateY: [28, 0],
          letterSpacing: ["0.7em", "0.12em"],
          duration: 1000,
          delay: titleStart + 900,
          ease: "outExpo",
        });
      } else {
        animate(revealCardRef.current, {
          opacity: [0, 1],
          scale: [0.92, 1],
          rotateZ: [-1.5, 0],
          duration: 500,
          ease: "outBack",
        });
      }
    })();

    return () => {
      disposed = true;
    };
  }, [isRevealingBatch, revealedCount, lastRevealedItem]);

  useEffect(() => {
    const loadBanners = async () => {
      const response = await fetch("/api/banners", { cache: "no-store" });
      if (!response.ok) {
        setDataError(
          "Failed to load banners from database. Using fallback data.",
        );
        return;
      }

      const apiBanners = (await response.json()) as BannerApiEntry[];
      const dbCatalog = mapApiBannersToCatalog(apiBanners);
      if (dbCatalog.length === 0) {
        setDataError("No usable banners in database. Using fallback data.");
        return;
      }

      setDataError(null);
      setCatalog(dbCatalog);
      applyBannerEngine(dbCatalog[0]);
    };

    void loadBanners();
    void loadRecordedHistory(1, banner, 1);
  }, []);

  const runPull = (count: number) => {
    if (isRolling || isRevealingBatch) {
      return;
    }

    const created = engineRef.current.pull(totalPity + 1, count);
    const video = pickRollVideo(created, count);

    if (!video) {
      applyRollResults(created);
      return;
    }

    // Started here (inside the click) so the browser's autoplay policy allows it.
    if (created.some((item) => item.rarity === 5)) {
      playGoldenSign();
    }
    setPendingResults(created);
    setRollVideoSrc(video);
    setIsRolling(true);
  };

  const resetRun = () => {
    if (isRolling || isRevealingBatch) {
      return;
    }
    engineRef.current.reset();
    setCurrentPity(engineRef.current.getCurrentPity());
    setFourStarPity(engineRef.current.getFourStarPity());
    setTotalPity(0);
    setHistory([]);
    void persistPityState(banner, 0, 0, 0, false);
    void clearRecordedHistoryForBanner(banner);
  };

  const switchBanner = (nextBanner: string) => {
    if (isRolling || isRevealingBatch) {
      return;
    }
    const nextEntry = catalog.find((entry) => entry.name === nextBanner);
    if (!nextEntry) {
      setDataError(`Banner "${nextBanner}" does not exist in loaded data.`);
      return;
    }
    applyBannerEngine(nextEntry);
  };

  const thumbnailStyle =
    latest?.rarity === 5
      ? "from-amber-400 via-orange-300 to-rose-300"
      : latest?.rarity === 4
        ? "from-violet-400 via-fuchsia-300 to-indigo-300"
        : "from-blue-400 via-sky-300 to-cyan-200";
  const revealCardStyle =
    lastRevealedItem?.rarity === 5
      ? "from-amber-400/30 via-orange-400/20 to-rose-400/30 border-amber-300/70 shadow-[0_0_70px_rgba(251,191,36,0.35)]"
      : lastRevealedItem?.rarity === 4
        ? "from-violet-400/30 via-fuchsia-400/20 to-indigo-400/30 border-violet-300/70 shadow-[0_0_70px_rgba(167,139,250,0.35)]"
        : "from-blue-500/30 via-sky-400/20 to-blue-500/30 border-blue-300/60 shadow-[0_0_40px_rgba(96,165,250,0.3)]";
  const revealRankStyle =
    lastRevealedItem?.rarity === 5
      ? "border-amber-300/80 bg-amber-400/30 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
      : lastRevealedItem?.rarity === 4
        ? "border-violet-300/80 bg-violet-400/30 text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.45)]"
        : "border-blue-300/70 bg-blue-400/25 text-blue-100 shadow-[0_0_20px_rgba(96,165,250,0.4)]";
  const revealAuraStyle =
    lastRevealedItem?.rarity === 5
      ? "from-amber-300/20 via-orange-300/10 to-rose-300/20"
      : lastRevealedItem?.rarity === 4
        ? "from-violet-300/20 via-fuchsia-300/10 to-indigo-300/20"
        : "from-blue-300/20 via-sky-200/10 to-blue-300/20";
  const revealRankLabel =
    lastRevealedItem?.rarity === 5
      ? "S"
      : lastRevealedItem?.rarity === 4
        ? "A"
        : "B";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#1e293b_0%,#111827_45%,#09090b_100%)] px-4 py-6 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {isRolling && rollVideoSrc ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl">
              <video
                ref={rollVideoRef}
                key={rollVideoSrc}
                src={rollVideoSrc}
                className="h-auto w-full rounded-2xl border border-white/40 shadow-[0_0_60px_rgba(255,255,255,0.15)]"
                autoPlay
                playsInline
                muted={soundVolume === 0 || rollHasS}
                onEnded={finalizeRoll}
                onError={finalizeRoll}
              />
              <button
                type="button"
                onClick={finalizeRoll}
                className="absolute right-4 top-4 rounded-lg border border-white/40 bg-black/70 px-3 py-1 text-sm font-semibold text-white transition hover:bg-black"
              >
                Skip
              </button>
            </div>
          </div>
        ) : null}
        {isRevealingBatch ? (
          <div
            ref={revealOverlayRef}
            className={`fixed inset-0 z-40 flex cursor-pointer items-center justify-center overflow-hidden p-4 backdrop-blur-sm ${
              isFeaturedReveal
                ? "bg-[radial-gradient(circle_at_center,#451a03_0%,#1c1917_45%,#030712_85%)]"
                : lastRevealedItem?.rarity === 5
                  ? "bg-[radial-gradient(circle_at_center,#78350f_0%,#1c1917_45%,#09090b_85%)]"
                  : "bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_70%)]"
            }`}
            onClick={() => void handleRevealNext()}
            onPointerMove={handleRevealPointerMove}
            onPointerLeave={resetRevealTilt}
          >
            {isFeaturedReveal ? (
              <>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(254,240,138,0.45),rgba(245,158,11,0.3)_35%,rgba(180,83,9,0.15)_55%,transparent_75%)] motion-safe:animate-pulse" />
                <div
                  data-s-fx="vignette"
                  className="pointer-events-none absolute inset-0 z-5 bg-black opacity-0"
                />
                <div className="pointer-events-none absolute inset-0 z-25" aria-hidden>
                  {INTRO_DUST.map((mote) => (
                    <span
                      key={`${mote.left}-${mote.top}`}
                      data-s-fx="intro-dust"
                      className="absolute rounded-full bg-amber-200 opacity-0 shadow-[0_0_6px_rgba(253,224,71,0.9)]"
                      style={{
                        left: `${mote.left}%`,
                        top: `${mote.top}%`,
                        width: mote.size,
                        height: mote.size,
                      }}
                    />
                  ))}
                  <div
                    data-s-fx="intro-halo"
                    className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.35)_0%,rgba(245,158,11,0.15)_40%,transparent_70%)] opacity-0"
                  />
                  <div
                    data-s-fx="intro-line"
                    className="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-linear-to-r from-transparent via-amber-200 to-transparent opacity-0 shadow-[0_0_20px_4px_rgba(253,224,71,0.6)]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-3 sm:gap-6">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <div key={star} className="relative flex items-center justify-center">
                        <div
                          data-s-fx={`intro-glint-${star}`}
                          className="absolute h-[220%] w-[220%] opacity-0"
                        >
                          <span className="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-linear-to-r from-transparent via-yellow-50 to-transparent" />
                          <span className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-linear-to-b from-transparent via-yellow-50 to-transparent" />
                        </div>
                        {Array.from({ length: INTRO_SPARKS_PER_STAR }, (_, spark) => (
                          <span
                            key={spark}
                            data-s-fx={`intro-spark-${star}`}
                            className="absolute h-1 w-1 rounded-full bg-yellow-100 opacity-0 shadow-[0_0_6px_rgba(253,224,71,0.95)]"
                          />
                        ))}
                        <span
                          data-s-fx="intro-star"
                          className="relative bg-linear-to-b from-yellow-50 via-amber-300 to-amber-600 bg-clip-text text-6xl text-transparent opacity-0 drop-shadow-[0_0_24px_rgba(253,224,71,0.95)] sm:text-8xl"
                        >
                          ★
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            {lastRevealedItem?.rarity === 5 ? (
              <>
                {isFeaturedReveal ? null : (
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
                handleSkipReveal();
              }}
              className="absolute right-6 top-6 z-20 rounded-lg border border-rose-300/70 bg-rose-500/25 px-4 py-1.5 text-sm font-bold tracking-wide text-rose-100 transition hover:bg-rose-500/40"
            >
              Skip
            </button>

            {lastRevealedItem ? (
              <div
                ref={revealModalRef}
                className="pointer-events-none relative w-full max-w-5xl"
              >
                {lastRevealedItem.rarity === 5 ? (
                  <>
                    {isFeaturedReveal ? null : (
                      /* Outer wrapper is animated by animejs; the inner layer spins via CSS so the transforms don't fight. */
                      <div
                        data-s-fx="rays"
                        className="pointer-events-none absolute left-1/2 top-1/2 h-[170vmax] w-[170vmax] -translate-x-1/2 -translate-y-1/2 opacity-0"
                      >
                        <div className="h-full w-full rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(253,224,71,0.32)_0deg_5deg,transparent_5deg_15deg)] mask-[radial-gradient(circle,black_8%,transparent_50%)] motion-safe:animate-s-spin" />
                      </div>
                    )}
                    <div
                      data-s-fx="backdrop-pulse"
                      className={`pointer-events-none absolute inset-[-15%] rounded-full opacity-0 blur-2xl ${
                        isFeaturedReveal
                          ? "bg-[radial-gradient(circle,rgba(255,251,235,0.75)_0%,rgba(253,224,71,0.55)_25%,rgba(245,158,11,0.35)_48%,rgba(15,23,42,0)_72%)]"
                          : "bg-[radial-gradient(circle,rgba(251,191,36,0.6)_0%,rgba(244,114,182,0.3)_35%,rgba(15,23,42,0)_70%)]"
                      }`}
                    />
                    {isFeaturedReveal ? null : (
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
                  ref={revealTiltRef}
                  className="relative transition-transform duration-200 ease-out will-change-transform"
                >
                <div
                  ref={revealCardRef}
                  className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 ${revealCardStyle}`}
                >
                  {lastRevealedItem.rarity === 5 ? (
                    <>
                      <div
                        className={`pointer-events-none absolute inset-[-60%] opacity-90 motion-safe:animate-s-border ${
                          isFeaturedReveal
                            ? "bg-[conic-gradient(from_0deg,#fef3c7,#f59e0b,#b45309,#fde68a,#d97706,#fef3c7)]"
                            : "bg-[conic-gradient(from_0deg,#fde047,#f97316,#f472b6,#a78bfa,#38bdf8,#fde047)]"
                        }`}
                      />
                      {isFeaturedReveal ? null : (
                        <div
                          data-s-fx="card-flash"
                          className="pointer-events-none absolute inset-0 z-30 rounded-2xl bg-white opacity-0"
                        />
                      )}
                    </>
                  ) : null}
                  <div
                    className={`pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-tr ${revealAuraStyle}`}
                  />
                  {[0, 1, 2, 3, 4, 5].map((sparkle) => (
                    <div
                      key={sparkle}
                      className="pointer-events-none absolute h-2 w-2 animate-ping rounded-full bg-white/70"
                      style={{
                        top: `${16 + (sparkle % 3) * 24}%`,
                        left: `${12 + sparkle * 14}%`,
                        animationDelay: `${sparkle * 180}ms`,
                        animationDuration: "1400ms",
                      }}
                    />
                  ))}
                  <img
                    src={lastRevealedItem.itemImage}
                    alt={lastRevealedItem.name}
                    className="relative mx-auto h-[72vh] max-h-[820px] w-full rounded-xl border border-white/30 object-cover shadow-2xl"
                  />
                  {lastRevealedItem.rarity === 5 ? (
                    <>
                      <div className="pointer-events-none absolute inset-4 overflow-hidden rounded-xl">
                        <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/45 to-transparent motion-safe:animate-s-shine" />
                        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                        {isFeaturedReveal ? (
                          <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-black/80 to-transparent" />
                        ) : null}
                      </div>
                      {isFeaturedReveal ? (
                        <div
                          className="pointer-events-none absolute inset-x-6 top-8 flex justify-center text-4xl font-black sm:text-7xl"
                          aria-label="Featured"
                        >
                          {FEATURED_LETTERS.map((letter, index) => (
                            <span
                              key={index}
                              data-s-fx="headline"
                              className={`inline-block opacity-0 drop-shadow-[0_0_18px_rgba(251,191,36,0.6)] ${GOLD_SHIMMER_TEXT}`}
                            >
                              {letter}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="pointer-events-none absolute inset-x-6 bottom-8 flex flex-col items-center gap-2 text-center">
                        <span
                          data-s-fx="rank"
                          className={`inline-flex min-w-24 items-center justify-center rounded-full border px-6 py-1.5 text-3xl font-black tracking-[0.25em] opacity-0 ${revealRankStyle}`}
                        >
                          S
                        </span>
                        <div className="flex gap-1.5" aria-label="5 stars">
                          {[0, 1, 2, 3, 4].map((star) => (
                            <span
                              key={star}
                              data-s-fx="star"
                              className="text-3xl text-amber-300 opacity-0 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]"
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <p
                          data-s-fx="name"
                          className="max-w-full truncate bg-gradient-to-r from-amber-100 via-yellow-200 to-amber-400 bg-clip-text text-3xl font-black uppercase text-transparent opacity-0 drop-shadow-[0_2px_14px_rgba(251,191,36,0.65)] sm:text-5xl"
                        >
                          {lastRevealedItem.name}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
                      <span
                        className={`inline-flex min-w-24 items-center justify-center rounded-full border px-5 py-1.5 text-xl font-black tracking-[0.25em] ${revealRankStyle}`}
                      >
                        {revealRankLabel}
                      </span>
                    </div>
                  )}
                  {lastRevealedItem.rarity === 5 ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-20 rounded-2xl mix-blend-overlay transition-opacity duration-300"
                      style={{
                        background:
                          "radial-gradient(circle at var(--tilt-x, 50%) var(--tilt-y, 50%), rgba(255,255,255,0.55), transparent 45%)",
                        opacity: "var(--tilt-glare, 0)",
                      }}
                    />
                  ) : null}
                </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {dataError ? (
          <p className="rounded-xl border border-amber-400/70 bg-amber-500/15 px-4 py-2 text-amber-200">
            {dataError}
          </p>
        ) : null}
        {recordError ? (
          <p className="rounded-xl border border-rose-400/70 bg-rose-500/15 px-4 py-2 text-rose-200">
            {recordError}
          </p>
        ) : null}
        {pityError ? (
          <p className="rounded-xl border border-rose-400/70 bg-rose-500/15 px-4 py-2 text-rose-200">
            {pityError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <button
            type="button"
            className="h-11 min-w-44 rounded-xl border border-sky-300/60 bg-sky-400/10 px-6 text-xl font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:bg-sky-300/20"
          >
            gacha
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 rounded-xl border border-white/20 bg-slate-900/60 px-4 py-2 text-sm">
              <span className="font-medium text-slate-300">Banner</span>
              <select
                value={banner}
                onChange={(event) => switchBanner(event.target.value)}
                className="rounded-md bg-slate-950/50 px-2 py-1 font-semibold text-white outline-none"
                disabled={isRolling || isRevealingBatch}
              >
                {bannerOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
              <span className="font-medium">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={soundVolume}
                onChange={(event) => {
                  const nextVolume = clampVolume(Number(event.target.value));
                  setSoundVolume(nextVolume);
                  persistSoundVolume(nextVolume);
                }}
                className="w-24 accent-cyan-300"
              />
              <span className="w-9 text-right font-semibold">
                {soundVolume}%
              </span>
            </label>
            <Link
              href="/items"
              className="rounded-xl border border-violet-300/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/30"
            >
              Manage Items
            </Link>
            <Link
              href="/banners"
              className="rounded-xl border border-fuchsia-300/40 bg-fuchsia-500/15 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/30"
            >
              Manage Banners
            </Link>
          </div>
        </div>

        <section
          className={`relative mx-auto h-[500px] w-full max-w-[980px] overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br ${thumbnailStyle} p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-8`}
        >
          {selectedBannerEntry.bannerThumbnail ? (
            <img
              src={selectedBannerEntry.bannerThumbnail}
              alt={`${selectedBannerEntry.name} thumbnail`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/15" />
          <p className="relative inline-flex w-fit rounded-full border border-black/20 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
            {banner} Banner
          </p>
        </section>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-3 text-lg sm:grid-cols-2 sm:text-xl">
            <p className="rounded-xl border border-white/15 bg-white/8 px-5 py-4">
              current pity: {currentPity}
            </p>
            <p className="rounded-xl border border-white/15 bg-white/8 px-5 py-4">
              total pity: {totalPity}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <button
              type="button"
              onClick={resetRun}
              className="h-14 w-full rounded-xl border border-rose-300/50 bg-rose-500/20 px-8 text-2xl font-bold uppercase tracking-wide text-rose-100 transition hover:bg-rose-500/35 disabled:cursor-not-allowed disabled:opacity-50 sm:w-44"
              disabled={isRolling || isRevealingBatch}
            >
              reset
            </button>
            <form
              className="flex w-full flex-col gap-1 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                if (pullCount !== null) {
                  runPull(pullCount);
                }
              }}
            >
              <div className="flex h-14 overflow-hidden rounded-xl border border-amber-300/60 bg-amber-500/20">
                <label
                  htmlFor="pull-count"
                  className="flex items-center pl-4 text-2xl font-bold text-amber-100/80"
                >
                  x
                </label>
                <input
                  id="pull-count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_PULL_COUNT}
                  step={1}
                  value={pullCountInput}
                  onChange={(event) => setPullCountInput(event.target.value)}
                  aria-invalid={pullCount === null}
                  aria-describedby="pull-count-hint"
                  className="w-24 bg-transparent px-2 text-2xl font-bold text-amber-50 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  disabled={isRolling || isRevealingBatch}
                />
                <button
                  type="submit"
                  className="flex-1 border-l border-amber-300/40 px-8 text-2xl font-bold uppercase tracking-wide text-amber-100 transition hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRolling || isRevealingBatch || pullCount === null}
                >
                  pull
                </button>
              </div>
              <p
                id="pull-count-hint"
                className={`text-xs ${pullCount === null ? "text-rose-300" : "text-slate-400"}`}
              >
                {pullCount === null
                  ? `Enter a whole number from 1 to ${MAX_PULL_COUNT}.`
                  : `Costs ${formatResource(pullCount)}`}
              </p>
            </form>
          </div>
        </div>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">S-item pity statistics</h2>
            <button
              type="button"
              onClick={() =>
                void loadRecordedHistory(
                  recordPagination.page,
                  banner,
                  sPityPage,
                )
              }
              className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20"
            >
              Refresh stats
            </button>
          </div>

          {pullStatistics ? (
            <>
              <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
                <p className="rounded-lg border border-white/20 bg-white/10 px-3 py-2">
                  Total pulls: {pullStatistics.totalPulls}
                </p>
                <p className="rounded-lg border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-amber-100">
                  S items: {pullStatistics.totalS}
                </p>
                <p className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-cyan-100">
                  Avg S pity: {pullStatistics.averagePity}
                </p>
                <p className="rounded-lg border border-violet-300/40 bg-violet-500/15 px-3 py-2 text-violet-100">
                  Max S pity: {pullStatistics.maxPity}
                </p>
              </div>

              <h3 className="mb-2 text-lg font-semibold">Resource spent</h3>
              <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
                <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-emerald-100">
                  Total: {formatResource(pullStatistics.totalPulls)}
                </p>
                <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-emerald-100">
                  Avg per S: {formatResource(pullStatistics.averagePity)}
                </p>
                <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-emerald-100">
                  Max per S: {formatResource(pullStatistics.maxPity)}
                </p>
                <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-emerald-100">
                  Latest S:{" "}
                  {pullStatistics.lastSPity === null
                    ? "-"
                    : formatResource(pullStatistics.lastSPity)}
                </p>
              </div>

              <p className="mb-3 text-sm text-slate-300/90">
                Latest S pity:{" "}
                {pullStatistics.lastSPity === null
                  ? "No S item yet"
                  : pullStatistics.lastSPity}
              </p>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-300/85">
                  Page {pullStatistics.pagination.page} of{" "}
                  {pullStatistics.pagination.totalPages} •{" "}
                  {pullStatistics.pagination.totalCount} S entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void loadRecordedHistory(
                        recordPagination.page,
                        banner,
                        pullStatistics.pagination.page - 1,
                      )
                    }
                    disabled={!pullStatistics.pagination.hasPrevPage}
                    className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void loadRecordedHistory(
                        recordPagination.page,
                        banner,
                        pullStatistics.pagination.page + 1,
                      )
                    }
                    disabled={!pullStatistics.pagination.hasNextPage}
                    className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              {pullStatistics.entries.length === 0 ? (
                <p className="text-slate-300">
                  No S items recorded for this banner yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {pullStatistics.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-amber-300/40 bg-amber-500/15 px-4 py-3"
                    >
                      <p className="text-base font-semibold text-amber-100">
                        - {entry.itemName}: {entry.pity}
                      </p>
                      <p className="text-xs text-slate-200/85">
                        {new Date(entry.createdAt).toLocaleString()} •{" "}
                        {entry.featured ? "featured" : "standard"} •{" "}
                        {formatResource(entry.pity)} spent
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-slate-300">No statistics available yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Recorded pull history</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void loadRecordedHistory(recordPagination.page - 1)
                }
                disabled={!recordPagination.hasPrevPage}
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() =>
                  void loadRecordedHistory(recordPagination.page + 1)
                }
                disabled={!recordPagination.hasNextPage}
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => void loadRecordedHistory(recordPagination.page)}
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20"
              >
                Refresh
              </button>
            </div>
          </div>
          <p className="mb-3 text-sm text-slate-300/85">
            Page {recordPagination.page} of {recordPagination.totalPages} •{" "}
            {recordPagination.totalCount} records
          </p>

          {recordedHistory.length === 0 ? (
            <p className="text-slate-300">No recorded pulls yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recordedHistory.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl border px-4 py-3 ${
                    item.rarity === 5
                      ? "border-amber-300/60 bg-amber-500/20"
                      : item.rarity === 4
                        ? "border-violet-300/60 bg-violet-500/20"
                        : "border-blue-300/50 bg-blue-500/15"
                  }`}
                >
                  <p className="text-xs text-slate-200/85">
                    {new Date(item.createdAt).toLocaleString()} •{" "}
                    {item.bannerName}
                  </p>
                  <p className="text-lg font-semibold">
                    {item.rarity}★ {item.itemName}
                  </p>
                  <p className="text-sm text-slate-100/90">
                    {item.itemType}
                    {item.featured ? " • featured" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
