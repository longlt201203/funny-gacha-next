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

function parseId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const itemId = parseId(id);
  if (!itemId) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const exists = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const payload = (await request.json()) as ItemPayload;
  const normalized = normalizePayload(payload);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const updated = await prisma.item.update({
    where: { id: itemId },
    data: normalized.value,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const itemId = parseId(id);
  if (!itemId) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const exists = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await prisma.item.delete({ where: { id: itemId } });
  return new NextResponse(null, { status: 204 });
}
