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

const REVEAL_SFX_BY_RARITY: Record<3 | 4 | 5, string> = {
  3: "/sfx/reveal-3star.ogg",
  4: "/sfx/reveal-4star.ogg",
  5: "/sfx/reveal-5star.ogg",
};
const RESOURCE_PER_PULL = 160;

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
  const revealAudioRef = useRef<Partial<Record<3 | 4 | 5, HTMLAudioElement>>>(
    {},
  );
  const revealModalRef = useRef<HTMLDivElement | null>(null);
  const revealCardRef = useRef<HTMLDivElement | null>(null);
  const sBackdropPulseRef = useRef<HTMLDivElement | null>(null);
  const sFlashRef = useRef<HTMLDivElement | null>(null);
  const sRingRef = useRef<HTMLDivElement | null>(null);
  const sRaysRef = useRef<HTMLDivElement | null>(null);
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
    () =>
      catalog.find((entry) => entry.name === banner) ?? fallbackCatalog[0],
    [banner, catalog],
  );
  const latest = history[0] ?? null;
  const normalizedSoundVolume = soundVolume / 100;
  const isRevealingBatch = revealBatch !== null;
  const lastRevealedItem =
    revealBatch && revealedCount > 0
      ? revealBatch[Math.min(revealedCount, revealBatch.length) - 1]
      : null;

  const applyRollResults = (created: PullResult[]) => {
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

  const finalizeRoll = () => {
    if (!pendingResults) {
      setIsRolling(false);
      setRollVideoSrc(null);
      return;
    }

    const created = pendingResults;
    setPendingResults(null);
    setRollVideoSrc(null);
    setIsRolling(false);
    if (created.length > 0) {
      setRevealBatch(created);
      setRevealedCount(0);
      return;
    }
    applyRollResults(created);
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
      const nextItem = revealBatch[revealedCount];
      playRevealSfx(nextItem.rarity);
      setRevealedCount((prev) => prev + 1);
      return;
    }

    const completedBatch = revealBatch;
    setRevealBatch(null);
    setRevealedCount(0);
    applyRollResults(completedBatch);
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

  const handleSkipReveal = () => {
    if (!revealBatch) {
      return;
    }

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
      const animate = await getAnimate();
      if (disposed) {
        return;
      }

      if (typeof animate !== "function") {
        return;
      }

      if (!revealCardRef.current || !lastRevealedItem) {
        return;
      }

      if (lastRevealedItem.rarity === 5) {
        animate(revealCardRef.current, {
          opacity: [0, 1],
          scale: [0.78, 1.04, 1],
          translateY: [24, -4, 0],
          rotateZ: [-3, 1, 0],
          duration: 840,
          ease: "outExpo",
        });

        if (sBackdropPulseRef.current) {
          animate(sBackdropPulseRef.current, {
            opacity: [0, 0.9, 0],
            scale: [0.92, 1.18],
            duration: 920,
            ease: "outExpo",
          });
        }

        if (sFlashRef.current) {
          animate(sFlashRef.current, {
            opacity: [0.95, 0],
            scale: [0.85, 1.25],
            duration: 620,
            ease: "outExpo",
          });
        }

        if (sRingRef.current) {
          animate(sRingRef.current, {
            opacity: [0.95, 0],
            scale: [0.65, 1.35],
            rotateZ: [0, 80],
            duration: 980,
            ease: "outCirc",
          });
        }

        if (sRaysRef.current) {
          animate(sRaysRef.current, {
            opacity: [0, 1, 0.25],
            scale: [0.7, 1.2],
            rotate: [-20, 0, 18],
            duration: 1100,
            ease: "outExpo",
          });
        }
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
        : "from-slate-400 via-slate-300 to-slate-200";
  const revealCardStyle =
    lastRevealedItem?.rarity === 5
      ? "from-amber-400/30 via-orange-400/20 to-rose-400/30 border-amber-300/70 shadow-[0_0_70px_rgba(251,191,36,0.35)]"
      : lastRevealedItem?.rarity === 4
        ? "from-violet-400/30 via-fuchsia-400/20 to-indigo-400/30 border-violet-300/70 shadow-[0_0_70px_rgba(167,139,250,0.35)]"
        : "from-slate-500/30 via-slate-400/20 to-slate-500/30 border-slate-300/60 shadow-[0_0_40px_rgba(148,163,184,0.25)]";
  const revealRankStyle =
    lastRevealedItem?.rarity === 5
      ? "border-amber-300/80 bg-amber-400/30 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
      : lastRevealedItem?.rarity === 4
        ? "border-violet-300/80 bg-violet-400/30 text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.45)]"
        : "border-slate-300/70 bg-slate-300/20 text-slate-100 shadow-[0_0_20px_rgba(148,163,184,0.35)]";
  const revealAuraStyle =
    lastRevealedItem?.rarity === 5
      ? "from-amber-300/20 via-orange-300/10 to-rose-300/20"
      : lastRevealedItem?.rarity === 4
        ? "from-violet-300/20 via-fuchsia-300/10 to-indigo-300/20"
        : "from-slate-300/20 via-slate-200/10 to-slate-300/20";
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
                muted={soundVolume === 0}
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
            className="fixed inset-0 z-40 flex cursor-pointer items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_70%)] p-4 backdrop-blur-sm"
            onClick={() => void handleRevealNext()}
          >
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
                  <div
                    ref={sBackdropPulseRef}
                    className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.55)_0%,rgba(244,114,182,0.3)_35%,rgba(15,23,42,0)_70%)] opacity-0 blur-2xl"
                  />
                ) : null}
                <div
                  ref={revealCardRef}
                  className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 ${revealCardStyle}`}
                >
                  {lastRevealedItem.rarity === 5 ? (
                    <>
                      <div
                        ref={sFlashRef}
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-white opacity-0"
                      />
                      <div
                        ref={sRaysRef}
                        className="pointer-events-none absolute -inset-16 rounded-full bg-[conic-gradient(from_0deg,rgba(253,224,71,0.0),rgba(253,224,71,0.85),rgba(251,146,60,0.7),rgba(244,114,182,0.75),rgba(253,224,71,0.0))] opacity-0 blur-xl"
                      />
                      <div
                        ref={sRingRef}
                        className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-200/90 opacity-0"
                      />
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
                  <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
                    <span
                      className={`inline-flex min-w-24 items-center justify-center rounded-full border px-5 py-1.5 text-xl font-black tracking-[0.25em] ${revealRankStyle}`}
                    >
                      {revealRankLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={revealModalRef} className="pointer-events-none text-center text-slate-300">
                Click anywhere to reveal
              </div>
            )}
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
              <span className="w-9 text-right font-semibold">{soundVolume}%</span>
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
            <button
              type="button"
              onClick={() => runPull(1)}
              className="h-14 w-full rounded-xl border border-cyan-300/60 bg-cyan-500/20 px-8 text-2xl font-bold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-50 sm:w-44"
              disabled={isRolling || isRevealingBatch}
            >
              x1
            </button>
            <button
              type="button"
              onClick={() => runPull(10)}
              className="h-14 w-full rounded-xl border border-amber-300/60 bg-amber-500/20 px-8 text-2xl font-bold uppercase tracking-wide text-amber-100 transition hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-50 sm:w-44"
              disabled={isRolling || isRevealingBatch}
            >
              x10
            </button>
          </div>
        </div>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">S-item pity statistics</h2>
            <button
              type="button"
              onClick={() =>
                void loadRecordedHistory(recordPagination.page, banner, sPityPage)
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
                <p className="text-slate-300">No S items recorded for this banner yet.</p>
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
                        : "border-slate-300/40 bg-slate-500/15"
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
