import { ItemType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ItemPayload = {
  name?: unknown;
  rarity?: unknown;
  featured?: unknown;
  itemType?: unknown;
  itemImage?: unknown;
};

function isValidItemType(value: unknown): value is ItemType {
  return value === "WEAPON" || value === "CHARACTER";
}

function isValidRarity(value: string): boolean {
  return value === "B" || value === "A" || value === "S";
}

function normalizePayload(payload: ItemPayload) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const rarity = typeof payload.rarity === "string" ? payload.rarity.trim().toUpperCase() : "";
  const itemImage = typeof payload.itemImage === "string" ? payload.itemImage.trim() : "";
  const featured = payload.featured === true;

  if (!name) {
    return { error: "name is required" };
  }
  if (!rarity) {
    return { error: "rarity is required" };
  }
  if (!isValidRarity(rarity)) {
    return { error: "rarity must be B, A, or S" };
  }
  if (!itemImage) {
    return { error: "itemImage is required" };
  }
  if (!isValidItemType(payload.itemType)) {
    return { error: "itemType must be WEAPON or CHARACTER" };
  }

  return {
    value: {
      name,
      rarity,
      featured,
      itemType: payload.itemType,
      itemImage,
    },
  };
}

export async function GET() {
  const items = await prisma.item.findMany({
    include: {
      banners: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ItemPayload;
  const normalized = normalizePayload(payload);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const item = await prisma.item.create({
    data: normalized.value,
  });
  return NextResponse.json(item, { status: 201 });
}
