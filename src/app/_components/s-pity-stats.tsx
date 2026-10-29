import { formatResource } from "./gacha-config";
import type { PullStatistics } from "./types";

const PAGER_BUTTON_CLASS =
  "rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50";

export function SPityStats({
  statistics,
  onRefresh,
  onPageChange,
}: {
  statistics: PullStatistics | null;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">S-item pity statistics</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20"
        >
          Refresh stats
        </button>
      </div>

      {statistics ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
            <p className="rounded-lg border border-white/20 bg-white/10 px-3 py-2">
              Total pulls: {statistics.totalPulls}
            </p>
            <p className="rounded-lg border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-amber-100">
              S items: {statistics.totalS}
            </p>
            <p className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-cyan-100">
              Avg S pity: {statistics.averagePity}
            </p>
            <p className="rounded-lg border border-violet-300/40 bg-violet-500/15 px-3 py-2 text-violet-100">
              Max S pity: {statistics.maxPity}
            </p>
          </div>

          <h3 className="mb-2 text-lg font-semibold">Resource spent</h3>
          <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
            <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-emerald-100">
              Total: {formatResource(statistics.totalPulls)}
            </p>
            <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-emerald-100">
              Avg per S: {formatResource(statistics.averagePity)}
            </p>
            <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-emerald-100">
              Max per S: {formatResource(statistics.maxPity)}
            </p>
            <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-emerald-100">
              Latest S:{" "}
              {statistics.lastSPity === null
                ? "-"
                : formatResource(statistics.lastSPity)}
            </p>
          </div>

          <p className="mb-3 text-sm text-slate-300/90">
            Latest S pity:{" "}
            {statistics.lastSPity === null
              ? "No S item yet"
              : statistics.lastSPity}
          </p>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-300/85">
              Page {statistics.pagination.page} of{" "}
              {statistics.pagination.totalPages} •{" "}
              {statistics.pagination.totalCount} S entries
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(statistics.pagination.page - 1)}
                disabled={!statistics.pagination.hasPrevPage}
                className={PAGER_BUTTON_CLASS}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => onPageChange(statistics.pagination.page + 1)}
                disabled={!statistics.pagination.hasNextPage}
                className={PAGER_BUTTON_CLASS}
              >
                Next
              </button>
            </div>
          </div>

          {statistics.entries.length === 0 ? (
            <p className="text-slate-300">
              No S items recorded for this banner yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {statistics.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-amber-300/40 bg-amber-500/15 px-4 py-3"
                >
                  <p className="text-base font-semibold text-amber-100">
                    - {entry.itemName}: {entry.pity}
                  </p>
                  <p className="text-xs text-slate-200/85">
                    {new Date(entry.createdAt).toLocaleString()} •{" "}
                    {entry.featured ? "featured" : "standard"} •{" "}
                    {formatResource(entry.pity)} spent
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-slate-300">No statistics available yet.</p>
      )}
    </section>
  );
}
