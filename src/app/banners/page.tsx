"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ItemOption = {
  id: number;
  name: string;
  rarity: string;
  itemType: "WEAPON" | "CHARACTER";
};

type BannerRow = {
  id: number;
  name: string;
  bannerThumbnail: string;
  items: ItemOption[];
  createdAt: string;
  updatedAt: string;
};

type BannerForm = {
  name: string;
  bannerThumbnail: string;
  itemIds: number[];
};

const INITIAL_FORM: BannerForm = {
  name: "",
  bannerThumbnail: "",
  itemIds: [],
};

export default function BannersPage() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [form, setForm] = useState<BannerForm>(INITIAL_FORM);
  const [selectedThumbnailFile, setSelectedThumbnailFile] =
    useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (editingId ? `Edit banner #${editingId}` : "Create banner"),
    [editingId],
  );

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const [bannerResponse, itemResponse] = await Promise.all([
      fetch("/api/banners", { cache: "no-store" }),
      fetch("/api/items", { cache: "no-store" }),
    ]);

    if (!bannerResponse.ok || !itemResponse.ok) {
      setLoading(false);
      setError("Failed to fetch banners/items");
      return;
    }

    const bannerData = (await bannerResponse.json()) as BannerRow[];
    const itemData = (await itemResponse.json()) as ItemOption[];
    setBanners(bannerData);
    setItems(itemData);
    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (!selectedThumbnailFile) {
      setThumbnailPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedThumbnailFile);
    setThumbnailPreview(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedThumbnailFile]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setSelectedThumbnailFile(null);
    setThumbnailPreview("");
    setEditingId(null);
    setError(null);
  };

  const toggleItem = (itemId: number) => {
    setForm((prev) => ({
      ...prev,
      itemIds: prev.itemIds.includes(itemId)
        ? prev.itemIds.filter((id) => id !== itemId)
        : [...prev.itemIds, itemId],
    }));
  };

  const uploadThumbnail = async (): Promise<string | null> => {
    if (!selectedThumbnailFile) {
      return null;
    }

    const data = new FormData();
    data.append("file", selectedThumbnailFile);
    const uploadResponse = await fetch("/api/uploads", {
      method: "POST",
      body: data,
    });

    if (!uploadResponse.ok) {
      const body = (await uploadResponse
        .json()
        .catch(() => ({ error: "Failed to upload banner thumbnail" }))) as {
        error?: string;
      };
      setError(body.error ?? "Failed to upload banner thumbnail");
      return null;
    }

    const payload = (await uploadResponse.json()) as { url: string };
    return payload.url;
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    let bannerThumbnail = form.bannerThumbnail;
    const uploadedUrl = await uploadThumbnail();
    if (selectedThumbnailFile && !uploadedUrl) {
      setSaving(false);
      return;
    }
    if (uploadedUrl) {
      bannerThumbnail = uploadedUrl;
    }

    if (!bannerThumbnail) {
      setError("Please upload a banner thumbnail");
      setSaving(false);
      return;
    }

    const method = editingId ? "PUT" : "POST";
    const endpoint = editingId ? `/api/banners/${editingId}` : "/api/banners";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, bannerThumbnail }),
    });

    if (!response.ok) {
      const body = (await response
        .json()
        .catch(() => ({ error: "Failed to save banner" }))) as {
        error?: string;
      };
      setError(body.error ?? "Failed to save banner");
      setSaving(false);
      return;
    }

    await fetchData();
    resetForm();
    setSaving(false);
  };

  const beginEdit = (banner: BannerRow) => {
    setEditingId(banner.id);
    setForm({
      name: banner.name,
      bannerThumbnail: banner.bannerThumbnail,
      itemIds: banner.items.map((item) => item.id),
    });
    setSelectedThumbnailFile(null);
    setThumbnailPreview("");
  };

  const deleteBanner = async (id: number) => {
    setError(null);
    const response = await fetch(`/api/banners/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to delete banner");
      return;
    }
    if (editingId === id) {
      resetForm();
    }
    await fetchData();
  };

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-6 text-neutral-900 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Banner CRUD</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/banner-settings"
              className="border-2 border-black bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-200"
            >
              Banner Settings
            </Link>
            <Link
              href="/items"
              className="border-2 border-black bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-200"
            >
              Manage Items
            </Link>
            <Link
              href="/"
              className="border-2 border-black bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-200"
            >
              Back to Gacha
            </Link>
          </div>
        </div>

        {error ? (
          <p className="border-2 border-red-400 bg-red-100 px-4 py-3 text-red-700">
            {error}
          </p>
        ) : null}

        <section className="border-2 border-black bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold">{title}</h2>
          <form className="grid grid-cols-1 gap-4" onSubmit={submitForm}>
            <label className="flex flex-col gap-1 text-sm">
              Banner name
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="border border-neutral-400 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Banner thumbnail file
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setSelectedThumbnailFile(event.target.files?.[0] ?? null)
                }
                className="border border-neutral-400 px-3 py-2"
              />
            </label>
            {thumbnailPreview || form.bannerThumbnail ? (
              <img
                src={thumbnailPreview || form.bannerThumbnail}
                alt="Banner thumbnail preview"
                className="h-40 w-full rounded border border-neutral-300 object-cover"
              />
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Assign items</p>
              {items.length === 0 ? (
                <p className="text-sm text-neutral-600">
                  No items available. Create items first.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 rounded border border-neutral-300 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <label
                      key={item.id}
                      className="inline-flex items-start gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.itemIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />
                      <span>
                        #{item.id} {item.name} ({item.rarity} / {item.itemType})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="border-2 border-black bg-white px-4 py-2 font-semibold hover:bg-neutral-200 disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update banner"
                    : "Create banner"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="border-2 border-black bg-white px-4 py-2 font-semibold hover:bg-neutral-200"
              >
                Clear
              </button>
            </div>
          </form>
        </section>

        <section className="border-2 border-black bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Banners</h2>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="border border-black px-3 py-1 text-sm font-semibold hover:bg-neutral-100"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p>Loading banners...</p>
          ) : banners.length === 0 ? (
            <p>No banners yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {banners.map((banner) => (
                <article
                  key={banner.id}
                  className="border border-neutral-300 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">
                      #{banner.id} {banner.name}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(banner)}
                        className="border border-black px-2 py-1 text-sm hover:bg-neutral-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteBanner(banner.id)}
                        className="border border-red-500 px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {banner.bannerThumbnail ? (
                    <img
                      src={banner.bannerThumbnail}
                      alt={`${banner.name} thumbnail`}
                      className="mb-2 h-32 w-full rounded border border-neutral-300 object-cover"
                    />
                  ) : null}
                  <p className="text-sm">
                    Assigned Items: {banner.items.length}
                  </p>
                  <ul className="mt-2 list-inside list-disc text-sm">
                    {banner.items.length === 0 ? (
                      <li className="text-neutral-500">No assigned items</li>
                    ) : (
                      banner.items.map((item) => (
                        <li key={item.id}>
                          #{item.id} {item.name} ({item.rarity} /{" "}
                          {item.itemType})
                        </li>
                      ))
                    )}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
