import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PityPayload = {
  bannerName?: unknown;
  currentPity?: unknown;
  fourStarPity?: unknown;
  totalPity?: unknown;
  guaranteedFeatured?: unknown;
};

function normalizeBannerName(value: unknown): string | null {
  const bannerName = typeof value === "string" ? value.trim() : "";
  return bannerName ? bannerName : null;
}

function normalizeNonNegativeInt(value: unknown): number | null {
  if (!Number.isInteger(value) || Number(value) < 0) {
    return null;
  }
  return Number(value);
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }
  return value;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const bannerName = normalizeBannerName(searchParams.get("bannerName"));
  if (!bannerName) {
    return NextResponse.json({ error: "bannerName query param is required" }, { status: 400 });
  }

  const state = await prisma.gachaState.findUnique({
    where: { bannerName },
  });

  if (!state) {
    return NextResponse.json({
      bannerName,
      currentPity: 0,
      fourStarPity: 0,
      totalPity: 0,
      guaranteedFeatured: false,
    });
  }

  return NextResponse.json({
    bannerName: state.bannerName,
    currentPity: state.currentPity,
    fourStarPity: state.fourStarPity,
    totalPity: state.totalPity,
    guaranteedFeatured: state.guaranteedFeatured,
  });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as PityPayload;
  const bannerName = normalizeBannerName(payload.bannerName);
  if (!bannerName) {
    return NextResponse.json({ error: "bannerName is required" }, { status: 400 });
  }

  const currentPity = normalizeNonNegativeInt(payload.currentPity);
  const fourStarPity = normalizeNonNegativeInt(payload.fourStarPity);
  const totalPity = normalizeNonNegativeInt(payload.totalPity);
  const guaranteedFeatured = normalizeBoolean(payload.guaranteedFeatured);

  if (currentPity === null || fourStarPity === null || totalPity === null || guaranteedFeatured === null) {
    return NextResponse.json(
      {
        error:
          "currentPity, fourStarPity, totalPity must be non-negative integers and guaranteedFeatured must be boolean",
      },
      { status: 400 },
    );
  }

  const state = await prisma.gachaState.upsert({
    where: { bannerName },
    update: { currentPity, fourStarPity, totalPity, guaranteedFeatured },
    create: { bannerName, currentPity, fourStarPity, totalPity, guaranteedFeatured },
  });

  return NextResponse.json({
    bannerName: state.bannerName,
    currentPity: state.currentPity,
    fourStarPity: state.fourStarPity,
    totalPity: state.totalPity,
    guaranteedFeatured: state.guaranteedFeatured,
  });
}
