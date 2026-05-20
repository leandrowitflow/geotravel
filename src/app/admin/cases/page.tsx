import Link from "next/link";
import { DeleteAllCasesButton } from "@/components/admin/delete-all-cases-button";
import { RefreshDataButton } from "@/components/admin/refresh-data-button";
import { inboxStageFromOrchestration } from "@/lib/admin/inbox-stage";
import { listCasesWithReservation } from "@/lib/admin/queries";
import { formatExtraInformationSummary } from "@/lib/admin/collected-data-display";
import { formatMessageForConversation } from "@/lib/admin/whatsapp-template-display";

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

function excerpt(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default async function CasesInboxPage() {
  const rows = await listCasesWithReservation();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Case inbox
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Latest message preview; open a case for the full thread (
            <code className="rounded bg-stone-100 px-1 text-xs dark:bg-stone-800">#messages</code>
            ).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeleteAllCasesButton />
          <RefreshDataButton />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-300">
            <tr>
              <th className="px-3 py-2 font-medium">Latest message</th>
              <th className="px-3 py-2 font-medium">Case</th>
              <th className="px-3 py-2 font-medium">Booking</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium min-w-[12rem]">Extra information</th>
              <th className="px-3 py-2 font-medium">Channel</th>
              <th className="px-3 py-2 font-medium">Messages</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ case: c, reservation: r, lastMessage: lm, messageCount }) => {
              const stage = inboxStageFromOrchestration(c.orchestrationState);
              return (
              <tr
                key={c.id}
                className="border-b border-stone-100 hover:bg-stone-50/80 dark:border-stone-800 dark:hover:bg-stone-800/50"
              >
                <td className="max-w-[14rem] px-3 py-2 text-xs text-stone-600 dark:text-stone-300">
                  {lm ? (
                    <Link
                      href={`/admin/cases/${c.id}#messages`}
                      className="block text-teal-800 underline decoration-teal-600/40 underline-offset-2 hover:decoration-teal-600 dark:text-teal-300"
                      title={lm.body}
                    >
                      <span className="font-medium text-stone-700 dark:text-stone-200">
                        {lm.direction}
                      </span>{" "}
                      <span className="text-stone-500 dark:text-stone-400">
                        {lm.createdAt.toISOString().slice(5, 16).replace("T", " ")}
                      </span>
                      <span className="mt-0.5 block font-normal text-stone-600 dark:text-stone-400">
                        {excerpt(
                          formatMessageForConversation({
                            direction: lm.direction,
                            body: lm.body,
                            metadata: lm.metadata,
                          }).body,
                          72,
                        )}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/admin/cases/${c.id}#messages`}
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
                <td className="max-w-[18rem] px-3 py-2 text-xs text-stone-600 dark:text-stone-300">
                  <Link
                    href={`/admin/cases/${c.id}#collected-data`}
                    className="block hover:text-teal-800 dark:hover:text-teal-300"
                    title={formatExtraInformationSummary(c.collectedData, 500)}
                  >
                    {formatExtraInformationSummary(c.collectedData)}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.currentChannel}</td>
                <td className="px-3 py-2 tabular-nums text-stone-700 dark:text-stone-200">
                  <Link
                    href={`/admin/cases/${c.id}#messages`}
                    className="text-teal-800 underline dark:text-teal-300"
                  >
                    {messageCount}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                </td>
                <td className="px-3 py-2 text-xs text-stone-600 dark:text-stone-400">
                  {c.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-stone-500 dark:text-stone-400">No cases yet.</p>
        ) : null}
      </div>
    </div>
  );
}
