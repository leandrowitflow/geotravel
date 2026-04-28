import Link from "next/link";
import { notFound } from "next/navigation";
import { getCaseDetail } from "@/lib/admin/queries";
import { CaseActions } from "./case-actions";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCaseDetail(id);
  if (!detail) {
    notFound();
  }
  const { case: c, reservation: r, messages, events, crmSync } = detail;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/cases"
            className="text-sm text-teal-800 underline dark:text-teal-300"
          >
            ← Cases
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Case detail
          </h1>
          <p className="font-mono text-xs text-stone-500 dark:text-stone-400">{c.id}</p>
        </div>
        <CaseActions caseId={c.id} />
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">Reservation</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500 dark:text-stone-400">Booking ref</dt>
            <dd>{r.externalBookingId}</dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-stone-400">Source</dt>
            <dd>{r.externalSource}</dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-stone-400">Pickup</dt>
            <dd>
              {r.pickupDatetime?.toISOString().slice(0, 16) ?? "—"}{" "}
              {r.pickupLocation ? `· ${r.pickupLocation}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-stone-400">Dropoff</dt>
            <dd>{r.dropoffLocation ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-stone-400">Phone</dt>
            <dd>{r.sourcePhone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-stone-400">Status</dt>
            <dd>{r.bookingStatus}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">Collected data</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-stone-50 p-3 text-xs dark:bg-stone-950 dark:text-stone-200">
          {JSON.stringify(c.collectedData ?? {}, null, 2)}
        </pre>
        <h3 className="mt-4 text-sm font-medium text-stone-700 dark:text-stone-300">Consent</h3>
        <pre className="mt-1 overflow-x-auto rounded bg-stone-50 p-3 text-xs dark:bg-stone-950 dark:text-stone-200">
          {JSON.stringify(c.consent ?? {}, null, 2)}
        </pre>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">Message timeline</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded border border-stone-100 bg-stone-50/80 px-3 py-2 dark:border-stone-700 dark:bg-stone-950/80"
            >
              <div className="flex flex-wrap gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span>{m.createdAt.toISOString()}</span>
                <span>{m.direction}</span>
                <span>{m.channel}</span>
                <span>{m.status}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">Behavioural events</h2>
        <ul className="mt-3 max-h-80 overflow-y-auto space-y-1 font-mono text-xs">
          {events.map((e) => (
            <li key={e.id}>
              {e.createdAt.toISOString()} — {e.eventType}{" "}
              {e.channel ? `(${e.channel})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">CRM sync attempts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {crmSync.map((s) => (
            <li
              key={s.id}
              className="rounded border border-stone-100 px-3 py-2 dark:border-stone-700"
            >
              <div className="text-xs text-stone-500 dark:text-stone-400">
                {s.createdAt.toISOString()} · {s.kind} · {s.status}
              </div>
              {s.errorMessage ? (
                <div className="text-xs text-red-700 dark:text-red-400">{s.errorMessage}</div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
