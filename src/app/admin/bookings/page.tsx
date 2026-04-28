import Link from "next/link";
import {
  fetchGeotravelBookings,
  type GeotravelBooking,
} from "@/lib/geotravel/bookings-api";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100"
        : tone === "bad"
          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100"
          : "bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-100";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function outcomeTone(o: string | null): "ok" | "bad" | "neutral" {
  if (o === "Active") return "ok";
  if (o === "Cancelled") return "bad";
  return "neutral";
}

function directionTone(d: string | null): "ok" | "warn" | "neutral" {
  if (d === "IN") return "ok";
  if (d === "OUT") return "warn";
  return "neutral";
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return s.replace("T", " ").slice(0, 16);
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: "neutral" | "ok" | "warn" | "bad";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-300"
        : tone === "bad"
          ? "text-red-600 dark:text-red-400"
          : "text-stone-800 dark:text-stone-100";
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
      <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 dark:text-stone-500">{sub}</p>}
    </div>
  );
}

function formatLeadTime(interval: string | null) {
  if (!interval) return null;
  const match = interval.match(/(\d+)\s*days?\s*(\d+):(\d+)/);
  if (match) return `${match[1]}d ${match[2]}h`;
  const hourMatch = interval.match(/(\d+):(\d+)/);
  if (hourMatch) return `${hourMatch[1]}h`;
  return interval;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string; airport?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0));
  const limit = 100;

  const result = await fetchGeotravelBookings({
    limit,
    offset: page * limit,
    outcome: sp.outcome,
    airport: sp.airport,
  });

  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <p className="font-semibold">Failed to load bookings</p>
        <p className="mt-1 font-mono text-xs">{result.error}</p>
        <p className="mt-3 text-stone-500 dark:text-stone-400">
          Check that{" "}
          <code className="rounded bg-stone-100 px-1 dark:bg-stone-800 dark:text-stone-200">
            GEOTRAVEL_API_KEY
          </code>{" "}
          is set in{" "}
          <code className="rounded bg-stone-100 px-1 dark:bg-stone-800 dark:text-stone-200">
            .env.local
          </code>
          .
        </p>
      </div>
    );
  }

  const bookings = result.data;
  const { total } = result.pagination;

  const active = bookings.filter((b) => b.outcome === "Active").length;
  const cancelled = bookings.filter((b) => b.outcome === "Cancelled").length;
  const returns = bookings.filter((b) => b.is_return === 1).length;
  const totalRevenue = bookings
    .filter((b) => b.outcome === "Active" && b.amount)
    .reduce((s, b) => s + (b.amount ?? 0), 0);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Bookings</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Live data from Geotravel API —{" "}
            <span className="font-medium text-stone-700 dark:text-stone-200">
              {total.toLocaleString()}
            </span>{" "}
            total bookings
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Live
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: "All", params: "" },
          { label: "Active", params: "?outcome=Active" },
          { label: "Cancelled", params: "?outcome=Cancelled" },
        ].map((f) => (
          <Link
            key={f.label}
            href={`/admin/bookings${f.params}`}
            className={`rounded-full border px-3 py-1 transition-colors ${
              (sp.outcome ?? "") ===
              (f.params.replace("?outcome=", "") === "All"
                ? ""
                : f.params.replace("?outcome=", ""))
                ? "border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-200"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-500"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Showing" value={bookings.length} sub={`of ${total.toLocaleString()} total`} tone="neutral" />
        <StatCard label="Active" value={active} tone="ok" />
        <StatCard label="Cancelled" value={cancelled} tone={cancelled > 0 ? "bad" : "neutral"} />
        <StatCard
          label="Revenue (page)"
          value={`€${totalRevenue.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub={`${returns} returns`}
          tone="ok"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-300">
            <tr>
              <th className="px-3 py-2 font-semibold">Ref</th>
              <th className="px-3 py-2 font-semibold">Customer</th>
              <th className="px-3 py-2 font-semibold">Route</th>
              <th className="px-3 py-2 font-semibold">Pickup</th>
              <th className="px-3 py-2 font-semibold">Vehicle</th>
              <th className="px-3 py-2 font-semibold">Pax</th>
              <th className="px-3 py-2 font-semibold">Direction</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Amount</th>
              <th className="px-3 py-2 font-semibold">Platform</th>
              <th className="px-3 py-2 font-semibold">Lead time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {bookings.map((b: GeotravelBooking) => (
              <tr
                key={b.id}
                className="hover:bg-stone-50/60 dark:hover:bg-stone-800/50"
              >
                {/* Ref */}
                <td className="px-3 py-2">
                  <div className="font-mono text-xs font-medium text-stone-800 dark:text-stone-100">
                    {b.booking_reference ?? b.id}
                  </div>
                  {b.loyalty_name && (
                    <Badge tone="neutral">{b.loyalty_name}</Badge>
                  )}
                  {b.trip_type === "return" && (
                    <div className="mt-0.5">
                      <Badge tone="warn">return</Badge>
                    </div>
                  )}
                </td>

                {/* Customer */}
                <td className="px-3 py-2">
                  <div className="font-medium text-stone-800 dark:text-stone-100">
                    {b.passenger_name ?? "—"}
                  </div>
                  <div className="text-xs text-stone-400 dark:text-stone-500">
                    {b.passenger_phone ?? ""}
                  </div>
                  {b.invoice_country && (
                    <div className="text-xs text-stone-400 dark:text-stone-500">
                      {b.invoice_country}
                    </div>
                  )}
                </td>

                {/* Route */}
                <td className="px-3 py-2 max-w-[180px]">
                  <div className="truncate text-xs">
                    <span className="text-stone-400 dark:text-stone-500">From </span>
                    <span className="text-stone-700 dark:text-stone-200">
                      {b.pickup_city ?? b.pickup_address ?? "—"}
                    </span>
                  </div>
                  <div className="truncate text-xs">
                    <span className="text-stone-400 dark:text-stone-500">To </span>
                    <span className="text-stone-700 dark:text-stone-200">
                      {b.dropoff_city ?? b.dropoff_address ?? "—"}
                    </span>
                  </div>
                  {b.nearest_airport && (
                    <div className="text-xs text-stone-400 dark:text-stone-500">
                      ✈ {b.nearest_airport}
                    </div>
                  )}
                  {b.distance_km && (
                    <div className="text-xs text-stone-400 dark:text-stone-500">
                      {b.distance_km} km
                    </div>
                  )}
                </td>

                {/* Pickup */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-700 dark:text-stone-200">
                  <div>{fmtDate(b.pickup_date_time)}</div>
                  {b.pickup_dow !== null && b.pickup_dow !== undefined && (
                    <div className="text-stone-400 dark:text-stone-500">{DOW[b.pickup_dow]}</div>
                  )}
                  {b.pickup_location_type && (
                    <Badge tone="neutral">{b.pickup_location_type}</Badge>
                  )}
                </td>

                {/* Vehicle */}
                <td className="px-3 py-2 text-xs text-stone-700 dark:text-stone-200">
                  {b.vehicle_type ?? "—"}
                </td>

                {/* Pax */}
                <td className="px-3 py-2 text-xs text-stone-700 text-center dark:text-stone-200">
                  {b.passenger_count ?? "—"}
                </td>

                {/* Direction */}
                <td className="px-3 py-2">
                  {b.direction ? (
                    <Badge tone={directionTone(b.direction)}>
                      {b.direction}
                    </Badge>
                  ) : (
                    <span className="text-xs text-stone-300 dark:text-stone-600">—</span>
                  )}
                </td>

                {/* Status / Outcome */}
                <td className="px-3 py-2">
                  <Badge tone={outcomeTone(b.outcome)}>
                    {b.outcome ?? "—"}
                  </Badge>
                  {b.status && b.status !== b.outcome && (
                    <div className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                      {b.status}
                    </div>
                  )}
                </td>

                {/* Amount */}
                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-stone-700 dark:text-stone-200">
                  {b.amount != null ? `€${b.amount.toFixed(2)}` : "—"}
                </td>

                {/* Platform */}
                <td className="px-3 py-2 text-xs text-stone-600 dark:text-stone-400">
                  {b.plateform ?? "—"}
                </td>

                {/* Lead time */}
                <td className="px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
                  {formatLeadTime(b.book_lead_time) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {bookings.length === 0 && (
          <p className="p-8 text-center text-stone-400 dark:text-stone-500">No bookings found.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>
            Page {page + 1} of {totalPages} —{" "}
            {total.toLocaleString()} total
          </span>
          <div className="flex gap-2">
            {page > 0 && (
              <Link
                href={`/admin/bookings?page=${page - 1}${sp.outcome ? `&outcome=${sp.outcome}` : ""}`}
                className="rounded border border-stone-200 bg-white px-3 py-1 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
              >
                ← Previous
              </Link>
            )}
            {page + 1 < totalPages && (
              <Link
                href={`/admin/bookings?page=${page + 1}${sp.outcome ? `&outcome=${sp.outcome}` : ""}`}
                className="rounded border border-stone-200 bg-white px-3 py-1 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
