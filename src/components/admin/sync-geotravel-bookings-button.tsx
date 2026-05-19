"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Pulls the full Geotravel delta window server-side, advances the stored watermark, then refreshes the page.
 */
export function SyncGeotravelBookingsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function sync() {
    setMsg(null);
    try {
      const res = await fetch("/api/admin/geotravel-bookings/sync-delta", {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        rowsInWindow?: number;
        cursorAdvancedTo?: string | null;
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
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({
        tone: "err",
        text: e instanceof Error ? e.message : "Sync failed",
      });
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void sync()}
        title="Fetch all bookings changed since the last sync (updated_from) and advance the watermark"
        className="rounded-md border border-teal-700 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-900 hover:bg-teal-100 disabled:opacity-60 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100 dark:hover:bg-teal-900/40"
      >
        {pending ? "Syncing…" : "Sync changes"}
      </button>
      {msg && (
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
      )}
    </div>
  );
}
