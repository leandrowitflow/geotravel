"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  /** Shown on the button when idle */
  label?: string;
  className?: string;
};

/**
 * Triggers a full server re-fetch for the current route (App Router),
 * re-running async RSC loaders (Supabase, Geotravel API, etc.).
 */
export function RefreshDataButton({
  label = "Refresh data",
  className = "",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title="Fetch the latest data from the server (same URL and filters)"
      onClick={() => startTransition(() => router.refresh())}
      className={`rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 ${className}`}
    >
      {pending ? "Refreshing…" : label}
    </button>
  );
}
