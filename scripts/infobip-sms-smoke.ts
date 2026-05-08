/**
 * Send one SMS via Infobip (same path as WhatsApp→SMS fallback).
 * Run: npm run infobip:sms-smoke
 *
 * Requires in .env.local:
 *   INFOBIP_BASE_URL
 *   INFOBIP_API_KEY
 *   INFOBIP_SMS_SENDER
 *   INFOBIP_TEST_TO_E164  (digits only, no +) — or falls back to WHATSAPP_TEST_TO_E164
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const toRaw =
    process.env.INFOBIP_TEST_TO_E164?.trim().replace(/^\+/, "") ||
    process.env.WHATSAPP_TEST_TO_E164?.trim().replace(/^\+/, "");
  const base = process.env.INFOBIP_BASE_URL?.trim();
  const key = process.env.INFOBIP_API_KEY?.trim();
  const sender = process.env.INFOBIP_SMS_SENDER?.trim();

  if (!base || !key || !sender) {
    console.error(
      "Missing Infobip config: INFOBIP_BASE_URL, INFOBIP_API_KEY, or INFOBIP_SMS_SENDER is missing/empty in process.env.",
    );
    console.error(
      "Save .env.local to disk (Cmd/Ctrl+S), confirm values appear after each = on disk, then restart `next dev`.",
    );
    process.exit(1);
  }
  if (!toRaw) {
    console.error(
      "Set INFOBIP_TEST_TO_E164 (or WHATSAPP_TEST_TO_E164) to digits-only destination.",
    );
    process.exit(1);
  }

  const { sendInfobipSms } = await import("../src/lib/messaging/infobip-sms");
  const result = await sendInfobipSms({
    channel: "sms",
    toE164: `+${toRaw}`,
    body: "Geotravel Infobip SMS smoke — you can delete this message.",
  });

  if (!result.ok) {
    console.error("Send failed:", result.error);
    process.exit(1);
  }

  console.log("OK SMS sent. providerMessageId:", result.providerMessageId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
