import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseActions } from "@/app/admin/cases/[id]/case-actions";
import { CaseConversationThread } from "@/components/admin/case-conversation-thread";
import { CollectedDataConsentPanel } from "@/components/admin/collected-data-consent-panel";
import { RefreshDataButton } from "@/components/admin/refresh-data-button";
import { getCaseDetail } from "@/lib/admin/queries";
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
        <RefreshDataButton />
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
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">Conversation</h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Oldest first — customer on the left, Geotravel on the right. Template
          messages show the approved WhatsApp wording customers receive, not the
          internal variable dump.
        </p>
        <CaseConversationThread
          messages={messages}
          preferredLanguage={detail.contact?.preferredLanguage}
        />
      </section>

      <section
        id="collected-data"
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none"
      >
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">
          Actions
        </h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Re-run extraction from the latest customer message into{" "}
          <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">
            cases.collected_data
          </code>{" "}
          (Supabase).
        </p>
        <div className="mt-3">
          <CaseActions caseId={c.id} />
        </div>
      </section>

      <CollectedDataConsentPanel
        collectedData={c.collectedData}
        consent={c.consent}
        pendingFieldKey={c.pendingFieldKey}
        orchestrationState={c.orchestrationState}
        preferredLanguage={
          (detail.contact?.preferredLanguage as "en" | "pt") ?? "en"
        }
      />

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
