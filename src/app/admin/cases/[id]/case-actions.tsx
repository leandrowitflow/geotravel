"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CaseActions({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "ok" | "err";
    text: string;
    hint?: string;
  } | null>(null);

  async function run(action: string) {
    setPending(action);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
              : "Saved.",
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
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
