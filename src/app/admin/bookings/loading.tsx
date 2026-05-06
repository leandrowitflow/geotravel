export default function BookingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Bookings</h1>
          <p className="flex items-center gap-2 text-sm font-medium text-teal-800 dark:text-teal-200">
            <span
              className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-teal-700 border-t-transparent dark:border-teal-400 dark:border-t-transparent"
              aria-hidden
            />
            Loading data from the Geotravel API…
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Ref or phone filters can take a few seconds while we query the remote service.
          </p>
        </div>
        <div className="h-9 w-28 shrink-0 animate-pulse rounded-md bg-stone-200 dark:bg-stone-700" />
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-7 w-16 animate-pulse rounded-full bg-stone-200 dark:bg-stone-700"
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-stone-200 bg-stone-100 dark:border-stone-700 dark:bg-stone-800/80"
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
        <div className="h-24 animate-pulse bg-stone-100 dark:bg-stone-800/60" />
        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex gap-3 px-3 py-3">
              <div className="h-4 w-24 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 flex-1 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-20 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
