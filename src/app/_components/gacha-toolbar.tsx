import Link from "next/link";

export function GachaToolbar({
  banner,
  bannerOptions,
  onBannerChange,
  disabled,
  soundVolume,
  onSoundVolumeChange,
}: {
  banner: string;
  bannerOptions: string[];
  onBannerChange: (banner: string) => void;
  disabled: boolean;
  soundVolume: number;
  onSoundVolumeChange: (volume: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <button
        type="button"
        className="h-11 min-w-44 rounded-xl border border-sky-300/60 bg-sky-400/10 px-6 text-xl font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:bg-sky-300/20"
      >
        gacha
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-3 rounded-xl border border-white/20 bg-slate-900/60 px-4 py-2 text-sm">
          <span className="font-medium text-slate-300">Banner</span>
          <select
            value={banner}
            onChange={(event) => onBannerChange(event.target.value)}
            className="rounded-md bg-slate-950/50 px-2 py-1 font-semibold text-white outline-none"
            disabled={disabled}
          >
            {bannerOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
          <span className="font-medium">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={soundVolume}
            onChange={(event) => onSoundVolumeChange(Number(event.target.value))}
            className="w-24 accent-cyan-300"
          />
          <span className="w-9 text-right font-semibold">{soundVolume}%</span>
        </label>
        <Link
          href="/items"
          className="rounded-xl border border-violet-300/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/30"
        >
          Manage Items
        </Link>
        <Link
          href="/banners"
          className="rounded-xl border border-fuchsia-300/40 bg-fuchsia-500/15 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/30"
        >
          Manage Banners
        </Link>
      </div>
    </div>
  );
}
