"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const TABS = [
  { href: "/banners", label: "Banners" },
  { href: "/items", label: "Items" },
] as const;

export function ManageNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm font-semibold text-slate-400 transition hover:text-white">
          ← Back to Gacha
        </Link>
        <div className="flex rounded-xl border border-white/15 bg-white/5 p-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-lg px-4 py-1.5 text-sm font-semibold transition",
                  active ? "bg-white/20 text-white" : "text-slate-400 hover:text-white",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
