This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app), configured to use:

- [Bun](https://bun.sh) as package manager/runtime
- [Tailwind CSS](https://tailwindcss.com)
- [Prisma](https://www.prisma.io) with a local MySQL database via Docker Compose

## Getting Started

Install dependencies:

```bash
bun install
```

Create your local environment file:

```bash
# PowerShell
Copy-Item .env.example .env
```

If you need to call API from another origin, set CORS origin in `.env`:

```bash
# allow all origins (quick testing)
CORS_ORIGIN="*"

# or allow specific origins (comma-separated)
CORS_ORIGIN="http://192.168.1.10:3000,https://your-domain.com"
```

For remote dev usage (hot reload/HMR via IP or another host), allow dev origins:

```bash
ALLOWED_DEV_ORIGINS="26.63.91.47:3000,localhost:3000"
```

Start local MySQL:

```bash
bun run db:up
```

Run Prisma migrations (creates first migration and applies it):

```bash
bun run prisma:migrate --name init
```

When you change Prisma schema later (for example adding the `Item`/`Banner` models), run:

```bash
bun run prisma:migrate --name add-banner-item-relation
```

For pull-history recording table updates, run:

```bash
bun run prisma:migrate --name add-pull-history
```

For persisted pity state updates, run:

```bash
bun run prisma:migrate --name add-gacha-state
```

For banner rate/pity/guarantee settings updates, run:

```bash
bun run prisma:migrate --name add-banner-settings
```

Start the development server:

```bash
bun run dev
```

The dev and start scripts are configured with `--hostname 0.0.0.0` so the app/API can be accessed from other devices in your network.
Default dev uses Turbopack. If you want Webpack mode, use:

```bash
bun run dev:webpack
```

If remote host access still has websocket/HMR issues, use production sharing mode (no HMR websocket):

```bash
bun run share
```

Open [http://localhost:3000](http://localhost:3000).

Item CRUD page is available at [items page](/C:/Projects/funny-gacha-next/src/app/items/page.tsx) route: `http://localhost:3000/items`.
On Item CRUD, image is uploaded via file input and stored under [public/uploads/](/C:/Projects/funny-gacha-next/public/uploads/).

Banner CRUD page is available at [banners page](/C:/Projects/funny-gacha-next/src/app/banners/page.tsx) route: `http://localhost:3000/banners`.
Banner settings page is available at [banner settings page](/C:/Projects/funny-gacha-next/src/app/banner-settings/page.tsx) route: `http://localhost:3000/banner-settings`.
Banner management now supports `bannerThumbnail` URL, and the main gacha hero image uses this banner thumbnail instead of the latest pulled item image.
Pull history is recorded through [pulls route](/C:/Projects/funny-gacha-next/src/app/api/pulls/route.ts) and shown on the home page.
Upload endpoint [uploads route](/C:/Projects/funny-gacha-next/src/app/api/uploads/route.ts) accepts multipart image uploads and returns both `url` (relative path) and `publicUrl` (absolute URL) for external clients.

## Prisma commands

```bash
bun run prisma:generate
bun run prisma:studio
```

Prisma client is exposed via [prisma.ts](/C:/Projects/funny-gacha-next/src/lib/prisma.ts).

## Local database

The MySQL service is defined in [docker-compose.yml](/C:/Projects/funny-gacha-next/docker-compose.yml).

Stop the database:

```bash
bun run db:down
```

> If port `3306` is already used locally, change the left side of the port mapping in [docker-compose.yml](/C:/Projects/funny-gacha-next/docker-compose.yml) and update `DATABASE_URL` in `.env`.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
