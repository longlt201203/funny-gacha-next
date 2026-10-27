"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  rarity: string;
  featured: boolean;
  itemType: ItemType;
  itemImage: string;
};

const INITIAL_FORM: ItemForm = {
  name: "",
  rarity: "B",
  featured: false,
  itemType: "WEAPON",
  itemImage: "",
};

export default function ItemsPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [form, setForm] = useState<ItemForm>(INITIAL_FORM);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (editingId ? `Edit item #${editingId}` : "Create item"), [editingId]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/items", { cache: "no-store" });
    if (!response.ok) {
      setLoading(false);
      setError("Failed to fetch items");
      return;
    }

    const data = (await response.json()) as ItemRow[];
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  useEffect(() => {
    if (!selectedImageFile) {
      setImagePreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImageFile);
    setImagePreview(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImageFile]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setSelectedImageFile(null);
    setImagePreview("");
    setEditingId(null);
    setError(null);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImageFile) {
      return null;
    }

    const data = new FormData();
    data.append("file", selectedImageFile);
    const uploadResponse = await fetch("/api/uploads", {
      method: "POST",
      body: data,
    });

    if (!uploadResponse.ok) {
      const body = (await uploadResponse.json().catch(() => ({ error: "Failed to upload image" }))) as {
        error?: string;
      };
      setError(body.error ?? "Failed to upload image");
      return null;
    }

    const payload = (await uploadResponse.json()) as { url: string };
    return payload.url;
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    let itemImage = form.itemImage;
    const uploadedUrl = await uploadImage();
    if (selectedImageFile && !uploadedUrl) {
      setSaving(false);
      return;
    }
    if (uploadedUrl) {
      itemImage = uploadedUrl;
    }

    if (!itemImage) {
      setError("Please upload an image");
      setSaving(false);
      return;
    }

    const method = editingId ? "PUT" : "POST";
    const endpoint = editingId ? `/api/items/${editingId}` : "/api/items";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, itemImage }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: "Failed to save item" }))) as {
        error?: string;
      };
      setError(body.error ?? "Failed to save item");
      setSaving(false);
      return;
    }

    await fetchItems();
    resetForm();
    setSaving(false);
  };

  const beginEdit = (item: ItemRow) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      rarity: item.rarity,
      featured: item.featured,
      itemType: item.itemType,
      itemImage: item.itemImage,
    });
    setSelectedImageFile(null);
  };

  const deleteItem = async (id: number) => {
    setError(null);
    const response = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to delete item");
      return;
    }
    if (editingId === id) {
      resetForm();
    }
    await fetchItems();
  };

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-6 text-neutral-900 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Item CRUD</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/banners"
              className="border-2 border-black bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-200"
            >
              Manage Banners
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
          <p className="border-2 border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</p>
        ) : null}

        <section className="border-2 border-black bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold">{title}</h2>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={submitForm}>
            <label className="flex flex-col gap-1 text-sm">
              Name
              <input
                required
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="border border-neutral-400 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Rarity
              <select
                value={form.rarity}
                onChange={(event) => setForm((prev) => ({ ...prev, rarity: event.target.value }))}
                className="border border-neutral-400 px-3 py-2"
              >
                <option value="B">B</option>
                <option value="A">A</option>
                <option value="S">S</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Item Type
              <select
                value={form.itemType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, itemType: event.target.value as ItemType }))
                }
                className="border border-neutral-400 px-3 py-2"
              >
                <option value="WEAPON">WEAPON</option>
                <option value="CHARACTER">CHARACTER</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Item Image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setSelectedImageFile(event.target.files?.[0] ?? null)}
                className="border border-neutral-400 px-3 py-2"
              />
              <span className="text-xs text-neutral-500">
                Upload JPG, PNG, WEBP, or GIF. {editingId ? "Leave empty to keep current image." : ""}
              </span>
            </label>
            {imagePreview || form.itemImage ? (
              <div className="md:col-span-2">
                <p className="mb-1 text-sm">Preview</p>
                <img
                  src={imagePreview || form.itemImage}
                  alt="Item preview"
                  className="h-40 w-full max-w-md border border-neutral-300 object-cover"
                />
              </div>
            ) : null}
            <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) => setForm((prev) => ({ ...prev, featured: event.target.checked }))}
              />
              Featured item
            </label>

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="border-2 border-black bg-white px-4 py-2 font-semibold hover:bg-neutral-200 disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Update item" : "Create item"}
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
            <h2 className="text-xl font-semibold">Items</h2>
            <button
              type="button"
              onClick={() => void fetchItems()}
              className="border border-black px-3 py-1 text-sm font-semibold hover:bg-neutral-100"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p>Loading items...</p>
          ) : items.length === 0 ? (
            <p>No items yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {items.map((item) => (
                <article key={item.id} className="border border-neutral-300 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">
                      #{item.id} {item.name}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(item)}
                        className="border border-black px-2 py-1 text-sm hover:bg-neutral-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteItem(item.id)}
                        className="border border-red-500 px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p className="text-sm">Rarity: {item.rarity}</p>
                  <p className="text-sm">Type: {item.itemType}</p>
                  <p className="text-sm">
                    Banners: {item.banners.length > 0 ? item.banners.map((banner) => banner.name).join(", ") : "-"}
                  </p>
                  <p className="text-sm">Featured: {item.featured ? "Yes" : "No"}</p>
                  <img
                    src={item.itemImage}
                    alt={item.name}
                    className="mt-2 h-36 w-full border border-neutral-300 object-cover"
                  />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
