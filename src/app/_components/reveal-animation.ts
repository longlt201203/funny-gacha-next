import type { PullResult } from "@/lib/gacha";
import { FEATURED_INTRO_MS } from "./gacha-config";

type Anime = Pick<typeof import("animejs"), "animate" | "stagger">;

export type RevealElements = {
  /** Holds every `[data-s-fx]` effect layer. */
  overlay: HTMLElement | null;
  /** Wraps the card; shaken on a normal S impact. */
  modal: HTMLElement | null;
  card: HTMLElement;
};

/** The reveal overlay sliding in when a batch starts. */
export function animateRevealEntrance({ animate }: Anime, modal: HTMLElement) {
  animate(modal, {
    opacity: [0, 1],
    translateY: [18, 0],
    duration: 420,
    ease: "outExpo",
  });
}

/** The current card leaving before the next item is revealed. */
export function animateCardExit({ animate }: Anime, card: HTMLElement) {
  animate(card, {
    opacity: [1, 0],
    scale: [1, 0.94],
    rotateZ: [0, -1.5],
    duration: 220,
    ease: "inQuad",
  });
}

/** Plays the reveal for one item: a short pop for A/B, the full burst (or featured intro) for S. */
export function animateItemReveal(
  { animate, stagger }: Anime,
  { overlay, modal, card }: RevealElements,
  item: PullResult,
) {
  if (item.rarity === 5) {
    // Featured S: a calm black-screen five-star intro, then the card opens into a golden glow at time `t`.
    const featured = item.featured;
    const t = featured ? FEATURED_INTRO_MS : 0;
    const fx = (name: string) =>
      Array.from(
        overlay?.querySelectorAll<HTMLElement>(
          `[data-s-fx="${name}"]`,
        ) ?? [],
      );
    // Hide targets up front so delayed tweens (and leftovers from a previous S) don't show early.
    const run = (
      targets: HTMLElement[],
      params: Parameters<typeof animate>[1],
    ) => {
      if (targets.length > 0) {
        for (const target of targets) {
          target.style.opacity = "0";
        }
        animate(targets, params);
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animate(card, { opacity: [0, 1], duration: 400, ease: "outQuad" });
      run(
        [
          ...fx("rank"),
          ...fx("star"),
          ...fx("name"),
          ...fx("headline"),
          ...fx("rays"),
        ],
        { opacity: [0, 1], duration: 400, ease: "outQuad" },
      );
      return;
    }

    if (featured) {
      card.style.opacity = "0";
      // Intro: cut to black, five stars light up one by one, then gather into a line where the card opens.
      run(fx("vignette"), {
        opacity: [
          { to: 1, duration: 150 },
          { to: 1, duration: t - 150 },
          { to: 0, duration: 700 },
        ],
        ease: "outQuad",
      });
      // Pop timings scale with the intro length so all five stars land before they gather at `t - gather`.
      const introStars = fx("intro-star");
      const gather = Math.min(320, t * 0.22);
      const popDuration = Math.min(550, t * 0.35);
      const popStart = t * 0.06;
      const popStagger =
        (t - gather - popDuration - popStart) /
        Math.max(1, introStars.length - 1);
      run(introStars, {
        opacity: [0, 1],
        scale: [0, 1.5, 1],
        rotateZ: [-120, 0],
        duration: popDuration,
        delay: stagger(popStagger, { start: popStart }),
        ease: "outBack",
      });

      // Ambient layers in the dark: gold dust, a halo bloom, and a horizon line the stars gather into.
      run(fx("intro-dust"), {
        opacity: () => [0, 0.4 + Math.random() * 0.6, 0],
        translateY: () => [0, -(10 + Math.random() * 30)],
        scale: [0.5, 1.2],
        duration: () => t + 300 + Math.random() * 400,
        delay: () => Math.random() * t * 0.5,
        ease: "outSine",
      });
      run(fx("intro-halo"), {
        opacity: [
          { to: 1, duration: t, ease: "outQuad" },
          { to: 0, duration: 600, ease: "outQuad" },
        ],
        scale: [
          { from: 0.4, to: 1.1, duration: t, ease: "outQuad" },
          { to: 1.6, duration: 600, ease: "outExpo" },
        ],
      });
      run(fx("intro-line"), {
        scaleX: [{ from: 0, to: 1, duration: t - popStart, ease: "outExpo" }],
        opacity: [
          { to: 1, duration: Math.min(200, t * 0.3) },
          { to: 1, duration: t - popStart - Math.min(200, t * 0.3) },
          { to: 0, duration: 500 },
        ],
        delay: popStart,
      });

      // As each star lands: a four-point glint flashes behind it and a few sparks scatter.
      introStars.forEach((_, index) => {
        const landAt = popStart + index * popStagger + popDuration * 0.45;
        run(fx(`intro-glint-${index}`), {
          opacity: [0, 1, 0],
          scale: [0.2, 1.3],
          rotateZ: [0, 45],
          duration: Math.max(260, popDuration),
          delay: landAt,
          ease: "outQuad",
        });
        const sparks = fx(`intro-spark-${index}`);
        const offset = Math.random() * Math.PI;
        run(sparks, {
          translateX: (_target: unknown, i = 0) => [
            0,
            Math.cos(offset + (i / sparks.length) * Math.PI * 2) * (36 + Math.random() * 30),
          ],
          translateY: (_target: unknown, i = 0) => [
            0,
            Math.sin(offset + (i / sparks.length) * Math.PI * 2) * (36 + Math.random() * 30),
          ],
          opacity: [1, 0],
          scale: [1.2, 0],
          duration: 420,
          delay: landAt,
          ease: "outExpo",
        });
      });

      const centerX = window.innerWidth / 2;
      animate(introStars, {
        translateX: (target: unknown) => {
          const rect = (target as HTMLElement).getBoundingClientRect();
          return centerX - (rect.left + rect.width / 2);
        },
        scaleX: 3,
        scaleY: 0.1,
        opacity: 0,
        duration: gather,
        delay: t - gather,
        ease: "inBack",
      });

      // The card opens like a door of light from the stars' line; the lasting glow is a static box-shadow.
      // Transform + an overlay fade only: animating filter/clip-path on the card repaints it every frame.
      animate(card, {
        opacity: [{ to: 1, duration: 120 }],
        scaleX: [1.2, 1],
        scaleY: [0.04, 1],
        duration: 1300,
        delay: t,
        ease: "outExpo",
      });
      run(fx("card-flash"), {
        opacity: [1, 0],
        duration: 1100,
        delay: t,
        ease: "inQuad",
      });
    } else {
      // Impact: gold flash plus a short camera shake.
      run(fx("screen-flash"), {
        opacity: [
          { to: 0.9, duration: 220 },
          { to: 0, duration: 530 },
        ],
        ease: "outQuad",
      });
      if (modal) {
        animate(modal, {
          translateX: [0, -16, 13, -10, 7, -4, 2, 0],
          translateY: [0, 8, -6, 5, -3, 2, 0, 0],
          duration: 560,
          ease: "linear",
        });
      }

      // Card bursts out of a white flash (the card-flash overlay stands in for an animated filter).
      animate(card, {
        opacity: [0, 1],
        scale: [0.5, 1.08, 1],
        rotateZ: [-5, 1.5, 0],
        duration: 1100,
        ease: "outExpo",
      });
      run(fx("card-flash"), {
        opacity: [1, 0],
        duration: 700,
        ease: "outExpo",
      });
      run(fx("rays"), {
        opacity: [0, 1],
        scale: [0.3, 1],
        duration: 1400,
        ease: "outExpo",
      });
      run(fx("ring"), {
        opacity: [1, 0],
        scale: [0.15, 2.4],
        duration: 1200,
        delay: stagger(150),
        ease: "outCirc",
      });

      const particles = fx("particle");
      const vectors = particles.map((_, index) => {
        const angle =
          (index / particles.length) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 220 + Math.random() * 380;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
        };
      });
      run(particles, {
        translateX: (_target: unknown, index = 0) => [0, vectors[index].x],
        translateY: (_target: unknown, index = 0) => [
          0,
          vectors[index].y + 90,
        ],
        scale: [{ to: 1.6, duration: 160 }, { to: 0 }],
        opacity: [{ to: 1, duration: 80 }, { to: 0 }],
        duration: () => 1000 + Math.random() * 800,
        delay: stagger(8, { start: 60 }),
        ease: "outExpo",
      });
    }

    // Golden aura swells behind the card.
    run(fx("backdrop-pulse"), {
      opacity: [0, 1, 0.55],
      scale: [0.6, 1.25, 1.1],
      duration: 1400,
      delay: t,
      ease: "outExpo",
    });

    // Title card: (featured) FEATURED letters rise in gently, the rank slams, stars pop, then the name sweeps in.
    const titleStart = t + (featured ? 500 : 0);
    run(fx("headline"), {
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 700,
      delay: stagger(70, { start: t + 250 }),
      ease: "outQuad",
    });
    run(fx("rank"), {
      opacity: [0, 1],
      scale: [4, 0.85, 1],
      rotateZ: [-30, 4, 0],
      duration: 800,
      delay: titleStart + 300,
      ease: "outExpo",
    });
    run(fx("star"), {
      opacity: [0, 1],
      scale: [0, 1.6, 1],
      rotateZ: [-180, 0],
      duration: 650,
      delay: stagger(110, { start: titleStart + 560 }),
      ease: "outBack",
    });
    run(fx("name"), {
      opacity: [0, 1],
      translateY: [28, 0],
      // scaleX instead of letter-spacing, which would re-run layout every frame.
      scaleX: [1.6, 1],
      duration: 1000,
      delay: titleStart + 900,
      ease: "outExpo",
    });
  } else {
    animate(card, {
      opacity: [0, 1],
      scale: [0.92, 1],
      rotateZ: [-1.5, 0],
      duration: 500,
      ease: "outBack",
    });
  }
}
