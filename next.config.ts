import type { NextConfig } from "next";

function normalizeDevOrigin(origin: string): string {
  const trimmed = origin.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.host;
  } catch {
    return trimmed.replace(/^https?:\/\//, "");
  }
}

const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => normalizeDevOrigin(origin))
  .filter((origin) => origin.length > 0);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins,
  async redirects() {
    return [
      {
        source: "/banner-settings",
        destination: "/banners",
        permanent: false,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
