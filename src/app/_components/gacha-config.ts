import type { PullResult } from "@/lib/gacha";

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
export const GOLDEN_SIGN_SFX = "/sfx/zzz-golden-sign.mp3";

export const REVEAL_SFX_BY_RARITY: Record<3 | 4 | 5, string> = {
  3: "/sfx/reveal-3star.ogg",
  4: "/sfx/reveal-4star.ogg",
  5: "/sfx/reveal-5star.ogg",
};

// Featured S reveal: a black-screen five-star intro of this length runs before the card opens.
export const FEATURED_INTRO_MS = 700;

export const RESOURCE_PER_PULL = 160;
// Every pull goes through the one-by-one reveal and a single POST /api/pulls, so keep batches bounded.
export const MAX_PULL_COUNT = 5000;

export const DEFAULT_HISTORY_PAGE_SIZE = 12;
export const DEFAULT_S_PITY_PAGE_SIZE = 12;

export function parsePullCount(value: string): number | null {
  const parsed = Number(value);
  return value.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= 1 &&
    parsed <= MAX_PULL_COUNT
    ? parsed
    : null;
}

export function formatResource(pity: number): string {
  return Math.round(pity * RESOURCE_PER_PULL).toLocaleString();
}

export function pickRollVideo(
  created: PullResult[],
  count: number,
): string | null {
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
  return MULTI_ROLL_VIDEO_BY_TOP_RARITY[4];
}
