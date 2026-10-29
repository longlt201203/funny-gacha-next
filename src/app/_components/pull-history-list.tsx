import type { Pagination, RecordedPull } from "./types";

const PAGER_BUTTON_CLASS =
  "rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50";

export function PullHistoryList({
  items,
  pagination,
  onPageChange,
}: {
  items: RecordedPull[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Recorded pull history</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!pagination.hasPrevPage}
            className={PAGER_BUTTON_CLASS}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasNextPage}
            className={PAGER_BUTTON_CLASS}
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pagination.page)}
            className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold transition hover:bg-white/20"
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="mb-3 text-sm text-slate-300/85">
        Page {pagination.page} of {pagination.totalPages} •{" "}
        {pagination.totalCount} records
      </p>

      {items.length === 0 ? (
        <p className="text-slate-300">No recorded pulls yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border px-4 py-3 ${
                item.rarity === 5
                  ? "border-amber-300/60 bg-amber-500/20"
                  : item.rarity === 4
                    ? "border-violet-300/60 bg-violet-500/20"
                    : "border-blue-300/50 bg-blue-500/15"
              }`}
            >
              <p className="text-xs text-slate-200/85">
                {new Date(item.createdAt).toLocaleString()} • {item.bannerName}
              </p>
              <p className="text-lg font-semibold">
                {item.rarity}★ {item.itemName}
              </p>
              <p className="text-sm text-slate-100/90">
                {item.itemType}
                {item.featured ? " • featured" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
