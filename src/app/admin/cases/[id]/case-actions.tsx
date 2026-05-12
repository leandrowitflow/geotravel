"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function CaseActions({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "ok" | "err";
    text: string;
    hint?: string;
  } | null>(null);
  const [simBody, setSimBody] = useState("");
  const simRef = useRef<HTMLTextAreaElement>(null);

  async function run(action: string, extra?: Record<string, unknown>) {
    setPending(action);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setNotice({
          tone: "err",
          text: j.error ?? "Action failed",
          hint: typeof j.hint === "string" ? j.hint : undefined,
        });
        return;
      }
      setNotice({
        tone: "ok",
        text:
          action === "resend"
            ? "Reminder sent."
            : action === "force_sms"
              ? "Channel set to SMS."
              : action === "simulate_inbound"
                ? "Message simulated — AI reply stored."
                : "Saved.",
      });
      if (action === "simulate_inbound") setSimBody("");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function handleSimKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && simBody.trim()) {
      e.preventDefault();
      run("simulate_inbound", { body: simBody.trim() });
    }
  }

  return (
    <div className="space-y-3">
      {notice && (
        <p
          className={
            notice.tone === "ok"
              ? "text-sm text-emerald-700 dark:text-emerald-300"
              : "text-sm text-red-700 dark:text-red-300"
          }
          role="status"
        >
          {notice.text}
          {notice.hint && (
            <span className="mt-1 block text-xs text-stone-600 dark:text-stone-400">
              {notice.hint}
            </span>
          )}
        </p>
      )}

      {/* Simulate a customer message + get AI reply without real WhatsApp */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-800 dark:bg-teal-950/30">
        <p className="mb-2 text-xs font-medium text-teal-900 dark:text-teal-200">
          Simulate customer message
          <span className="ml-1 font-normal text-teal-700 dark:text-teal-400">
            — runs full AI pipeline locally, stores inbound + assistant reply
          </span>
        </p>
        <div className="flex gap-2">
          <textarea
            ref={simRef}
            rows={2}
            value={simBody}
            onChange={(e) => setSimBody(e.target.value)}
            onKeyDown={handleSimKeyDown}
            placeholder="Type a message as the customer… (Enter to send, Shift+Enter for newline)"
            disabled={pending !== null}
            className="flex-1 resize-none rounded-md border border-teal-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50 dark:border-teal-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder-stone-500"
          />
          <button
            type="button"
            disabled={pending !== null || !simBody.trim()}
            onClick={() => run("simulate_inbound", { body: simBody.trim() })}
            className="self-end rounded-md bg-teal-700 px-3 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-40"
          >
            {pending === "simulate_inbound" ? "…" : "Send"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("resend")}
          className="rounded-md bg-teal-800 px-3 py-1.5 text-sm text-white hover:bg-teal-900 disabled:opacity-50"
        >
          {pending === "resend" ? "…" : "Resend reminder"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("force_sms")}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
        >
          {pending === "force_sms" ? "…" : "Force SMS"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("retry_crm")}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
        >
          {pending === "retry_crm" ? "…" : "Retry CRM write"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("needs_human")}
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/40"
        >
          {pending === "needs_human" ? "…" : "Mark needs human"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("close_case")}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
        >
          {pending === "close_case" ? "…" : "Close case"}
        </button>
      </div>
    </div>
  );
}
