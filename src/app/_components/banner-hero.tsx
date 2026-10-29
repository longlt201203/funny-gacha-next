/** The selected banner's artwork; the fallback gradient follows the rarity of the latest pull. */
export function BannerHero({
  name,
  thumbnail,
  latestRarity,
}: {
  name: string;
  thumbnail?: string | null;
  latestRarity: number | null;
}) {
  const thumbnailStyle =
    latestRarity === 5
      ? "from-amber-400 via-orange-300 to-rose-300"
      : latestRarity === 4
        ? "from-violet-400 via-fuchsia-300 to-indigo-300"
        : "from-blue-400 via-sky-300 to-cyan-200";

  return (
    <section
      className={`relative mx-auto h-[500px] w-full max-w-[980px] overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br ${thumbnailStyle} p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-8`}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={`${name} thumbnail`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/15" />
      <p className="relative inline-flex w-fit rounded-full border border-black/20 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
        {name} Banner
      </p>
    </section>
  );
}
