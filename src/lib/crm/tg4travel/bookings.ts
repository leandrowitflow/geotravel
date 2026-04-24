/**
 * Read bookings from the TG4Travel Partners API.
 * Endpoint: POST /v2/bookings_list (form-encoded body)
 * @see https://webhook.backoffice.tg4travel.com/index.html#/
 */
import { getTg4AccessToken, getTg4ApiBaseUrl } from "./oauth-token";

export type Tg4Booking = {
  id: string;
  customerReference: string | null;
  bookingReference: string | null;
  state_hash: string | null;
  status: string | null;
  amount: string | null;
  currency: string | null;
  customerPrice: string | null;
  customerOriginalPrice: string | null;
  customerCurrency: string | null;
  booked_date: string | null;
  pickup_date_time: string | null;
  pickup_date_time_zone: string | null;
  vehicle_type: string | null;
  passenger_count: string | null;
  additional_comments: string | null;
  meet_and_greet: string | null;
  passenger_title: string | null;
  passenger_name: string | null;
  passenger_telephone_number: string | null;
  passenger_email: string | null;
  pickup_latitude: string | null;
  pickup_longitude: string | null;
  pickup_address: string | null;
  pickup_postcode: string | null;
  pickup_country: string | null;
  pickup_type: string | null;
  pickup_city: string | null;
  dropoff_latitude: string | null;
  dropoff_longitude: string | null;
  dropoff_address: string | null;
  dropoff_establishment_name: string | null;
  dropoff_postcode: string | null;
  dropoff_country: string | null;
  dropoff_type: string | null;
  dropoff_date_time: string | null;
  dropoff_city: string | null;
  time_distance: string | null;
  source: string | null;
  plateform: string | null;
  actual_booking: string | null;
  vehicle_number: string | null;
  extras: string | null;
  departure_flight: string | null;
  arrival_flight: string | null;
  information_for_driver: string | null;
  flight_arrival_date_time: string | null;
  origin_airport: string | null;
  destination_airport: string | null;
  driver_sign: string | null;
  sender: string | null;
  received_time: string | null;
  subject: string | null;
  tag: string | null;
  created_at: string | null;
  updated_at: string | null;
  adults: string | null;
  babies: string | null;
  infant: string | null;
  toddlers: string | null;
  teens: string | null;
  children: string | null;
  cabin_luggage: string | null;
  checked_luggage: string | null;
  pushchair: string | null;
  pet_box: string | null;
  golf_bag: string | null;
  babyseat: string | null;
  boosterseat: string | null;
  infants_carrier: string | null;
  wheelchair: string | null;
  bicycle: string | null;
  other_sports_equipment: string | null;
  other_luggage: string | null;
  promo_code: string | null;
  payment_method: string | null;
  nearest_airport_id: string | null;
  nearest_airport: string | null;
  ride_status: string | null;
  supplier_id: string | null;
  supplier_assigned_date: string | null;
  driver_first_name: string | null;
  driver_last_name: string | null;
  driver_telephone_number: string | null;
  driver_assigned_date: string | null;
  send_updates: string | null;
  price_rule_type: string | null;
  searchResultId: string | null;
  loyalty_name: string | null;
  from_zone: string | null;
  to_zone: string | null;
  distance_km: string | null;
  invoice_country: string | null;
  platform_id: string | null;
  partner_id: string | null;
  is_return: string | null;
  return_pickup_date: string | null;
  airline: string | null;
  serviceReference: string | null;
  travelTime: string | null;
  clientEmail: string | null;
};

export type Tg4BookingsListParams = {
  start?: number;
  length?: number;
  id?: number;
  bookingReference?: number;
  pickup_datetime_from?: string;
  pickup_datetime_to?: string;
  booked_date_from?: string;
  booked_date_to?: string;
  passenger_name?: string;
  passenger_telephone_number?: string;
};

export type Tg4BookingsListResult =
  | {
      ok: true;
      total_count: number;
      filtered_count: number;
      data: Tg4Booking[];
    }
  | { ok: false; error: string };

export async function fetchTg4BookingsList(
  params: Tg4BookingsListParams = {},
): Promise<Tg4BookingsListResult> {
  const tokenResult = await getTg4AccessToken();
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }

  const base = getTg4ApiBaseUrl();
  const url = `${base}/v2/bookings_list`;

  const body = new URLSearchParams();
  if (params.start !== undefined) body.set("start", String(params.start));
  if (params.length !== undefined) body.set("length", String(params.length));
  if (params.id !== undefined) body.set("id", String(params.id));
  if (params.bookingReference !== undefined)
    body.set("bookingReference", String(params.bookingReference));
  if (params.pickup_datetime_from)
    body.set("pickup_datetime_from", params.pickup_datetime_from);
  if (params.pickup_datetime_to)
    body.set("pickup_datetime_to", params.pickup_datetime_to);
  if (params.booked_date_from)
    body.set("booked_date_from", params.booked_date_from);
  if (params.booked_date_to)
    body.set("booked_date_to", params.booked_date_to);
  if (params.passenger_name)
    body.set("passenger_name", params.passenger_name);
  if (params.passenger_telephone_number)
    body.set(
      "passenger_telephone_number",
      params.passenger_telephone_number,
    );

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `tg4_bookings_network:${msg}` };
  }

  type ApiResponse = {
    status?: boolean;
    total_count?: number;
    filtered_count?: number;
    data?: Tg4Booking[];
    message?: string;
  };

  let json: ApiResponse;
  try {
    json = (await res.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      error: `tg4_bookings_invalid_json:${res.status}`,
    };
  }

  if (!res.ok || json.status === false) {
    return {
      ok: false,
      error: `tg4_bookings_${res.status}:${json.message ?? "unknown"}`,
    };
  }

  return {
    ok: true,
    total_count: json.total_count ?? 0,
    filtered_count: json.filtered_count ?? 0,
    data: json.data ?? [],
  };
}
