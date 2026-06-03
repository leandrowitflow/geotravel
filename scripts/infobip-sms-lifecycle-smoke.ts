/**
 * Send welcome_1 lifecycle body via Infobip (same text as WhatsApp template).
 * Run: npm run infobip:sms-lifecycle-smoke
 *
 * Destination is always +351966915976.
 */
import { config } from "dotenv";
import {
  buildLifecycleSmsBody,
  resolveLifecycleTemplateVariables,
} from "../src/lib/geotravel/build-lifecycle-sms-body";
import type { GeotravelBooking } from "../src/lib/geotravel/bookings-api";
import { infobipSmsSender } from "../src/lib/messaging/infobip-config";
import { sendInfobipSms } from "../src/lib/messaging/infobip-sms";
import { smsTestToE164 } from "../src/lib/messaging/sms-test-destination";

config({ path: ".env.local" });
config();

async function main() {
  const base = process.env.INFOBIP_BASE_URL?.trim();
  const key = process.env.INFOBIP_API_KEY?.trim();
  const sender = infobipSmsSender();

  if (!base || !key || !sender) {
    console.error("Missing INFOBIP_BASE_URL, INFOBIP_API_KEY, or INFOBIP_SMS_SENDER.");
    process.exit(1);
  }

  const smokeBooking = {
    id: 0,
    booking_reference: "SMS-SMOKE-1",
    plateform: "Booking.com",
    pickup_date_time: "2026-05-01T10:00:00.000Z",
    passenger_phone: "966915976",
    passenger_name: "Test Passenger",
  } as GeotravelBooking;

  const vars = resolveLifecycleTemplateVariables(
    smokeBooking,
    "welcome_1",
    "Test",
  );

  const body = buildLifecycleSmsBody({
    templateName: "welcome_1",
    languageCode: "pt_PT",
    templateVariables: vars,
  });

  if (!body) {
    console.error("Could not build welcome_1 SMS body.");
    process.exit(1);
  }

  console.log(`Body length: ${body.length} chars (will be sent as one SMS line).`);

  const result = await sendInfobipSms({
    channel: "sms",
    toE164: smsTestToE164(),
    body,
  });

  if (!result.ok) {
    console.error("Send failed:", result.error);
    process.exit(1);
  }

  const meta = result.smsProviderMeta;
  console.log(
    `OK welcome_1 SMS sent to ${smsTestToE164()}.`,
    `providerMessageId: ${result.providerMessageId}`,
    meta?.statusGroup ? `status=${meta.statusGroup}/${meta.statusName ?? ""}` : "",
    meta?.smsCount != null ? `parts=${meta.smsCount}` : "",
  );
  console.log("Check the phone in ~30s for the Portuguese welcome_1 message.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
