"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export type Rarity = "S" | "A" | "B";

export const RARITIES: Rarity[] = ["S", "A", "B"];

export const RARITY_META: Record<
  Rarity,
  { stars: number; badge: string; ring: string; text: string }
> = {
  S: {
    stars: 5,
    badge: "border-amber-300/70 bg-amber-400/20 text-amber-100",
    ring: "ring-amber-300/70",
    text: "text-amber-200",
  },
  A: {
    stars: 4,
    badge: "border-violet-300/70 bg-violet-400/20 text-violet-100",
    ring: "ring-violet-300/70",
    text: "text-violet-200",
  },
  B: {
    stars: 3,
    badge: "border-blue-300/70 bg-blue-400/20 text-blue-100",
    ring: "ring-blue-300/70",
    text: "text-blue-200",
  },
};

export function toRarity(value: string): Rarity {
  const normalized = value.trim().toUpperCase();
  return normalized === "S" || normalized === "A" ? normalized : "B";
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-fuchsia-300/60 bg-fuchsia-500/80 text-white shadow-[0_0_24px_rgba(217,70,239,0.25)] hover:bg-fuchsia-500",
  secondary: "border-white/25 bg-white/10 text-slate-100 hover:bg-white/20",
  ghost: "border-transparent bg-transparent text-slate-300 hover:bg-white/10 hover:text-white",
  danger: "border-rose-300/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/40",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md"): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70 disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
    BUTTON_VARIANTS[variant],
  );
}

// No width or vertical padding here: Tailwind resolves conflicting utilities by stylesheet order, not
// className order, so callers couldn't reliably override them. Use inputClass for full-width fields.
export const inputBaseClass =
  "rounded-lg border border-white/20 bg-slate-950/60 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-fuchsia-300/70 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/30 aria-[invalid=true]:border-rose-400/80";

export const inputClass = cx(inputBaseClass, "w-full py-2");

export function RarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-black tracking-wider",
        RARITY_META[rarity].badge,
        className,
      )}
      title={`${RARITY_META[rarity].stars}★`}
    >
      {rarity}
      <span className="font-semibold opacity-80">{"★".repeat(RARITY_META[rarity].stars)}</span>
    </span>
  );
}

export function FeaturedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-pink-300/70 bg-pink-500/25 px-2 py-0.5 text-xs font-bold text-pink-100">
      Featured
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-rose-300">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-white/15 bg-slate-950/50 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition",
            value === option.value ? "bg-white/20 text-white" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg border border-white/15 bg-slate-950/40 p-3 text-left transition hover:bg-white/5"
    >
      <span
        className={cx(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition",
          checked ? "bg-fuchsia-500" : "bg-slate-600",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-100">{label}</span>
        {description ? <span className="block text-xs text-slate-400">{description}</span> : null}
      </span>
    </button>
  );
}

function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onEscape]);
}

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEscape(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className={buttonClass("ghost", "sm")} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <footer className="border-t border-white/10 bg-slate-900/95 px-6 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEscape(open && !busy, onCancel);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <div className="mt-2 text-sm text-slate-300">{message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={buttonClass("danger")} autoFocus>
            {busy ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImageDropzone({
  file,
  currentUrl,
  onFileChange,
  aspect = "aspect-video",
  error,
}: {
  file: File | null;
  currentUrl: string;
  onFileChange: (file: File | null) => void;
  aspect?: string;
  error?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const preview = objectUrl || currentUrl;

  const acceptFile = (candidate: File | undefined) => {
    if (candidate && candidate.type.startsWith("image/")) {
      onFileChange(candidate);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          acceptFile(event.dataTransfer.files?.[0]);
        }}
        className={cx(
          "group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70",
          aspect,
          dragging
            ? "border-fuchsia-300 bg-fuchsia-500/10"
            : error
              ? "border-rose-400/70 bg-rose-500/5"
              : "border-white/20 bg-slate-950/40 hover:border-white/40",
        )}
      >
        {preview ? (
          <>
            <img src={preview} alt="Selected image preview" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
              Click or drop to replace
            </span>
          </>
        ) : (
          <span className="px-4 text-center text-sm text-slate-400">
            <span className="block text-2xl">🖼️</span>
            Drop an image here, or <span className="font-semibold text-fuchsia-300">browse</span>
            <span className="block text-xs text-slate-500">JPG, PNG, WEBP or GIF</span>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            acceptFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={error ? "text-rose-300" : "truncate text-slate-400"}>
          {error ?? (file ? `New file: ${file.name}` : currentUrl ? "Using current image" : "No image selected")}
        </span>
        {file ? (
          <button type="button" onClick={() => onFileChange(null)} className={buttonClass("ghost", "sm")}>
            Undo
          </button>
        ) : null}
      </div>
    </div>
  );
}

export type Toast = { id: number; tone: "success" | "error"; message: string };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: Toast["tone"], message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3000);
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

export function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-60 flex w-full max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cx(
            "pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
            toast.tone === "success"
              ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-50"
              : "border-rose-300/50 bg-rose-500/25 text-rose-50",
          )}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 px-6 py-14 text-center">
      <p className="text-lg font-semibold text-slate-100">{title}</p>
      <p className="max-w-md text-sm text-slate-400">{description}</p>
      {action}
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="aspect-video bg-white/10" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 rounded bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  const data = new FormData();
  data.append("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body: data });
  if (!response.ok) {
    return { error: await readError(response, "Failed to upload image") };
  }
  const payload = (await response.json()) as { url: string };
  return { url: payload.url };
}
