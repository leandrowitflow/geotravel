"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  /** Shown on the button when idle */
  label?: string;
  className?: string;
  /** Bookings page: pull Geotravel delta (updated_from) before re-fetching the table. */
  syncGeotravelDeltaFirst?: boolean;
};

/**
 * Triggers a full server re-fetch for the current route (App Router),
 * re-running async RSC loaders (Supabase, Geotravel API, etc.).
 */
export function RefreshDataButton({
  label = "Refresh data",
  className = "",
  syncGeotravelDeltaFirst = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function refresh() {
    setMsg(null);
    if (syncGeotravelDeltaFirst) {
      try {
        const res = await fetch("/api/admin/geotravel-bookings/sync-delta", {
          method: "POST",
        });
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          hint?: string;
          rowsInWindow?: number;
        };
        if (!res.ok) {
          setMsg({
            tone: "err",
            text: [j.error, j.hint].filter(Boolean).join(" — ") || "Sync failed",
          });
          return;
        }
        setMsg({
          tone: "ok",
          text: `Synced ${j.rowsInWindow ?? 0} changed booking(s) — highlighted in the table.`,
        });
      } catch (e) {
        setMsg({
          tone: "err",
          text: e instanceof Error ? e.message : "Sync failed",
        });
        return;
      }
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        title={
          syncGeotravelDeltaFirst
            ? "Sync changed bookings from Geotravel (updated_from), then reload the table"
            : "Fetch the latest data from the server (same URL and filters)"
        }
        onClick={() => void refresh()}
        className={`rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 ${className}`}
      >
        {pending ? "Refreshing…" : label}
      </button>
      {msg ? (
        <span
          className={
            msg.tone === "ok"
              ? "text-[10px] text-emerald-700 dark:text-emerald-400"
              : "text-[10px] text-red-700 dark:text-red-400"
          }
          role="status"
        >
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}
