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
        channel?: "whatsapp" | "sms";
        templateUsed?: boolean;
        templateName?: string;
        templateLanguageSent?: string;
        firstNameUsed?: string;
        whatsappFallbackToSms?: boolean;
        whatsappAttemptError?: string;
        whatsappRecoveryHint?: string;
        destinationE164?: string;
        smsProviderMeta?: { destinationDigits?: string; status?: string };
      };
      if (!res.ok) {
        setMsg({
          tone: "err",
          text: [j.error, j.hint].filter(Boolean).join(" — ") || "Request failed",
        });
        return;
      }
      const via =
        j.channel === "sms"
          ? "SMS"
          : j.channel === "whatsapp"
            ? j.templateUsed
              ? "WhatsApp (Meta template)"
              : "WhatsApp"
            : "Message";
      const dest = j.destinationE164 ?? "";
      const ibTo = j.smsProviderMeta?.destinationDigits;
      const ibSt = j.smsProviderMeta?.status;
      const destDigits = dest.replace(/\D/g, "");
      const mismatch =
        j.channel === "sms" && ibTo && ibTo !== destDigits
          ? ` Infobip echoed ${ibTo} (expected ${destDigits}).`
          : "";
      const waFail =
        j.whatsappFallbackToSms && j.whatsappAttemptError
          ? ` WhatsApp failed: ${j.whatsappAttemptError}`
          : "";
      const recovery = j.whatsappRecoveryHint ? ` ${j.whatsappRecoveryHint}` : "";
      const namePreview =
        j.templateUsed && j.firstNameUsed != null
          ? ` first_name=${j.firstNameUsed}.`
          : "";
      setMsg({
        tone: "ok",
        text: [
          `Sent via ${via} to ${dest || "?"}.`,
          namePreview.trim() || null,
          j.channel === "sms" && ibSt ? `Provider: ${ibSt}.` : null,
          j.channel === "sms" ? mismatch.trim() || null : null,
          waFail.trim() || null,
          recovery.trim() || null,
          "Case updated.",
        ]
          .filter(Boolean)
          .join(" "),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-[min(100%,280px)] flex-col gap-1">
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
