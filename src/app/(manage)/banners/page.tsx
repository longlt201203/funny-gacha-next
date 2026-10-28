"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CardSkeletonGrid,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  ImageDropzone,
  RARITIES,
  RARITY_META,
  RarityBadge,
  SegmentedControl,
  ToastViewport,
  Toggle,
  buttonClass,
  cx,
  inputBaseClass,
  inputClass,
  readError,
  toRarity,
  uploadImage,
  useToasts,
  type Rarity,
} from "../_components/ui";

type ItemOption = {
  id: number;
  name: string;
  rarity: string;
  featured: boolean;
  itemType: "WEAPON" | "CHARACTER";
  itemImage: string;
};

type BannerRow = {
  id: number;
  name: string;
  bannerThumbnail: string;
  items: ItemOption[];
  fiveStarRate: number;
  fourStarRate: number;
  fiveStarHardPity: number;
  fiveStarSoftPityStart: number;
  fiveStarSoftIncrease: number;
  fourStarHardPity: number;
  featuredRate?: number;
  winRate?: number;
  guaranteeEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type BannerSettingsForm = {
  fiveStarRate: string;
  fourStarRate: string;
  fiveStarHardPity: string;
  fiveStarSoftPityStart: string;
  fiveStarSoftIncrease: string;
  fourStarHardPity: string;
  winRate: string;
  guaranteeEnabled: boolean;
};

type SettingsKey = Exclude<keyof BannerSettingsForm, "guaranteeEnabled">;

type BannerForm = {
  name: string;
  bannerThumbnail: string;
  itemIds: number[];
  settings: BannerSettingsForm;
};

const DEFAULT_SETTINGS: BannerSettingsForm = {
  fiveStarRate: "0.6",
  fourStarRate: "5.1",
  fiveStarHardPity: "90",
  fiveStarSoftPityStart: "74",
  fiveStarSoftIncrease: "6",
  fourStarHardPity: "10",
  winRate: "50",
  guaranteeEnabled: true,
};

const INITIAL_FORM: BannerForm = {
  name: "",
  bannerThumbnail: "",
  itemIds: [],
  settings: DEFAULT_SETTINGS,
};

function toSettingsForm(banner: BannerRow): BannerSettingsForm {
  return {
    fiveStarRate: String(banner.fiveStarRate),
    fourStarRate: String(banner.fourStarRate),
    fiveStarHardPity: String(banner.fiveStarHardPity),
    fiveStarSoftPityStart: String(banner.fiveStarSoftPityStart),
    fiveStarSoftIncrease: String(banner.fiveStarSoftIncrease),
    fourStarHardPity: String(banner.fourStarHardPity),
    winRate: String(banner.winRate ?? banner.featuredRate ?? 50),
    guaranteeEnabled: banner.guaranteeEnabled,
  };
}

function parseFiniteNumber(value: string): number | null {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

type ParsedSettings = {
  fiveStarRate: number;
  fourStarRate: number;
  fiveStarHardPity: number;
  fiveStarSoftPityStart: number;
  fiveStarSoftIncrease: number;
  fourStarHardPity: number;
  winRate: number;
  guaranteeEnabled: boolean;
};

function validateSettings(form: BannerSettingsForm): {
  errors: Partial<Record<SettingsKey, string>>;
  value: ParsedSettings | null;
} {
  const errors: Partial<Record<SettingsKey, string>> = {};
  const fiveStarRate = parseFiniteNumber(form.fiveStarRate);
  const fourStarRate = parseFiniteNumber(form.fourStarRate);
  const winRate = parseFiniteNumber(form.winRate);
  const fiveStarHardPity = parsePositiveInt(form.fiveStarHardPity);
  const fiveStarSoftPityStart = parsePositiveInt(form.fiveStarSoftPityStart);
  const fiveStarSoftIncrease = parseFiniteNumber(form.fiveStarSoftIncrease);
  const fourStarHardPity = parsePositiveInt(form.fourStarHardPity);

  if (fiveStarRate === null || fiveStarRate < 0) errors.fiveStarRate = "Enter a number ≥ 0.";
  if (fourStarRate === null || fourStarRate < 0) errors.fourStarRate = "Enter a number ≥ 0.";
  if (fiveStarRate !== null && fourStarRate !== null && fiveStarRate + fourStarRate > 100) {
    errors.fourStarRate = "5★ + 4★ rates can't exceed 100%.";
  }
  if (winRate === null || winRate < 0 || winRate > 100) errors.winRate = "Enter a value from 0 to 100.";
  if (fiveStarHardPity === null) errors.fiveStarHardPity = "Enter a whole number ≥ 1.";
  if (fiveStarSoftPityStart === null) {
    errors.fiveStarSoftPityStart = "Enter a whole number ≥ 1.";
  } else if (fiveStarHardPity !== null && fiveStarSoftPityStart > fiveStarHardPity) {
    errors.fiveStarSoftPityStart = "Must be ≤ 5★ hard pity.";
  }
  if (fiveStarSoftIncrease === null || fiveStarSoftIncrease < 0) {
    errors.fiveStarSoftIncrease = "Enter a number ≥ 0.";
  }
  if (fourStarHardPity === null) errors.fourStarHardPity = "Enter a whole number ≥ 1.";

  if (Object.keys(errors).length > 0) {
    return { errors, value: null };
  }
  return {
    errors,
    value: {
      fiveStarRate: fiveStarRate!,
      fourStarRate: fourStarRate!,
      fiveStarHardPity: fiveStarHardPity!,
      fiveStarSoftPityStart: fiveStarSoftPityStart!,
      fiveStarSoftIncrease: fiveStarSoftIncrease!,
      fourStarHardPity: fourStarHardPity!,
      winRate: winRate!,
      guaranteeEnabled: form.guaranteeEnabled,
    },
  };
}

async function fetchBannerData(): Promise<{ banners: BannerRow[]; items: ItemOption[] } | { error: string }> {
  const [bannerResponse, itemResponse] = await Promise.all([
    fetch("/api/banners", { cache: "no-store" }),
    fetch("/api/items", { cache: "no-store" }),
  ]);
  if (!bannerResponse.ok || !itemResponse.ok) {
    return { error: "Failed to load banners or items." };
  }
  return {
    banners: (await bannerResponse.json()) as BannerRow[],
    items: (await itemResponse.json()) as ItemOption[],
  };
}

function countByRarity(items: ItemOption[]) {
  const counts: Record<Rarity, number> = { S: 0, A: 0, B: 0 };
  let featuredS = 0;
  for (const item of items) {
    const rarity = toRarity(item.rarity);
    counts[rarity] += 1;
    if (rarity === "S" && item.featured) {
      featuredS += 1;
    }
  }
  return { counts, featuredS };
}

// Mirrors how GachaBanner treats the pool, so misconfigured banners are flagged before anyone pulls on them.
function bannerWarnings(items: ItemOption[]): string[] {
  if (items.length === 0) {
    return ["No items assigned, so this banner is hidden on the gacha page."];
  }
  const { counts, featuredS } = countByRarity(items);
  const warnings: string[] = [];
  if (counts.S === 0) {
    warnings.push("No S items, so 5★ can never drop.");
  } else if (featuredS === 0 || featuredS === counts.S) {
    warnings.push(
      featuredS === 0
        ? "No featured S item, so the win rate and guarantee have no effect."
        : "Every S item is featured, so the win rate and guarantee have no effect.",
    );
  }
  if (counts.A === 0) {
    warnings.push("No A items, so 4★ can never drop.");
  }
  if (counts.B === 0) {
    warnings.push("No B items, so every pull is 4★ or better.");
  }
  return warnings;
}

function RarityBreakdown({ items }: { items: ItemOption[] }) {
  const { counts, featuredS } = countByRarity(items);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {RARITIES.map((rarity) => (
        <span
          key={rarity}
          className={cx(
            "rounded-full border px-2 py-0.5 text-xs font-semibold",
            counts[rarity] > 0 ? RARITY_META[rarity].badge : "border-white/10 text-slate-500",
          )}
        >
          {rarity} × {counts[rarity]}
        </span>
      ))}
      {featuredS > 0 ? <span className="text-xs text-pink-200">{featuredS} featured S</span> : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  hint,
  error,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <div className="relative">
          <input
            id={id}
            inputMode="decimal"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            className={cx(inputClass, suffix && "pr-14")}
          />
          {suffix ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
              {suffix}
            </span>
          ) : null}
        </div>
      )}
    </Field>
  );
}

function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-b border-white/10 pb-6 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description ? <p className="text-xs text-slate-400">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function BannersPage() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [form, setForm] = useState<BannerForm>(INITIAL_FORM);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [itemSearch, setItemSearch] = useState("");
  const [itemRarityFilter, setItemRarityFilter] = useState<Rarity | "ALL">("ALL");
  const [selectedOnly, setSelectedOnly] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<BannerRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toasts, push, dismiss } = useToasts();

  const applyLoaded = useCallback((result: Awaited<ReturnType<typeof fetchBannerData>>) => {
    if ("error" in result) {
      setLoadError(result.error);
    } else {
      setBanners(result.banners);
      setItems(result.items);
      setLoadError(null);
    }
    setLoading(false);
  }, []);

  const loadData = useCallback(async () => applyLoaded(await fetchBannerData()), [applyLoaded]);

  useEffect(() => {
    let active = true;
    void fetchBannerData().then((result) => {
      if (active) {
        applyLoaded(result);
      }
    });
    return () => {
      active = false;
    };
  }, [applyLoaded]);

  const visibleBanners = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? banners.filter((banner) => banner.name.toLowerCase().includes(query)) : banners;
  }, [banners, search]);

  const selectedItems = useMemo(
    () => items.filter((item) => form.itemIds.includes(item.id)),
    [items, form.itemIds],
  );

  const pickerItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    return items
      .filter(
        (item) =>
          (!query || item.name.toLowerCase().includes(query)) &&
          (itemRarityFilter === "ALL" || toRarity(item.rarity) === itemRarityFilter) &&
          (!selectedOnly || form.itemIds.includes(item.id)),
      )
      .sort((a, b) => {
        const order: Record<Rarity, number> = { S: 0, A: 1, B: 2 };
        return order[toRarity(a.rarity)] - order[toRarity(b.rarity)] || a.name.localeCompare(b.name);
      });
  }, [items, itemSearch, itemRarityFilter, selectedOnly, form.itemIds]);

  const validation = useMemo(() => validateSettings(form.settings), [form.settings]);
  const settingsErrors = submitted ? validation.errors : {};
  const nameError = submitted && !form.name.trim() ? "Name is required." : undefined;
  const thumbnailError = submitted && !thumbnailFile && !form.bannerThumbnail ? "Please choose a thumbnail." : null;
  const formWarnings = bannerWarnings(selectedItems);
  const renamed = editing !== null && form.name.trim() !== editing.name;

  const fiveRate = parseFiniteNumber(form.settings.fiveStarRate) ?? 0;
  const fourRate = parseFiniteNumber(form.settings.fourStarRate) ?? 0;
  const threeRate = Math.max(0, 100 - fiveRate - fourRate);

  const openCreate = () => {
    setEditing(null);
    setForm(INITIAL_FORM);
    setThumbnailFile(null);
    setSubmitted(false);
    setItemSearch("");
    setItemRarityFilter("ALL");
    setSelectedOnly(false);
    setDrawerOpen(true);
  };

  const openEdit = (banner: BannerRow) => {
    setEditing(banner);
    setForm({
      name: banner.name,
      bannerThumbnail: banner.bannerThumbnail,
      itemIds: banner.items.map((item) => item.id),
      settings: toSettingsForm(banner),
    });
    setThumbnailFile(null);
    setSubmitted(false);
    setItemSearch("");
    setItemRarityFilter("ALL");
    setSelectedOnly(false);
    setDrawerOpen(true);
  };

  const closeDrawer = useCallback(() => {
    if (!saving) {
      setDrawerOpen(false);
    }
  }, [saving]);

  const updateSettings = (patch: Partial<BannerSettingsForm>) => {
    setForm((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  };

  const toggleItem = (itemId: number) => {
    setForm((prev) => ({
      ...prev,
      itemIds: prev.itemIds.includes(itemId)
        ? prev.itemIds.filter((id) => id !== itemId)
        : [...prev.itemIds, itemId],
    }));
  };

  const selectShown = () => {
    setForm((prev) => ({
      ...prev,
      itemIds: [...new Set([...prev.itemIds, ...pickerItems.map((item) => item.id)])],
    }));
  };

  const deselectShown = () => {
    const shown = new Set(pickerItems.map((item) => item.id));
    setForm((prev) => ({ ...prev, itemIds: prev.itemIds.filter((id) => !shown.has(id)) }));
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!form.name.trim() || (!thumbnailFile && !form.bannerThumbnail) || !validation.value) {
      push("error", "Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    let bannerThumbnail = form.bannerThumbnail;
    if (thumbnailFile) {
      const uploaded = await uploadImage(thumbnailFile);
      if ("error" in uploaded) {
        push("error", uploaded.error);
        setSaving(false);
        return;
      }
      bannerThumbnail = uploaded.url;
    }

    const response = await fetch(editing ? `/api/banners/${editing.id}` : "/api/banners", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        bannerThumbnail,
        itemIds: form.itemIds,
        ...validation.value,
      }),
    });

    if (!response.ok) {
      push("error", await readError(response, "Failed to save banner."));
      setSaving(false);
      return;
    }

    await loadData();
    setSaving(false);
    setDrawerOpen(false);
    push("success", `${editing ? "Updated" : "Created"} "${form.name.trim()}".`);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    const response = await fetch(`/api/banners/${pendingDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!response.ok) {
      push("error", await readError(response, "Failed to delete banner."));
      return;
    }
    push("success", `Deleted "${pendingDelete.name}".`);
    if (editing?.id === pendingDelete.id) {
      setDrawerOpen(false);
    }
    setPendingDelete(null);
    await loadData();
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Banners</h1>
          <p className="mt-1 text-sm text-slate-400">
            {banners.length} banner{banners.length === 1 ? "" : "s"} · {items.length} items available
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {banners.length > 0 ? (
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search banners..."
              aria-label="Search banners"
              className={cx(inputBaseClass, "w-56 py-2")}
            />
          ) : null}
          <button type="button" onClick={openCreate} className={buttonClass("primary")}>
            + New banner
          </button>
        </div>
      </header>

      {loading ? (
        <CardSkeletonGrid count={4} />
      ) : loadError ? (
        <EmptyState
          title="Couldn't load banners"
          description={loadError}
          action={
            <button type="button" onClick={() => void loadData()} className={buttonClass("secondary")}>
              Try again
            </button>
          }
        />
      ) : banners.length === 0 ? (
        <EmptyState
          title="No banners yet"
          description={
            items.length === 0
              ? "A banner is a pool of items with its own rates and pity. Start by creating some items."
              : "A banner is a pool of items with its own rates and pity. Create one to start pulling."
          }
          action={
            items.length === 0 ? (
              <Link href="/items" className={buttonClass("primary")}>
                Go to Items
              </Link>
            ) : (
              <button type="button" onClick={openCreate} className={buttonClass("primary")}>
                + Create your first banner
              </button>
            )
          }
        />
      ) : visibleBanners.length === 0 ? (
        <EmptyState title="No matching banners" description={`Nothing matches "${search}".`} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {visibleBanners.map((banner) => {
            const warnings = bannerWarnings(banner.items);
            return (
              <article
                key={banner.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/5 transition hover:bg-white/10"
              >
                <button
                  type="button"
                  onClick={() => openEdit(banner)}
                  className="relative block aspect-21/9 overflow-hidden bg-slate-950/60 text-left"
                  aria-label={`Edit ${banner.name}`}
                >
                  {banner.bannerThumbnail ? (
                    <img
                      src={banner.bannerThumbnail}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-4 bottom-3">
                    <h2 className="text-2xl font-bold text-white drop-shadow">{banner.name}</h2>
                    <p className="text-xs text-slate-300">#{banner.id}</p>
                  </div>
                </button>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <RarityBreakdown items={banner.items} />

                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-black/20 px-2 py-1.5">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">5★ / 4★</dt>
                      <dd className="text-sm font-semibold text-white">
                        {banner.fiveStarRate}% / {banner.fourStarRate}%
                      </dd>
                    </div>
                    <div className="rounded-lg bg-black/20 px-2 py-1.5">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">5★ pity</dt>
                      <dd className="text-sm font-semibold text-white">
                        {banner.fiveStarSoftPityStart} → {banner.fiveStarHardPity}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-black/20 px-2 py-1.5">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">Win rate</dt>
                      <dd className="text-sm font-semibold text-white">
                        {banner.winRate ?? banner.featuredRate}%{banner.guaranteeEnabled ? " + G" : ""}
                      </dd>
                    </div>
                  </dl>

                  {warnings.length > 0 ? (
                    <ul className="space-y-1 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {warnings.map((warning) => (
                        <li key={warning}>⚠ {warning}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-auto flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => openEdit(banner)} className={buttonClass("secondary", "sm")}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(banner)}
                      className={buttonClass("danger", "sm")}
                      aria-label={`Delete ${banner.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        title={editing ? `Edit ${editing.name}` : "New banner"}
        subtitle={editing ? `#${editing.id}` : "Pick the pool, then tune rates and pity"}
        onClose={closeDrawer}
        footer={
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              {form.itemIds.length} item{form.itemIds.length === 1 ? "" : "s"} selected
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={closeDrawer} disabled={saving} className={buttonClass("secondary")}>
                Cancel
              </button>
              <button type="submit" form="banner-form" disabled={saving} className={buttonClass("primary")}>
                {saving ? "Saving..." : editing ? "Save changes" : "Create banner"}
              </button>
            </div>
          </div>
        }
      >
        <form id="banner-form" onSubmit={submitForm} className="flex flex-col gap-6" noValidate>
          <FormSection title="Details">
            <Field
              label="Name"
              error={nameError}
              hint={
                renamed
                  ? `Saved pity and pull history are stored under "${editing?.name}" and won't carry over to the new name.`
                  : undefined
              }
            >
              {(id) => (
                <input
                  id={id}
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. Moonlit Serenade"
                  aria-invalid={nameError ? true : undefined}
                  className={inputClass}
                />
              )}
            </Field>
            <ImageDropzone
              file={thumbnailFile}
              currentUrl={form.bannerThumbnail}
              onFileChange={setThumbnailFile}
              aspect="aspect-21/9"
              error={thumbnailError}
            />
          </FormSection>

          <FormSection
            title="Item pool"
            description="Items that can drop from this banner."
            action={<RarityBreakdown items={selectedItems} />}
          >
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">
                No items exist yet.{" "}
                <Link href="/items" className="font-semibold text-fuchsia-300 hover:underline">
                  Create items
                </Link>{" "}
                first.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Search items..."
                    aria-label="Search items"
                    className={cx(inputBaseClass, "w-full py-2 sm:w-48")}
                  />
                  <SegmentedControl
                    label="Filter items by rarity"
                    value={itemRarityFilter}
                    onChange={setItemRarityFilter}
                    options={[
                      { value: "ALL", label: "All" },
                      ...RARITIES.map((rarity) => ({ value: rarity, label: rarity })),
                    ]}
                  />
                  <button
                    type="button"
                    aria-pressed={selectedOnly}
                    onClick={() => setSelectedOnly((prev) => !prev)}
                    className={cx(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      selectedOnly
                        ? "border-fuchsia-300/70 bg-fuchsia-500/25 text-fuchsia-100"
                        : "border-white/15 text-slate-400 hover:text-slate-200",
                    )}
                  >
                    Selected only
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <button type="button" onClick={selectShown} className="font-semibold text-fuchsia-300 hover:underline">
                    Select all shown
                  </button>
                  <button type="button" onClick={deselectShown} className="font-semibold text-slate-400 hover:underline">
                    Deselect shown
                  </button>
                </div>
                {pickerItems.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">No items match.</p>
                ) : (
                  <div className="grid max-h-[360px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                    {pickerItems.map((item) => {
                      const rarity = toRarity(item.rarity);
                      const selected = form.itemIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => toggleItem(item.id)}
                          title={`${item.name} (${rarity}${item.featured ? ", featured" : ""})`}
                          className={cx(
                            "relative overflow-hidden rounded-lg border text-left transition",
                            selected
                              ? "border-fuchsia-300 ring-2 ring-fuchsia-300/60"
                              : "border-white/10 opacity-60 hover:opacity-100",
                          )}
                        >
                          <img src={item.itemImage} alt="" className="aspect-square w-full object-cover" />
                          <span className="absolute left-1 top-1">
                            <RarityBadge rarity={rarity} className="px-1.5 text-[10px]" />
                          </span>
                          {selected ? (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500 text-xs font-bold text-white">
                              ✓
                            </span>
                          ) : null}
                          <span className="block truncate bg-black/60 px-1.5 py-1 text-[11px] text-slate-100">
                            {item.featured ? <span className="text-pink-300">★ </span> : null}
                            {item.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {formWarnings.length > 0 ? (
                  <ul className="space-y-1 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    {formWarnings.map((warning) => (
                      <li key={warning}>⚠ {warning}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </FormSection>

          <FormSection
            title="Rates & pity"
            description="Base drop chances before pity kicks in."
            action={
              <button type="button" onClick={() => updateSettings(DEFAULT_SETTINGS)} className={buttonClass("ghost", "sm")}>
                Reset to defaults
              </button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberField
                label="5★ rate"
                suffix="%"
                value={form.settings.fiveStarRate}
                error={settingsErrors.fiveStarRate}
                onChange={(fiveStarRate) => updateSettings({ fiveStarRate })}
              />
              <NumberField
                label="4★ rate"
                suffix="%"
                value={form.settings.fourStarRate}
                error={settingsErrors.fourStarRate}
                onChange={(fourStarRate) => updateSettings({ fourStarRate })}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">3★ rate</span>
                <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                  {Number(threeRate.toFixed(4))}%
                </p>
                <p className="text-xs text-slate-400">The rest of 100%.</p>
              </div>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden>
              <div className="bg-amber-400" style={{ width: `${Math.min(100, fiveRate)}%` }} />
              <div className="bg-violet-400" style={{ width: `${Math.min(100, fourRate)}%` }} />
              <div className="bg-slate-400" style={{ width: `${threeRate}%` }} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberField
                label="5★ soft pity from"
                suffix="pulls"
                value={form.settings.fiveStarSoftPityStart}
                error={settingsErrors.fiveStarSoftPityStart}
                onChange={(fiveStarSoftPityStart) => updateSettings({ fiveStarSoftPityStart })}
              />
              <NumberField
                label="Increase per pull"
                suffix="%"
                value={form.settings.fiveStarSoftIncrease}
                error={settingsErrors.fiveStarSoftIncrease}
                onChange={(fiveStarSoftIncrease) => updateSettings({ fiveStarSoftIncrease })}
              />
              <NumberField
                label="5★ hard pity"
                suffix="pulls"
                value={form.settings.fiveStarHardPity}
                error={settingsErrors.fiveStarHardPity}
                onChange={(fiveStarHardPity) => updateSettings({ fiveStarHardPity })}
              />
            </div>
            {validation.value ? (
              <p className="rounded-lg bg-black/20 px-3 py-2 text-xs text-slate-300">
                From pull <strong className="text-white">{validation.value.fiveStarSoftPityStart}</strong>, the 5★
                chance rises by <strong className="text-white">{validation.value.fiveStarSoftIncrease}%</strong> per
                pull. A 5★ is guaranteed by pull{" "}
                <strong className="text-white">{validation.value.fiveStarHardPity}</strong>, and a 4★ or better by
                pull <strong className="text-white">{validation.value.fourStarHardPity}</strong>.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberField
                label="4★ hard pity"
                suffix="pulls"
                value={form.settings.fourStarHardPity}
                error={settingsErrors.fourStarHardPity}
                onChange={(fourStarHardPity) => updateSettings({ fourStarHardPity })}
              />
              <NumberField
                label="5★ win rate"
                suffix="%"
                hint="Chance a 5★ is featured."
                value={form.settings.winRate}
                error={settingsErrors.winRate}
                onChange={(winRate) => updateSettings({ winRate })}
              />
            </div>
            <Toggle
              checked={form.settings.guaranteeEnabled}
              onChange={(guaranteeEnabled) => updateSettings({ guaranteeEnabled })}
              label="Guarantee after a lost 50/50"
              description="If a 5★ isn't featured, the next 5★ is guaranteed to be featured."
            />
          </FormSection>
        </form>
      </Drawer>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name}"?`}
        message={
          <>
            The banner and its item assignments will be removed. The items themselves are kept. Saved pity and pull
            history stay stored under this name, so a new banner with the same name will pick them up again.
          </>
        }
        confirmLabel="Delete banner"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
