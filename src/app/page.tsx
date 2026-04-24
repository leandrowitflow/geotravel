import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const user =
    supabase != null
      ? (await supabase.auth.getUser()).data.user
      : null;
  return (
    <div className="flex min-h-screen flex-col bg-[#0c3532] text-white">
      <div className="mx-auto flex max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <p className="text-sm uppercase tracking-[0.2em] text-teal-200/90">
          Geotravel
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Reservation enrichment agent
        </h1>
        <p className="text-lg text-teal-100/90">
          Text-first operations: WhatsApp primary, SMS fallback, CRM write-back,
          and structured behavioural telemetry — per your MVP spec.
        </p>
        <div className="flex flex-wrap gap-3">
          {user ? (
            <Link
              href="/admin/cases"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-[#0c3532] hover:bg-teal-50"
            >
              Open admin center
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-[#0c3532] hover:bg-teal-50"
            >
              Staff sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
