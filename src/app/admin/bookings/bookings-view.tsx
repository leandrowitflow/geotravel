import Link from "next/link";
import { BookingsSearchForm } from "@/components/admin/bookings-search-form";
import { RefreshDataButton } from "@/components/admin/refresh-data-button";
import { SendGeotravelWhatsAppButton } from "@/components/admin/send-geotravel-whatsapp-button";
import {
  fetchGeotravelBookings,
  fetchGeotravelBookingsPhoneScan,
  fetchGeotravelBookingsRefScan,
  type GeotravelBooking,
} from "@/lib/geotravel/bookings-api";

/** Server-side sort keys (current page only; API has no sort param). */
const SORT_COLUMNS = [
  "ref",
  "customer",
  "route",
  "pickup",
  "vehicle",
  "pax",
  "direction",
  "status",
  "outcome",
  "amount",
  "platform",
  "lead_time",
] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function isSortColumn(s: string): s is SortColumn {
  return (SORT_COLUMNS as readonly string[]).includes(s);
}

function sortBookingsData(
  rows: GeotravelBooking[],
  column: SortColumn,
  order: "asc" | "desc",
): GeotravelBooking[] {
  const mul = order === "desc" ? -1 : 1;

  function sortValue(b: GeotravelBooking): string | number {
    switch (column) {
      case "ref":
        return (b.booking_reference ?? String(b.id)).toLowerCase();
      case "customer":
        return (b.passenger_name ?? "").toLowerCase();
      case "route": {
        const from = b.pickup_city ?? b.pickup_address ?? "";
        const to = b.dropoff_city ?? b.dropoff_address ?? "";
        return `${from} ${to}`.toLowerCase();
      }
      case "pickup":
        return b.pickup_date_time ?? "";
      case "vehicle":
        return (b.vehicle_type ?? "").toLowerCase();
      case "pax": {
        const n = b.passenger_count;
        return n === null || n === undefined ? Number.POSITIVE_INFINITY : n;
      }
      case "direction":
        return (b.direction ?? "").toLowerCase();
      case "status":
        return (b.status ?? "").toLowerCase();
      case "outcome":
        return (b.outcome ?? "").toLowerCase();
      case "amount": {
        const n = b.amount;
        return n === null || n === undefined ? Number.POSITIVE_INFINITY : n;
      }
      case "platform":
        return (b.plateform ?? "").toLowerCase();
      case "lead_time":
        return (b.book_lead_time ?? "").toLowerCase();
    }
  }

  return [...rows].sort((a, b) => {
    const va = sortValue(a);
    const vb = sortValue(b);
    let c = 0;
    if (typeof va === "number" && typeof vb === "number") {
      c = va - vb;
    } else {
      c = String(va).localeCompare(String(vb), undefined, { numeric: true });
    }
    if (c !== 0) return c * mul;
    return (a.id - b.id) * mul;
  });
}

function filterByRefPhone(
  rows: GeotravelBooking[],
  refQ?: string,
  phoneQ?: string,
): GeotravelBooking[] {
  const refNorm = refQ?.trim().toLowerCase();
  const phoneDigits = phoneQ?.replace(/\D/g, "").trim();
  if (!refNorm && !phoneDigits) return rows;
  return rows.filter((b) => {
    if (refNorm) {
      const hay = `${b.booking_reference ?? ""} ${b.id}`.toLowerCase();
      if (!hay.includes(refNorm)) return false;
    }
    if (phoneDigits) {
      const p = (b.passenger_phone ?? "").replace(/\D/g, "");
      if (!p.includes(phoneDigits)) return false;
    }
    return true;
  });
}

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

/** Geotravel operational status (CONFIRMED, PENDING_CANCELLATION, etc.) */
function statusTone(s: string | null): "ok" | "warn" | "bad" | "neutral" {
  if (!s) return "neutral";
  const u = s.toUpperCase();
  if (u.includes("CANCEL")) return "bad";
  if (u === "NEW" || u.includes("PENDING")) return "warn";
  if (
    u === "CONFIRMED" ||
    u === "COMPLETE" ||
    u === "ACCEPTED" ||
    u === "DRIVER_ASSIGNED"
  ) {
    return "ok";
  }
  return "neutral";
}

function bookingsQuery(sp: {
  page?: number;
  outcome?: string;
  airport?: string;
  status?: string;
  ref?: string;
  phone?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const p = new URLSearchParams();
  if (sp.page != null && sp.page > 0) p.set("page", String(sp.page));
  if (sp.outcome) p.set("outcome", sp.outcome);
  if (sp.airport) p.set("airport", sp.airport);
  if (sp.status) p.set("status", sp.status);
  if (sp.ref) p.set("ref", sp.ref);
  if (sp.phone) p.set("phone", sp.phone);
  if (sp.sort) {
    p.set("sort", sp.sort);
    p.set("order", sp.order ?? "asc");
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}

function SortTh({
  label,
  column,
  page,
  sp,
}: {
  label: string;
  column: SortColumn;
  page: number;
  sp: {
    outcome?: string;
    airport?: string;
    status?: string;
    ref?: string;
    phone?: string;
    sort?: string;
    order?: string;
  };
}) {
  const isActive = sp.sort === column;
  const currentOrder = sp.order === "desc" ? "desc" : "asc";
  const nextOrder: "asc" | "desc" =
    isActive && currentOrder === "asc" ? "desc" : "asc";
  const href = `/admin/bookings${bookingsQuery({
    page: page > 0 ? page : undefined,
    outcome: sp.outcome,
    airport: sp.airport,
    status: sp.status,
    ref: sp.ref,
    phone: sp.phone,
    sort: column,
    order: nextOrder,
  })}`;
  const ariaSort = !isActive
    ? ("none" as const)
    : currentOrder === "asc"
      ? ("ascending" as const)
      : ("descending" as const);

  return (
    <th className="px-3 py-2 font-semibold whitespace-nowrap" aria-sort={ariaSort}>
      <Link
        href={href}
        prefetch={false}
        className={`group inline-flex max-w-full items-center gap-1 rounded px-0.5 py-0.5 -mx-0.5 hover:bg-stone-200/80 dark:hover:bg-stone-700/80 ${
          isActive ? "text-teal-800 dark:text-teal-200" : ""
        }`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span
          className={`font-mono text-[10px] leading-none tabular-nums ${
            isActive
              ? "text-teal-700 dark:text-teal-300"
              : "text-stone-400 opacity-60 group-hover:opacity-100 dark:text-stone-500"
          }`}
          aria-hidden
        >
          {isActive ? (currentOrder === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
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

export type BookingsSearchParams = Promise<{
  outcome?: string;
  airport?: string;
  status?: string;
  ref?: string;
  phone?: string;
  sort?: string;
  order?: string;
  page?: string;
}>;

export async function BookingsView({
  searchParams,
}: {
  searchParams: BookingsSearchParams;
}) {
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0));
  const limit = 500;
  const apiStatus = sp.status?.trim() || undefined;
  const refQ = sp.ref?.trim();
  const phoneQ = sp.phone?.trim();
  const phoneDigits = phoneQ?.replace(/\D/g, "").trim() ?? "";

  if (phoneQ && phoneDigits.length > 0 && phoneDigits.length < 6) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Customer phone filter needs at least 6 digits</p>
        <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
          The Geotravel API <span className="font-mono">passenger_phone</span> parameter accepts any format, but the
          normalized value must include at least six digits. Add more digits or clear the phone field.
        </p>
      </div>
    );
  }

  const result = phoneDigits
    ? await fetchGeotravelBookingsPhoneScan({
        outcome: sp.outcome,
        airport: sp.airport,
        status: apiStatus,
        phoneDigits,
        passengerPhoneParam: phoneQ,
        refSubstring: refQ,
        page,
        limit,
      })
    : refQ
      ? await fetchGeotravelBookingsRefScan({
          outcome: sp.outcome,
          airport: sp.airport,
          status: apiStatus,
          refSubstring: refQ,
          page,
          limit,
        })
      : await fetchGeotravelBookings({
          limit,
          offset: page * limit,
          outcome: sp.outcome,
          airport: sp.airport,
          status: apiStatus,
        });

  if (!result.ok) {
    const rateLimited =
      result.error.includes("429") || result.error.toLowerCase().includes("rate limit");
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <p className="font-semibold">Failed to load bookings</p>
        <p className="mt-1 font-mono text-xs">{result.error}</p>
        {rateLimited ? (
          <p className="mt-3 text-stone-600 dark:text-stone-400">
            The Geotravel Data API is rate-limiting requests. Wait a minute, then use{" "}
            <span className="font-medium">Refresh data</span>. If you were not searching by ref/phone, try again with a
            quiet period.             For ref-only searches, a <span className="font-mono">booking_reference</span> /{" "}
            <span className="font-mono">ref</span> URL filter avoids large client scans.{" "}
            <span className="font-mono">GEOTRAVEL_MAX_SCAN_ROWS</span> caps how many rows ref-only or phone+ref walks.
          </p>
        ) : (
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
        )}
      </div>
    );
  }

  const bookings = result.data;
  const { total } = result.pagination;
  const clientScanCap = result.clientScanRowCap;
  const serverSideFilter = Boolean(result.serverSideFilter);
  const scanCapText = (clientScanCap ?? 12_000).toLocaleString();
  const apiGrandTotal =
    result.ok && result.phoneSearchApiTotal != null
      ? result.phoneSearchApiTotal
      : result.ok && result.refSearchApiTotal != null
        ? result.refSearchApiTotal
        : total;

  const filteredBySearch =
    phoneDigits || refQ ? bookings : filterByRefPhone(bookings, refQ, phoneQ);

  const sortColumn =
    sp.sort && isSortColumn(sp.sort) ? sp.sort : undefined;
  const sortOrder = sp.order === "desc" ? "desc" : "asc";
  const sortedBookings =
    sortColumn != null
      ? sortBookingsData(filteredBySearch, sortColumn, sortOrder)
      : filteredBySearch;

  const active = filteredBySearch.filter((b) => b.outcome === "Active").length;
  const cancelled = filteredBySearch.filter((b) => b.outcome === "Cancelled").length;
  const returns = filteredBySearch.filter((b) => b.is_return === 1).length;
  const totalRevenue = filteredBySearch
    .filter((b) => b.outcome === "Active" && b.amount)
    .reduce((s, b) => s + (b.amount ?? 0), 0);

  const totalPages = Math.ceil(total / limit);
  const refScanActive = Boolean(refQ && !phoneDigits);
  const phoneScanActive = Boolean(phoneDigits);
  const phoneScanTruncated = result.ok && Boolean(result.phoneScanTruncated);
  const refScanTruncated = result.ok && Boolean(result.refScanTruncated);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Bookings</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Live data from Geotravel API —{" "}
            {phoneScanActive ? (
              <>
                <span className="font-medium text-stone-700 dark:text-stone-200">
                  {total.toLocaleString()}
                </span>{" "}
                booking{total === 1 ? "" : "s"} matched phone
                {refQ ? " and ref" : ""}
                {" · "}
                <span className="font-medium text-stone-700 dark:text-stone-200">
                  {apiGrandTotal.toLocaleString()}
                </span>{" "}
                total in API under these filters
              </>
            ) : refScanActive ? (
              <>
                <span className="font-medium text-stone-700 dark:text-stone-200">
                  {total.toLocaleString()}
                </span>{" "}
                booking{total === 1 ? "" : "s"} matched ref
                {" · "}
                <span className="font-medium text-stone-700 dark:text-stone-200">
                  {apiGrandTotal.toLocaleString()}
                </span>{" "}
                total in API under these filters
              </>
            ) : (
              <>
                <span className="font-medium text-stone-700 dark:text-stone-200">
                  {total.toLocaleString()}
                </span>{" "}
                total bookings
              </>
            )}
            {serverSideFilter && (
              <span className="block pt-1 text-xs text-emerald-800 dark:text-emerald-300/90">
                The Geotravel API accepted a server-side filter for this search (about one HTTP request per page). Use
                pagination to walk every matching row without rate-limit bursts.
              </span>
            )}
            {phoneScanTruncated && (
              <span className="block pt-1 text-xs text-amber-700 dark:text-amber-300/90">
                Phone + ref search loaded at most the first {scanCapText} rows that matched the phone filter (see{" "}
                <span className="font-mono">GEOTRAVEL_MAX_SCAN_ROWS</span>). Totals may be incomplete; raise the cap if your
                quota allows.
              </span>
            )}
            {refScanTruncated && (
              <span className="block pt-1 text-xs text-amber-700 dark:text-amber-300/90">
                Ref search only walked the first {scanCapText} rows (client-side cap). Set{" "}
                <span className="font-mono">GEOTRAVEL_MAX_SCAN_ROWS</span> if your quota allows, or ask Geotravel for a{" "}
                <span className="font-mono">booking_reference</span> URL filter so one request returns matches.
              </span>
            )}
            <span className="mt-2 block rounded-md border border-stone-200 bg-stone-100/80 px-2 py-1.5 text-xs text-stone-600 dark:border-stone-600 dark:bg-stone-800/80 dark:text-stone-300">
              <strong className="font-medium text-stone-800 dark:text-stone-200">Data source:</strong> this table calls the{" "}
              <span className="font-mono">Geotravel Data API</span> on every load and on{" "}
              <span className="font-medium">Refresh data</span> (no browser cache). Reservations you create only inside this app (
              <span className="font-mono">/admin/cases</span>, Supabase) do{" "}
              <strong className="font-medium">not</strong> appear here unless that external API returns them.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RefreshDataButton />
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Live
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            { label: "All", outcome: undefined as string | undefined },
            { label: "Active", outcome: "Active" },
            { label: "Cancelled", outcome: "Cancelled" },
          ] as const
        ).map((f) => {
          const selected = (sp.outcome ?? "") === (f.outcome ?? "");
          return (
            <Link
              key={f.label}
              href={`/admin/bookings${bookingsQuery({
                outcome: f.outcome,
                airport: sp.airport,
                status: apiStatus,
                ref: refQ,
                phone: phoneQ,
                sort: sp.sort,
                order: sp.order === "desc" ? "desc" : undefined,
              })}`}
              className={`rounded-full border px-3 py-1 transition-colors ${
                selected
                  ? "border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-200"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-500"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Showing"
          value={sortedBookings.length}
          sub={
            phoneScanActive
              ? `${sortedBookings.length} on page · ${total.toLocaleString()} match${total === 1 ? "" : "es"} · ${apiGrandTotal.toLocaleString()} in API`
              : refScanActive
                ? `${sortedBookings.length} on page · ${total.toLocaleString()} match${total === 1 ? "" : "es"} · ${apiGrandTotal.toLocaleString()} in API`
                : `of ${total.toLocaleString()} total`
          }
          tone="neutral"
        />
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
        <div className="border-b border-stone-200 px-3 py-3 dark:border-stone-700">
          <BookingsSearchForm
            outcome={sp.outcome}
            airport={sp.airport}
            sort={sp.sort}
            orderIsDesc={sp.order === "desc"}
            defaultRef={sp.ref ?? ""}
            defaultPhone={sp.phone ?? ""}
            defaultStatus={apiStatus ?? ""}
            clearSearchHref={`/admin/bookings${bookingsQuery({
              outcome: sp.outcome,
              airport: sp.airport,
              sort: sp.sort,
              order: sp.order === "desc" ? "desc" : undefined,
            })}`}
          />
        </div>
        <p className="border-b border-stone-200 px-3 py-2 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
          Status is sent to the Geotravel API. Column headers sort this page ({limit} rows).{" "}
          <span className="text-stone-600 dark:text-stone-300">
            WhatsApp confirm (Active + CONFIRMED) is enabled only for passenger phone containing{" "}
            <span className="font-mono">966915976</span>.
          </span>
          {phoneScanActive
            ? " Customer phone uses the Geotravel passenger_phone filter (≥6 digits, any format). With Ref, results are phone-filtered on the server and narrowed by ref on our side (capped by GEOTRAVEL_MAX_SCAN_ROWS)."
            : refScanActive
              ? " Ref uses a server filter when the API supports booking_reference/ref params; otherwise a capped client scan."
              : ` Without Ref or phone search you get one API page (${limit} rows). Use Search to trigger a server or capped client search.`}
        </p>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-300">
            <tr>
              <SortTh label="Ref" column="ref" page={page} sp={sp} />
              <SortTh label="Customer" column="customer" page={page} sp={sp} />
              <SortTh label="Route" column="route" page={page} sp={sp} />
              <SortTh label="Pickup" column="pickup" page={page} sp={sp} />
              <SortTh label="Vehicle" column="vehicle" page={page} sp={sp} />
              <SortTh label="Pax" column="pax" page={page} sp={sp} />
              <SortTh label="Direction" column="direction" page={page} sp={sp} />
              <SortTh label="Status" column="status" page={page} sp={sp} />
              <SortTh label="Outcome" column="outcome" page={page} sp={sp} />
              <SortTh label="Amount" column="amount" page={page} sp={sp} />
              <SortTh label="Platform" column="platform" page={page} sp={sp} />
              <SortTh label="Lead time" column="lead_time" page={page} sp={sp} />
              <th className="px-3 py-2 font-semibold whitespace-nowrap">WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {sortedBookings.map((b: GeotravelBooking) => (
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

                {/* Status (API) */}
                <td className="px-3 py-2 max-w-[160px]">
                  {b.status ? (
                    <Badge tone={statusTone(b.status)}>
                      <span className="font-mono normal-case tracking-tight">
                        {b.status.replace(/_/g, " ")}
                      </span>
                    </Badge>
                  ) : (
                    <span className="text-xs text-stone-400 dark:text-stone-500">—</span>
                  )}
                </td>

                {/* Outcome (Active / Cancelled) */}
                <td className="px-3 py-2">
                  <Badge tone={outcomeTone(b.outcome)}>
                    {b.outcome ?? "—"}
                  </Badge>
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

                <td className="px-3 py-2 align-top">
                  <SendGeotravelWhatsAppButton booking={b} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedBookings.length === 0 && (
          <p className="p-8 text-center text-stone-400 dark:text-stone-500">
            {phoneScanActive
              ? phoneScanTruncated
                ? `No rows matched both phone and ref within the first ${scanCapText} phone-matched bookings. Try increasing GEOTRAVEL_MAX_SCAN_ROWS, loosening filters, or search phone alone.`
                : "No rows matched that phone under these filters in the Geotravel API."
              : refScanActive
                ? refScanTruncated
                  ? `No rows matched that ref in the first ${scanCapText} API results. Try narrowing filters or increasing GEOTRAVEL_MAX_SCAN_ROWS.`
                  : "No rows matched that ref under these filters in the Geotravel API."
                : bookings.length > 0 && phoneQ
                  ? "No rows match phone on this page. Use digits in Customer phone and Search to scan the API."
                  : "No bookings found."}
          </p>
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
                href={`/admin/bookings${bookingsQuery({
                  page: page - 1,
                  outcome: sp.outcome,
                  airport: sp.airport,
                  status: apiStatus,
                  ref: refQ,
                  phone: phoneQ,
                  sort: sp.sort,
                  order: sp.order === "desc" ? "desc" : undefined,
                })}`}
                className="rounded border border-stone-200 bg-white px-3 py-1 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
              >
                ← Previous
              </Link>
            )}
            {page + 1 < totalPages && (
              <Link
                href={`/admin/bookings${bookingsQuery({
                  page: page + 1,
                  outcome: sp.outcome,
                  airport: sp.airport,
                  status: apiStatus,
                  ref: refQ,
                  phone: phoneQ,
                  sort: sp.sort,
                  order: sp.order === "desc" ? "desc" : undefined,
                })}`}
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
