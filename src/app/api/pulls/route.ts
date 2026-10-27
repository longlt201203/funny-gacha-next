import { randomUUID } from "crypto";
import { ItemType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PullPayload = {
  bannerName?: unknown;
  pulls?: unknown;
};

type PullInput = {
  name?: unknown;
  itemType?: unknown;
  itemImage?: unknown;
  rarity?: unknown;
  featured?: unknown;
};

function isValidItemType(value: unknown): value is ItemType {
  return value === "WEAPON" || value === "CHARACTER";
}

function isValidRarity(value: unknown): value is 3 | 4 | 5 {
  return value === 3 || value === 4 || value === 5;
}

function normalizePulls(payload: PullPayload) {
  const bannerName = typeof payload.bannerName === "string" ? payload.bannerName.trim() : "";
  if (!bannerName) {
    return { error: "bannerName is required" };
  }

  if (!Array.isArray(payload.pulls) || payload.pulls.length === 0) {
    return { error: "pulls must be a non-empty array" };
  }

  const normalized: Array<{
    itemName: string;
    itemType: ItemType;
    itemImage: string;
    rarity: 3 | 4 | 5;
    featured: boolean;
  }> = [];

  for (const pull of payload.pulls as PullInput[]) {
    const itemName = typeof pull.name === "string" ? pull.name.trim() : "";
    const itemImage = typeof pull.itemImage === "string" ? pull.itemImage.trim() : "";

    if (!itemName) {
      return { error: "Each pull must include name" };
    }
    if (!itemImage) {
      return { error: "Each pull must include itemImage" };
    }
    if (!isValidItemType(pull.itemType)) {
      return { error: "Each pull must include itemType as WEAPON or CHARACTER" };
    }
    if (!isValidRarity(pull.rarity)) {
      return { error: "Each pull must include rarity as 3, 4, or 5" };
    }

    normalized.push({
      itemName,
      itemImage,
      itemType: pull.itemType,
      rarity: pull.rarity,
      featured: pull.featured === true,
    });
  }

  return {
    value: {
      bannerName,
      pulls: normalized,
    },
  };
}

export async function GET(request: Request) {
  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 12;
  const DEFAULT_S_STATS_PAGE_SIZE = 12;
  const MAX_PAGE_SIZE = 50;
  const searchParams = new URL(request.url).searchParams;
  const bannerName = (searchParams.get("bannerName") ?? "").trim();
  const withSStats = searchParams.get("withSStats") === "1";

  const parsedPage = Number(searchParams.get("page") ?? DEFAULT_PAGE);
  const parsedPageSize = Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  const parsedSPage = Number(searchParams.get("sPage") ?? DEFAULT_PAGE);
  const parsedSPageSize = Number(searchParams.get("sPageSize") ?? DEFAULT_S_STATS_PAGE_SIZE);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE;
  const pageSize =
    Number.isInteger(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const sPage = Number.isInteger(parsedSPage) && parsedSPage > 0 ? parsedSPage : DEFAULT_PAGE;
  const sPageSize =
    Number.isInteger(parsedSPageSize) && parsedSPageSize > 0
      ? Math.min(parsedSPageSize, MAX_PAGE_SIZE)
      : DEFAULT_S_STATS_PAGE_SIZE;

  const where = bannerName ? { bannerName } : undefined;
  const totalCount = await prisma.pullHistory.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  const pulls = await prisma.pullHistory.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  let sStats:
    | {
        totalPulls: number;
        totalS: number;
        averagePity: number;
        maxPity: number;
        lastSPity: number | null;
        entries: Array<{
          id: number;
          itemName: string;
          pity: number;
          featured: boolean;
          createdAt: Date;
        }>;
        pagination: {
          page: number;
          pageSize: number;
          totalCount: number;
          totalPages: number;
          hasPrevPage: boolean;
          hasNextPage: boolean;
        };
      }
    | undefined;

  if (withSStats) {
    const statsRows = await prisma.pullHistory.findMany({
      where,
      select: {
        id: true,
        rarity: true,
        itemName: true,
        featured: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    let pullsSinceLastS = 0;
    const entries: Array<{
      id: number;
      itemName: string;
      pity: number;
      featured: boolean;
      createdAt: Date;
    }> = [];

    for (const row of statsRows) {
      pullsSinceLastS += 1;
      if (row.rarity === 5) {
        entries.push({
          id: row.id,
          itemName: row.itemName,
          pity: pullsSinceLastS,
          featured: row.featured,
          createdAt: row.createdAt,
        });
        pullsSinceLastS = 0;
      }
    }

    const pityValues = entries.map((entry) => entry.pity);
    const totalS = pityValues.length;
    const averagePity =
      totalS > 0 ? Number((pityValues.reduce((sum, value) => sum + value, 0) / totalS).toFixed(2)) : 0;
    const maxPity = totalS > 0 ? Math.max(...pityValues) : 0;
    const lastSPity = totalS > 0 ? entries[entries.length - 1].pity : null;
    const newestFirstEntries = [...entries].reverse();
    const sTotalCount = newestFirstEntries.length;
    const sTotalPages = Math.max(1, Math.ceil(sTotalCount / sPageSize));
    const safeSPage = Math.min(sPage, sTotalPages);
    const pagedEntries = newestFirstEntries.slice((safeSPage - 1) * sPageSize, safeSPage * sPageSize);

    sStats = {
      totalPulls: statsRows.length,
      totalS,
      averagePity,
      maxPity,
      lastSPity,
      entries: pagedEntries,
      pagination: {
        page: safeSPage,
        pageSize: sPageSize,
        totalCount: sTotalCount,
        totalPages: sTotalPages,
        hasPrevPage: safeSPage > 1,
        hasNextPage: safeSPage < sTotalPages,
      },
    };
  }

  return NextResponse.json({
    items: pulls,
    pagination: {
      page: safePage,
      pageSize,
      totalCount,
      totalPages,
      hasPrevPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
    statistics: sStats,
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as PullPayload;
  const normalized = normalizePulls(payload);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const pullBatchId = randomUUID();
  await prisma.pullHistory.createMany({
    data: normalized.value.pulls.map((pull, index) => ({
      bannerName: normalized.value.bannerName,
      pullBatchId,
      pullOrder: index + 1,
      rarity: pull.rarity,
      itemType: pull.itemType,
      itemName: pull.itemName,
      itemImage: pull.itemImage,
      featured: pull.featured,
    })),
  });

  return NextResponse.json(
    {
      pullBatchId,
      recorded: normalized.value.pulls.length,
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const bannerName = (searchParams.get("bannerName") ?? "").trim();

  if (!bannerName) {
    return NextResponse.json({ error: "bannerName query param is required" }, { status: 400 });
  }

  const result = await prisma.pullHistory.deleteMany({
    where: { bannerName },
  });

  return NextResponse.json({
    deletedCount: result.count,
    bannerName,
  });
}
