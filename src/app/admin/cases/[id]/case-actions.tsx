"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CaseActions({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function run(action: string) {
    setPending(action);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Action failed");
      } else {
        router.refresh();
      }
    } finally {
      setPending(null);
    }
  }

  return (
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
  );
}
