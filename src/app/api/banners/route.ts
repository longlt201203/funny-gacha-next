import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BannerPayload = {
  name?: unknown;
  bannerThumbnail?: unknown;
  itemIds?: unknown;
  fiveStarRate?: unknown;
  fourStarRate?: unknown;
  fiveStarHardPity?: unknown;
  fiveStarSoftPityStart?: unknown;
  fiveStarSoftIncrease?: unknown;
  fourStarHardPity?: unknown;
  winRate?: unknown;
  featuredRate?: unknown;
  guaranteeEnabled?: unknown;
};

type BannerSettingsInput = {
  fiveStarRate?: number;
  fourStarRate?: number;
  fiveStarHardPity?: number;
  fiveStarSoftPityStart?: number;
  fiveStarSoftIncrease?: number;
  fourStarHardPity?: number;
  featuredRate?: number;
  guaranteeEnabled?: boolean;
};

function normalizeSettings(payload: BannerPayload): { value: BannerSettingsInput } | { error: string } {
  const out: BannerSettingsInput = {};
  const numberFields = [
    "fiveStarRate",
    "fourStarRate",
    "fiveStarHardPity",
    "fiveStarSoftPityStart",
    "fiveStarSoftIncrease",
    "fourStarHardPity",
    "winRate",
    "featuredRate",
  ] as const;

  for (const field of numberFields) {
    const raw = payload[field];
    if (raw === undefined) {
      continue;
    }
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return { error: `${field} must be a finite number` };
    }
    if (field === "winRate") {
      out.featuredRate = raw;
      continue;
    }
    out[field] = raw;
  }

  if (payload.guaranteeEnabled !== undefined) {
    if (typeof payload.guaranteeEnabled !== "boolean") {
      return { error: "guaranteeEnabled must be boolean" };
    }
    out.guaranteeEnabled = payload.guaranteeEnabled;
  }

  return { value: out };
}

function normalizeBannerPayload(payload: BannerPayload) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return { error: "name is required" };
  }
  const bannerThumbnail =
    typeof payload.bannerThumbnail === "string"
      ? payload.bannerThumbnail.trim()
      : undefined;

  const ids = Array.isArray(payload.itemIds) ? payload.itemIds : [];
  const itemIds = ids.filter((value): value is number => Number.isInteger(value) && value > 0);
  if (itemIds.length !== ids.length) {
    return { error: "itemIds must be an array of positive integers" };
  }

  const normalizedSettings = normalizeSettings(payload);
  if ("error" in normalizedSettings) {
    return normalizedSettings;
  }

  return {
    value: { name, bannerThumbnail, itemIds, settings: normalizedSettings.value },
  };
}

export async function GET() {
  const banners = await prisma.banner.findMany({
    include: {
      items: {
        select: {
          id: true,
          name: true,
          rarity: true,
          featured: true,
          itemType: true,
          itemImage: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(
    banners.map((banner) => ({
      ...banner,
      winRate: banner.featuredRate,
    })),
  );
}

export async function POST(request: Request) {
  const payload = (await request.json()) as BannerPayload;
  const normalized = normalizeBannerPayload(payload);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const itemCount = await prisma.item.count({
    where: {
      id: { in: normalized.value.itemIds },
    },
  });
  if (itemCount !== normalized.value.itemIds.length) {
    return NextResponse.json({ error: "Some selected items do not exist" }, { status: 400 });
  }

  try {
    const banner = await prisma.banner.create({
      data: {
        name: normalized.value.name,
        bannerThumbnail: normalized.value.bannerThumbnail ?? "",
        ...normalized.value.settings,
        items: {
          connect: normalized.value.itemIds.map((id) => ({ id })),
        },
      },
      include: {
        items: {
          select: {
            id: true,
            name: true,
            rarity: true,
            featured: true,
            itemType: true,
            itemImage: true,
          },
        },
      },
    });

    return NextResponse.json({ ...banner, winRate: banner.featuredRate }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Banner name must be unique" }, { status: 409 });
    }
    throw error;
  }
}
