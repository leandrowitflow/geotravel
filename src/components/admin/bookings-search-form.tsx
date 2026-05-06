"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";

const BOOKING_STATUSES = [
  "ACCEPTED",
  "CANCELLED",
  "COMPLETE",
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "FREE CANCELLATION",
  "NEW",
  "PENDING_AMENDMENT",
  "PENDING_CANCELLATION",
] as const;

type Props = {
  outcome?: string;
  airport?: string;
  sort?: string;
  orderIsDesc?: boolean;
  defaultRef: string;
  defaultPhone: string;
  defaultStatus: string;
  clearSearchHref: string;
};

/**
 * Client form so Search uses router.push + useTransition — shows pending state and
 * triggers the route `loading.tsx` UI while the server fetches Geotravel data.
 */
export function BookingsSearchForm({
  outcome,
  airport,
  sort,
  orderIsDesc,
  defaultRef,
  defaultPhone,
  defaultStatus,
  clearSearchHref,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    for (const [key, value] of fd.entries()) {
      const v = typeof value === "string" ? value.trim() : String(value);
      if (v) p.set(key, v);
    }
    const q = p.toString();
    startTransition(() => {
      router.push(q ? `/admin/bookings?${q}` : "/admin/bookings");
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {outcome ? <input type="hidden" name="outcome" value={outcome} /> : null}
      {airport ? <input type="hidden" name="airport" value={airport} /> : null}
      {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      {orderIsDesc ? <input type="hidden" name="order" value="desc" /> : null}
      <div className="flex min-w-[140px] flex-1 flex-col gap-1">
        <label htmlFor="bookings-ref" className="text-xs font-medium text-stone-600 dark:text-stone-400">
          Ref
        </label>
        <input
          id="bookings-ref"
          name="ref"
          type="search"
          defaultValue={defaultRef}
          placeholder="Reference or ID…"
          disabled={pending}
          className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
          autoComplete="off"
        />
      </div>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <label htmlFor="bookings-phone" className="text-xs font-medium text-stone-600 dark:text-stone-400">
          Customer phone
        </label>
        <input
          id="bookings-phone"
          name="phone"
          type="search"
          defaultValue={defaultPhone}
          placeholder="Digits only…"
          disabled={pending}
          className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
          autoComplete="off"
        />
      </div>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
        <label htmlFor="bookings-status" className="text-xs font-medium text-stone-600 dark:text-stone-400">
          Status
        </label>
        <select
          id="bookings-status"
          name="status"
          defaultValue={defaultStatus}
          disabled={pending}
          className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        >
          <option value="">Any status</option>
          {defaultStatus &&
            !(BOOKING_STATUSES as readonly string[]).includes(defaultStatus) && (
              <option value={defaultStatus}>{defaultStatus.replace(/_/g, " ")}</option>
            )}
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-70 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {pending ? "Loading…" : "Search"}
        </button>
        <Link
          href={clearSearchHref}
          prefetch={false}
          aria-disabled={pending}
          className={`rounded-md border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800 ${pending ? "pointer-events-none opacity-50" : ""}`}
        >
          Clear search
        </Link>
      </div>
    </form>
  );
}
