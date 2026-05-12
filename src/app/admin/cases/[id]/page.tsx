import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshDataButton } from "@/components/admin/refresh-data-button";
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
        <div className="flex flex-wrap items-center gap-2">
          <RefreshDataButton />
          <CaseActions caseId={c.id} />
        </div>
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
            <dt className="text-stone-500 dark:text-stone-400">Booking status</dt>
            <dd>{r.bookingStatus}</dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-stone-400">Case status</dt>
            <dd>{c.caseStatus}</dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-stone-400">Orchestration</dt>
            <dd className="font-mono text-xs">{c.orchestrationState}</dd>
          </div>
        </dl>
      </section>

      <section
        id="messages"
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none"
      >
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">Messages</h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Oldest first · inbound (customer) vs outbound (system / admin).
        </p>
        <ul className="mt-3 space-y-3 text-sm">
          {messages.length === 0 ? (
            <li className="text-stone-500 dark:text-stone-400">No messages on this case yet.</li>
          ) : null}
          {messages.map((m) => {
            const inbound = m.direction === "inbound";
            return (
              <li
                key={m.id}
                className={`flex ${inbound ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={
                    inbound
                      ? "max-w-[min(100%,42rem)] rounded-lg border border-teal-200 bg-teal-50/90 px-3 py-2 dark:border-teal-800 dark:bg-teal-950/50"
                      : "max-w-[min(100%,42rem)] rounded-lg border border-stone-200 bg-stone-100/90 px-3 py-2 dark:border-stone-600 dark:bg-stone-800/80"
                  }
                >
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                    <span className="font-medium text-stone-600 dark:text-stone-300">
                      {inbound ? "Customer" : "Outbound"}
                    </span>
                    <span>{m.createdAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                    <span>{m.channel}</span>
                    <span>{m.status}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-stone-900 dark:text-stone-100">
                    {m.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <details className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <summary className="cursor-pointer text-lg font-medium text-stone-900 dark:text-stone-50">
          Collected data & consent
        </summary>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          JSON for debugging — collapsed by default to keep testing focused on messages.
        </p>
        <h3 className="mt-3 text-sm font-medium text-stone-700 dark:text-stone-300">Collected data</h3>
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-stone-50 p-3 text-xs dark:bg-stone-950 dark:text-stone-200">
          {JSON.stringify(c.collectedData ?? {}, null, 2)}
        </pre>
        <h3 className="mt-4 text-sm font-medium text-stone-700 dark:text-stone-300">Consent</h3>
        <pre className="mt-1 max-h-48 overflow-auto rounded bg-stone-50 p-3 text-xs dark:bg-stone-950 dark:text-stone-200">
          {JSON.stringify(c.consent ?? {}, null, 2)}
        </pre>
      </details>

      <details className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <summary className="cursor-pointer text-lg font-medium text-stone-900 dark:text-stone-50">
          Behavioural events ({events.length})
        </summary>
        <ul className="mt-3 max-h-80 overflow-y-auto space-y-1 font-mono text-xs">
          {events.map((e) => (
            <li key={e.id}>
              {e.createdAt.toISOString()} — {e.eventType}{" "}
              {e.channel ? `(${e.channel})` : ""}
            </li>
          ))}
        </ul>
      </details>

      <details className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <summary className="cursor-pointer text-lg font-medium text-stone-900 dark:text-stone-50">
          CRM sync attempts ({crmSync.length})
        </summary>
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
      </details>
    </div>
  );
}
