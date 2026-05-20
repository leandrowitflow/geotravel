import type { MessageRow } from "@/db/schema";
import { formatMessageForConversation } from "@/lib/admin/whatsapp-template-display";

export function CaseConversationThread({
  messages,
  preferredLanguage,
}: {
  messages: MessageRow[];
  preferredLanguage?: string | null;
}) {
  if (messages.length === 0) {
    return (
      <p className="mt-4 text-sm text-stone-400 dark:text-stone-500">
        No messages yet.
      </p>
    );
  }

  return (
    <ol className="mt-4 space-y-1">
      {messages.map((m, i) => {
        const inbound = m.direction === "inbound";
        const display = formatMessageForConversation({
          direction: m.direction,
          body: m.body,
          metadata: m.metadata,
          preferredLanguage,
        });

        const prev = messages[i - 1];
        const showDateSep =
          !prev ||
          new Date(m.createdAt).toDateString() !==
            new Date(prev.createdAt).toDateString();
        const ts = m.createdAt.toISOString().slice(11, 16);
        const dateLabel = m.createdAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        return (
          <li key={m.id}>
            {showDateSep && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
                <span className="text-[11px] text-stone-400 dark:text-stone-500">
                  {dateLabel}
                </span>
                <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
              </div>
            )}
            <div
              className={`flex ${inbound ? "justify-start" : "justify-end"} mt-1.5`}
            >
              <div
                className={`max-w-[min(85%,36rem)] space-y-0.5 ${inbound ? "" : "items-end flex flex-col"}`}
              >
                {display.isWhatsappTemplate && display.templateLabel && (
                  <div className="flex justify-end">
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                      {display.templateLabel}
                      {display.templateLanguage === "pt_PT" ? " · PT" : ""}
                    </span>
                  </div>
                )}
                <div
                  className={
                    inbound
                      ? "rounded-2xl rounded-tl-sm bg-stone-100 px-3.5 py-2.5 text-sm text-stone-900 dark:bg-stone-800 dark:text-stone-100"
                      : display.isWhatsappTemplate
                        ? "rounded-2xl rounded-tr-sm border border-teal-600/30 bg-teal-700 px-3.5 py-2.5 text-sm text-white"
                        : "rounded-2xl rounded-tr-sm bg-teal-600 px-3.5 py-2.5 text-sm text-white"
                  }
                >
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {display.body}
                  </p>
                </div>
                <p
                  className={`text-[10px] text-stone-400 dark:text-stone-500 ${inbound ? "pl-1" : "pr-1"}`}
                >
                  {inbound ? "Customer" : "Geotravel"}
                  {display.isWhatsappTemplate ? " · WhatsApp template" : ""} ·{" "}
                  {ts} · {m.channel}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
