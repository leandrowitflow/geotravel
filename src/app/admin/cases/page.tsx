import Link from "next/link";
import { listCasesWithReservation } from "@/lib/admin/queries";

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        : tone === "bad"
          ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100"
          : "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export default async function CasesInboxPage() {
  const rows = await listCasesWithReservation();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Case inbox
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Operational cases and enrichment status.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-300">
            <tr>
              <th className="px-3 py-2 font-medium">Case</th>
              <th className="px-3 py-2 font-medium">Booking</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Channel</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Enrichment</th>
              <th className="px-3 py-2 font-medium">D-1</th>
              <th className="px-3 py-2 font-medium">Flags</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ case: c, reservation: r }) => (
              <tr
                key={c.id}
                className="border-b border-stone-100 hover:bg-stone-50/80 dark:border-stone-800 dark:hover:bg-stone-800/50"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/admin/cases/${c.id}`}
                    className="text-teal-800 underline dark:text-teal-300"
                  >
                    {c.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{r.externalBookingId}</div>
                  <div className="text-stone-500 dark:text-stone-400">{r.externalSource}</div>
                </td>
                <td className="px-3 py-2">{r.customerName ?? "—"}</td>
                <td className="px-3 py-2">{c.currentChannel}</td>
                <td className="px-3 py-2">
                  <Badge tone="neutral">{c.orchestrationState}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge
                    tone={
                      c.enrichmentStatus === "complete"
                        ? "ok"
                        : c.enrichmentStatus === "pending"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {c.enrichmentStatus}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge tone="neutral">{c.confirmationStatus}</Badge>
                </td>
                <td className="px-3 py-2">
                  {c.exceptionFlag ? <Badge tone="bad">exception</Badge> : null}{" "}
                  {c.humanIntervention ? (
                    <Badge tone="warn">human</Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-stone-600 dark:text-stone-400">
                  {c.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-stone-500 dark:text-stone-400">No cases yet.</p>
        ) : null}
      </div>
    </div>
  );
}
