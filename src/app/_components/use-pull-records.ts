"use client";

import { useState } from "react";
import type { PullResult } from "@/lib/gacha";
import {
  DEFAULT_HISTORY_PAGE_SIZE,
  DEFAULT_S_PITY_PAGE_SIZE,
} from "./gacha-config";
import type { Pagination, PullStatistics, RecordedPull } from "./types";

/** Recorded pull history and S-pity statistics for `banner`, backed by /api/pulls. */
export function usePullRecords(banner: string) {
  const [recordedHistory, setRecordedHistory] = useState<RecordedPull[]>([]);
  const [recordPagination, setRecordPagination] = useState<Pagination>({
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
  const [recordError, setRecordError] = useState<string | null>(null);

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
      pagination: Pagination;
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

  return {
    recordedHistory,
    recordPagination,
    pullStatistics,
    sPityPage,
    setSPityPage,
    recordError,
    loadRecordedHistory,
    recordPullHistory,
    clearRecordedHistoryForBanner,
  };
}
