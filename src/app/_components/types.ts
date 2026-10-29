export type RecordedPull = {
  id: number;
  bannerName: string;
  pullBatchId: string;
  pullOrder: number;
  rarity: number;
  itemType: "WEAPON" | "CHARACTER";
  itemName: string;
  itemImage: string;
  featured: boolean;
  createdAt: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
};

export type SPityEntry = {
  id: number;
  itemName: string;
  pity: number;
  featured: boolean;
  createdAt: string;
};

export type PullStatistics = {
  totalPulls: number;
  totalS: number;
  averagePity: number;
  maxPity: number;
  lastSPity: number | null;
  entries: SPityEntry[];
  pagination: Pagination;
};

export type PersistedPityState = {
  bannerName: string;
  currentPity: number;
  fourStarPity: number;
  totalPity: number;
  guaranteedFeatured: boolean;
};
