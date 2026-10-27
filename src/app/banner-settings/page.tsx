"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BannerItemRef = {
  id: number;
};

type BannerRow = {
  id: number;
  name: string;
  items: BannerItemRef[];
  fiveStarRate: number;
  fourStarRate: number;
  fiveStarHardPity: number;
  fiveStarSoftPityStart: number;
  fiveStarSoftIncrease: number;
  fourStarHardPity: number;
  featuredRate?: number;
  winRate?: number;
  guaranteeEnabled: boolean;
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

const DEFAULT_FORM: BannerSettingsForm = {
  fiveStarRate: "0.6",
  fourStarRate: "5.1",
  fiveStarHardPity: "90",
  fiveStarSoftPityStart: "74",
  fiveStarSoftIncrease: "6",
  fourStarHardPity: "10",
  winRate: "50",
  guaranteeEnabled: true,
};

function toForm(banner: BannerRow): BannerSettingsForm {
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
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

export default function BannerSettingsPage() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [selectedBannerId, setSelectedBannerId] = useState<number | null>(null);
  const [form, setForm] = useState<BannerSettingsForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedBanner = useMemo(
    () => (selectedBannerId ? banners.find((banner) => banner.id === selectedBannerId) ?? null : null),
    [banners, selectedBannerId],
  );

  const loadBanners = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/banners", { cache: "no-store" });
    if (!response.ok) {
      setLoading(false);
      setError("Failed to load banners.");
      return;
    }

    const data = (await response.json()) as BannerRow[];
    setBanners(data);

    if (data.length === 0) {
      setSelectedBannerId(null);
      setForm(DEFAULT_FORM);
    } else {
      const nextSelected = selectedBannerId && data.some((banner) => banner.id === selectedBannerId) ? selectedBannerId : data[0].id;
      const nextBanner = data.find((banner) => banner.id === nextSelected) ?? data[0];
      setSelectedBannerId(nextBanner.id);
      setForm(toForm(nextBanner));
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadBanners();
  }, []);

  const onSelectBanner = (id: number) => {
    setError(null);
    setSuccess(null);
    setSelectedBannerId(id);
    const banner = banners.find((entry) => entry.id === id);
    if (!banner) {
      return;
    }
    setForm(toForm(banner));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBanner) {
      setError("Please select a banner first.");
      return;
    }

    const fiveStarRate = parseFiniteNumber(form.fiveStarRate);
    const fourStarRate = parseFiniteNumber(form.fourStarRate);
    const winRate = parseFiniteNumber(form.winRate);
    const fiveStarHardPity = parsePositiveInt(form.fiveStarHardPity);
    const fiveStarSoftPityStart = parsePositiveInt(form.fiveStarSoftPityStart);
    const fiveStarSoftIncrease = parseFiniteNumber(form.fiveStarSoftIncrease);
    const fourStarHardPity = parsePositiveInt(form.fourStarHardPity);

    if (
      fiveStarRate === null ||
      fourStarRate === null ||
      winRate === null ||
      fiveStarHardPity === null ||
      fiveStarSoftPityStart === null ||
      fiveStarSoftIncrease === null ||
      fourStarHardPity === null
    ) {
      setError("Please input valid numeric settings.");
      return;
    }

    if (fiveStarRate < 0 || fourStarRate < 0 || fiveStarRate + fourStarRate > 100) {
      setError("5★ rate and 4★ rate must be >= 0 and combined <= 100.");
      return;
    }
    if (winRate < 0 || winRate > 100) {
      setError("Win rate must be between 0 and 100.");
      return;
    }
    if (fiveStarSoftPityStart > fiveStarHardPity) {
      setError("Soft pity start cannot be greater than 5★ hard pity.");
      return;
    }
    if (fiveStarSoftIncrease < 0) {
      setError("Soft pity increase must be >= 0.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/banners/${selectedBanner.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selectedBanner.name,
        itemIds: selectedBanner.items.map((item) => item.id),
        fiveStarRate,
        fourStarRate,
        fiveStarHardPity,
        fiveStarSoftPityStart,
        fiveStarSoftIncrease,
        fourStarHardPity,
        winRate,
        guaranteeEnabled: form.guaranteeEnabled,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: "Failed to save settings" }))) as { error?: string };
      setError(body.error ?? "Failed to save settings");
      setSaving(false);
      return;
    }

    await loadBanners();
    setSaving(false);
    setSuccess(`Settings for "${selectedBanner.name}" updated.`);
  };

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-6 text-neutral-900 sm:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Banner Settings</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/banners"
              className="border-2 border-black bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-200"
            >
              Manage Banners
            </Link>
            <Link href="/" className="border-2 border-black bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-200">
              Back to Gacha
            </Link>
          </div>
        </div>

        {error ? <p className="border-2 border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</p> : null}
        {success ? <p className="border-2 border-green-400 bg-green-100 px-4 py-3 text-green-700">{success}</p> : null}

        <section className="border-2 border-black bg-white p-5">
          {loading ? (
            <p>Loading banners...</p>
          ) : banners.length === 0 ? (
            <p>No banners found. Create one in Manage Banners first.</p>
          ) : (
            <form className="grid grid-cols-1 gap-4" onSubmit={submit}>
              <label className="flex flex-col gap-1 text-sm">
                Select banner
                <select
                  value={selectedBannerId ?? ""}
                  onChange={(event) => onSelectBanner(Number(event.target.value))}
                  className="border border-neutral-400 px-3 py-2"
                >
                  {banners.map((banner) => (
                    <option key={banner.id} value={banner.id}>
                      #{banner.id} {banner.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  5★ rate (%)
                  <input
                    value={form.fiveStarRate}
                    onChange={(event) => setForm((prev) => ({ ...prev, fiveStarRate: event.target.value }))}
                    className="border border-neutral-400 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  4★ rate (%)
                  <input
                    value={form.fourStarRate}
                    onChange={(event) => setForm((prev) => ({ ...prev, fourStarRate: event.target.value }))}
                    className="border border-neutral-400 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  5★ hard pity
                  <input
                    value={form.fiveStarHardPity}
                    onChange={(event) => setForm((prev) => ({ ...prev, fiveStarHardPity: event.target.value }))}
                    className="border border-neutral-400 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  5★ soft pity start
                  <input
                    value={form.fiveStarSoftPityStart}
                    onChange={(event) => setForm((prev) => ({ ...prev, fiveStarSoftPityStart: event.target.value }))}
                    className="border border-neutral-400 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  5★ soft pity increase (%)
                  <input
                    value={form.fiveStarSoftIncrease}
                    onChange={(event) => setForm((prev) => ({ ...prev, fiveStarSoftIncrease: event.target.value }))}
                    className="border border-neutral-400 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  4★ hard pity
                  <input
                    value={form.fourStarHardPity}
                    onChange={(event) => setForm((prev) => ({ ...prev, fourStarHardPity: event.target.value }))}
                    className="border border-neutral-400 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Win rate on 5★ (%)
                  <input
                    value={form.winRate}
                    onChange={(event) => setForm((prev) => ({ ...prev, winRate: event.target.value }))}
                    className="border border-neutral-400 px-3 py-2"
                  />
                </label>
                <label className="inline-flex items-center gap-2 pt-7 text-sm">
                  <input
                    type="checkbox"
                    checked={form.guaranteeEnabled}
                    onChange={(event) => setForm((prev) => ({ ...prev, guaranteeEnabled: event.target.checked }))}
                  />
                  Enable guaranteed featured after losing previous win-rate roll
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 border-black bg-white px-4 py-2 font-semibold hover:bg-neutral-200 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(DEFAULT_FORM)}
                  className="border-2 border-black bg-white px-4 py-2 font-semibold hover:bg-neutral-200"
                >
                  Use Default Values
                </button>
                <button
                  type="button"
                  onClick={() => void loadBanners()}
                  className="border-2 border-black bg-white px-4 py-2 font-semibold hover:bg-neutral-200"
                >
                  Refresh
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
