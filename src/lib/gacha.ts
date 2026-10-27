type RandomFn = () => number;

interface WeightedEntry<T> {
  item: T;
  weight: number;
}

class GachaPool<T> {
  private readonly totalWeight: number;

  constructor(
    private readonly entries: readonly WeightedEntry<T>[],
    private readonly random: RandomFn = Math.random,
  ) {
    if (entries.length === 0) {
      throw new Error("GachaPool needs at least one entry");
    }

    let total = 0;
    for (const entry of entries) {
      if (!(entry.weight > 0) || !Number.isFinite(entry.weight)) {
        throw new Error(`Invalid weight ${entry.weight}: weights must be positive finite numbers`);
      }
      total += entry.weight;
    }
    this.totalWeight = total;
  }

  rollOne(): T {
    const rand = this.random() * this.totalWeight;
    let cumulative = 0;
    for (const entry of this.entries) {
      cumulative += entry.weight;
      if (rand < cumulative) {
        return entry.item;
      }
    }

    return this.entries[this.entries.length - 1]!.item;
  }
}

interface RarityRule {
  rate: number;
  pity?: number;
  softPity?: SoftPity;
  featuredRate?: number;
}

interface SoftPity {
  start: number;
  increase: number;
}

function hasPity(rule: RarityRule): boolean {
  return rule.pity !== undefined || rule.softPity !== undefined;
}

function rarityChanceAt(rule: RarityRule, n: number): number {
  if (rule.pity !== undefined && n >= rule.pity) {
    return 1;
  }
  if (rule.softPity !== undefined && n >= rule.softPity.start) {
    return Math.min(1, (rule.rate + rule.softPity.increase * (n - rule.softPity.start + 1)) / 100);
  }
  return rule.rate / 100;
}

type RarityTable<R extends string> = Record<R, RarityRule>;

interface RarityItem<R extends string> {
  rarity: R;
  featured?: boolean;
}

function groupByRarity<R extends string, T extends RarityItem<R>>(items: readonly T[]): Map<R, T[]> {
  const groups = new Map<R, T[]>();
  for (const item of items) {
    const group = groups.get(item.rarity);
    if (group) {
      group.push(item);
    } else {
      groups.set(item.rarity, [item]);
    }
  }
  return groups;
}

interface RarityPools<T> {
  all: GachaPool<T>;
  featured?: GachaPool<T>;
  standard?: GachaPool<T>;
}

function uniformPool<T>(items: readonly T[], random: RandomFn): GachaPool<T> | undefined {
  return items.length > 0 ? new GachaPool(items.map((item) => ({ item, weight: 1 })), random) : undefined;
}

class GachaBanner<R extends string, T extends RarityItem<R>> {
  private readonly itemPools = new Map<R, RarityPools<T>>();
  private readonly rarities: R[];
  private readonly pullsSince = new Map<R, number>();
  private guaranteedFeatured = false;

  constructor(
    items: readonly T[],
    private readonly table: RarityTable<R>,
    private readonly guaranteeEnabled: boolean,
    private readonly random: RandomFn = Math.random,
  ) {
    for (const [rarity, group] of groupByRarity<R, T>(items)) {
      const featuredRate = table[rarity].featuredRate;
      if (featuredRate !== undefined && !(featuredRate >= 0 && featuredRate <= 100)) {
        throw new Error(`Invalid featuredRate ${featuredRate} for ${rarity}: must be between 0 and 100`);
      }

      this.itemPools.set(rarity, {
        all: uniformPool(group, random)!,
        featured: uniformPool(group.filter((item) => item.featured), random),
        standard: uniformPool(group.filter((item) => !item.featured), random),
      });
    }

    this.rarities = [...this.itemPools.keys()].sort((a, b) => table[a].rate - table[b].rate);

    for (const rarity of this.rarities) {
      if (hasPity(table[rarity])) {
        this.pullsSince.set(rarity, 0);
      }
    }
  }

  getPity(rarity: R): number | undefined {
    return this.pullsSince.get(rarity);
  }

  setPity(rarity: R, value: number): void {
    if (!this.pullsSince.has(rarity)) {
      return;
    }
    this.pullsSince.set(rarity, Math.max(0, Math.floor(value)));
  }

  getRates(): Map<R, number> {
    const rates = new Map<R, number>();
    let remaining = 1;

    for (const rarity of this.rarities) {
      const pulls = this.pullsSince.get(rarity);
      if (pulls === undefined) {
        continue;
      }

      const rule = this.table[rarity];
      const chance = rarityChanceAt(rule, pulls + 1);
      if (chance > rule.rate / 100) {
        const granted = Math.min(remaining, chance);
        rates.set(rarity, granted);
        remaining -= granted;
      }
    }

    const unraised = this.rarities.filter((rarity) => !rates.has(rarity));
    const baseTotal = unraised.reduce((sum, rarity) => sum + this.table[rarity].rate, 0);
    for (const rarity of unraised) {
      rates.set(rarity, baseTotal > 0 ? (remaining * this.table[rarity].rate) / baseTotal : 0);
    }

    return rates;
  }

  pullOne(): T {
    const entries = [...this.getRates()]
      .filter(([, chance]) => chance > 0)
      .map(([rarity, chance]) => ({ item: rarity, weight: chance }));
    const rarity = new GachaPool(entries, this.random).rollOne();
    const item = this.pickItem(rarity);

    for (const [tracked, pulls] of this.pullsSince) {
      this.pullsSince.set(tracked, tracked === rarity ? 0 : pulls + 1);
    }

    return item;
  }

  getGuaranteedFeatured(): boolean {
    return this.guaranteedFeatured;
  }

  setGuaranteedFeatured(value: boolean): void {
    this.guaranteedFeatured = value;
  }

  private pickItem(rarity: R): T {
    const pools = this.itemPools.get(rarity)!;
    const featuredRate = this.table[rarity].featuredRate;
    if (featuredRate === undefined || !pools.featured || !pools.standard) {
      return pools.all.rollOne();
    }
    if (rarity === "S" && this.guaranteeEnabled && this.guaranteedFeatured) {
      this.guaranteedFeatured = false;
      return pools.featured.rollOne();
    }

    const wonFeatured = this.random() * 100 < featuredRate;
    if (rarity === "S" && this.guaranteeEnabled) {
      this.guaranteedFeatured = !wonFeatured;
    }

    return (wonFeatured ? pools.featured : pools.standard).rollOne();
  }

  pull(times: number): T[] {
    const results: T[] = [];
    for (let i = 0; i < times; i++) {
      results.push(this.pullOne());
    }
    return results;
  }

  reset(): void {
    for (const rarity of this.pullsSince.keys()) {
      this.pullsSince.set(rarity, 0);
    }
  }
}

export type BannerRarity = "B" | "A" | "S";
export type ItemType = "WEAPON" | "CHARACTER";
export type PullRarity = 3 | 4 | 5;

export interface BannerItem extends RarityItem<BannerRarity> {
  id?: number;
  name: string;
  itemType: ItemType;
  itemImage: string;
}

export interface BannerCatalogEntry {
  name: string;
  bannerThumbnail: string;
  items: BannerItem[];
  settings?: BannerSettings;
}

export interface BannerApiItem {
  id: number;
  name: string;
  rarity: string;
  featured: boolean;
  itemType: ItemType;
  itemImage: string;
}

export interface BannerApiEntry {
  id: number;
  name: string;
  bannerThumbnail?: string;
  items: BannerApiItem[];
  fiveStarRate: number;
  fourStarRate: number;
  fiveStarHardPity: number;
  fiveStarSoftPityStart: number;
  fiveStarSoftIncrease: number;
  fourStarHardPity: number;
  featuredRate?: number;
  winRate?: number;
  guaranteeEnabled: boolean;
}

export interface PullResult {
  id: number;
  name: string;
  itemType: ItemType;
  itemImage: string;
  rarity: PullRarity;
  featured: boolean;
}

export interface BannerSettings {
  fiveStarRate: number;
  fourStarRate: number;
  fiveStarHardPity: number;
  fiveStarSoftPityStart: number;
  fiveStarSoftIncrease: number;
  fourStarHardPity: number;
  winRate: number;
  guaranteeEnabled: boolean;
}

const DEFAULT_BANNER_SETTINGS: BannerSettings = {
  fiveStarRate: 0.6,
  fourStarRate: 5.1,
  fiveStarHardPity: 90,
  fiveStarSoftPityStart: 74,
  fiveStarSoftIncrease: 6,
  fourStarHardPity: 10,
  winRate: 50,
  guaranteeEnabled: true,
};

function normalizeBannerSettings(settings?: Partial<BannerSettings>): BannerSettings {
  const merged = { ...DEFAULT_BANNER_SETTINGS, ...settings };

  const fiveStarRate = Number.isFinite(merged.fiveStarRate) ? Math.max(0, merged.fiveStarRate) : DEFAULT_BANNER_SETTINGS.fiveStarRate;
  const fourStarRate = Number.isFinite(merged.fourStarRate) ? Math.max(0, merged.fourStarRate) : DEFAULT_BANNER_SETTINGS.fourStarRate;
  const winRate = Number.isFinite(merged.winRate)
    ? Math.min(100, Math.max(0, merged.winRate))
    : DEFAULT_BANNER_SETTINGS.winRate;
  const fiveStarHardPity = Number.isInteger(merged.fiveStarHardPity) ? Math.max(1, merged.fiveStarHardPity) : DEFAULT_BANNER_SETTINGS.fiveStarHardPity;
  const fiveStarSoftPityStart = Number.isInteger(merged.fiveStarSoftPityStart)
    ? Math.max(1, Math.min(merged.fiveStarSoftPityStart, fiveStarHardPity))
    : DEFAULT_BANNER_SETTINGS.fiveStarSoftPityStart;
  const fiveStarSoftIncrease = Number.isFinite(merged.fiveStarSoftIncrease)
    ? Math.max(0, merged.fiveStarSoftIncrease)
    : DEFAULT_BANNER_SETTINGS.fiveStarSoftIncrease;
  const fourStarHardPity = Number.isInteger(merged.fourStarHardPity) ? Math.max(1, merged.fourStarHardPity) : DEFAULT_BANNER_SETTINGS.fourStarHardPity;
  const guaranteeEnabled = typeof merged.guaranteeEnabled === "boolean" ? merged.guaranteeEnabled : DEFAULT_BANNER_SETTINGS.guaranteeEnabled;

  const total = fiveStarRate + fourStarRate;
  if (total > 100) {
    const scale = 100 / total;
    return {
      fiveStarRate: Number((fiveStarRate * scale).toFixed(4)),
      fourStarRate: Number((fourStarRate * scale).toFixed(4)),
      fiveStarHardPity,
      fiveStarSoftPityStart,
      fiveStarSoftIncrease,
      fourStarHardPity,
      winRate,
      guaranteeEnabled,
    };
  }

  return {
    fiveStarRate,
    fourStarRate,
    fiveStarHardPity,
    fiveStarSoftPityStart,
    fiveStarSoftIncrease,
    fourStarHardPity,
    winRate,
    guaranteeEnabled,
  };
}

function buildRarityTable(settings?: Partial<BannerSettings>): RarityTable<BannerRarity> {
  const normalized = normalizeBannerSettings(settings);
  const threeStarRate = Math.max(0, 100 - normalized.fiveStarRate - normalized.fourStarRate);
  return {
    S: {
      rate: normalized.fiveStarRate,
      pity: normalized.fiveStarHardPity,
      softPity: { start: normalized.fiveStarSoftPityStart, increase: normalized.fiveStarSoftIncrease },
      featuredRate: normalized.winRate,
    },
    A: { rate: normalized.fourStarRate, pity: normalized.fourStarHardPity },
    B: { rate: threeStarRate },
  };
}

function isBannerRarity(value: string): value is BannerRarity {
  return value === "B" || value === "A" || value === "S";
}

function rarityToStars(rarity: BannerRarity): PullRarity {
  if (rarity === "S") {
    return 5;
  }
  if (rarity === "A") {
    return 4;
  }
  return 3;
}

const FALLBACK_CATALOG: BannerCatalogEntry[] = [
  {
    name: "Custom",
    bannerThumbnail: "https://placehold.co/1280x720/0f172a/e2e8f0?text=Custom+Banner",
    settings: DEFAULT_BANNER_SETTINGS,
    items: [
      {
        name: "Fallback Sword",
        rarity: "B",
        itemType: "WEAPON",
        itemImage: "https://placehold.co/640x360/78716c/ffffff?text=Fallback+Sword",
      },
      {
        name: "Fallback Ranger",
        rarity: "A",
        itemType: "CHARACTER",
        itemImage: "https://placehold.co/640x360/3b82f6/ffffff?text=Fallback+Ranger",
      },
      {
        name: "Fallback Legend",
        rarity: "S",
        itemType: "CHARACTER",
        featured: true,
        itemImage: "https://placehold.co/640x360/f59e0b/111111?text=Fallback+Legend",
      },
    ],
  },
];

export function getFallbackBannerCatalog(): BannerCatalogEntry[] {
  return FALLBACK_CATALOG;
}

export function mapApiBannersToCatalog(banners: BannerApiEntry[]): BannerCatalogEntry[] {
  const catalog: BannerCatalogEntry[] = [];

  for (const banner of banners) {
    const mappedItems: BannerItem[] = [];
    for (const item of banner.items) {
      const normalizedRarity = item.rarity.trim().toUpperCase();
      if (!isBannerRarity(normalizedRarity)) {
        continue;
      }

      mappedItems.push({
        id: item.id,
        name: item.name,
        rarity: normalizedRarity,
        featured: item.featured,
        itemType: item.itemType,
        itemImage: item.itemImage,
      });
    }

    if (mappedItems.length > 0) {
      catalog.push({
        name: banner.name,
        bannerThumbnail: banner.bannerThumbnail ?? "",
        settings: normalizeBannerSettings({
          fiveStarRate: banner.fiveStarRate,
          fourStarRate: banner.fourStarRate,
          fiveStarHardPity: banner.fiveStarHardPity,
          fiveStarSoftPityStart: banner.fiveStarSoftPityStart,
          fiveStarSoftIncrease: banner.fiveStarSoftIncrease,
          fourStarHardPity: banner.fourStarHardPity,
          winRate: banner.winRate ?? banner.featuredRate,
          guaranteeEnabled: banner.guaranteeEnabled,
        }),
        items: mappedItems,
      });
    }
  }

  return catalog;
}

export class GachaEngine {
  private banner: GachaBanner<BannerRarity, BannerItem>;

  constructor(public readonly config: BannerCatalogEntry) {
    if (config.items.length === 0) {
      throw new Error(`Banner "${config.name}" has no items`);
    }
    const settings = normalizeBannerSettings(config.settings);
    const table = buildRarityTable(settings);
    this.banner = new GachaBanner(config.items, table, settings.guaranteeEnabled);
  }

  getCurrentPity(): number {
    return this.banner.getPity("S") ?? 0;
  }

  getFourStarPity(): number {
    return this.banner.getPity("A") ?? 0;
  }

  getGuaranteedFeatured(): boolean {
    return this.banner.getGuaranteedFeatured();
  }

  hydratePityState(currentPity: number, fourStarPity: number, guaranteedFeatured: boolean): void {
    this.banner.setPity("S", currentPity);
    this.banner.setPity("A", fourStarPity);
    this.banner.setGuaranteedFeatured(guaranteedFeatured);
  }

  getRates(): { fiveStar: number; fourStar: number; threeStar: number } {
    const rates = this.banner.getRates();
    return {
      fiveStar: (rates.get("S") ?? 0) * 100,
      fourStar: (rates.get("A") ?? 0) * 100,
      threeStar: (rates.get("B") ?? 0) * 100,
    };
  }

  pull(startId: number, count: number): PullResult[] {
    const results = this.banner.pull(count);
    return results.map((item, index) => ({
      id: startId + index,
      name: item.name,
      itemType: item.itemType,
      itemImage: item.itemImage,
      rarity: rarityToStars(item.rarity),
      featured: !!item.featured,
    }));
  }

  reset(): void {
    this.banner.reset();
  }
}
