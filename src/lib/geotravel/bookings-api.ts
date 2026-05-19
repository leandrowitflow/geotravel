import {
  advanceGeotravelBookingsSyncCursor,
  maxUpdatedAtFromBookings,
  saveGeotravelBookingsDeltaHighlights,
} from "@/lib/geotravel/bookings-sync-cursor";

/**
 * Geotravel Data API client.
 * REST API for external access to bookings data.
 * Documented query params include limit (1–500), offset, outcome, status, from, to,
 * pickup_city, dropoff_city, country, airport, passenger_phone (server-side phone filter:
 * any format, min 6 digits, matches last 9 stored digits), booking_reference / ref,
 * plateform, updated_from / modified_since, updated_to, order_by (booked_date |
 * updated_at | pickup_date_time), etc.
 * @see https://geotraveldata.com/api-docs
 */

const API_BASE =
  "https://wntjsuwvglchzlmrujdq.supabase.co/functions/v1/bookings-api";

export type GeotravelBooking = {
  id: number;
  status: string | null;
  outcome: string | null;
  plateform: string | null;
  booked_date: string | null;
  pickup_date_time: string | null;
  pickup_city: string | null;
  pickup_country: string | null;
  pickup_address: string | null;
  pickup_location_type: string | null;
  dropoff_city: string | null;
  dropoff_country: string | null;
  dropoff_address: string | null;
  dropoff_location_type: string | null;
  nearest_airport: string | null;
  vehicle_type: string | null;
  passenger_count: number | null;
  distance_km: number | null;
  amount: number | null;
  invoice_country: string | null;
  booking_reference: string | null;
  passenger_phone: string | null;
  passenger_name: string | null;
  loyalty_name: string | null;
  direction: "IN" | "OUT" | "P2P" | null;
  trip_type: "one_way" | "return" | null;
  is_return: 0 | 1 | null;
  multidays: number | null;
  book_lead_time: string | null;
  pickup_dow: number | null;
  /** Present on API rows when the bookings-api edge function is up to date; used for incremental sync. */
  updated_at?: string | null;
};

export type GeotravelBookingsParams = {
  limit?: number;
  offset?: number;
  status?: string;
  outcome?: string;
  from?: string;
  to?: string;
  pickup_city?: string;
  dropoff_city?: string;
  country?: string;
  airport?: string;
  /** Server-side filter when the API supports it (avoids ref client scan). */
  booking_reference?: string;
  /** Alternate param name some deployments use. */
  ref?: string;
  /** Server-side phone filter (Geotravel normalizes input; min 6 digits). */
  passenger_phone?: string;
  plateform?: string;
  /** ISO-8601 — rows with updated_at on or after this instant (alias: modified_since). */
  updated_from?: string;
  modified_since?: string;
  /** ISO-8601 — upper bound on updated_at when supported. */
  updated_to?: string;
  order_by?: "booked_date" | "updated_at" | "pickup_date_time";
};

export type GeotravelBookingsResult =
  | {
      ok: true;
      data: GeotravelBooking[];
      pagination: { offset: number; limit: number; total: number };
      /** True when phone search did not scan the full API total (see clientScanRowCap / env). */
      phoneScanTruncated?: boolean;
      /** When set, phone search was used; value is the API’s reported total under the same filters. */
      phoneSearchApiTotal?: number;
      /** True when ref client-scan stopped before the API’s full total (see clientScanRowCap). */
      refScanTruncated?: boolean;
      refSearchApiTotal?: number;
      /** API accepted booking_reference / passenger_phone as query params (one request per UI page). */
      serverSideFilter?: boolean;
      /** When client-side scan ran, max rows walked (from GEOTRAVEL_MAX_SCAN_ROWS or default). */
      clientScanRowCap?: number;
      /** Incremental delta: `updated_from` sent to the API. */
      incrementalFrom?: string;
      /** True when the list used updated_from / order_by=updated_at. */
      incrementalSync?: boolean;
    }
  | { ok: false; error: string };

/**
 * Client-side scan cap when the API ignores ref/phone query params (keeps request volume low).
 * Override with GEOTRAVEL_MAX_SCAN_ROWS (e.g. 50000) if Geotravel raises your quota.
 */
function maxCrossPageScanRows(): number {
  const raw = process.env.GEOTRAVEL_MAX_SCAN_ROWS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 500 && n <= 200_000) return Math.floor(n);
  }
  return 12_000;
}

/** Chunk size when walking the API client-side (API max per page is 500). */
const CROSS_PAGE_CHUNK = 500;
/** Pause between scan pages to avoid bursting the edge rate limiter. */
const CROSS_PAGE_REQUEST_GAP_MS = 450;

const RATE_LIMIT_MAX_ATTEMPTS = 6;

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryAfterMsFromResponse(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const sec = Number(h);
  if (Number.isFinite(sec) && sec >= 0) return Math.min(sec * 1000, 120_000);
  return undefined;
}

async function backoffForRateLimit(res: Response, attempt: number): Promise<void> {
  const fromHeader = retryAfterMsFromResponse(res);
  const exp = 700 * 2 ** attempt;
  const base = fromHeader ?? exp;
  const jitter = Math.floor(Math.random() * 250);
  await sleepMs(Math.min(base + jitter, 90_000));
}

async function paceCrossPageRequest(pageIndex: number): Promise<void> {
  if (pageIndex <= 0) return;
  await sleepMs(CROSS_PAGE_REQUEST_GAP_MS);
}

function phoneDigitsMatch(stored: string | null, queryDigits: string): boolean {
  const p = (stored ?? "").replace(/\D/g, "");
  if (!p || !queryDigits) return false;
  return p.includes(queryDigits) || queryDigits.includes(p);
}

function refRowMatches(row: GeotravelBooking, refLower: string): boolean {
  const hay = `${row.booking_reference ?? ""} ${row.id}`.toLowerCase();
  return hay.includes(refLower);
}

/**
 * Paging scan for booking reference / id substring (same filters as list view).
 */
export async function fetchGeotravelBookingsRefScan(input: {
  outcome?: string;
  airport?: string;
  status?: string;
  refSubstring: string;
  page: number;
  limit: number;
  updatedFrom?: string;
}): Promise<GeotravelBookingsResult> {
  const refRaw = input.refSubstring.trim();
  const refLower = refRaw.toLowerCase();
  if (!refLower) {
    return fetchGeotravelBookings({
      limit: input.limit,
      offset: input.page * input.limit,
      outcome: input.outcome,
      airport: input.airport,
      status: input.status,
    });
  }

  const base = bookingsListBaseParams(input);

  const totalRes = await fetchGeotravelBookings({ ...base, limit: 1, offset: 0 });
  if (!totalRes.ok) return totalRes;
  const Tu = totalRes.pagination.total;

  if (Tu === 0) {
    return {
      ok: true,
      data: [],
      pagination: { offset: 0, limit: input.limit, total: 0 },
      refSearchApiTotal: 0,
      refScanTruncated: false,
      serverSideFilter: false,
      incrementalFrom: input.updatedFrom,
      incrementalSync: Boolean(input.updatedFrom),
    };
  }

  const variants = /^bk-/i.test(refRaw)
    ? [refRaw, refRaw.replace(/^bk-/i, "").trim()].filter(Boolean)
    : [refRaw];

  let chosen: { key: "booking_reference" | "ref"; value: string } | null = null;
  let Tf = Tu;

  outer: for (const variant of variants) {
    for (const key of ["booking_reference", "ref"] as const) {
      const probeParams: GeotravelBookingsParams = { ...base, limit: 1, offset: 0 };
      if (key === "booking_reference") probeParams.booking_reference = variant;
      else probeParams.ref = variant;

      const probe = await fetchGeotravelBookings(probeParams);
      if (!probe.ok) return probe;
      if (probe.pagination.total < Tu) {
        chosen = { key, value: variant };
        Tf = probe.pagination.total;
        break outer;
      }
    }
  }

  if (chosen) {
    const pageParams: GeotravelBookingsParams = {
      ...base,
      limit: input.limit,
      offset: input.page * input.limit,
    };
    if (chosen.key === "booking_reference") pageParams.booking_reference = chosen.value;
    else pageParams.ref = chosen.value;

    const pageRes = await fetchGeotravelBookings(pageParams);
    if (!pageRes.ok) return pageRes;
    const data = pageRes.data.filter((row) => refRowMatches(row, refLower));
    return {
      ok: true,
      data,
      pagination: {
        offset: input.page * input.limit,
        limit: input.limit,
        total: Tf,
      },
      refSearchApiTotal: Tu,
      refScanTruncated: false,
      serverSideFilter: true,
      incrementalFrom: input.updatedFrom,
      incrementalSync: Boolean(input.updatedFrom),
    };
  }

  const scanCap = maxCrossPageScanRows();
  const matches: GeotravelBooking[] = [];
  let apiTotal = 0;
  let offset = 0;
  let pageIndex = 0;

  while (true) {
    await paceCrossPageRequest(pageIndex);
    const r = await fetchGeotravelBookings({
      ...base,
      limit: CROSS_PAGE_CHUNK,
      offset,
    });
    pageIndex += 1;
    if (!r.ok) return r;

    apiTotal = r.pagination.total;
    const maxOffset = Math.min(apiTotal, scanCap);

    for (const row of r.data) {
      if (!refRowMatches(row, refLower)) continue;
      matches.push(row);
    }

    if (r.data.length < CROSS_PAGE_CHUNK) break;
    offset += CROSS_PAGE_CHUNK;
    if (offset >= maxOffset) break;
  }

  const truncated = apiTotal > scanCap;
  const unique = [...new Map(matches.map((b) => [b.id, b])).values()];
  const totalMatches = unique.length;
  const start = input.page * input.limit;
  const slice = unique.slice(start, start + input.limit);

  return {
    ok: true,
    data: slice,
    pagination: {
      offset: start,
      limit: input.limit,
      total: totalMatches,
    },
    refScanTruncated: truncated,
    refSearchApiTotal: apiTotal,
    serverSideFilter: false,
    clientScanRowCap: scanCap,
    incrementalFrom: input.updatedFrom,
    incrementalSync: Boolean(input.updatedFrom),
  };
}

function bookingsListBaseParams(input: {
  outcome?: string;
  airport?: string;
  status?: string;
  updatedFrom?: string;
}): GeotravelBookingsParams {
  const base: GeotravelBookingsParams = {
    outcome: input.outcome,
    airport: input.airport,
    status: input.status,
  };
  if (input.updatedFrom) {
    base.updated_from = input.updatedFrom;
    base.order_by = "updated_at";
  }
  return base;
}

/**
 * Phone search using Geotravel’s `passenger_phone` query param (any format; server
 * normalizes; matches last 9 stored digits; min 6 digits in the request).
 * Phone-only: one paginated API call per page. Phone + ref: loads phone-filtered pages
 * and filters by ref client-side (capped by GEOTRAVEL_MAX_SCAN_ROWS).
 */
export async function fetchGeotravelBookingsPhoneScan(input: {
  outcome?: string;
  airport?: string;
  status?: string;
  /** Digits used for validation and a defensive client-side match check. */
  phoneDigits: string;
  /** Raw search value sent as `passenger_phone` when it contains enough digits. */
  passengerPhoneParam?: string;
  refSubstring?: string;
  page: number;
  limit: number;
  updatedFrom?: string;
}): Promise<GeotravelBookingsResult> {
  const queryDigits = input.phoneDigits.replace(/\D/g, "").trim();
  if (!queryDigits) {
    return { ok: false, error: "Phone search requires at least one digit." };
  }
  if (queryDigits.length < 6) {
    return {
      ok: false,
      error: "Phone filter requires at least 6 digits (Geotravel API).",
    };
  }

  const base = bookingsListBaseParams(input);

  const rawParam = input.passengerPhoneParam?.trim();
  const phoneParam =
    rawParam && rawParam.replace(/\D/g, "").length >= 6 ? rawParam : queryDigits;

  const refExtra = input.refSubstring?.trim().toLowerCase();

  const totalRes = await fetchGeotravelBookings({ ...base, limit: 1, offset: 0 });
  if (!totalRes.ok) return totalRes;
  const Tu = totalRes.pagination.total;

  if (Tu === 0) {
    return {
      ok: true,
      data: [],
      pagination: { offset: 0, limit: input.limit, total: 0 },
      phoneSearchApiTotal: 0,
      phoneScanTruncated: false,
      serverSideFilter: true,
      incrementalFrom: input.updatedFrom,
      incrementalSync: Boolean(input.updatedFrom),
    };
  }

  if (!refExtra) {
    const pageRes = await fetchGeotravelBookings({
      ...base,
      passenger_phone: phoneParam,
      limit: input.limit,
      offset: input.page * input.limit,
    });
    if (!pageRes.ok) return pageRes;
    const Tf = pageRes.pagination.total;
    const data = pageRes.data.filter((row) =>
      phoneDigitsMatch(row.passenger_phone, queryDigits),
    );
    return {
      ok: true,
      data,
      pagination: {
        offset: input.page * input.limit,
        limit: input.limit,
        total: Tf,
      },
      phoneSearchApiTotal: Tu,
      phoneScanTruncated: false,
      serverSideFilter: true,
      incrementalFrom: input.updatedFrom,
      incrementalSync: Boolean(input.updatedFrom),
    };
  }

  const scanCap = maxCrossPageScanRows();
  const matches: GeotravelBooking[] = [];
  let apiPhoneTotal = 0;
  let offset = 0;
  let pageIndex = 0;

  while (true) {
    await paceCrossPageRequest(pageIndex);
    const r = await fetchGeotravelBookings({
      ...base,
      passenger_phone: phoneParam,
      limit: CROSS_PAGE_CHUNK,
      offset,
    });
    pageIndex += 1;
    if (!r.ok) return r;

    apiPhoneTotal = r.pagination.total;
    const maxOffset = Math.min(apiPhoneTotal, scanCap);

    for (const row of r.data) {
      if (!refRowMatches(row, refExtra)) continue;
      if (!phoneDigitsMatch(row.passenger_phone, queryDigits)) continue;
      matches.push(row);
    }

    if (r.data.length < CROSS_PAGE_CHUNK) break;
    offset += CROSS_PAGE_CHUNK;
    if (offset >= maxOffset) break;
  }

  const truncated = apiPhoneTotal > scanCap;
  const unique = [...new Map(matches.map((b) => [b.id, b])).values()];
  const totalMatches = unique.length;
  const start = input.page * input.limit;
  const slice = unique.slice(start, start + input.limit);

  return {
    ok: true,
    data: slice,
    pagination: { offset: start, limit: input.limit, total: totalMatches },
    phoneSearchApiTotal: Tu,
    phoneScanTruncated: truncated,
    serverSideFilter: true,
    clientScanRowCap: truncated ? scanCap : undefined,
    incrementalFrom: input.updatedFrom,
    incrementalSync: Boolean(input.updatedFrom),
  };
}

export async function fetchGeotravelBookings(
  params: GeotravelBookingsParams = {},
): Promise<GeotravelBookingsResult> {
  const apiKey = process.env.GEOTRAVEL_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "GEOTRAVEL_API_KEY is not set in environment variables.",
    };
  }

  const qs = new URLSearchParams();
  if (params.limit !== undefined) {
    const L = Math.max(1, Math.min(500, Math.floor(params.limit)));
    qs.set("limit", String(L));
  }
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  if (params.status) qs.set("status", params.status);
  if (params.outcome) qs.set("outcome", params.outcome);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.pickup_city) qs.set("pickup_city", params.pickup_city);
  if (params.dropoff_city) qs.set("dropoff_city", params.dropoff_city);
  if (params.country) qs.set("country", params.country);
  if (params.airport) qs.set("airport", params.airport);
  if (params.booking_reference)
    qs.set("booking_reference", params.booking_reference);
  if (params.ref) qs.set("ref", params.ref);
  if (params.passenger_phone) qs.set("passenger_phone", params.passenger_phone);
  if (params.plateform) qs.set("plateform", params.plateform);
  if (params.updated_from) qs.set("updated_from", params.updated_from);
  if (params.modified_since) qs.set("modified_since", params.modified_since);
  if (params.updated_to) qs.set("updated_to", params.updated_to);
  if (params.order_by) qs.set("order_by", params.order_by);

  const url = `${API_BASE}?${qs.toString()}`;

  type ApiResponse = {
    data?: GeotravelBooking[];
    pagination?: { offset: number; limit: number; total: number };
    error?: string;
    message?: string;
  };

  for (let attempt = 0; attempt < RATE_LIMIT_MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `geotravel_network:${msg}` };
    }

    const text = await res.text();
    let json: ApiResponse;
    try {
      json = JSON.parse(text) as ApiResponse;
    } catch {
      if (res.status === 429 && attempt < RATE_LIMIT_MAX_ATTEMPTS - 1) {
        await backoffForRateLimit(res, attempt);
        continue;
      }
      return { ok: false, error: `geotravel_invalid_json:${res.status}` };
    }

    if (res.status === 429 && attempt < RATE_LIMIT_MAX_ATTEMPTS - 1) {
      await backoffForRateLimit(res, attempt);
      continue;
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `geotravel_${res.status}:${json.error ?? json.message ?? "unknown"}`,
      };
    }

    return {
      ok: true,
      data: json.data ?? [],
      pagination: json.pagination ?? { offset: 0, limit: 0, total: 0 },
    };
  }

  return {
    ok: false,
    error: "geotravel_429:Rate limit exceeded (retries exhausted)",
  };
}

export type GeotravelIncrementalListInput = Omit<
  GeotravelBookingsParams,
  "updated_from" | "modified_since" | "order_by"
> & {
  page: number;
  /** When set, only rows updated at or after this instant (stable sort: updated_at asc). */
  updatedFrom?: string;
};

/**
 * One page of the bookings list, optionally scoped to a delta window (`updated_from`).
 */
export async function fetchGeotravelBookingsIncrementalList(
  input: GeotravelIncrementalListInput,
): Promise<GeotravelBookingsResult> {
  const limit = input.limit ?? 500;
  const offset = input.page * limit;
  const { page: _page, updatedFrom, ...rest } = input;

  const params: GeotravelBookingsParams = {
    ...rest,
    limit,
    offset,
  };

  if (updatedFrom) {
    params.updated_from = updatedFrom;
    params.order_by = "updated_at";
  }

  const res = await fetchGeotravelBookings(params);
  if (!res.ok) return res;

  return {
    ...res,
    incrementalFrom: updatedFrom,
    incrementalSync: Boolean(updatedFrom),
  };
}

/**
 * Walk every page in the current delta window and advance the stored cursor to the
 * latest `updated_at` seen (for “Refresh data” / cron).
 */
export async function pullGeotravelBookingsDeltaWindow(
  base: Omit<GeotravelBookingsParams, "limit" | "offset" | "updated_from" | "order_by">,
  updatedFrom: string,
): Promise<
  | { ok: true; rows: GeotravelBooking[]; cursorAdvancedTo: string | null }
  | { ok: false; error: string }
> {
  const byId = new Map<number, GeotravelBooking>();
  let offset = 0;
  let pageIndex = 0;
  let total = 0;

  while (true) {
    await paceCrossPageRequest(pageIndex);
    const r = await fetchGeotravelBookings({
      ...base,
      updated_from: updatedFrom,
      order_by: "updated_at",
      limit: CROSS_PAGE_CHUNK,
      offset,
    });
    pageIndex += 1;
    if (!r.ok) return { ok: false, error: r.error };

    total = r.pagination.total;
    for (const row of r.data) {
      byId.set(row.id, row);
    }

    if (r.data.length < CROSS_PAGE_CHUNK) break;
    offset += CROSS_PAGE_CHUNK;
    if (offset >= total) break;
  }

  const rows = [...byId.values()];
  const batchMax = maxUpdatedAtFromBookings(rows);
  let cursorAdvancedTo: string | null = null;
  if (batchMax) {
    cursorAdvancedTo = await advanceGeotravelBookingsSyncCursor(rows);
  }
  await saveGeotravelBookingsDeltaHighlights(rows, updatedFrom);

  return { ok: true, rows, cursorAdvancedTo };
}
