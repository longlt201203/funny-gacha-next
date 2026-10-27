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

function parseId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bannerId = parseId(id);
  if (!bannerId) {
    return NextResponse.json({ error: "Invalid banner id" }, { status: 400 });
  }

  const payload = (await request.json()) as BannerPayload;
  const normalized = normalizeBannerPayload(payload);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const exists = await prisma.banner.findUnique({ where: { id: bannerId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Banner not found" }, { status: 404 });
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
    const updated = await prisma.banner.update({
      where: { id: bannerId },
      data: {
        name: normalized.value.name,
        ...(normalized.value.bannerThumbnail !== undefined
          ? { bannerThumbnail: normalized.value.bannerThumbnail }
          : {}),
        ...normalized.value.settings,
        items: {
          set: normalized.value.itemIds.map((itemId) => ({ id: itemId })),
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

    return NextResponse.json({ ...updated, winRate: updated.featuredRate });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Banner name must be unique" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bannerId = parseId(id);
  if (!bannerId) {
    return NextResponse.json({ error: "Invalid banner id" }, { status: 400 });
  }

  const exists = await prisma.banner.findUnique({ where: { id: bannerId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Banner not found" }, { status: 404 });
  }

  await prisma.banner.delete({ where: { id: bannerId } });
  return new NextResponse(null, { status: 204 });
}
