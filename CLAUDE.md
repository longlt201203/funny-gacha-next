# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

This project runs Next.js 16.4 (React 19.3). Before using Next.js APIs, read the bundled docs in `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`, …). For example, CORS lives in `src/proxy.ts` (an exported `proxy` function, which replaced `middleware.ts`), and `next.config.ts` turns on `cacheComponents` and `partialPrefetching`.

## Commands

Bun is the package manager and runtime (`bun@1.3.13`).

```bash
bun install
bun run db:up                      # start MySQL via docker compose (port 3306)
bun run prisma:migrate --name <x>  # prisma migrate dev: create + apply migration, regenerate client
bun run prisma:generate
bun run dev                        # next dev --turbopack on 0.0.0.0
bun run dev:webpack                # same, but with webpack
bun run share                      # build + start (no HMR websocket; for remote-device access)
bun run build
bun run lint                       # eslint (flat config, eslint-config-next)
```

There is no test framework or test suite.

Env vars (see `.env.example`): `DATABASE_URL` (MySQL), `CORS_ORIGIN` (`*` or a comma-separated list, used by `src/proxy.ts` on `/api/*`), and `ALLOWED_DEV_ORIGINS` (comma-separated hosts, used for `allowedDevOrigins` in `next.config.ts`).

## Architecture

A gacha (loot-pull) simulator. Most of the app is client components that call JSON route handlers backed by Prisma/MySQL.

**Gacha engine (`src/lib/gacha.ts`)** is pure TypeScript and runs **client-side**. The server never rolls pulls.
- Internal rarities are `"S" | "A" | "B"`. These map to the 5/4/3 stars used in the API, `PullHistory`, and the UI (`rarityToStars`). `Item.rarity` in the DB is a free-form string; `mapApiBannersToCatalog` uppercases it and drops items that aren't S/A/B. Banners with no valid items are left out of the catalog.
- `GachaBanner` handles pity: S has hard pity plus soft pity (the rate grows by `fiveStarSoftIncrease` percentage points per pull past `fiveStarSoftPityStart`), and A has hard pity only. Raised rates take probability first and the remaining rarities share what is left. Featured vs. standard selection uses `featuredRate`/`winRate`, with a 50/50-style guarantee (`guaranteedFeatured`) that applies only to S.
- `normalizeBannerSettings` clamps every setting and scales the 5★ and 4★ rates down when together they exceed 100. `GachaEngine` is the public wrapper the UI uses.
- Naming quirk: the DB column is `Banner.featuredRate`, but the engine and UI call it `winRate`. The banner API routes accept either name on input and return `winRate` alongside `featuredRate`.

**State persistence flow (`src/app/page.tsx`, a large `"use client"` page):**
1. Load `/api/banners` and build a `GachaEngine` for the selected banner. If loading fails, use the fallback catalog in `gacha.ts`.
2. Restore pity from `GET /api/pity?bannerName=` (the `GachaState` row, keyed by banner **name**) into the engine with `hydratePityState`.
3. After each pull, the client `PUT`s updated pity to `/api/pity` and `POST`s the results to `/api/pulls`. These are denormalized `PullHistory` rows (item name/image copied, `pullBatchId` groups a 1x/10x pull).
4. `GET /api/pulls?withSStats=1` computes per-S pity stats on the server by replaying the full history in order.

`GachaState` and `PullHistory` link to banners by `bannerName` string, not by foreign key, so renaming a banner orphans its pity and history.

**Management pages** live in the `src/app/(manage)/` route group, so the URLs are still `/items` and `/banners`. They share `layout.tsx` (dark shell and tab nav) and a small UI kit in `_components/ui.tsx` (Drawer, ConfirmDialog, ImageDropzone, toasts, rarity badges, `uploadImage`). Build new management UI from that kit rather than one-off styles. `/banners` uses a single drawer form to edit a banner's name, thumbnail, item pool (Banner↔Item is an implicit many-to-many), and rate/pity/guarantee settings, and it warns about pools the engine can't use well (e.g. no S items, or no featured/standard split). `/banner-settings` redirects to `/banners` via `next.config.ts`. `POST /api/uploads` writes images to `public/uploads/` on local disk and returns `url` (relative) and `publicUrl` (absolute).

**Assets:** reveal videos (`public/videos/{3,4,5}star-{single,multi}.mp4`) and SFX (`public/sfx/`) are chosen by the highest rarity in a pull. Animations use `animejs` v4, loaded with a dynamic `import()`.

Prisma client is a global singleton in `src/lib/prisma.ts`. Schema changes go through `prisma migrate dev`; migrations are committed under `prisma/migrations/`.
