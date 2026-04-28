import { BookingsView, type BookingsSearchParams } from "./bookings-view";

export default function BookingsPage({
  searchParams,
}: {
  searchParams: BookingsSearchParams;
}) {
  return <BookingsView searchParams={searchParams} />;
}
