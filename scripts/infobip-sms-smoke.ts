/**
 * Send one SMS via Infobip (same path as WhatsApp→SMS fallback).
 * Run: npm run infobip:sms-smoke
 *
 * Destination is always +351966915976 (pilot test line).
 *
 * Requires in .env.local:
 *   INFOBIP_BASE_URL
 *   INFOBIP_API_KEY
 *   INFOBIP_SMS_SENDER  (e.g. 351923250271)
 */
import { config } from "dotenv";
import { SMS_TEST_TO_DIGITS, smsTestToE164 } from "../src/lib/messaging/sms-test-destination";

config({ path: ".env.local" });
config();

async function main() {
  const base = process.env.INFOBIP_BASE_URL?.trim();
  const key = process.env.INFOBIP_API_KEY?.trim();
  const { infobipSmsSender } = await import("../src/lib/messaging/infobip-config");
  const sender = infobipSmsSender();

  if (!base || !key || !sender) {
    console.error(
      "Missing Infobip config: INFOBIP_BASE_URL, INFOBIP_API_KEY, or INFOBIP_SMS_SENDER is missing/empty in process.env.",
    );
    console.error(
      "Save .env.local to disk (Cmd/Ctrl+S), confirm values appear after each = on disk, then restart `next dev`.",
    );
    process.exit(1);
  }

  const envTo =
    process.env.INFOBIP_TEST_TO_E164?.trim().replace(/^\+/, "") ||
    process.env.WHATSAPP_TEST_TO_E164?.trim().replace(/^\+/, "");
  if (envTo && envTo !== SMS_TEST_TO_DIGITS) {
    console.warn(
      `Ignoring INFOBIP_TEST_TO_E164/WHATSAPP_TEST_TO_E164=${envTo}; smoke sends only to ${SMS_TEST_TO_DIGITS}.`,
    );
  }

  const { sendInfobipSms } = await import("../src/lib/messaging/infobip-sms");
  const result = await sendInfobipSms({
    channel: "sms",
    toE164: smsTestToE164(),
    body: "Geotravel Infobip SMS smoke — you can delete this message.",
  });

  if (!result.ok) {
    console.error("Send failed:", result.error);
    process.exit(1);
  }

  console.log(
    `OK SMS sent to ${smsTestToE164()}. providerMessageId:`,
    result.providerMessageId,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
