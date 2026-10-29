// Gold dust scattered across the black intro screen (fixed layout; brightness and drift are randomized per reveal).
const INTRO_DUST = Array.from({ length: 40 }, (_, index) => ({
  left: (index * 53 + 11) % 100,
  top: (index * 29 + 7) % 100,
  size: 1 + (index % 3),
}));
const INTRO_SPARKS_PER_STAR = 6;

/** Layers for the featured S black-screen intro; all start hidden and are driven by `animateItemReveal`. */
export function RevealFeaturedIntro() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(254,240,138,0.45),rgba(245,158,11,0.3)_35%,rgba(180,83,9,0.15)_55%,transparent_75%)] motion-safe:animate-pulse" />
      <div
        data-s-fx="vignette"
        className="pointer-events-none absolute inset-0 z-5 bg-black opacity-0"
      />
      <div className="pointer-events-none absolute inset-0 z-25" aria-hidden>
        {INTRO_DUST.map((mote) => (
          <span
            key={`${mote.left}-${mote.top}`}
            data-s-fx="intro-dust"
            className="absolute rounded-full bg-amber-200 opacity-0 shadow-[0_0_6px_rgba(253,224,71,0.9)]"
            style={{
              left: `${mote.left}%`,
              top: `${mote.top}%`,
              width: mote.size,
              height: mote.size,
            }}
          />
        ))}
        <div
          data-s-fx="intro-halo"
          className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.35)_0%,rgba(245,158,11,0.15)_40%,transparent_70%)] opacity-0"
        />
        <div
          data-s-fx="intro-line"
          className="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-linear-to-r from-transparent via-amber-200 to-transparent opacity-0 shadow-[0_0_20px_4px_rgba(253,224,71,0.6)]"
        />
        <div className="absolute inset-0 flex items-center justify-center gap-3 sm:gap-6">
          {[0, 1, 2, 3, 4].map((star) => (
            <div key={star} className="relative flex items-center justify-center">
              <div
                data-s-fx={`intro-glint-${star}`}
                className="absolute h-[220%] w-[220%] opacity-0"
              >
                <span className="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-linear-to-r from-transparent via-yellow-50 to-transparent" />
                <span className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-linear-to-b from-transparent via-yellow-50 to-transparent" />
              </div>
              {Array.from({ length: INTRO_SPARKS_PER_STAR }, (_, spark) => (
                <span
                  key={spark}
                  data-s-fx={`intro-spark-${star}`}
                  className="absolute h-1 w-1 rounded-full bg-yellow-100 opacity-0 shadow-[0_0_6px_rgba(253,224,71,0.95)]"
                />
              ))}
              <span
                data-s-fx="intro-star"
                className="relative bg-linear-to-b from-yellow-50 via-amber-300 to-amber-600 bg-clip-text text-6xl text-transparent opacity-0 drop-shadow-[0_0_24px_rgba(253,224,71,0.95)] sm:text-8xl"
              >
                ★
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
