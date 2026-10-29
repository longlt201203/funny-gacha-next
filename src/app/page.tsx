"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GachaEngine,
  getFallbackBannerCatalog,
  mapApiBannersToCatalog,
  type BannerApiEntry,
  type BannerCatalogEntry,
  type PullResult,
} from "@/lib/gacha";
import { BannerHero } from "./_components/banner-hero";
import { GachaToolbar } from "./_components/gacha-toolbar";
import { pickRollVideo } from "./_components/gacha-config";
import { PullControls } from "./_components/pull-controls";
import { PullHistoryList } from "./_components/pull-history-list";
import { RevealOverlay } from "./_components/reveal-overlay";
import { RollVideoOverlay } from "./_components/roll-video-overlay";
import { SPityStats } from "./_components/s-pity-stats";
import type { PersistedPityState } from "./_components/types";
import { useGachaAudio } from "./_components/use-gacha-audio";
import { usePullRecords } from "./_components/use-pull-records";
import { useSoundVolume } from "./_components/use-sound-volume";

const fallbackCatalog = getFallbackBannerCatalog();

export default function Home() {
  const [catalog, setCatalog] = useState<BannerCatalogEntry[]>(fallbackCatalog);
  const [banner, setBanner] = useState(fallbackCatalog[0].name);
  const [totalPity, setTotalPity] = useState(0);
  const [history, setHistory] = useState<PullResult[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [pityError, setPityError] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollVideoSrc, setRollVideoSrc] = useState<string | null>(null);
  const [pendingResults, setPendingResults] = useState<PullResult[] | null>(
    null,
  );
  const [revealBatch, setRevealBatch] = useState<PullResult[] | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);

  const engineRef = useRef(new GachaEngine(fallbackCatalog[0]));
  const [currentPity, setCurrentPity] = useState(
    engineRef.current.getCurrentPity(),
  );
  const [fourStarPity, setFourStarPity] = useState(
    engineRef.current.getFourStarPity(),
  );

  const [soundVolume, setSoundVolume] = useSoundVolume();
  const normalizedSoundVolume = soundVolume / 100;
  const { playGoldenSign, stopGoldenSign, playItemRevealSfx, cancelDelayedSfx } =
    useGachaAudio(normalizedSoundVolume);
  const {
    recordedHistory,
    recordPagination,
    pullStatistics,
    sPityPage,
    setSPityPage,
    recordError,
    loadRecordedHistory,
    recordPullHistory,
    clearRecordedHistoryForBanner,
  } = usePullRecords(banner);

  const bannerOptions = useMemo(
    () => catalog.map((item) => item.name),
    [catalog],
  );
  const selectedBannerEntry = useMemo(
    () => catalog.find((entry) => entry.name === banner) ?? fallbackCatalog[0],
    [banner, catalog],
  );
  const latest = history[0] ?? null;
  const isRevealingBatch = revealBatch !== null;
  const isBusy = isRolling || isRevealingBatch;
  const rollHasS = pendingResults?.some((item) => item.rarity === 5) ?? false;
  const lastRevealedItem =
    revealBatch && revealedCount > 0
      ? revealBatch[Math.min(revealedCount, revealBatch.length) - 1]
      : null;

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

  const handleRevealAdvance = () => {
    if (!revealBatch) {
      return;
    }

    if (revealedCount < revealBatch.length) {
      playItemRevealSfx(revealBatch[revealedCount]);
      setRevealedCount((prev) => prev + 1);
      return;
    }

    const completedBatch = revealBatch;
    setRevealBatch(null);
    setRevealedCount(0);
    applyRollResults(completedBatch);
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
    if (isBusy) {
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
    if (isBusy) {
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
    if (isBusy) {
      return;
    }
    const nextEntry = catalog.find((entry) => entry.name === nextBanner);
    if (!nextEntry) {
      setDataError(`Banner "${nextBanner}" does not exist in loaded data.`);
      return;
    }
    applyBannerEngine(nextEntry);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#1e293b_0%,#111827_45%,#09090b_100%)] px-4 py-6 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {isRolling && rollVideoSrc ? (
          <RollVideoOverlay
            src={rollVideoSrc}
            hasS={rollHasS}
            volume={normalizedSoundVolume}
            muted={soundVolume === 0 || rollHasS}
            onFinish={finalizeRoll}
          />
        ) : null}
        {revealBatch && lastRevealedItem ? (
          <RevealOverlay
            item={lastRevealedItem}
            hasMore={revealedCount < revealBatch.length}
            onAdvance={handleRevealAdvance}
            onSkip={handleSkipReveal}
          />
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

        <GachaToolbar
          banner={banner}
          bannerOptions={bannerOptions}
          onBannerChange={switchBanner}
          disabled={isBusy}
          soundVolume={soundVolume}
          onSoundVolumeChange={setSoundVolume}
        />

        <BannerHero
          name={banner}
          thumbnail={selectedBannerEntry.bannerThumbnail}
          latestRarity={latest?.rarity ?? null}
        />

        <PullControls
          currentPity={currentPity}
          totalPity={totalPity}
          disabled={isBusy}
          onReset={resetRun}
          onPull={runPull}
        />

        <SPityStats
          statistics={pullStatistics}
          onRefresh={() =>
            void loadRecordedHistory(recordPagination.page, banner, sPityPage)
          }
          onPageChange={(page) =>
            void loadRecordedHistory(recordPagination.page, banner, page)
          }
        />

        <PullHistoryList
          items={recordedHistory}
          pagination={recordPagination}
          onPageChange={(page) => void loadRecordedHistory(page)}
        />
      </div>
    </main>
  );
}
