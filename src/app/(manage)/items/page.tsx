"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CardSkeletonGrid,
  ConfirmDialog,
  Drawer,
  EmptyState,
  FeaturedBadge,
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

type ItemType = "WEAPON" | "CHARACTER";

type ItemRow = {
  id: number;
  name: string;
  rarity: string;
  featured: boolean;
  itemType: ItemType;
  itemImage: string;
  banners: Array<{ id: number; name: string }>;
  createdAt: string;
  updatedAt: string;
};

type ItemForm = {
  name: string;
  rarity: Rarity;
  featured: boolean;
  itemType: ItemType;
  itemImage: string;
};

type SortKey = "newest" | "rarity" | "name";

const INITIAL_FORM: ItemForm = {
  name: "",
  rarity: "B",
  featured: false,
  itemType: "WEAPON",
  itemImage: "",
};

const RARITY_ORDER: Record<Rarity, number> = { S: 0, A: 1, B: 2 };

const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  WEAPON: "Weapon",
  CHARACTER: "Character",
};

async function fetchItems(): Promise<{ items: ItemRow[] } | { error: string }> {
  const response = await fetch("/api/items", { cache: "no-store" });
  if (!response.ok) {
    return { error: "Failed to load items." };
  }
  return { items: (await response.json()) as ItemRow[] };
}

export default function ItemsPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<ItemType | "ALL">("ALL");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemForm>(INITIAL_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<ItemRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toasts, push, dismiss } = useToasts();

  const applyLoaded = useCallback((result: Awaited<ReturnType<typeof fetchItems>>) => {
    if ("error" in result) {
      setLoadError(result.error);
    } else {
      setItems(result.items);
      setLoadError(null);
    }
    setLoading(false);
  }, []);

  const loadItems = useCallback(async () => applyLoaded(await fetchItems()), [applyLoaded]);

  useEffect(() => {
    let active = true;
    void fetchItems().then((result) => {
      if (active) {
        applyLoaded(result);
      }
    });
    return () => {
      active = false;
    };
  }, [applyLoaded]);

  const counts = useMemo(() => {
    const byRarity: Record<Rarity, number> = { S: 0, A: 0, B: 0 };
    for (const item of items) {
      byRarity[toRarity(item.rarity)] += 1;
    }
    return byRarity;
  }, [items]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter(
      (item) =>
        (!query || item.name.toLowerCase().includes(query)) &&
        (rarityFilter === "ALL" || toRarity(item.rarity) === rarityFilter) &&
        (typeFilter === "ALL" || item.itemType === typeFilter) &&
        (!featuredOnly || item.featured),
    );
    if (sort === "rarity") {
      return [...filtered].sort(
        (a, b) =>
          RARITY_ORDER[toRarity(a.rarity)] - RARITY_ORDER[toRarity(b.rarity)] || a.name.localeCompare(b.name),
      );
    }
    if (sort === "name") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered;
  }, [items, search, rarityFilter, typeFilter, featuredOnly, sort]);

  const hasActiveFilters = search !== "" || rarityFilter !== "ALL" || typeFilter !== "ALL" || featuredOnly;

  const clearFilters = () => {
    setSearch("");
    setRarityFilter("ALL");
    setTypeFilter("ALL");
    setFeaturedOnly(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setImageFile(null);
    setSubmitted(false);
    setDrawerOpen(true);
  };

  const openEdit = (item: ItemRow) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      rarity: toRarity(item.rarity),
      featured: item.featured,
      itemType: item.itemType,
      itemImage: item.itemImage,
    });
    setImageFile(null);
    setSubmitted(false);
    setDrawerOpen(true);
  };

  const closeDrawer = useCallback(() => {
    if (!saving) {
      setDrawerOpen(false);
    }
  }, [saving]);

  const nameError = submitted && !form.name.trim() ? "Name is required." : null;
  const imageError = submitted && !imageFile && !form.itemImage ? "Please choose an image." : null;

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!form.name.trim() || (!imageFile && !form.itemImage)) {
      return;
    }

    setSaving(true);
    let itemImage = form.itemImage;
    if (imageFile) {
      const uploaded = await uploadImage(imageFile);
      if ("error" in uploaded) {
        push("error", uploaded.error);
        setSaving(false);
        return;
      }
      itemImage = uploaded.url;
    }

    const response = await fetch(editingId ? `/api/items/${editingId}` : "/api/items", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, itemImage }),
    });

    if (!response.ok) {
      push("error", await readError(response, "Failed to save item."));
      setSaving(false);
      return;
    }

    await loadItems();
    setSaving(false);
    setDrawerOpen(false);
    push("success", `${editingId ? "Updated" : "Created"} "${form.name.trim()}".`);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    const response = await fetch(`/api/items/${pendingDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!response.ok) {
      push("error", await readError(response, "Failed to delete item."));
      return;
    }
    push("success", `Deleted "${pendingDelete.name}".`);
    if (editingId === pendingDelete.id) {
      setDrawerOpen(false);
    }
    setPendingDelete(null);
    await loadItems();
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Items</h1>
          <p className="mt-1 text-sm text-slate-400">
            {items.length} total ·{" "}
            {RARITIES.map((rarity, index) => (
              <span key={rarity}>
                {index > 0 ? " · " : null}
                <span className={RARITY_META[rarity].text}>
                  {counts[rarity]} {rarity}
                </span>
              </span>
            ))}
          </p>
        </div>
        <button type="button" onClick={openCreate} className={buttonClass("primary")}>
          + New item
        </button>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search items by name..."
            aria-label="Search items"
            className={cx(inputClass, "lg:max-w-xs")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Filter by rarity"
              value={rarityFilter}
              onChange={setRarityFilter}
              options={[{ value: "ALL", label: "All" }, ...RARITIES.map((rarity) => ({ value: rarity, label: rarity }))]}
            />
            <SegmentedControl
              label="Filter by type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "ALL", label: "All types" },
                { value: "WEAPON", label: "Weapon" },
                { value: "CHARACTER", label: "Character" },
              ]}
            />
            <button
              type="button"
              aria-pressed={featuredOnly}
              onClick={() => setFeaturedOnly((prev) => !prev)}
              className={cx(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                featuredOnly
                  ? "border-pink-300/70 bg-pink-500/25 text-pink-100"
                  : "border-white/15 text-slate-400 hover:text-slate-200",
              )}
            >
              ★ Featured only
            </button>
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <label htmlFor="item-sort" className="text-xs text-slate-400">
              Sort
            </label>
            <select
              id="item-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className={cx(inputBaseClass, "py-1.5")}
            >
              <option value="newest">Newest</option>
              <option value="rarity">Rarity</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
        {hasActiveFilters ? (
          <p className="text-xs text-slate-400">
            Showing {visibleItems.length} of {items.length} items ·{" "}
            <button type="button" onClick={clearFilters} className="font-semibold text-fuchsia-300 hover:underline">
              Clear filters
            </button>
          </p>
        ) : null}
      </section>

      {loading ? (
        <CardSkeletonGrid />
      ) : loadError ? (
        <EmptyState
          title="Couldn't load items"
          description={loadError}
          action={
            <button type="button" onClick={() => void loadItems()} className={buttonClass("secondary")}>
              Try again
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Items are the weapons and characters that can drop from a banner. Create a few, then assign them to a banner."
          action={
            <button type="button" onClick={openCreate} className={buttonClass("primary")}>
              + Create your first item
            </button>
          }
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title="No matching items"
          description="Try a different search or clear the filters."
          action={
            <button type="button" onClick={clearFilters} className={buttonClass("secondary")}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => {
            const rarity = toRarity(item.rarity);
            return (
              <article
                key={item.id}
                className={cx(
                  "group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 ring-1 ring-inset transition hover:-translate-y-0.5 hover:bg-white/10",
                  RARITY_META[rarity].ring,
                )}
              >
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="relative block aspect-4/3 overflow-hidden bg-slate-950/60"
                  aria-label={`Edit ${item.name}`}
                >
                  <img
                    src={item.itemImage}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <RarityBadge rarity={rarity} className="backdrop-blur" />
                  </div>
                  {item.featured ? (
                    <div className="absolute right-3 top-3">
                      <FeaturedBadge />
                    </div>
                  ) : null}
                </button>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-white" title={item.name}>
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {ITEM_TYPE_LABEL[item.itemType]} · #{item.id}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => openEdit(item)} className={buttonClass("secondary", "sm")}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        className={buttonClass("danger", "sm")}
                        aria-label={`Delete ${item.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1">
                    {item.banners.length === 0 ? (
                      <span className="text-xs italic text-slate-500">Not in any banner</span>
                    ) : (
                      item.banners.map((banner) => (
                        <span
                          key={banner.id}
                          className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-slate-300"
                        >
                          {banner.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        title={editingId ? "Edit item" : "New item"}
        subtitle={editingId ? `#${editingId}` : "Add a weapon or character to the pool"}
        onClose={closeDrawer}
        footer={
          <div className="flex items-center justify-between gap-2">
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  const item = items.find((entry) => entry.id === editingId);
                  if (item) {
                    setPendingDelete(item);
                  }
                }}
                className={buttonClass("danger")}
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={closeDrawer} disabled={saving} className={buttonClass("secondary")}>
                Cancel
              </button>
              <button type="submit" form="item-form" disabled={saving} className={buttonClass("primary")}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Create item"}
              </button>
            </div>
          </div>
        }
      >
        <form
          id="item-form"
          onSubmit={submitForm}
          className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
          noValidate
        >
          <ImageDropzone
            file={imageFile}
            currentUrl={form.itemImage}
            onFileChange={setImageFile}
            aspect="aspect-3/4"
            error={imageError}
          />

          <div className="flex flex-col gap-5">
          <Field label="Name" error={nameError}>
            {(id) => (
              <input
                id={id}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Skyward Blade"
                aria-invalid={nameError ? true : undefined}
                className={inputClass}
                autoFocus
              />
            )}
          </Field>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Rarity</span>
              <div role="radiogroup" aria-label="Rarity" className="grid grid-cols-3 gap-2">
                {RARITIES.map((rarity) => (
                  <button
                    key={rarity}
                    type="button"
                    role="radio"
                    aria-checked={form.rarity === rarity}
                    onClick={() => setForm((prev) => ({ ...prev, rarity }))}
                    className={cx(
                      "rounded-lg border py-2 text-sm font-black transition",
                      form.rarity === rarity
                        ? RARITY_META[rarity].badge
                        : "border-white/15 text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {rarity}
                    <span className="block text-[10px] font-semibold">{RARITY_META[rarity].stars}★</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Type</span>
              <div role="radiogroup" aria-label="Item type" className="grid grid-cols-2 gap-2">
                {(["WEAPON", "CHARACTER"] as const).map((itemType) => (
                  <button
                    key={itemType}
                    type="button"
                    role="radio"
                    aria-checked={form.itemType === itemType}
                    onClick={() => setForm((prev) => ({ ...prev, itemType }))}
                    className={cx(
                      "rounded-lg border py-3.5 text-sm font-semibold transition",
                      form.itemType === itemType
                        ? "border-white/40 bg-white/15 text-white"
                        : "border-white/15 text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {ITEM_TYPE_LABEL[itemType]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Toggle
            checked={form.featured}
            onChange={(featured) => setForm((prev) => ({ ...prev, featured }))}
            label="Featured item"
            description={
              form.rarity === "S"
                ? "Winning the 5★ win-rate roll (or the guarantee) drops a featured S item."
                : "The featured split only applies to S items, so this has no effect on drop rates for A/B items."
            }
          />
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name}"?`}
        message={
          pendingDelete && pendingDelete.banners.length > 0 ? (
            <>
              It will be removed from{" "}
              <strong className="text-white">{pendingDelete.banners.map((banner) => banner.name).join(", ")}</strong>.
              Pull history keeps its own copy of the item. This can&apos;t be undone.
            </>
          ) : (
            "This can't be undone."
          )
        }
        confirmLabel="Delete item"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
