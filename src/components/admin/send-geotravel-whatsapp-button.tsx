"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { isBookingEligibleForWhatsAppConfirmation } from "@/lib/geotravel/geotravel-confirmation-message";

export function SendGeotravelWhatsAppButton({
  booking,
}: {
  booking: GeotravelBooking;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

  if (!isBookingEligibleForWhatsAppConfirmation(booking)) {
    return null;
  }

  async function send() {
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/geotravel-bookings/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        caseId?: string;
      };
      if (!res.ok) {
        setMsg({
          tone: "err",
          text: [j.error, j.hint].filter(Boolean).join(" — ") || "Request failed",
        });
        return;
      }
      setMsg({ tone: "ok", text: "WhatsApp sent. Case updated." });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-[140px] flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void send()}
        className="rounded border border-teal-600 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-900 hover:bg-teal-100 disabled:opacity-50 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100 dark:hover:bg-teal-900/40"
      >
        {pending ? "Sending…" : "WhatsApp confirm"}
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
