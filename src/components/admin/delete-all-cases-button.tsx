"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAllCasesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (
      !window.confirm(
        "Delete ALL cases? This removes message history and CRM sync rows for each case. Reservations are kept.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cases/delete-all", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; deleted?: number; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={busy}
        className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900"
      >
        {busy ? "Deleting…" : "Delete all cases"}
      </button>
      {error ? <span className="max-w-xs text-right text-xs text-red-700 dark:text-red-400">{error}</span> : null}
    </div>
  );
}
