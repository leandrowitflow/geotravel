/**
 * Geotravel Data API client.
 * REST API for external access to bookings data.
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
};

export type GeotravelBookingsResult =
  | {
      ok: true;
      data: GeotravelBooking[];
      pagination: { offset: number; limit: number; total: number };
    }
  | { ok: false; error: string };

/** PT demo mobile +351 966 915 976 — search digits: 351966915976 */
const MOCK_PHONE_351 = "+351966915976";

function buildMockBookings351966915976(): GeotravelBooking[] {
  const now = Date.now();
  const p1 = new Date(now + 2 * 86400_000);
  return [
    {
      id: 910351001,
      status: "NEW",
      outcome: "Active",
      plateform: "mock",
      booked_date: new Date().toISOString(),
      pickup_date_time: p1.toISOString(),
      pickup_city: "Lisbon",
      pickup_country: "PT",
      pickup_address: "Lisbon Airport (LIS)",
      pickup_location_type: "airport",
      dropoff_city: "Cascais",
      dropoff_country: "PT",
      dropoff_address: "Hotel mock bay",
      dropoff_location_type: "hotel",
      nearest_airport: "LIS",
      vehicle_type: "Standard sedan",
      passenger_count: 2,
      distance_km: 35,
      amount: 48.5,
      invoice_country: "PT",
      booking_reference: "MOCK-351966915976-NEW",
      passenger_phone: MOCK_PHONE_351,
      passenger_name: "Mock Cliente (NEW)",
      loyalty_name: null,
      direction: "IN",
      trip_type: "one_way",
      is_return: 0,
      multidays: null,
      book_lead_time: "2 days 4:00:00",
      pickup_dow: p1.getUTCDay(),
    },
  ];
}

function mockBookingsMatchingParams(
  params: GeotravelBookingsParams,
): GeotravelBooking[] {
  return buildMockBookings351966915976().filter((b) => {
    if (params.outcome && b.outcome !== params.outcome) return false;
    if (params.status && b.status !== params.status) return false;
    if (
      params.airport &&
      (b.nearest_airport?.toUpperCase() ?? "") !== params.airport.toUpperCase()
    ) {
      return false;
    }
    return true;
  });
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
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  if (params.status) qs.set("status", params.status);
  if (params.outcome) qs.set("outcome", params.outcome);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.pickup_city) qs.set("pickup_city", params.pickup_city);
  if (params.dropoff_city) qs.set("dropoff_city", params.dropoff_city);
  if (params.country) qs.set("country", params.country);
  if (params.airport) qs.set("airport", params.airport);

  const url = `${API_BASE}?${qs.toString()}`;

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

  type ApiResponse = {
    data?: GeotravelBooking[];
    pagination?: { offset: number; limit: number; total: number };
    error?: string;
    message?: string;
  };

  let json: ApiResponse;
  try {
    json = (await res.json()) as ApiResponse;
  } catch {
    return { ok: false, error: `geotravel_invalid_json:${res.status}` };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `geotravel_${res.status}:${json.error ?? json.message ?? "unknown"}`,
    };
  }

  const pagination = json.pagination ?? { offset: 0, limit: 0, total: 0 };
  let data = json.data ?? [];
  const useMock =
    process.env.GEOTRAVEL_MOCK_BOOKINGS === "1" ||
    process.env.GEOTRAVEL_MOCK_BOOKINGS === "true";

  if (useMock) {
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 100;
    const mocks = mockBookingsMatchingParams(params);
    if (offset === 0) {
      data = [...mocks, ...data].slice(0, limit);
    }
    return {
      ok: true,
      data,
      pagination: {
        ...pagination,
        total: pagination.total + mocks.length,
      },
    };
  }

  return {
    ok: true,
    data,
    pagination,
  };
}
