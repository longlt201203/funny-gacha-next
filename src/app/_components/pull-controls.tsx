"use client";

import { useState } from "react";
import { formatResource, MAX_PULL_COUNT, parsePullCount } from "./gacha-config";

/** Pity counters plus the reset button and the "x N pull" form. */
export function PullControls({
  currentPity,
  totalPity,
  disabled,
  onReset,
  onPull,
}: {
  currentPity: number;
  totalPity: number;
  disabled: boolean;
  onReset: () => void;
  onPull: (count: number) => void;
}) {
  const [pullCountInput, setPullCountInput] = useState("10");
  const pullCount = parsePullCount(pullCountInput);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid grid-cols-1 gap-3 text-lg sm:grid-cols-2 sm:text-xl">
        <p className="rounded-xl border border-white/15 bg-white/8 px-5 py-4">
          current pity: {currentPity}
        </p>
        <p className="rounded-xl border border-white/15 bg-white/8 px-5 py-4">
          total pity: {totalPity}
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
        <button
          type="button"
          onClick={onReset}
          className="h-14 w-full rounded-xl border border-rose-300/50 bg-rose-500/20 px-8 text-2xl font-bold uppercase tracking-wide text-rose-100 transition hover:bg-rose-500/35 disabled:cursor-not-allowed disabled:opacity-50 sm:w-44"
          disabled={disabled}
        >
          reset
        </button>
        <form
          className="flex w-full flex-col gap-1 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            if (pullCount !== null) {
              onPull(pullCount);
            }
          }}
        >
          <div className="flex h-14 overflow-hidden rounded-xl border border-amber-300/60 bg-amber-500/20">
            <label
              htmlFor="pull-count"
              className="flex items-center pl-4 text-2xl font-bold text-amber-100/80"
            >
              x
            </label>
            <input
              id="pull-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PULL_COUNT}
              step={1}
              value={pullCountInput}
              onChange={(event) => setPullCountInput(event.target.value)}
              aria-invalid={pullCount === null}
              aria-describedby="pull-count-hint"
              className="w-24 bg-transparent px-2 text-2xl font-bold text-amber-50 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              disabled={disabled}
            />
            <button
              type="submit"
              className="flex-1 border-l border-amber-300/40 px-8 text-2xl font-bold uppercase tracking-wide text-amber-100 transition hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || pullCount === null}
            >
              pull
            </button>
          </div>
          <p
            id="pull-count-hint"
            className={`text-xs ${pullCount === null ? "text-rose-300" : "text-slate-400"}`}
          >
            {pullCount === null
              ? `Enter a whole number from 1 to ${MAX_PULL_COUNT}.`
              : `Costs ${formatResource(pullCount)}`}
          </p>
        </form>
      </div>
    </div>
  );
}
