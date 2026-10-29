import type { Ref } from "react";
import type { PullResult } from "@/lib/gacha";

const GOLD_SHIMMER_TEXT =
  "bg-[linear-gradient(90deg,#b45309,#fde68a,#fffbeb,#fbbf24,#b45309)] bg-size-[200%_auto] bg-clip-text text-transparent motion-safe:animate-s-prism";
const FEATURED_LETTERS = "FEATURED".split("");

function cardStyle(item: PullResult, featured: boolean): string {
  if (featured) {
    return "from-amber-400/30 via-orange-400/20 to-rose-400/30 border-amber-300/70 shadow-[0_0_28px_rgba(251,191,36,0.55),0_0_70px_rgba(251,191,36,0.35)]";
  }
  return item.rarity === 5
    ? "from-amber-400/30 via-orange-400/20 to-rose-400/30 border-amber-300/70 shadow-[0_0_70px_rgba(251,191,36,0.35)]"
    : item.rarity === 4
      ? "from-violet-400/30 via-fuchsia-400/20 to-indigo-400/30 border-violet-300/70 shadow-[0_0_70px_rgba(167,139,250,0.35)]"
      : "from-blue-500/30 via-sky-400/20 to-blue-500/30 border-blue-300/60 shadow-[0_0_40px_rgba(96,165,250,0.3)]";
}

function rankStyle(item: PullResult): string {
  return item.rarity === 5
    ? "border-amber-300/80 bg-amber-400/30 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
    : item.rarity === 4
      ? "border-violet-300/80 bg-violet-400/30 text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.45)]"
      : "border-blue-300/70 bg-blue-400/25 text-blue-100 shadow-[0_0_20px_rgba(96,165,250,0.4)]";
}

function auraStyle(item: PullResult): string {
  return item.rarity === 5
    ? "from-amber-300/20 via-orange-300/10 to-rose-300/20"
    : item.rarity === 4
      ? "from-violet-300/20 via-fuchsia-300/10 to-indigo-300/20"
      : "from-blue-300/20 via-sky-200/10 to-blue-300/20";
}

/** The revealed item card. S cards carry the `[data-s-fx]` title layers that `animateItemReveal` drives. */
export function RevealCard({
  item,
  featured,
  ref,
}: {
  item: PullResult;
  featured: boolean;
  ref: Ref<HTMLDivElement>;
}) {
  const isS = item.rarity === 5;
  const revealRankStyle = rankStyle(item);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 will-change-[transform,opacity] ${cardStyle(item, featured)}`}
    >
      {isS ? (
        <>
          <div
            className={`pointer-events-none absolute inset-[-60%] opacity-90 motion-safe:animate-s-border ${
              featured
                ? "bg-[conic-gradient(from_0deg,#fef3c7,#f59e0b,#b45309,#fde68a,#d97706,#fef3c7)]"
                : "bg-[conic-gradient(from_0deg,#fde047,#f97316,#f472b6,#a78bfa,#38bdf8,#fde047)]"
            }`}
          />
          <div
            data-s-fx="card-flash"
            className={`pointer-events-none absolute inset-0 z-30 rounded-2xl opacity-0 ${
              featured
                ? "bg-[radial-gradient(circle,#fffbeb_0%,#fde68a_60%,#f59e0b_100%)]"
                : "bg-white"
            }`}
          />
        </>
      ) : null}
      <div
        className={`pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-tr ${auraStyle(item)}`}
      />
      {[0, 1, 2, 3, 4, 5].map((sparkle) => (
        <div
          key={sparkle}
          className="pointer-events-none absolute h-2 w-2 animate-ping rounded-full bg-white/70"
          style={{
            top: `${16 + (sparkle % 3) * 24}%`,
            left: `${12 + sparkle * 14}%`,
            animationDelay: `${sparkle * 180}ms`,
            animationDuration: "1400ms",
          }}
        />
      ))}
      <img
        src={item.itemImage}
        alt={item.name}
        className="relative mx-auto h-[72vh] max-h-[820px] w-full rounded-xl border border-white/30 object-cover shadow-2xl"
      />
      {isS ? (
        <>
          <div className="pointer-events-none absolute inset-4 overflow-hidden rounded-xl">
            <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/45 to-transparent motion-safe:animate-s-shine" />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            {featured ? (
              <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-black/80 to-transparent" />
            ) : null}
          </div>
          {featured ? (
            <div
              className="pointer-events-none absolute inset-x-6 top-8 flex justify-center text-4xl font-black sm:text-7xl"
              aria-label="Featured"
            >
              {FEATURED_LETTERS.map((letter, index) => (
                <span
                  key={index}
                  data-s-fx="headline"
                  className={`inline-block opacity-0 drop-shadow-[0_0_18px_rgba(251,191,36,0.6)] ${GOLD_SHIMMER_TEXT}`}
                >
                  {letter}
                </span>
              ))}
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-x-6 bottom-8 flex flex-col items-center gap-2 text-center">
            <span
              data-s-fx="rank"
              className={`inline-flex min-w-24 items-center justify-center rounded-full border px-6 py-1.5 text-3xl font-black tracking-[0.25em] opacity-0 ${revealRankStyle}`}
            >
              S
            </span>
            <div className="flex gap-1.5" aria-label="5 stars">
              {[0, 1, 2, 3, 4].map((star) => (
                <span
                  key={star}
                  data-s-fx="star"
                  className="text-3xl text-amber-300 opacity-0 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]"
                >
                  ★
                </span>
              ))}
            </div>
            <p
              data-s-fx="name"
              className="max-w-full truncate bg-gradient-to-r from-amber-100 via-yellow-200 to-amber-400 bg-clip-text text-3xl font-black uppercase text-transparent opacity-0 drop-shadow-[0_2px_14px_rgba(251,191,36,0.65)] sm:text-5xl"
            >
              {item.name}
            </p>
          </div>
        </>
      ) : (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
          <span
            className={`inline-flex min-w-24 items-center justify-center rounded-full border px-5 py-1.5 text-xl font-black tracking-[0.25em] ${revealRankStyle}`}
          >
            {item.rarity === 4 ? "A" : "B"}
          </span>
        </div>
      )}
      {isS ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 rounded-2xl mix-blend-overlay transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(circle at var(--tilt-x, 50%) var(--tilt-y, 50%), rgba(255,255,255,0.55), transparent 45%)",
            opacity: "var(--tilt-glare, 0)",
          }}
        />
      ) : null}
    </div>
  );
}
