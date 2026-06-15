"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { isBookingEligibleForWhatsAppConfirmation } from "@/lib/geotravel/geotravel-confirmation-message";
import {
  formatHoursUntilPickup,
  GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES,
  type GeotravelWhatsappLifecycleTemplate,
  selectBookingWhatsappTemplate,
} from "@/lib/geotravel/select-booking-whatsapp-template";

const TEMPLATE_LABELS: Record<GeotravelWhatsappLifecycleTemplate, string> = {
  welcome_1: "welcome_1",
  welcome_2: "welcome_2",
  data: "data",
  canceled: "canceled",
  satisfaction: "satisfaction",
};

type SendChannel = "whatsapp" | "sms";

export function SendGeotravelWhatsAppButton({
  booking,
  infobipSmsSenderLabel,
}: {
  booking: GeotravelBooking;
  /** From INFOBIP_SMS_SENDER on the server (e.g. +447860030523). */
  infobipSmsSenderLabel?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

  const autoSelection = useMemo(
    () => selectBookingWhatsappTemplate(booking),
    [booking],
  );

  if (!isBookingEligibleForWhatsAppConfirmation(booking)) {
    return null;
  }

  async function send(
    channel: SendChannel,
    templateOverride?: GeotravelWhatsappLifecycleTemplate,
  ) {
    const key = `${channel}:${templateOverride ?? "auto"}`;
    setPending(key);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/geotravel-bookings/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking,
          channel,
          ...(templateOverride ? { templateOverride } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        channel?: "whatsapp" | "sms";
        templateUsed?: boolean;
        templateName?: string;
        templatePhase?: string;
        templateSelectionReason?: string;
        hoursUntilPickup?: number | null;
        templateLanguageSent?: string;
        firstNameUsed?: string;
        whatsappFallbackToSms?: boolean;
        whatsappAttemptError?: string;
        whatsappRecoveryHint?: string;
        destinationE164?: string;
      };
      if (!res.ok) {
        setMsg({
          tone: "err",
          text: [j.error, j.hint].filter(Boolean).join(" — ") || "Request failed",
        });
        return;
      }
      const phase = j.templatePhase ?? templateOverride ?? "auto";
      const meta = j.templateName;
      const tplLabel =
        meta && phase !== "auto" && meta !== phase ? `${phase} → ${meta}` : meta ?? phase;
      const when = formatHoursUntilPickup(
        j.hoursUntilPickup ?? autoSelection.hoursUntilPickup,
      );
      const via = j.channel ?? channel;
      setMsg({
        tone: "ok",
        text: [
          `Sent ${tplLabel} (${j.templateLanguageSent ?? "en"}) via ${via} to ${j.destinationE164 ?? "?"}.`,
          j.templateSelectionReason ? `(${j.templateSelectionReason}, ${when})` : null,
          j.whatsappFallbackToSms && j.whatsappAttemptError
            ? `WhatsApp failed: ${j.whatsappAttemptError}`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function channelButtons(channel: SendChannel, labelPrefix: string) {
    const autoKey = `${channel}:auto`;
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void send(channel)}
          className={
            channel === "sms"
              ? "rounded border border-violet-600 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40"
              : "rounded border border-teal-600 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-900 hover:bg-teal-100 disabled:opacity-50 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100 dark:hover:bg-teal-900/40"
          }
          title={
            autoSelection.metaTemplateName === autoSelection.phase
              ? autoSelection.reason
              : `${autoSelection.reason} → Meta: ${autoSelection.metaTemplateName}`
          }
        >
          {pending === autoKey
            ? "Sending…"
            : `${labelPrefix} · ${autoSelection.phase} (${autoSelection.language})`}
        </button>
        <div className="flex flex-wrap gap-1">
          {GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES.map((t) => {
            const k = `${channel}:${t}`;
            return (
              <button
                key={k}
                type="button"
                disabled={pending !== null}
                onClick={() => void send(channel, t)}
                className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-700 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
                title={`Force ${t} via ${channel}`}
              >
                {pending === k ? "…" : TEMPLATE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[min(100%,300px)] flex-col gap-2">
      {channelButtons("whatsapp", "WhatsApp")}
      <p className="text-[10px] leading-snug text-stone-500 dark:text-stone-400">
        Auto: {autoSelection.reason} ({formatHoursUntilPickup(autoSelection.hoursUntilPickup)}).
      </p>
      {channelButtons("sms", "SMS")}
      <p className="text-[10px] leading-snug text-stone-500 dark:text-stone-400">
        {infobipSmsSenderLabel
          ? `SMS uses the same lifecycle text from ${infobipSmsSenderLabel} (Infobip).`
          : "SMS uses the same lifecycle text via Infobip. Set INFOBIP_BASE_URL, INFOBIP_API_KEY, and INFOBIP_SMS_SENDER in env."}
      </p>
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
