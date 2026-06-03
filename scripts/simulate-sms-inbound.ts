/**
 * Simulate inbound SMS (same path as Infobip webhook) for debugging.
 * Run: npx tsx scripts/simulate-sms-inbound.ts "your message here"
 */
import { config } from "dotenv";
import { smsTestToE164 } from "../src/lib/messaging/sms-test-destination";

config({ path: ".env.local" });
config();

async function main() {
  const body = process.argv.slice(2).join(" ").trim() || "Somos 4 pessoas";
  const from = smsTestToE164();

  const { processInboundMessaging } = await import(
    "../src/lib/orchestration/process-inbound-message"
  );

  console.log("Simulating inbound SMS from", from, "body:", body.slice(0, 80));
  const result = await processInboundMessaging({
    channel: "sms",
    fromE164: from,
    body,
    providerMessageId: `sim-${Date.now()}`,
  });

  if (!result.ok) {
    console.error("Pipeline failed:", result.error);
    if (result.error === "unknown_contact") {
      console.error(
        "No contact/case for this phone. Send SMS · welcome_1 from /admin/bookings first (pilot 966915976).",
      );
    }
    process.exit(1);
  }

  console.log("OK — check phone for outbound SMS and /admin/cases for new messages.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
