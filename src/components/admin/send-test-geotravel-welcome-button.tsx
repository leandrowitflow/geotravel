"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_GEOTRAVEL_TEST_WELCOME_E164 } from "@/lib/geotravel/admin-test-welcome-booking";

export function SendTestGeotravelWelcomeButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function send() {
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/geotravel-bookings/test-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        channel?: string;
        destinationE164?: string;
      };
      if (!res.ok) {
        setMsg({
          tone: "err",
          text: [j.error, j.hint].filter(Boolean).join(" — ") || "Request failed",
        });
        return;
      }
      setMsg({
        tone: "ok",
        text: `Test welcome sent via ${j.channel ?? "?"} to ${j.destinationE164 ?? DEFAULT_GEOTRAVEL_TEST_WELCOME_E164}.`,
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-xs flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void send()}
        className="rounded border border-amber-600 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
        title={`Uses GEOTRAVEL_TEST_WELCOME_E164 or default ${DEFAULT_GEOTRAVEL_TEST_WELCOME_E164}`}
      >
        {pending ? "Sending…" : `Test welcome (${DEFAULT_GEOTRAVEL_TEST_WELCOME_E164})`}
      </button>
      {msg && (
        <span
          className={
            msg.tone === "ok"
              ? "text-[10px] text-emerald-700 dark:text-emerald-400"
              : "text-[10px] text-red-700 dark:text-red-400"
          }
          role="status"
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}
